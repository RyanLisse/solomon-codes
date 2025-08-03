import { closeDatabaseConnections } from "../database/connection";
import { createContextLogger } from "../logging/factory";
import { shutdownTelemetry } from "../telemetry";

export interface ShutdownHandler {
	name: string;
	priority: number; // Lower number = higher priority (executes first)
	handler: () => Promise<void>;
	timeout?: number; // Max time to wait for this handler (ms)
}

export interface ShutdownMetrics {
	startTime: number;
	endTime?: number;
	duration?: number;
	handlersExecuted: Array<{
		name: string;
		startTime: number;
		endTime: number;
		duration: number;
		success: boolean;
		error?: string;
	}>;
	signal?: string;
	forced: boolean;
}

/**
 * Graceful shutdown service for handling application termination
 */
export class GracefulShutdownService {
	private logger = createContextLogger("graceful-shutdown");
	private handlers: ShutdownHandler[] = [];
	private isShuttingDown = false;
	private shutdownPromise: Promise<void> | null = null;
	private metrics: ShutdownMetrics = {
		startTime: 0,
		handlersExecuted: [],
		forced: false,
	};

	constructor() {
		this.registerDefaultHandlers();
		this.setupSignalHandlers();
	}

	/**
	 * Register a shutdown handler
	 */
	registerHandler(handler: ShutdownHandler): void {
		if (this.isShuttingDown) {
			this.logger.warn("Cannot register handler during shutdown", {
				handlerName: handler.name,
			});
			return;
		}

		this.handlers.push(handler);
		this.handlers.sort((a, b) => a.priority - b.priority);

		this.logger.debug("Shutdown handler registered", {
			name: handler.name,
			priority: handler.priority,
			totalHandlers: this.handlers.length,
		});
	}

	/**
	 * Unregister a shutdown handler
	 */
	unregisterHandler(name: string): void {
		const index = this.handlers.findIndex((h) => h.name === name);
		if (index !== -1) {
			this.handlers.splice(index, 1);
			this.logger.debug("Shutdown handler unregistered", {
				name,
				remainingHandlers: this.handlers.length,
			});
		}
	}

	/**
	 * Initiate graceful shutdown
	 */
	async shutdown(signal?: string, timeout = 30000): Promise<void> {
		if (this.isShuttingDown) {
			this.logger.info("Shutdown already in progress, waiting for completion");
			return this.shutdownPromise || Promise.resolve();
		}

		this.isShuttingDown = true;
		this.metrics.startTime = Date.now();
		this.metrics.signal = signal;

		this.logger.info("Initiating graceful shutdown", {
			signal,
			timeout,
			handlerCount: this.handlers.length,
		});

		// Still use console for critical shutdown messages to ensure visibility
		console.log(
			`🛑 Initiating graceful shutdown (signal: ${signal || "manual"})`,
		);

		this.shutdownPromise = this.executeShutdown(timeout);
		return this.shutdownPromise;
	}

	/**
	 * Force immediate shutdown
	 */
	forceShutdown(exitCode = 1): never {
		this.metrics.forced = true;
		this.metrics.endTime = Date.now();
		this.metrics.duration = this.metrics.endTime - this.metrics.startTime;

		this.logger.error("Forcing immediate shutdown", {
			exitCode,
			metrics: this.metrics,
		});

		console.error(
			"💥 Forcing immediate shutdown due to timeout or critical error",
		);
		process.exit(exitCode);
	}

	/**
	 * Get shutdown metrics
	 */
	getMetrics(): ShutdownMetrics {
		return { ...this.metrics };
	}

	/**
	 * Check if shutdown is in progress
	 */
	isShutdownInProgress(): boolean {
		return this.isShuttingDown;
	}

