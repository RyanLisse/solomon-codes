/**
 * Tool Adapter Framework for LangGraph Integration
 * Provides unified interface for external tool integration with error resilience
 */

import { z } from "zod";
import type { ToolIntegrationState } from "../state/unified-state";

// Base adapter interface
export interface ToolAdapter<TConfig = unknown, TResult = unknown> {
	readonly name: string;
	readonly version: string;
	readonly isEnabled: boolean;

	initialize(config: TConfig): Promise<void>;
	isHealthy(): Promise<boolean>;
	execute(input: unknown): Promise<TResult>;
	shutdown(): Promise<void>;
	getStatus(): AdapterStatus;
}

// Adapter status tracking
export interface AdapterStatus {
	status: "inactive" | "initializing" | "healthy" | "degraded" | "error";
	lastHealthCheck: string;
	errorCount: number;
	lastError?: string;
	metadata?: Record<string, unknown>;
}

// Base adapter configuration
export const AdapterConfigSchema = z.object({
	retryAttempts: z.number().min(0).default(3),
	retryDelayMs: z.number().min(100).default(1000),
	healthCheckIntervalMs: z.number().min(1000).default(30000),
	timeoutMs: z.number().min(1000).default(10000),
	circuitBreakerThreshold: z.number().min(1).default(5),
	enabled: z.boolean().default(true),
});

export type AdapterConfig = z.infer<typeof AdapterConfigSchema>;

// Abstract base adapter with common functionality
export abstract class BaseAdapter<
	TConfig extends AdapterConfig,
	TResult = unknown,
