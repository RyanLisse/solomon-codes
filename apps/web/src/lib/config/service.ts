import { createClientLogger } from "../logging/client";
import { safeProcessExit } from "../utils/runtime";
import { type AppConfig, getConfigSync } from "./index";
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
	private config: AppConfig;
	private profile: EnvironmentProfile;
	private logger: ReturnType<typeof createClientLogger> | null = null;

	constructor() {
		this.config = getConfigSync();
		this.profile = this.getEnvironmentProfile();
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
	getConfiguration(): AppConfig {
		return this.config;
	}

	/**
	 * Get the current environment profile
	 */
	getProfile(): EnvironmentProfile {
		return this.profile;
	}

	/**
	 * Get environment profile based on NODE_ENV
	 */
	private getEnvironmentProfile(): EnvironmentProfile {
		const env = this.config.nodeEnv;
		return ENVIRONMENT_PROFILES[env] || ENVIRONMENT_PROFILES.development;
	}

	/**
	 * Check if a feature is enabled in the current environment
	 */
	isFeatureEnabled(feature: keyof EnvironmentProfile["features"]): boolean {
		return this.profile.features[feature];
	}

	/**
	 * Get environment-specific configuration value
	 */
	getEnvironmentValue<K extends keyof AppConfig>(
		key: K,
		fallback?: AppConfig[K],
	): AppConfig[K] {
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
	getDatabaseConfig(): { url?: string; isConfigured: boolean } {
		return {
			url: this.config.databaseUrl,
			isConfigured: Boolean(this.config.databaseUrl),
		};
	}

	/**
	 * Get telemetry configuration
	 */
	getTelemetryConfig() {
		const isEnabled = this.isFeatureEnabled("enableTelemetry");
		const endpoint = this.getEnvironmentValue("otelEndpoint");

		return {
			isEnabled: isEnabled && Boolean(endpoint),
			endpoint:
				endpoint ||
				this.profile.defaults.otelEndpoint ||
				"http://localhost:4318/v1/traces",
			headers: this.config.otelHeaders,
			samplingRatio: this.config.otelSamplingRatio,
			timeout: this.getEnvironmentValue("otelTimeout"),
			serviceName: this.config.serviceName,
			serviceVersion: this.config.appVersion,
		};
	}

	/**
	 * Get logging configuration
	 */
	getLoggingConfig() {
		return {
			level: this.config.logLevel,
			enableConsole: true,
			enableFile: Boolean(this.config.logFilePath),
			enableOpenTelemetry: this.isFeatureEnabled("enableTelemetry"),
			filePath: this.config.logFilePath,
			serviceName: this.config.serviceName,
			enableDetailedLogging: this.isFeatureEnabled("enableDetailedLogging"),
		};
	}

	/**
	 * Get API configuration
	 */
	getApiConfig() {
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
	getServerConfig() {
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
	isDevelopment(): boolean {
		return this.config.nodeEnv === "development";
	}

	/**
	 * Check if running in staging mode
	 */
	isStaging(): boolean {
		return this.config.nodeEnv === "staging";
	}

	/**
	 * Check if running in production mode
	 */
	isProduction(): boolean {
		return this.config.nodeEnv === "production";
	}

	/**
	 * Get environment information for debugging
	 */
	getEnvironmentInfo() {
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
 * Reset the configuration service (primarily for testing)
 */
export function resetConfigurationService(): void {
	_configService = null;
}

/**
 * Initialize configuration service with validation
 * Should be called at application startup
 */
export function initializeConfiguration(): ConfigurationService {
	const logger = createClientLogger("configuration-init");
	const service = getConfigurationService();

	logger.info("Initializing configuration service", {
		environment: service.getProfile().name,
		description: service.getProfile().description,
	});

	// Keep console output for startup visibility
	console.log("🔧 Initializing configuration service...");
	console.log(`📍 Environment: ${service.getProfile().name}`);
	console.log(`📝 Description: ${service.getProfile().description}`);

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
