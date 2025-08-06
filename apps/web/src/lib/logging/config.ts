import { getConfigurationService } from "../config/service";
import type {
	Environment,
	LoggerConfig,
	LogLevel,
	TransportConfig,
} from "./types";

/**
 * Get the current environment from configuration service
 */
export async function getEnvironment(): Promise<Environment> {
	try {
		const configService = getConfigurationService();
		const config = await configService.getConfiguration();
		const env = config.nodeEnv;
		return env === "development" || env === "production" || env === "test"
			? (env as Environment)
			: "development";
	} catch {
		// Fallback to environment variable if config service not available
		const env = process.env.NODE_ENV;
		return env === "development" || env === "production" || env === "test"
			? (env as Environment)
			: "development";
	}
}

/**
 * Get the log level from configuration service
 */
export async function getLogLevel(): Promise<LogLevel> {
	try {
		const configService = getConfigurationService();
		const loggingConfig = await configService.getLoggingConfig();
		return loggingConfig.level as LogLevel;
	} catch {
		// Fallback to environment variable
		const envLogLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
		const validLevels: LogLevel[] = ["error", "warn", "info", "debug", "trace"];

		if (envLogLevel && validLevels.includes(envLogLevel)) {
			return envLogLevel;
		}

		// Default based on environment
		const environment = await getEnvironment();
		switch (environment) {
			case "production":
				return "info";
			case "test":
				return "info";
			default:
				return "debug";
		}
	}
}

/**
 * Get service name from configuration service
 */
export async function getServiceName(): Promise<string> {
	try {
		const configService = getConfigurationService();
		const config = await configService.getConfiguration();
		return config.serviceName;
	} catch {
		return process.env.SERVICE_NAME || "solomon-codes-web";
	}
}

/**
 * Get service version from configuration service
 */
export async function getServiceVersion(): Promise<string> {
	try {
		const configService = getConfigurationService();
		const config = await configService.getConfiguration();
		return config.appVersion;
	} catch {
		return process.env.SERVICE_VERSION || "unknown";
	}
}

/**
 * Get default logger configuration based on configuration service
 */
export async function getDefaultLoggerConfig(): Promise<LoggerConfig> {
	try {
		const configService = getConfigurationService();
		const loggingConfig = await configService.getLoggingConfig();
		const serverConfig = await configService.getServerConfig();

		return {
			level: loggingConfig.level as LogLevel,
			environment: serverConfig.environment as Environment,
			serviceName: loggingConfig.serviceName,
			serviceVersion: serverConfig.version,
			filePath: loggingConfig.filePath,
			enableConsole: loggingConfig.enableConsole,
			enableFile: loggingConfig.enableFile,
			enableOpenTelemetry: loggingConfig.enableOpenTelemetry,
			defaultMeta: {
				service: loggingConfig.serviceName,
				version: serverConfig.version,
				environment: serverConfig.environment,
				"service.instance.id": process.env.HOSTNAME || "unknown",
			},
		};
	} catch {
		// Fallback to environment-based configuration
		const environment = await getEnvironment();
		const level = await getLogLevel();
		const serviceName = await getServiceName();
		const serviceVersion = await getServiceVersion();

		return {
			level,
			environment,
			serviceName,
			serviceVersion,
			filePath: process.env.LOG_FILE_PATH,
			enableConsole: true,
			enableFile: Boolean(process.env.LOG_FILE_PATH),
			enableOpenTelemetry: environment === "production",
			defaultMeta: {
				service: serviceName,
				version: serviceVersion,
				environment,
				"service.instance.id": process.env.HOSTNAME || "unknown",
			},
		};
	}
}

/**
 * Get transport configuration based on configuration service
 */