> implements ToolAdapter<TConfig, TResult>
{
	public readonly name: string;
	public readonly version: string;

	protected config: TConfig;
	protected status: AdapterStatus;
	protected healthCheckTimer?: NodeJS.Timeout;
	protected circuitBreakerCount = 0;

	constructor(name: string, version: string) {
		this.name = name;
		this.version = version;
		this.status = {
			status: "inactive",
			lastHealthCheck: new Date().toISOString(),
			errorCount: 0,
		};
	}

	get isEnabled(): boolean {
		return this.config?.enabled && this.status.status !== "error";
	}

	async initialize(config: TConfig): Promise<void> {
		this.config = config;
		this.status.status = "initializing";

		try {
			await this.onInitialize();
			this.status.status = "healthy";
			this.circuitBreakerCount = 0;

			// Start health check monitoring
			if (this.config.healthCheckIntervalMs > 0) {
				this.startHealthChecking();
			}
		} catch (error) {
			this.status.status = "error";
			this.status.lastError =
				error instanceof Error ? error.message : String(error);
			this.status.errorCount++;
			throw error;
		}
	}

	async isHealthy(): Promise<boolean> {
		try {
			const healthy = await this.onHealthCheck();
			this.status.lastHealthCheck = new Date().toISOString();

			if (healthy && this.status.status === "degraded") {
				this.status.status = "healthy";
				this.circuitBreakerCount = 0;
			}

			return healthy;
		} catch (error) {
			this.handleError(error);
			return false;
		}
	}

	async execute(input: unknown): Promise<TResult> {
		if (!this.isEnabled || this.status.status === "error") {
			throw new Error(
				`Adapter ${this.name} is not available (status: ${this.status.status})`,
			);
		}

		// Circuit breaker pattern
		if (this.circuitBreakerCount >= this.config.circuitBreakerThreshold) {
			throw new Error(
				`Circuit breaker open for ${this.name} (${this.circuitBreakerCount} failures)`,
			);
		}

		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
			try {
				const result = await this.executeWithTimeout(input);

				// Reset circuit breaker on success
				if (this.circuitBreakerCount > 0) {
					this.circuitBreakerCount = Math.max(0, this.circuitBreakerCount - 1);
				}

				return result;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				this.handleError(lastError);

				// Wait before retry (exponential backoff)
				if (attempt < this.config.retryAttempts) {
					const delay = this.config.retryDelayMs * 2 ** attempt;
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw (
			lastError ||
			new Error(
				`Failed to execute ${this.name} after ${this.config.retryAttempts} attempts`,
			)
		);
	}

	async shutdown(): Promise<void> {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = undefined;
		}

		try {
			await this.onShutdown();
		} finally {
			this.status.status = "inactive";
		}
	}

	getStatus(): AdapterStatus {
		return { ...this.status };
	}

	// Abstract methods to be implemented by concrete adapters
	protected abstract onInitialize(): Promise<void>;
	protected abstract onHealthCheck(): Promise<boolean>;
	protected abstract onExecute(input: unknown): Promise<TResult>;
	protected abstract onShutdown(): Promise<void>;

	private async executeWithTimeout(input: unknown): Promise<TResult> {
		return new Promise<TResult>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Execution timeout after ${this.config.timeoutMs}ms`));
			}, this.config.timeoutMs);

			this.onExecute(input)
				.then((result) => {
					clearTimeout(timeout);
					resolve(result);
				})
				.catch((error) => {
					clearTimeout(timeout);
					reject(error);
				});
		});
	}

	private startHealthChecking(): void {
		this.healthCheckTimer = setInterval(async () => {
			try {
				const healthy = await this.isHealthy();
				if (!healthy && this.status.status === "healthy") {
					this.status.status = "degraded";
				}
			} catch (error) {
				// Health check failures are already handled in isHealthy()
			}
		}, this.config.healthCheckIntervalMs);
	}

	private handleError(error: unknown): void {
		this.status.errorCount++;
		this.circuitBreakerCount++;
		this.status.lastError =
			error instanceof Error ? error.message : String(error);

		if (this.circuitBreakerCount >= this.config.circuitBreakerThreshold) {
			this.status.status = "error";
		} else {
			this.status.status = "degraded";
		}
	}
}

// Adapter Registry for managing multiple adapters
export class AdapterRegistry {
	private adapters = new Map<string, ToolAdapter>();
	private listeners = new Set<(event: AdapterEvent) => void>();

	register<T extends ToolAdapter>(adapter: T): void {
		this.adapters.set(adapter.name, adapter);
		this.emit({
			type: "registered",
			adapterName: adapter.name,
			timestamp: new Date().toISOString(),
		});
	}

	unregister(adapterName: string): boolean {
		const removed = this.adapters.delete(adapterName);
		if (removed) {
			this.emit({
				type: "unregistered",
				adapterName,
				timestamp: new Date().toISOString(),
			});
		}
		return removed;
	}

	get<T extends ToolAdapter = ToolAdapter>(adapterName: string): T | undefined {
		return this.adapters.get(adapterName) as T | undefined;
	}

	getAll(): ToolAdapter[] {
		return Array.from(this.adapters.values());
	}

	async initializeAll(configs: Record<string, unknown>): Promise<void> {
		const results = await Promise.allSettled(
			Array.from(this.adapters.values()).map(async (adapter) => {
				const config = configs[adapter.name];
				if (config) {
					await adapter.initialize(config);
				}
			}),
		);

		// Report initialization failures
		results.forEach((result, index) => {
			const adapter = Array.from(this.adapters.values())[index];
			if (result.status === "rejected") {
				this.emit({
					type: "error",
					adapterName: adapter.name,
					timestamp: new Date().toISOString(),
					error: result.reason,
				});
			}
		});
	}

	async shutdownAll(): Promise<void> {
		await Promise.allSettled(
			Array.from(this.adapters.values()).map((adapter) => adapter.shutdown()),
		);

		this.emit({
			type: "shutdown",
			adapterName: "all",
			timestamp: new Date().toISOString(),
		});
	}

	async getHealthStatus(): Promise<Record<string, AdapterStatus>> {
		const status: Record<string, AdapterStatus> = {};

		for (const [name, adapter] of this.adapters) {
			status[name] = adapter.getStatus();
		}

		return status;
	}

	onEvent(listener: (event: AdapterEvent) => void): void {
		this.listeners.add(listener);
	}

	offEvent(listener: (event: AdapterEvent) => void): void {
		this.listeners.delete(listener);
	}

	private emit(event: AdapterEvent): void {
		this.listeners.forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				console.error("Error in adapter event listener:", error);
			}
		});
	}
}

// Event system for adapter lifecycle
export interface AdapterEvent {
	type: "registered" | "unregistered" | "error" | "shutdown";
	adapterName: string;
	timestamp: string;
	error?: unknown;
}

// Global registry instance
export const globalAdapterRegistry = new AdapterRegistry();

// Utility functions for state integration
export function createToolIntegrationState(): ToolIntegrationState {
	return {
		vibeTunnel: {
			connections: [],
			isEnabled: false,
		},
		agentInbox: {
			messageQueues: {},
			broadcastMessages: [],
			isEnabled: false,
		},
		voiceSystem: {
			isListening: false,
			isSpeaking: false,
			speechQueue: [],
			isEnabled: false,
		},
		vibeKitSandbox: {
			sandboxes: [],
			isEnabled: false,
		},
	};
}

export function updateToolIntegrationStatus(
	state: ToolIntegrationState,
	toolName: keyof ToolIntegrationState,
	updates: Partial<
		NonNullable<ToolIntegrationState[keyof ToolIntegrationState]>
	>,
): ToolIntegrationState {
	return {
		...state,
		[toolName]: {
			...state[toolName],
			...updates,
		},
	};
}
