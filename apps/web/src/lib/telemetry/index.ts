/**
 * Telemetry service for OpenTelemetry configuration and initialization
 * Coordinates with Next.js OpenTelemetry setup via @vercel/otel
 */

import { getConfigurationServiceAsync } from "../config/service";
import { createContextLogger } from "../logging/factory";

export interface TelemetryConfig {
	isEnabled: boolean;
	endpoint: string;
	serviceName: string;
	serviceVersion: string;
	headers: Record<string, string>;
	timeout: number;
	samplingRatio: number;
	resourceAttributes: Record<string, string>;
}

export interface TelemetryService {
	getConfig(): Promise<TelemetryConfig>;
	isEnabled(): Promise<boolean>;
	initialize(): Promise<boolean>;
	shutdown(): Promise<void>;
}

/**
 * Implementation of the telemetry service
 */
class TelemetryServiceImpl implements TelemetryService {
	private logger: ReturnType<typeof createContextLogger> | null = null;
	private initialized = false;
	private config: TelemetryConfig | null = null;

	private getLogger() {
		if (!this.logger) {
			this.logger = createContextLogger("telemetry-service");
		}
		return this.logger;
	}

	/**
	 * Get the current telemetry configuration
	 */
	async getConfig(): Promise<TelemetryConfig> {
		if (!this.config) {
			this.config = await this.loadConfiguration();
		}
		return this.config;
	}

	/**
	 * Check if telemetry is enabled
	 */
	async isEnabled(): Promise<boolean> {
		const config = await this.getConfig();
		return config.isEnabled;
	}