export async function getTransportConfig(): Promise<TransportConfig> {
	try {
		const configService = getConfigurationService();
		const loggingConfig = await configService.getLoggingConfig();
		const config = await configService.getConfiguration();
		const environment = config.nodeEnv;

		return {
			console: {
				enabled: loggingConfig.enableConsole,
				level: loggingConfig.level as LogLevel,
				colorize: environment === "development",
			},
			file: {
				enabled: loggingConfig.enableFile,
				filename: loggingConfig.filePath || "logs/app.log",
				level: loggingConfig.level as LogLevel,
				maxsize: Number.parseInt(process.env.LOG_MAX_SIZE || "10485760", 10), // 10MB
				maxFiles: Number.parseInt(process.env.LOG_MAX_FILES || "5", 10),
				tailable: true,
			},
			opentelemetry: {
				enabled: loggingConfig.enableOpenTelemetry,
				level: loggingConfig.level as LogLevel,
			},
		};
	} catch {
		// Fallback to environment-based configuration
		const environment = await getEnvironment();
		const level = await getLogLevel();

		return {
			console: {
				enabled: true,
				level,
				colorize: environment === "development",
			},
			file: {
				enabled: Boolean(process.env.LOG_FILE_PATH),
				filename: process.env.LOG_FILE_PATH || "logs/app.log",
				level,
				maxsize: Number.parseInt(process.env.LOG_MAX_SIZE || "10485760", 10), // 10MB
				maxFiles: Number.parseInt(process.env.LOG_MAX_FILES || "5", 10),
				tailable: true,
			},
			opentelemetry: {
				enabled: environment === "production",
				level,
			},
		};
	}
}

/**
 * Validate logger configuration
 */
export async function validateLoggerConfig(
	config: Partial<LoggerConfig>,
): Promise<LoggerConfig> {
	const defaultConfig = await getDefaultLoggerConfig();
	const mergedConfig = { ...defaultConfig, ...config };

	// Validate log level
	const validLevels: LogLevel[] = ["error", "warn", "info", "debug", "trace"];
	if (mergedConfig.level && !validLevels.includes(mergedConfig.level)) {
		console.warn(
			`Invalid log level: ${mergedConfig.level}. Using default: ${defaultConfig.level}`,
		);
		mergedConfig.level = defaultConfig.level;
	}

	// Validate environment
	const validEnvironments: Environment[] = [
		"development",
		"production",
		"test",
	];
	if (
		mergedConfig.environment &&
		!validEnvironments.includes(mergedConfig.environment)
	) {
		console.warn(
			`Invalid environment: ${mergedConfig.environment}. Using default: ${defaultConfig.environment}`,
		);
		mergedConfig.environment = defaultConfig.environment;
	}

	// Ensure service name is provided
	if (!mergedConfig.serviceName) {
		mergedConfig.serviceName = defaultConfig.serviceName;
	}

	return mergedConfig;
}

/**
 * Get OpenTelemetry configuration from configuration service
 */
export async function getOpenTelemetryConfig() {
	try {
		const configService = getConfigurationService();
		const telemetryConfig = await configService.getTelemetryConfig();
		const serverConfig = await configService.getServerConfig();

		return {
			isEnabled: telemetryConfig.isEnabled,
			endpoint: telemetryConfig.endpoint,
			serviceName: telemetryConfig.serviceName,
			serviceVersion: telemetryConfig.serviceVersion,
			headers: telemetryConfig.headers,
			timeout: telemetryConfig.timeout,
			samplingRatio: telemetryConfig.samplingRatio,
			resourceAttributes: {
				environment: serverConfig.environment,
				"service.instance.id": process.env.HOSTNAME || "unknown",
			},
		};
	} catch (error) {
		// Log the error but provide a safe fallback
		console.warn(
			"Failed to get telemetry configuration from service, using fallback:",
			error,
		);

		return {
			isEnabled: false, // Disable telemetry if configuration service fails
			endpoint: "http://localhost:4318/v1/traces", // Safe fallback for development
			serviceName: getServiceName(),
			serviceVersion: getServiceVersion(),
			headers: {},
			timeout: 5000,
			samplingRatio: 1.0,
			resourceAttributes: {
				environment: getEnvironment(),
				"service.instance.id": process.env.HOSTNAME || "unknown",
			},
		};
	}
}
