import { trace } from "@opentelemetry/api";
import winston from "winston";
import { getOpenTelemetryConfig } from "../config";
import { getTelemetryService } from "../../telemetry";

/**
 * Extract trace context from the current OpenTelemetry span
 */
export function getTraceContext(): { traceId?: string; spanId?: string } {
	try {
		const activeSpan = trace.getActiveSpan();
		if (!activeSpan) {
			return {};
		}

		const spanContext = activeSpan.spanContext();
		if (!spanContext) {
			return {};
		}

		return {
			traceId: spanContext.traceId,
			spanId: spanContext.spanId,
		};
	} catch (_error) {
		// Silently fail if OpenTelemetry is not properly initialized
		return {};
	}
}

/**
 * Create a Winston format that adds OpenTelemetry trace context
 */
export function createOpenTelemetryFormat() {
	return winston.format((info) => {
		const traceContext = getTraceContext();
		return {
			...info,
			...traceContext,
		};
	})();
}

/**
 * Create a Winston transport that includes OpenTelemetry context
 */
export function createOpenTelemetryTransport(
	options: { level?: string; format?: winston.Logform.Format } = {},
) {
	const { level = "info", format } = options;

	return new winston.transports.Console({
		level,
		format: winston.format.combine(
			createOpenTelemetryFormat(),
			format || winston.format.json(),
		),
	});
}

/**
 * Create a custom Winston transport that sends logs to OpenTelemetry collector
 */
export class OpenTelemetryTransport extends winston.Transport {
	private readonly config: ReturnType<typeof getOpenTelemetryConfig>;

	constructor(options: winston.TransportStreamOptions = {}) {
		super(options);
		this.config = getOpenTelemetryConfig();
	}

	log(info: winston.LogEntry, callback: () => void) {
		setImmediate(() => {
			this.emit("logged", info);
		});

		// Add trace context to the log entry
		const traceContext = getTraceContext();
		const enhancedInfo = {
			...info,
			...traceContext,
			service: this.config.serviceName,
			version: this.config.serviceVersion,
		};

		// In a real implementation, you would send this to your OpenTelemetry collector
		// For now, we'll just ensure the trace context is included
		if (this.config.isEnabled) {
			// Here you could send to OTLP endpoint, but for now we'll use console
			console.log(JSON.stringify(enhancedInfo));
		}

		callback();
	}
}

/**
 * Create OpenTelemetry-enhanced logger configuration
 */
export function createOpenTelemetryLoggerConfig() {
	const config = getOpenTelemetryConfig();

	return {
		defaultMeta: {
			service: config.serviceName,
			version: config.serviceVersion,
			environment: config.resourceAttributes.environment,
		},
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.errors({ stack: true }),
			createOpenTelemetryFormat(),
			winston.format.json(),
		),
	};
}

/**
 * Initialize OpenTelemetry instrumentation for Winston
 */
export function initializeOpenTelemetryInstrumentation() {
	try {
		const telemetryService = getTelemetryService();
		const config = telemetryService.getConfig();

		if (!config.isEnabled) {
			return null;
		}

		// In a full implementation, you would initialize the OpenTelemetry SDK here
		// For now, we'll just return a configuration object
		return {
			serviceName: config.serviceName,
			serviceVersion: config.serviceVersion,
			endpoint: config.endpoint,
			headers: config.headers,
		};
	} catch (error) {
		console.warn("Failed to initialize OpenTelemetry instrumentation:", error);
		return null;
	}
}

/**
 * Create a logger with OpenTelemetry integration
 */
export function createOpenTelemetryLogger(
	options: {
		level?: string;
		enableConsole?: boolean;
		enableOTLP?: boolean;
	} = {},
) {
	const { level = "info", enableConsole = true, enableOTLP = false } = options;

	const config = getOpenTelemetryConfig();
	const transports: winston.transport[] = [];

	// Add console transport with OpenTelemetry context
	if (enableConsole) {
		transports.push(createOpenTelemetryTransport({ level }));
	}

	// Add OTLP transport if enabled
	if (enableOTLP && config.isEnabled) {
		transports.push(new OpenTelemetryTransport({ level }));
	}

	return winston.createLogger({
		level,
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.errors({ stack: true }),
			createOpenTelemetryFormat(),
			winston.format.json(),
		),
		defaultMeta: {
			service: config.serviceName,
			version: config.serviceVersion,
			environment: config.resourceAttributes.environment,
		},
		transports,
	});
}

