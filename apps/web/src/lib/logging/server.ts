/**
 * Server-only logging utilities
 * This file contains Winston-based logging that only works on the server
 */

import winston from "winston";
import { getStdout } from "../utils/runtime";
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
 * Create file transport with rotation
 */
function createFileTransport(
	filename: string,
	maxsize = 5242880, // 5MB
	maxFiles = 5,
) {
	return new winston.transports.File({
		filename,
		maxsize,
		maxFiles,
		tailable: true,
	});
}

/**
 * Create Winston logger with the specified configuration (server-only)
 */
export function createServerLogger(config?: Partial<LoggerConfig>): Logger {
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
		// Edge Runtime safe stream access
		const stream = getStdout();
		transports.push(
			new OpenTelemetryTransport({
				level: validatedConfig.level,
				stream: stream as any, // Type assertion for Edge Runtime compatibility
			}) as winston.transport,
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

	typedLogger.debug = (message: string, meta?: LogMetadata) => {
		originalDebug(message, { ...createCorrelationMetadata(), ...meta });
		return typedLogger;
	};

	typedLogger.info = (message: string, meta?: LogMetadata) => {
		originalInfo(message, { ...createCorrelationMetadata(), ...meta });
		return typedLogger;
	};

	typedLogger.warn = (message: string, meta?: LogMetadata) => {
		originalWarn(message, { ...createCorrelationMetadata(), ...meta });
		return typedLogger;
	};

	typedLogger.error = (message: string, meta?: LogMetadata) => {
		originalError(message, { ...createCorrelationMetadata(), ...meta });
		return typedLogger;
	};

	return typedLogger;
}

/**
 * Create a context-aware logger with default metadata (server-only)
 */
export function createContextServerLogger(
	context: string,
	defaultMeta?: LogMetadata,
): Logger {
	const config = getDefaultLoggerConfig();
	const logger = createServerLogger({
		...config,
		defaultMeta: {
			...config.defaultMeta,
			context,
			...defaultMeta,
		},
	});

	return logger;
}

/**
 * Global logger instance (server-only)
 */
let globalLogger: Logger | null = null;

/**
 * Get or create the global logger instance (server-only)
 */
export function getGlobalServerLogger(): Logger {
	if (!globalLogger) {
		globalLogger = createServerLogger();
	}
	return globalLogger;
}

/**
 * Set the global logger instance (server-only)
 */
export function setGlobalServerLogger(logger: Logger): void {
	globalLogger = logger;
}

// Re-export types for convenience
export type { Logger, LoggerConfig, LogMetadata } from "./types";
