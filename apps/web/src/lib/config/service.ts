import { createClientLogger } from "../logging/client";
import { safeProcessExit } from "../utils/runtime";
import { type AppConfig, getConfig } from "./index";
import { printValidationResults, validateEnvironment } from "./validation";

/**
 * Environment profile definitions
 */
export interface EnvironmentProfile {
	name: string;
	description: string;
	features: {
		enableDebugTools: boolean;
		enableMockData: boolean;
		enableDetailedLogging: boolean;
		requireSecureEndpoints: boolean;
		enableTelemetry: boolean;
	};
	defaults: Partial<AppConfig>;
}

/**
 * Predefined environment profiles
 */
export const ENVIRONMENT_PROFILES: Record<string, EnvironmentProfile> = {
	development: {
		name: "development",
		description: "Local development environment with debug tools enabled",
		features: {
			enableDebugTools: true,
			enableMockData: true,
			enableDetailedLogging: true,
			requireSecureEndpoints: false,
			enableTelemetry: false,
		},
		defaults: {
			logLevel: "debug",
			otelSamplingRatio: 0.1,
			otelEndpoint: "http://localhost:4318/v1/traces",
			otelTimeout: 5000,
		},
	},
	staging: {
		name: "staging",
		description: "Staging environment for testing production-like behavior",
		features: {
			enableDebugTools: true,
			enableMockData: false,
			enableDetailedLogging: true,
			requireSecureEndpoints: true,
			enableTelemetry: true,
		},
		defaults: {
			logLevel: "info",
			otelSamplingRatio: 0.5,
			otelTimeout: 5000,
		},
	},
	production: {
		name: "production",
		description:
			"Production environment with security and performance optimizations",
		features: {
			enableDebugTools: false,
			enableMockData: false,
			enableDetailedLogging: false,
			requireSecureEndpoints: true,
			enableTelemetry: true,
		},
		defaults: {
			logLevel: "warn",
			otelSamplingRatio: 0.1,
			otelTimeout: 10000,
		},
	},
};

/**
 * Configuration service for managing environment-specific settings
 */
export class ConfigurationService {
	private config: AppConfig | null = null;
	private profile: EnvironmentProfile | null = null;
	private logger: ReturnType<typeof createClientLogger> | null = null;
	private initPromise: Promise<void> | null = null;

	constructor() {
		// Initialize asynchronously to avoid sync config loading issues
		this.initPromise = this.initialize();
	}

	private async initialize(): Promise<void> {
		try {
			this.config = await getConfig();
			this.profile = this.getEnvironmentProfile();
		} catch (error) {
			console.error("Failed to initialize configuration service:", error);
			throw error;
		}
	}

	async waitForInitialization(): Promise<void> {
		if (this.initPromise) {
			await this.initPromise;
		}
	}

	private getLogger() {
		if (!this.logger) {
			this.logger = createClientLogger("configuration-service");
		}
		return this.logger;
	}

	/**
	 * Get the current configuration
	 */
	async getConfiguration(): Promise<AppConfig> {
		await this.waitForInitialization();
		if (!this.config) {
			throw new Error("Configuration not loaded");
		}
		return this.config;
	}

	/**
	 * Get the current configuration synchronously (throws if not initialized)
	 */
	getConfigurationSync(): AppConfig {
		if (!this.config) {
			throw new Error(
				"Configuration not loaded. Ensure ConfigurationService is initialized.",
			);
		}
		return this.config;
	}

	/**
	 * Get the current environment profile
	 */
	async getProfile(): Promise<EnvironmentProfile> {
		await this.waitForInitialization();
		if (!this.profile) {
			throw new Error("Environment profile not loaded");
		}
		return this.profile;
	}

	/**
	 * Get environment profile based on NODE_ENV
	 */
	private getEnvironmentProfile(): EnvironmentProfile {
		if (!this.config) {
			return ENVIRONMENT_PROFILES.development; // Safe fallback
		}
		const env = this.config.nodeEnv;
		return ENVIRONMENT_PROFILES[env] || ENVIRONMENT_PROFILES.development;
	}