/**
 * Middleware to add OpenTelemetry context to request logging
 */
interface MiddlewareRequest {
	headers: Record<string, string | string[] | undefined>;
	traceContext?: { traceId?: string; spanId?: string };
}

interface MiddlewareResponse {
	setHeader: (name: string, value: string) => void;
}

export function createOpenTelemetryLoggingMiddleware() {
	return (
		req: MiddlewareRequest,
		res: MiddlewareResponse,
		next: () => void,
	) => {
		const traceContext = getTraceContext();

		// Add trace context to request object for later use
		req.traceContext = traceContext;

		// Add trace context to response headers for client correlation
		if (traceContext.traceId) {
			res.setHeader("x-trace-id", traceContext.traceId);
		}
		if (traceContext.spanId) {
			res.setHeader("x-span-id", traceContext.spanId);
		}

		next();
	};
}

/**
 * Global Error Handler with comprehensive logging and telemetry
 * Integrates with existing Winston and OpenTelemetry infrastructure
 */

import { createContextLogger } from "../../factory";
import { getCorrelationId } from "../utils/correlation";
import {
	BaseApplicationError,
	createStructuredError,
	ErrorSeverity,
	ErrorCategory,
} from "../../config";

export interface GlobalErrorHandlerConfig {
	enableProcessExitOnCritical?: boolean;
	enableAlertingOnCritical?: boolean;
	maxErrorsPerMinute?: number;
	errorSamplingRate?: number;
	excludeFromReporting?: string[];
}

export interface ErrorMetrics {
	errorCount: number;
	errorRate: number;
	lastError: Date | null;
	errorsByCategory: Record<ErrorCategory, number>;
	errorsBySeverity: Record<ErrorSeverity, number>;
}

/**
 * Global error handler class with rate limiting and metrics
 */
export class GlobalErrorHandler {
	private logger = createContextLogger("global-error-handler");
	private config: GlobalErrorHandlerConfig;
	private errorMetrics: ErrorMetrics;
	private errorTimestamps: Date[] = [];
	private isInitialized = false;

	constructor(config: GlobalErrorHandlerConfig = {}) {
		this.config = {
			enableProcessExitOnCritical: false,
			enableAlertingOnCritical: true,
			maxErrorsPerMinute: 100,
			errorSamplingRate: 1.0,
			excludeFromReporting: [],
			...config,
		};

		this.errorMetrics = {
			errorCount: 0,
			errorRate: 0,
			lastError: null,
			errorsByCategory: Object.values(ErrorCategory).reduce(
				(acc, category) => ({ ...acc, [category]: 0 }),
				{} as Record<ErrorCategory, number>,
			),
			errorsBySeverity: Object.values(ErrorSeverity).reduce(
				(acc, severity) => ({ ...acc, [severity]: 0 }),
				{} as Record<ErrorSeverity, number>,
			),
		};
	}

	/**
	 * Initialize global error handlers
	 */
	initialize(): void {
		if (this.isInitialized) {
			this.logger.warn("Global error handler already initialized");
			return;
		}

		// Handle unhandled promise rejections
		process.on("unhandledRejection", (reason, promise) => {
			this.handleUnhandledRejection(reason, promise);
		});

		// Handle uncaught exceptions
		process.on("uncaughtException", (error) => {
			this.handleUncaughtException(error);
		});

		// Handle warning events
		process.on("warning", (warning) => {
			this.handleWarning(warning);
		});

		// Graceful shutdown handlers
		process.on("SIGTERM", () => this.handleShutdown("SIGTERM"));
		process.on("SIGINT", () => this.handleShutdown("SIGINT"));

		this.isInitialized = true;
		this.logger.info("Global error handler initialized", {
			config: this.config,
		});
	}

