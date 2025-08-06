import { trace } from "@opentelemetry/api";
import winston from "winston";
import { getTelemetryService } from "../../telemetry";
import { getStdout, safeProcessExit } from "../../utils/runtime";
import { getOpenTelemetryConfig } from "../config";

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
export class OpenTelemetryTransport extends winston.transports.Stream {
	private config: any;

	constructor(options?: winston.transports.StreamTransportOptions) {
		// Edge Runtime safe stream fallback
		const defaultStream = getStdout();

		super({
			stream: defaultStream as any,
			...options,
		});
		// Initialize with default config, will be set properly in initialize()
		this.config = {
			isEnabled: false,
			serviceName: "solomon-codes-web",
			serviceVersion: "unknown",
		};
	}

	/**
	 * Initialize the transport with async configuration
	 */
	async initialize(): Promise<void> {
		this.config = await getOpenTelemetryConfig();
	}

	log(info: winston.LogEntry, callback: () => void) {
		// Use setTimeout as fallback for Edge Runtime compatibility
		const scheduleCallback =
			typeof setImmediate !== "undefined"
				? setImmediate
				: (fn: () => void) => setTimeout(fn, 0);

		scheduleCallback(() => {
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
export async function createOpenTelemetryLoggerConfig() {
	const config = await getOpenTelemetryConfig();

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
export async function initializeOpenTelemetryInstrumentation() {
	try {
		const telemetryService = getTelemetryService();
		const config = await telemetryService.getConfig();

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
export async function createOpenTelemetryLogger(
	options: {
		level?: string;
		enableConsole?: boolean;
		enableOTLP?: boolean;
	} = {},
) {
	const { level = "info", enableConsole = true, enableOTLP = false } = options;

	const config = await getOpenTelemetryConfig();
	const transports: winston.transport[] = [];

	// Add console transport with OpenTelemetry context
	if (enableConsole) {
		transports.push(await createOpenTelemetryTransport({ level }));
	}

	// Add OTLP transport if enabled
	if (enableOTLP && config.isEnabled) {
		// Edge Runtime safe stream access
		const stream = getStdout();
		transports.push(
			new OpenTelemetryTransport({ level, stream: stream as any }), // Type assertion for Edge Runtime compatibility
		);
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

import {
	type BaseApplicationError,
	createStructuredError,
	ErrorCategory,
	ErrorSeverity,
} from "../../config/client";
import { createLogger } from "../index";
import type { Logger } from "../types";
// Import only what we need to avoid circular dependencies
import { getCorrelationId } from "../utils/correlation";

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
	private readonly logger: Logger;
	private readonly config: GlobalErrorHandlerConfig;
	private errorMetrics: ErrorMetrics;
	private errorTimestamps: Date[] = [];
	private isInitialized = false;

	constructor(config: GlobalErrorHandlerConfig = {}) {
		this.logger = createLogger({ serviceName: "global-error-handler" });
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
				(acc, category) => {
					acc[category] = 0;
					return acc;
				},
				{} as Record<ErrorCategory, number>,
			),
			errorsBySeverity: Object.values(ErrorSeverity).reduce(
				(acc, severity) => {
					acc[severity] = 0;
					return acc;
				},
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

		// Node.js-specific event handlers (skip in Edge Runtime)
		this.setupNodeEventHandlers();

		this.isInitialized = true;
		this.logger.info("Global error handler initialized", {
			config: this.config,
		});
	}

	/**
	 * Setup Node.js-specific event handlers (Edge Runtime safe)
	 */
	private setupNodeEventHandlers(): void {
		// Only execute in actual Node.js runtime
		if (
			typeof globalThis !== "undefined" &&
			(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime
		) {
			return; // Skip in Edge Runtime
		}

		try {
			// Dynamic access to avoid Edge Runtime static analysis
			const proc = (globalThis as { process?: NodeJS.Process }).process;
			if (proc && typeof proc.on === "function") {
				proc.on(
					"unhandledRejection",
					(reason: unknown, promise: Promise<unknown>) => {
						this.handleUnhandledRejection(reason, promise);
					},
				);

				proc.on("uncaughtException", (error: Error) => {
					this.handleUncaughtException(error);
				});

				proc.on("warning", (warning: unknown) => {
					this.handleWarning(warning);
				});

				proc.on("SIGTERM", () => this.handleShutdown("SIGTERM"));
				proc.on("SIGINT", () => this.handleShutdown("SIGINT"));
			}
		} catch (_error) {
			console.debug("Node.js event handlers not available");
		}
	}

	/**
	 * Clean up Node.js event handlers (Edge Runtime safe)
	 */
	private cleanupNodeEventHandlers(): void {
		// Only execute in actual Node.js runtime
		if (
			typeof globalThis !== "undefined" &&
			(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime
		) {
			return; // Skip in Edge Runtime
		}

		try {
			// Dynamic access to avoid Edge Runtime static analysis
			const proc = (globalThis as { process?: NodeJS.Process }).process;
			if (proc && typeof proc.removeAllListeners === "function") {
				proc.removeAllListeners("unhandledRejection");
				proc.removeAllListeners("uncaughtException");
				proc.removeAllListeners("warning");
				proc.removeAllListeners("SIGTERM");
				proc.removeAllListeners("SIGINT");
			}
		} catch (_error) {
			console.debug("Node.js event cleanup not available");
		}
	}

	/**
	 * Get system information (Edge Runtime safe)
	 */
	private getSystemInfo(): Record<string, unknown> {
		// Check if we're in Edge Runtime
		if (
			typeof globalThis !== "undefined" &&
			(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime
		) {
			return {
				uptime: 0,
				memoryUsage: {},
				platform: "edge",
				nodeVersion: "edge-runtime",
				runtime: "edge",
			};
		}

		// Node.js runtime - safely access process APIs
		try {
			const info: Record<string, unknown> = { runtime: "node" };
			const proc = globalThis.process;

			if (proc) {
				info.uptime = proc.uptime?.() || 0;
				info.memoryUsage = proc.memoryUsage?.() || {};
				info.platform = proc.platform || "unknown";
				info.nodeVersion = proc.version || "unknown";
			} else {
				info.uptime = 0;
				info.memoryUsage = {};
				info.platform = "unknown";
				info.nodeVersion = "unknown";
			}

			return info;
		} catch (_error) {
			// Fallback for any runtime that doesn't support these APIs
			return {
				uptime: 0,
				memoryUsage: {},
				platform: "unknown",
				nodeVersion: "unknown",
				runtime: "unknown",
			};
		}
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
		const errorMessage = error instanceof Error ? error.message : String(error);
		const structuredError = createStructuredError(
			errorMessage,
			ErrorSeverity.MEDIUM,
			ErrorCategory.SYSTEM,
			{
				...context,
				correlationId: context.correlationId || getCorrelationId(),
			},
		);

		// Create a BaseApplicationError-compatible object
		const baseError: BaseApplicationError = {
			...structuredError,
			timestamp: new Date(structuredError.timestamp),
			toStructuredError: () => structuredError,
		};

		// Update metrics
		this.updateErrorMetrics(baseError);

		// Check rate limiting
		if (!this.shouldProcessError()) {
			this.logger.warn("Error rate limit exceeded, dropping error", {
				fingerprint: structuredError.fingerprint,
			});
			return baseError;
		}

		// Check sampling
		if (!this.shouldSampleError()) {
			this.logger.debug("Error not sampled, skipping detailed processing", {
				fingerprint: structuredError.fingerprint,
			});
			return baseError;
		}

		// Log the error with appropriate level
		this.logError(baseError);

		// Handle critical errors
		if (baseError.severity === ErrorSeverity.CRITICAL) {
			this.handleCriticalError(baseError);
		}

		// Emit error event for external monitoring
		this.emitErrorEvent(baseError);

		return baseError;
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
				(acc, category) => {
					acc[category] = 0;
					return acc;
				},
				{} as Record<ErrorCategory, number>,
			),
			errorsBySeverity: Object.values(ErrorSeverity).reduce(
				(acc, severity) => {
					acc[severity] = 0;
					return acc;
				},
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

		// Clean up Node.js event handlers
		this.cleanupNodeEventHandlers();

		this.isInitialized = false;
	}

	/**
	 * Handle unhandled promise rejections
	 */
	private handleUnhandledRejection(
		reason: unknown,
		promise: Promise<unknown>,
	): void {
		const error = this.handleError(reason, {
			component: "global-error-handler",
			action: "unhandled-rejection",
			metadata: {
				promiseString: String(promise),
			},
		});

		// Critical unhandled rejections should potentially crash the process
		if (
			error.severity === ErrorSeverity.CRITICAL &&
			this.config.enableProcessExitOnCritical
		) {
			this.logger.error("Critical unhandled rejection, exiting process", {
				error: error.message || "Critical unhandled rejection",
				errorDetails: error.toStructuredError(),
			});
			// Only exit in Node.js environment
			safeProcessExit(1);
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

		this.logger.error("Uncaught exception, exiting process", {
			error: error.message || "Uncaught exception",
			errorDetails: structuredError.toStructuredError(),
		});

		// Always exit on uncaught exceptions after logging (only in Node.js)
		safeProcessExit(1);
	}

	/**
	 * Handle Node.js warnings
	 */
	private handleWarning(warning: unknown): void {
		const warningError =
			warning instanceof Error ? warning : new Error(String(warning));
		this.logger.warn("Node.js warning", {
			name: warningError.name,
			message: warningError.message,
			stack: warningError.stack,
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
		// Only exit in Node.js environment
		safeProcessExit(0);
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
		return (
			this.errorMetrics.errorRate < (this.config.maxErrorsPerMinute || 100)
		);
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
			correlationId: error.context?.correlationId
				? String(error.context.correlationId)
				: undefined,
			userId: error.context?.userId ? String(error.context.userId) : undefined,
			sessionId: error.context?.sessionId
				? String(error.context.sessionId)
				: undefined,
			requestId: error.context?.requestId
				? String(error.context.requestId)
				: undefined,
		};

		switch (error.severity) {
			case ErrorSeverity.CRITICAL:
				this.logger.error("Critical error occurred", logData);
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
			// Emit critical error event for alerting systems (only in Node.js)
			if (
				typeof process !== "undefined" &&
				typeof process.emit === "function"
			) {
				(
					process as NodeJS.Process & {
						emit: (event: string, ...args: unknown[]) => boolean;
					}
				).emit("criticalError", error.toStructuredError());
			}
		}

		// Log additional context for critical errors
		const getSystemInfo = () => {
			if (typeof process === "undefined") {
				return {
					runtime: "edge",
					timestamp: Date.now(),
				};
			}

			return this.getSystemInfo();
		};

		this.logger.error("Critical error requires immediate attention", {
			error: error.message || "Unknown error",
			errorDetails: error.toStructuredError(),
			systemInfo: getSystemInfo(),
			errorMetrics: this.getMetrics(),
		});
	}

	/**
	 * Emit error event for external monitoring systems
	 */
	private emitErrorEvent(error: BaseApplicationError): void {
		// Emit error event that can be captured by monitoring systems (only in Node.js)
		if (typeof process !== "undefined" && typeof process.emit === "function") {
			(
				process as NodeJS.Process & {
					emit: (event: string, ...args: unknown[]) => boolean;
				}
			).emit("applicationError", error.toStructuredError());
		}
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