	/**
	 * Check if a feature is enabled in the current environment
	 */
	async isFeatureEnabled(
		feature: keyof EnvironmentProfile["features"],
	): Promise<boolean> {
		await this.waitForInitialization();
		if (!this.profile) {
			return false;
		}
		return this.profile.features[feature];
	}

	/**
	 * Get environment-specific configuration value
	 */
	async getEnvironmentValue<K extends keyof AppConfig>(
		key: K,
		fallback?: AppConfig[K],
	): Promise<AppConfig[K]> {
		await this.waitForInitialization();

		if (!this.config || !this.profile) {
			if (fallback !== undefined) {
				return fallback;
			}
			throw new Error("Configuration not initialized");
		}

		const configValue = this.config[key];
		const profileDefault = this.profile.defaults[key] as AppConfig[K];

		const result = configValue ?? profileDefault ?? fallback;
		if (result === undefined) {
			throw new Error(
				`Configuration value for '${String(key)}' is undefined and no fallback provided`,
			);
		}
		return result;
	}

	/**
	 * Validate configuration for the current environment
	 */
	validateConfiguration(): boolean {
		const validationResult = validateEnvironment();

		if (!validationResult.success) {
			this.getLogger().error("Configuration validation failed", {
				environment: this.config.nodeEnv,
				errors: validationResult.errors,
				warnings: validationResult.warnings,
			});
			printValidationResults(validationResult);
			return false;
		}

		if (validationResult.warnings.length > 0) {
			this.getLogger().warn(
				"Configuration validation completed with warnings",
				{
					environment: this.config.nodeEnv,
					warnings: validationResult.warnings,
				},
			);
			printValidationResults(validationResult);
		}

		return true;
	}

	/**
	 * Get database configuration if available
	 */
	async getDatabaseConfig(): Promise<{ url?: string; isConfigured: boolean }> {
		await this.waitForInitialization();
		if (!this.config) {
			return { isConfigured: false };
		}
		return {
			url: this.config.databaseUrl,
			isConfigured: Boolean(this.config.databaseUrl),
		};
	}

	/**
	 * Get telemetry configuration
	 */
	async getTelemetryConfig() {
		await this.waitForInitialization();

		if (!this.config || !this.profile) {
			return {
				isEnabled: false,
				endpoint: "http://localhost:4318/v1/traces",
				headers: {},
				samplingRatio: 1.0,
				timeout: 30000,
				serviceName: "unknown",
				serviceVersion: "unknown",
			};
		}

		const isEnabled = await this.isFeatureEnabled("enableTelemetry");
		const endpoint = await this.getEnvironmentValue("otelEndpoint");
		const timeout = await this.getEnvironmentValue("otelTimeout");

		return {
			isEnabled: isEnabled && Boolean(endpoint),
			endpoint:
				endpoint ||
				this.profile.defaults.otelEndpoint ||
				"http://localhost:4318/v1/traces",
			headers: this.config.otelHeaders,
			samplingRatio: this.config.otelSamplingRatio,
			timeout,
			serviceName: this.config.serviceName,
			serviceVersion: this.config.appVersion,
		};
	}

	/**
	 * Get logging configuration
	 */
	async getLoggingConfig() {
		await this.waitForInitialization();
		if (!this.config || !this.profile) {
			return {
				level: "info" as const,
				enableConsole: true,
				enableFile: false,
				enableOpenTelemetry: false,
				filePath: undefined,
				serviceName: "unknown",
				enableDetailedLogging: false,
			};
		}
		return {
			level: this.config.logLevel,
			enableConsole: true,
			enableFile: Boolean(this.config.logFilePath),
			enableOpenTelemetry: await this.isFeatureEnabled("enableTelemetry"),
			filePath: this.config.logFilePath,
			serviceName: this.config.serviceName,
			enableDetailedLogging: await this.isFeatureEnabled(
				"enableDetailedLogging",
			),
		};
	}