	/**
	 * Handle application errors with comprehensive logging
	 */
	handleError(
		error: unknown,
		context: {
			correlationId?: string;
			userId?: string;
			sessionId?: string;
			requestId?: string;
			component?: string;
			action?: string;
			metadata?: Record<string, unknown>;
		} = {},
	): BaseApplicationError {
		const structuredError = createStructuredError(error, {
			...context,
			correlationId: context.correlationId || getCorrelationId(),
		});

		// Update metrics
		this.updateErrorMetrics(structuredError);

		// Check rate limiting
		if (!this.shouldProcessError()) {
			this.logger.warn("Error rate limit exceeded, dropping error", {
				fingerprint: structuredError.getFingerprint(),
			});
			return structuredError;
		}

		// Check sampling
		if (!this.shouldSampleError()) {
			this.logger.debug("Error not sampled, skipping detailed processing", {
				fingerprint: structuredError.getFingerprint(),
			});
			return structuredError;
		}

		// Log the error with appropriate level
		this.logError(structuredError);

		// Handle critical errors
		if (structuredError.severity === ErrorSeverity.CRITICAL) {
			this.handleCriticalError(structuredError);
		}

		// Emit error event for external monitoring
		this.emitErrorEvent(structuredError);

		return structuredError;
	}

	/**
	 * Get current error metrics
	 */
	getMetrics(): ErrorMetrics {
		this.updateErrorRate();
		return { ...this.errorMetrics };
	}

	/**
	 * Reset error metrics
	 */
	resetMetrics(): void {
		this.errorMetrics = {
			errorCount: 0,
			errorRate: 0,
			lastError: null,
			errorsByCategory: Object.values(ErrorCategory).reduce(
				(acc, category) => ({ ...acc, [category]: 0 }),
				{} as Record<ErrorCategory, number>,
			),
			errorsBySeverity: Object.values(ErrorSeverity).reduce(
				(acc, severity) => ({ ...acc, [severity]: 0 }),
				{} as Record<ErrorSeverity, number>,
			),
		};
		this.errorTimestamps = [];
		this.logger.info("Error metrics reset");
	}

	/**
	 * Shutdown the error handler gracefully
	 */
	shutdown(): void {
		if (!this.isInitialized) {
			return;
		}

		this.logger.info("Shutting down global error handler", {
			finalMetrics: this.getMetrics(),
		});

		// Remove event listeners
		process.removeAllListeners("unhandledRejection");
		process.removeAllListeners("uncaughtException");
		process.removeAllListeners("warning");

		this.isInitialized = false;
	}

	/**
	 * Handle unhandled promise rejections
	 */
	private handleUnhandledRejection(reason: unknown, promise: Promise<unknown>): void {
		const error = this.handleError(reason, {
			component: "global-error-handler",
			action: "unhandled-rejection",
			metadata: {
				promiseString: promise.toString(),
			},
		});

		// Critical unhandled rejections should potentially crash the process
		if (error.severity === ErrorSeverity.CRITICAL && this.config.enableProcessExitOnCritical) {
			this.logger.fatal("Critical unhandled rejection, exiting process", {
				error: error.toStructuredError(),
			});
			process.exit(1);
		}
	}

	/**
	 * Handle uncaught exceptions
	 */
	private handleUncaughtException(error: Error): void {
		const structuredError = this.handleError(error, {
			component: "global-error-handler",
			action: "uncaught-exception",
		});

		this.logger.fatal("Uncaught exception, exiting process", {
			error: structuredError.toStructuredError(),
		});

		// Always exit on uncaught exceptions after logging
		process.exit(1);
	}

	/**
	 * Handle Node.js warnings
	 */
	private handleWarning(warning: Error): void {
		this.logger.warn("Node.js warning", {
			name: warning.name,
			message: warning.message,
			stack: warning.stack,
		});
	}

	/**
	 * Handle graceful shutdown
	 */
	private handleShutdown(signal: string): void {
		this.logger.info(`Received ${signal}, initiating graceful shutdown`, {
			finalMetrics: this.getMetrics(),
		});

		this.shutdown();
		process.exit(0);
	}