	/**
	 * Initialize the telemetry service
	 */
	async initialize(): Promise<boolean> {
		if (this.initialized) {
			this.getLogger().debug("Telemetry service already initialized");
			return true;
		}

		try {
			const config = await this.getConfig();

			if (!config.isEnabled) {
				this.getLogger().info("Telemetry is disabled, skipping initialization");
				this.initialized = true;
				return true;
			}

			this.getLogger().info("Initializing telemetry service", {
				endpoint: config.endpoint,
				serviceName: config.serviceName,
				serviceVersion: config.serviceVersion,
				samplingRatio: config.samplingRatio,
			});

			// Validate configuration
			if (!this.validateConfiguration(config)) {
				this.getLogger().error("Telemetry configuration validation failed");
				return false;
			}

			// Test endpoint connectivity (optional)
			const isConnectable = await this.testEndpointConnectivity(config);
			if (!isConnectable) {
				this.getLogger().warn(
					"Telemetry endpoint is not reachable, continuing with degraded functionality",
				);
			}

			this.initialized = true;
			this.getLogger().info("Telemetry service initialized successfully");
			return true;
		} catch (error) {
			this.getLogger().error("Failed to initialize telemetry service", {
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}

	/**
	 * Shutdown the telemetry service
	 */
	async shutdown(): Promise<void> {
		if (!this.initialized) {
			return;
		}

		try {
			this.getLogger().info("Shutting down telemetry service");

			// In a real implementation, you would flush any pending telemetry data
			// and clean up resources here

			this.initialized = false;
			this.config = null;
			this.logger = null;

			console.log("Telemetry service shutdown complete");
		} catch (error) {
			console.error("Error during telemetry service shutdown", error);
		}
	}

	/**
	 * Load configuration from the configuration service
	 */
	private async loadConfiguration(): Promise<TelemetryConfig> {
		try {
			const configService = await getConfigurationServiceAsync();
			const telemetryConfig = await configService.getTelemetryConfig();
			const serverConfig = await configService.getServerConfig();

			return {
				isEnabled: telemetryConfig.isEnabled,
				endpoint: telemetryConfig.endpoint,
				serviceName: telemetryConfig.serviceName,
				serviceVersion: telemetryConfig.serviceVersion,
				headers: telemetryConfig.headers as Record<string, string>,
				timeout: telemetryConfig.timeout,
				samplingRatio: telemetryConfig.samplingRatio,
				resourceAttributes: {
					environment: serverConfig.environment,
					"service.name": telemetryConfig.serviceName,
					"service.version": telemetryConfig.serviceVersion,
					"service.instance.id": process.env.HOSTNAME || "unknown",
				} as Record<string, string>,
			};
		} catch (error) {
			console.error("Failed to load telemetry configuration", error);

			// Return a safe fallback configuration
			return {
				isEnabled: false,
				endpoint: "http://localhost:4318/v1/traces",
				serviceName: "solomon-codes-web",
				serviceVersion: "unknown",
				headers: {},
				timeout: 5000,
				samplingRatio: 1.0,
				resourceAttributes: {
					environment: process.env.NODE_ENV || "development",
					"service.name": "solomon-codes-web",
					"service.version": "unknown",
					"service.instance.id": process.env.HOSTNAME || "unknown",
				},
			};
		}
	}

	/**
	 * Validate the telemetry configuration
	 */
	private validateConfiguration(config: TelemetryConfig): boolean {
		const errors: string[] = [];

		if (!config.endpoint) {
			errors.push("Telemetry endpoint is required");
		}

		if (!config.serviceName) {
			errors.push("Service name is required");
		}

		if (!config.serviceVersion) {
			errors.push("Service version is required");
		}

		if (config.samplingRatio < 0 || config.samplingRatio > 1) {
			errors.push("Sampling ratio must be between 0 and 1");
		}

		if (config.timeout < 1000) {
			errors.push("Timeout must be at least 1000ms");
		}

		if (errors.length > 0) {
			this.getLogger().error("Telemetry configuration validation failed", {
				errors,
			});
			return false;
		}

		return true;
	}

	/**
	 * Test connectivity to the telemetry endpoint
	 */
	private async testEndpointConnectivity(
		config: TelemetryConfig,
	): Promise<boolean> {
		try {
			// Extract the base URL for health checking
			const url = new URL(config.endpoint);
			const healthCheckUrl = `${url.protocol}//${url.host}/health`;

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), config.timeout);

			const response = await fetch(healthCheckUrl, {
				method: "GET",
				headers: {
					...config.headers,
					"User-Agent": `${config.serviceName}/${config.serviceVersion}`,
				},
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			return response.ok;
		} catch (error) {
			this.getLogger().debug("Telemetry endpoint connectivity test failed", {
				endpoint: config.endpoint,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}
}

/**
 * Global telemetry service instance
 */
let _telemetryService: TelemetryService | null = null;

/**
 * Get the global telemetry service instance
 */
export function getTelemetryService(): TelemetryService {
	if (!_telemetryService) {
		_telemetryService = new TelemetryServiceImpl();
	}
	return _telemetryService;
}

/**
 * Initialize the telemetry service
 * Should be called at application startup
 * Coordinates with Next.js OpenTelemetry setup
 */
export async function initializeTelemetry(): Promise<boolean> {
	const logger = createContextLogger("telemetry-init");

	try {
		logger.info("Initializing telemetry service...");

		const service = getTelemetryService();
		const success = await service.initialize();

		if (success) {
			logger.info("Telemetry service initialized successfully");
			console.log("📊 Telemetry service initialized successfully");
		} else {
			logger.warn(
				"Telemetry service initialization failed, continuing without telemetry",
			);
			console.warn(
				"⚠️ Telemetry service initialization failed, continuing without telemetry",
			);
		}

		return success;
	} catch (error) {
		logger.error("Failed to initialize telemetry service", {
			error: error instanceof Error ? error.message : String(error),
		});
		console.error("❌ Failed to initialize telemetry service:", error);
		return false;
	}
}

/**
 * Shutdown the telemetry service
 * Should be called during application shutdown
 */
export async function shutdownTelemetry(): Promise<void> {
	const logger = createContextLogger("telemetry-shutdown");

	try {
		if (_telemetryService) {
			logger.info("Shutting down telemetry service...");
			await _telemetryService.shutdown();
			_telemetryService = null;
			logger.info("Telemetry service shutdown complete");
		}
	} catch (error) {
		logger.error("Error during telemetry shutdown", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Reset the telemetry service (primarily for testing)
 */
export function resetTelemetryService(): void {
	_telemetryService = null;
}

/**
 * Get telemetry configuration for external use
 */
export async function getTelemetryConfig(): Promise<TelemetryConfig> {
	return await getTelemetryService().getConfig();
}

/**
 * Check if telemetry is enabled
 */
export async function isTelemetryEnabled(): Promise<boolean> {
	return await getTelemetryService().isEnabled();
}
