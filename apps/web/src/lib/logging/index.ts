import winston from "winston";
import {
	getDefaultLoggerConfig,
	getTransportConfig,
	validateLoggerConfig,
} from "./config";
import {
	createOpenTelemetryFormat,
	OpenTelemetryTransport,
} from "./transports/opentelemetry";
import type { Logger, LoggerConfig, LogMetadata } from "./types";
import { createCorrelationMetadata } from "./utils/correlation";
import {
	createDevelopmentFormatter,
	createProductionFormatter,
} from "./utils/formatters";

/**
 * Create console transport based on environment
 */
function createConsoleTransport(colorize = false) {
	const format = colorize
		? createDevelopmentFormatter()
		: createProductionFormatter();

	return new winston.transports.Console({
		format,
	});
}

/**
 * Create file transport if file path is provided
 */
function createFileTransport(
	filename: string,
	maxsize?: number,
	maxFiles?: number,
) {
	return new winston.transports.File({
		filename,
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.errors({ stack: true }),
			winston.format.json(),
		),
		maxsize,
		maxFiles,
		tailable: true,
	});
}

/**
 * Create Winston logger with the specified configuration
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
	const validatedConfig = validateLoggerConfig(config || {});
	const transportConfig = getTransportConfig();

	const transports: winston.transport[] = [];

	// Add console transport
	if (validatedConfig.enableConsole && transportConfig.console?.enabled) {
		transports.push(createConsoleTransport(transportConfig.console.colorize));
	}

	// Add file transport if enabled
	if (
		validatedConfig.enableFile &&
		transportConfig.file?.enabled &&
		validatedConfig.filePath
	) {
		transports.push(
			createFileTransport(
				validatedConfig.filePath,
				transportConfig.file.maxsize,
				transportConfig.file.maxFiles,
			),
		);
	}

	// Add OpenTelemetry transport if enabled
	if (
		validatedConfig.enableOpenTelemetry &&
		transportConfig.opentelemetry?.enabled
	) {
		transports.push(
			new OpenTelemetryTransport({ level: validatedConfig.level }),
		);
	}

	const logger = winston.createLogger({
		level: validatedConfig.level,
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.errors({ stack: true }),
			createOpenTelemetryFormat(),
			winston.format.json(),
		),
		defaultMeta: validatedConfig.defaultMeta,
		transports,
		// Handle uncaught exceptions and rejections
		exceptionHandlers: [
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.timestamp(),
					winston.format.errors({ stack: true }),
					winston.format.json(),
				),
			}),
		],
		rejectionHandlers: [
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.timestamp(),
					winston.format.errors({ stack: true }),
					winston.format.json(),
				),
			}),
		],
	});

	// Extend logger with typed methods and correlation ID support
	const typedLogger = logger as Logger;

	// Override methods to automatically include correlation metadata
	const originalDebug = logger.debug.bind(logger);
	const originalInfo = logger.info.bind(logger);
	const originalWarn = logger.warn.bind(logger);
	const originalError = logger.error.bind(logger);
	const originalChild = logger.child.bind(logger);

	typedLogger.debug = (message: string, meta?: LogMetadata) => {
		const correlationMeta = createCorrelationMetadata(meta);
		return originalDebug(message, correlationMeta);
	};

	typedLogger.info = (message: string, meta?: LogMetadata) => {
		const correlationMeta = createCorrelationMetadata(meta);
		return originalInfo(message, correlationMeta);
	};

	typedLogger.warn = (message: string, meta?: LogMetadata) => {
		const correlationMeta = createCorrelationMetadata(meta);
		return originalWarn(message, correlationMeta);
	};

	typedLogger.error = (message: string | Error, meta?: LogMetadata) => {
		const correlationMeta = createCorrelationMetadata(meta);
		return originalError(message, correlationMeta);
	};

	typedLogger.child = (defaultMeta: LogMetadata): Logger => {
		const correlationMeta = createCorrelationMetadata(defaultMeta);
		return originalChild(correlationMeta) as Logger;
	};

	return typedLogger;
}

/**
 * Default logger instance
 */
let defaultLogger: Logger | null = null;

/**
 * Get the default logger instance (singleton)
 */
export function getLogger(): Logger {
	if (!defaultLogger) {
		defaultLogger = createLogger();
	}
	return defaultLogger;
}

/**
 * Create a child logger with additional metadata
 */
export function createChildLogger(metadata: LogMetadata): Logger {
	return getLogger().child(metadata);
}

/**
 * Reset the default logger (useful for testing)
 */
export function resetLogger(): void {
	defaultLogger = null;
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): LoggerConfig {
	return getDefaultLoggerConfig();
}

export { getDefaultLoggerConfig, getTransportConfig } from "./config";
// Export types for external use
export type { Logger, LoggerConfig, LogMetadata } from "./types";