	/**
	 * Get API configuration
	 */
	async getApiConfig() {
		await this.waitForInitialization();
		if (!this.config) {
			return {
				openai: {
					apiKey: undefined,
					isConfigured: false,
				},
				browserbase: {
					apiKey: undefined,
					projectId: undefined,
					isConfigured: false,
				},
				e2b: {
					apiKey: undefined,
					isConfigured: false,
				},
			};
		}
		return {
			openai: {
				apiKey: this.config.openaiApiKey,
				isConfigured: Boolean(this.config.openaiApiKey),
			},
			browserbase: {
				apiKey: this.config.browserbaseApiKey,
				projectId: this.config.browserbaseProjectId,
				isConfigured: Boolean(
					this.config.browserbaseApiKey && this.config.browserbaseProjectId,
				),
			},
			e2b: {
				apiKey: this.config.e2bApiKey,
				isConfigured: Boolean(this.config.e2bApiKey),
			},
		};
	}

	/**
	 * Get server configuration
	 */
	async getServerConfig() {
		await this.waitForInitialization();
		if (!this.config) {
			return {
				url: "http://localhost:3001",
				port: 3001,
				environment: "development",
				version: "unknown",
			};
		}
		return {
			url: this.config.serverUrl,
			port: this.config.port,
			environment: this.config.nodeEnv,
			version: this.config.appVersion,
		};
	}

	/**
	 * Check if running in development mode
	 */
	async isDevelopment(): Promise<boolean> {
		await this.waitForInitialization();
		return this.config?.nodeEnv === "development";
	}

	/**
	 * Check if running in staging mode
	 */
	async isStaging(): Promise<boolean> {
		await this.waitForInitialization();
		return this.config?.nodeEnv === "staging";
	}

	/**
	 * Check if running in production mode
	 */
	async isProduction(): Promise<boolean> {
		await this.waitForInitialization();
		return this.config?.nodeEnv === "production";
	}

	/**
	 * Get environment information for debugging
	 */
	async getEnvironmentInfo() {
		await this.waitForInitialization();
		if (!this.config || !this.profile) {
			return {
				environment: "development" as const,
				profile: "development",
				description: "Unknown environment",
				features: ENVIRONMENT_PROFILES.development.features,
				version: "unknown",
				serviceName: "unknown",
			};
		}
		return {
			environment: this.config.nodeEnv,
			profile: this.profile.name,
			description: this.profile.description,
			features: this.profile.features,
			version: this.config.appVersion,
			serviceName: this.config.serviceName,
		};
	}
}

/**
 * Global configuration service instance
 */
let _configService: ConfigurationService | null = null;

/**
 * Get the global configuration service instance
 */
export function getConfigurationService(): ConfigurationService {
	if (!_configService) {
		_configService = new ConfigurationService();
	}
	return _configService;
}

/**
 * Get the global configuration service instance with async initialization
 */
export async function getConfigurationServiceAsync(): Promise<ConfigurationService> {
	const service = getConfigurationService();
	await service.waitForInitialization();
	return service;
}

/**
 * Reset the configuration service (primarily for testing)
 */
export function resetConfigurationService(): void {
	_configService = null;
}

/**
 * Initialize configuration service with validation
 * Should be called at application startup
 */
export async function initializeConfiguration(): Promise<ConfigurationService> {
	const logger = createClientLogger("configuration-init");
	const service = getConfigurationService();
	await service.waitForInitialization();

	const profile = await service.getProfile();
	logger.info("Initializing configuration service", {
		environment: profile.name,
		description: profile.description,
	});

	// Keep console output for startup visibility
	console.log("🔧 Initializing configuration service...");
	console.log(`📍 Environment: ${profile.name}`);
	console.log(`📝 Description: ${profile.description}`);

	if (!service.validateConfiguration()) {
		logger.error("Configuration validation failed. Exiting...");
		console.error("❌ Configuration validation failed. Exiting...");
		// Only exit in Node.js environment, not Edge Runtime
		safeProcessExit(1);
	}

	logger.info("Configuration service initialized successfully");
	console.log("✅ Configuration service initialized successfully");
	return service;
}
