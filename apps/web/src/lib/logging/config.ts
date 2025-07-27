import type {
	Environment,
	LoggerConfig,
	LogLevel,
	TransportConfig,
} from "./types";

/**
 * Get the current environment from NODE_ENV
 */
export function getEnvironment(): Environment {
	const env = process.env.NODE_ENV as Environment;
	return env === "development" || env === "production" || env === "test"
		? env
		: "development";
}

/**
 * Get the log level from environment variables or default based on environment
 */
export function getLogLevel(): LogLevel {
	const envLogLevel = process.env.LOG_LEVEL as LogLevel;

	// Validate the log level
	const validLevels: LogLevel[] = ["error", "warn", "info", "debug", "trace"];
	if (envLogLevel && validLevels.includes(envLogLevel)) {
		return envLogLevel;
	}

	// Default based on environment
	const environment = getEnvironment();
	switch (environment) {
		case "production":
			return "info";
		case "test":
			return "warn";
		default:
			return "debug";
	}
}

/**
 * Get service name from environment or default
 */
export function getServiceName(): string {
	return process.env.SERVICE_NAME || "solomon-codes-web";
}

/**
 * Get service version from environment or default
 */
export function getServiceVersion(): string {
	return process.env.SERVICE_VERSION || "1.0.0";
}

/**
 * Get default logger configuration based on environment
 */
export function getDefaultLoggerConfig(): LoggerConfig {
	const environment = getEnvironment();
	const level = getLogLevel();
	const serviceName = getServiceName();
	const serviceVersion = getServiceVersion();

	return {
		level,
		environment,
		serviceName,
		serviceVersion,
		filePath: process.env.LOG_FILE_PATH,
		enableConsole: true,
		enableFile: Boolean(process.env.LOG_FILE_PATH),
		enableOpenTelemetry: process.env.NODE_ENV === "production",
		defaultMeta: {
			service: serviceName,
			version: serviceVersion,
			environment,
			"service.instance.id": process.env.HOSTNAME || "unknown",
		},
	};
}

/**
 * Get transport configuration based on environment and settings
 */
export function getTransportConfig(): TransportConfig {
	const environment = getEnvironment();
	const level = getLogLevel();

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
			enabled: process.env.NODE_ENV === "production",
			level,
		},
	};
}

/**
 * Validate logger configuration
 */
export function validateLoggerConfig(
	config: Partial<LoggerConfig>,
): LoggerConfig {
	const defaultConfig = getDefaultLoggerConfig();
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
 * Get OpenTelemetry configuration from environment
 */
export function getOpenTelemetryConfig() {
	return {
		isEnabled: process.env.NODE_ENV === "production",
		endpoint:
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
			"http://localhost:4318/v1/traces",
		serviceName: getServiceName(),
		serviceVersion: getServiceVersion(),
		headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
			? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
			: {},
		timeout: Number.parseInt(process.env.OTEL_TIMEOUT || "5000", 10),
		samplingRatio: Number.parseFloat(process.env.OTEL_SAMPLING_RATIO || "1.0"),
		resourceAttributes: {
			environment: getEnvironment(),
			"service.instance.id": process.env.HOSTNAME || "unknown",
		},
	};
}