	/**
	 * Update error metrics
	 */
	private updateErrorMetrics(error: BaseApplicationError): void {
		this.errorMetrics.errorCount++;
		this.errorMetrics.lastError = new Date();
		this.errorMetrics.errorsByCategory[error.category]++;
		this.errorMetrics.errorsBySeverity[error.severity]++;

		// Track timestamps for rate calculation
		const now = new Date();
		this.errorTimestamps.push(now);

		// Keep only timestamps from the last minute
		const oneMinuteAgo = new Date(now.getTime() - 60000);
		this.errorTimestamps = this.errorTimestamps.filter(
			(timestamp) => timestamp > oneMinuteAgo,
		);

		this.updateErrorRate();
	}

	/**
	 * Update error rate calculation
	 */
	private updateErrorRate(): void {
		this.errorMetrics.errorRate = this.errorTimestamps.length;
	}

	/**
	 * Check if error should be processed (rate limiting)
	 */
	private shouldProcessError(): boolean {
		return this.errorMetrics.errorRate < (this.config.maxErrorsPerMinute || 100);
	}

	/**
	 * Check if error should be sampled
	 */
	private shouldSampleError(): boolean {
		return Math.random() < (this.config.errorSamplingRate || 1.0);
	}

	/**
	 * Log error with appropriate level
	 */
	private logError(error: BaseApplicationError): void {
		const structuredError = error.toStructuredError();
		const logData = {
			...structuredError,
			correlationId: error.context.correlationId,
			userId: error.context.userId,
			sessionId: error.context.sessionId,
			requestId: error.context.requestId,
		};

		switch (error.severity) {
			case ErrorSeverity.CRITICAL:
				this.logger.fatal("Critical error occurred", logData);
				break;
			case ErrorSeverity.HIGH:
				this.logger.error("High severity error occurred", logData);
				break;
			case ErrorSeverity.MEDIUM:
				this.logger.warn("Medium severity error occurred", logData);
				break;
			case ErrorSeverity.LOW:
				this.logger.info("Low severity error occurred", logData);
				break;
			default:
				this.logger.error("Unknown severity error occurred", logData);
		}
	}

	/**
	 * Handle critical errors with special processing
	 */
	private handleCriticalError(error: BaseApplicationError): void {
		if (this.config.enableAlertingOnCritical) {
			// Emit critical error event for alerting systems
			process.emit("criticalError" as any, error);
		}

		// Log additional context for critical errors
		this.logger.fatal("Critical error requires immediate attention", {
			error: error.toStructuredError(),
			systemInfo: {
				uptime: process.uptime(),
				memoryUsage: process.memoryUsage(),
				platform: process.platform,
				nodeVersion: process.version,
			},
			errorMetrics: this.getMetrics(),
		});
	}

	/**
	 * Emit error event for external monitoring systems
	 */
	private emitErrorEvent(error: BaseApplicationError): void {
		// Emit error event that can be captured by monitoring systems
		process.emit("applicationError" as any, error.toStructuredError());
	}
}

// Global instance
let globalErrorHandler: GlobalErrorHandler | null = null;

/**
 * Initialize global error handler
 */
export function initializeGlobalErrorHandler(
	config: GlobalErrorHandlerConfig = {},
): GlobalErrorHandler {
	if (globalErrorHandler) {
		return globalErrorHandler;
	}

	globalErrorHandler = new GlobalErrorHandler(config);
	globalErrorHandler.initialize();
	return globalErrorHandler;
}

/**
 * Get global error handler instance
 */
export function getGlobalErrorHandler(): GlobalErrorHandler | null {
	return globalErrorHandler;
}

/**
 * Shutdown global error handler
 */
export function shutdownGlobalErrorHandler(): void {
	if (globalErrorHandler) {
		globalErrorHandler.shutdown();
		globalErrorHandler = null;
	}
}

/**
 * Utility to create a child logger with trace context
 */
export function createTraceLogger(parentLogger: winston.Logger) {
	const traceContext = getTraceContext();
	return parentLogger.child(traceContext);
}

/**
 * Export the OpenTelemetry configuration for reuse
 */
export { getOpenTelemetryConfig } from "../config";