	/**
	 * Execute the shutdown sequence
	 */
	private async executeShutdown(timeout: number): Promise<void> {
		const overallTimeout = setTimeout(() => {
			this.logger.error("Shutdown timeout reached, forcing exit", {
				timeout,
				executedHandlers: this.metrics.handlersExecuted.length,
				totalHandlers: this.handlers.length,
			});
			this.forceShutdown(1);
		}, timeout);

		try {
			for (const handler of this.handlers) {
				await this.executeHandler(handler);
			}

			this.metrics.endTime = Date.now();
			this.metrics.duration = this.metrics.endTime - this.metrics.startTime;

			this.logger.info("Graceful shutdown completed successfully", {
				duration: this.metrics.duration,
				handlersExecuted: this.metrics.handlersExecuted.length,
			});

			console.log(
				`✅ Graceful shutdown completed in ${this.metrics.duration}ms`,
			);

			clearTimeout(overallTimeout);
			process.exit(0);
		} catch (error) {
			this.logger.error("Error during shutdown sequence", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			clearTimeout(overallTimeout);
			this.forceShutdown(1);
		}
	}

	/**
	 * Execute a single shutdown handler
	 */
	private async executeHandler(handler: ShutdownHandler): Promise<void> {
		const startTime = Date.now();

		this.logger.info("Executing shutdown handler", {
			name: handler.name,
			priority: handler.priority,
			timeout: handler.timeout,
		});

		try {
			if (handler.timeout) {
				// Execute with timeout
				await Promise.race([
					handler.handler(),
					new Promise((_, reject) =>
						setTimeout(
							() => reject(new Error("Handler timeout")),
							handler.timeout,
						),
					),
				]);
			} else {
				// Execute without timeout
				await handler.handler();
			}

			const endTime = Date.now();
			this.metrics.handlersExecuted.push({
				name: handler.name,
				startTime,
				endTime,
				duration: endTime - startTime,
				success: true,
			});

			this.logger.info("Shutdown handler completed successfully", {
				name: handler.name,
				duration: endTime - startTime,
			});
		} catch (error) {
			const endTime = Date.now();
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			this.metrics.handlersExecuted.push({
				name: handler.name,
				startTime,
				endTime,
				duration: endTime - startTime,
				success: false,
				error: errorMessage,
			});

			this.logger.error("Shutdown handler failed", {
				name: handler.name,
				error: errorMessage,
				duration: endTime - startTime,
			});

			// Continue with other handlers even if one fails
		}
	}

	/**
	 * Register default system shutdown handlers
	 */
	private registerDefaultHandlers(): void {
		// Stop accepting new connections (highest priority)
		this.registerHandler({
			name: "stop-accepting-connections",
			priority: 1,
			handler: async () => {
				this.logger.info("Stopping acceptance of new connections");
				// In a real HTTP server, this would stop accepting new connections
				// For Next.js, this is handled by the framework
			},
			timeout: 1000,
		});

		// Close database connections
		this.registerHandler({
			name: "close-database-connections",
			priority: 2,
			handler: async () => {
				this.logger.info("Closing database connections");
				await closeDatabaseConnections();
			},
			timeout: 5000,
		});

		// Shutdown telemetry service
		this.registerHandler({
			name: "shutdown-telemetry",
			priority: 3,
			handler: async () => {
				this.logger.info("Shutting down telemetry service");
				await shutdownTelemetry();
			},
			timeout: 3000,
		});

		// Flush logs (lowest priority)
		this.registerHandler({
			name: "flush-logs",
			priority: 10,
			handler: async () => {
				this.logger.info("Flushing remaining logs");
				// Give time for log flushing
				await new Promise((resolve) => setTimeout(resolve, 100));
			},
			timeout: 2000,
		});
	}

	/**
	 * Setup signal handlers for graceful shutdown
	 */
	private setupSignalHandlers(): void {
		// Handle SIGTERM (Kubernetes, Docker, etc.)
		process.on("SIGTERM", () => {
			this.logger.info("Received SIGTERM signal");
			this.shutdown("SIGTERM", 30000).catch((error) => {
				this.logger.error("Error during SIGTERM shutdown", { error });
				this.forceShutdown(1);
			});
		});

		// Handle SIGINT (Ctrl+C)
		process.on("SIGINT", () => {
			this.logger.info("Received SIGINT signal");
			this.shutdown("SIGINT", 15000).catch((error) => {
				this.logger.error("Error during SIGINT shutdown", { error });
				this.forceShutdown(1);
			});
		});

		// Handle uncaught exceptions
		process.on("uncaughtException", (error) => {
			this.logger.error("Uncaught exception, initiating emergency shutdown", {
				error: error.message,
				stack: error.stack,
			});
			console.error("💥 Uncaught exception:", error);
			this.forceShutdown(1);
		});

		// Handle unhandled promise rejections
		process.on("unhandledRejection", (reason, _promise) => {
			this.logger.error(
				"Unhandled promise rejection, initiating emergency shutdown",
				{
					reason: reason instanceof Error ? reason.message : String(reason),
					stack: reason instanceof Error ? reason.stack : undefined,
				},
			);
			console.error("💥 Unhandled promise rejection:", reason);
			this.forceShutdown(1);
		});

		this.logger.info("Signal handlers registered for graceful shutdown");
	}
}

/**
 * Global graceful shutdown service instance
 */
let _shutdownService: GracefulShutdownService | null = null;

/**
 * Get the global graceful shutdown service
 */
export function getGracefulShutdownService(): GracefulShutdownService {
	if (!_shutdownService) {
		_shutdownService = new GracefulShutdownService();
	}
	return _shutdownService;
}

/**
 * Register a shutdown handler
 */
export function registerShutdownHandler(handler: ShutdownHandler): void {
	getGracefulShutdownService().registerHandler(handler);
}

/**
 * Initiate graceful shutdown
 */
export async function initiateGracefulShutdown(
	signal?: string,
	timeout = 30000,
): Promise<void> {
	return getGracefulShutdownService().shutdown(signal, timeout);
}

/**
 * Reset shutdown service (for testing)
 */
export function resetGracefulShutdownService(): void {
	_shutdownService = null;
}
