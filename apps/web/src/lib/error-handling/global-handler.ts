/**
 * Global error handling service for unhandled exceptions and rejections
 */

import { getConfigurationService } from "../config/service";
import { createContextLogger } from "../logging/factory";
import { getTelemetryService } from "../telemetry";

export interface ErrorMetadata {
	correlationId: string;
	timestamp: string;
	environment: string;
	version: string;
	userAgent?: string;
	url?: string;
	userId?: string;
	sessionId?: string;
}

export interface CategorizedError {
	type: "user" | "system" | "external" | "unknown";
	severity: "low" | "medium" | "high" | "critical";
	category: string;
	isRecoverable: boolean;
	shouldRetry: boolean;
}

export interface ErrorReport {
	id: string;
	error: Error;
	metadata: ErrorMetadata;
	categorization: CategorizedError;
	stackTrace: string;
	context: Record<string, unknown>;
}

/**
 * Global error handler service
 */
export class GlobalErrorHandler {
	private logger: ReturnType<typeof createContextLogger> | null = null;
	private initialized = false;
	private errorCount = 0;
	private lastErrorTime = 0;

	private getLogger() {
		if (!this.logger) {
			this.logger = createContextLogger("global-error-handler");
		}
		return this.logger;
	}

	/**
	 * Initialize the global error handler
	 */
	initialize(): void {
		if (this.initialized) {
			this.getLogger().debug("Global error handler already initialized");
			return;
		}

		// Handle unhandled promise rejections
		process.on(
			"unhandledRejection",
			(reason: unknown, promise: Promise<unknown>) => {
				this.handleUnhandledRejection(reason, promise);
			},
		);

		// Handle uncaught exceptions
		process.on("uncaughtException", (error: Error) => {
			this.handleUncaughtException(error);
		});

		// Handle warnings
		process.on("warning", (warning: Error) => {
			this.handleWarning(warning);
		});

		this.initialized = true;
		this.getLogger().info("Global error handler initialized");
	}

	/**
	 * Handle unhandled promise rejections
	 */
	private handleUnhandledRejection(
		reason: unknown,
		promise: Promise<unknown>,
	): void {
		const error = reason instanceof Error ? reason : new Error(String(reason));
		const errorReport = this.createErrorReport(error, {
			type: "unhandled-rejection",
			promise: promise.toString(),
		});

		this.getLogger().error("Unhandled promise rejection", {
			correlationId: errorReport.id,
			error: error.message,
			stack: error.stack,
			categorization: errorReport.categorization,
		});

		this.reportError(errorReport);
		this.updateErrorMetrics();

		// In production, we might want to exit gracefully
		if (
			this.isProduction() &&
			errorReport.categorization.severity === "critical"
		) {
			this.getLogger().error(
				"Critical unhandled rejection, initiating graceful shutdown",
			);
			this.initiateGracefulShutdown();
		}
	}

	/**
	 * Handle uncaught exceptions
	 */
	private handleUncaughtException(error: Error): void {
		const errorReport = this.createErrorReport(error, {
			type: "uncaught-exception",
		});

		this.getLogger().error("Uncaught exception", {
			correlationId: errorReport.id,
			error: error.message,
			stack: error.stack,
			categorization: errorReport.categorization,
		});

		this.reportError(errorReport);
		this.updateErrorMetrics();

		// Uncaught exceptions are always critical
		this.getLogger().error(
			"Critical uncaught exception, initiating graceful shutdown",
		);
		this.initiateGracefulShutdown();
	}

	/**
	 * Handle warnings
	 */
	private handleWarning(warning: Error): void {
		const errorReport = this.createErrorReport(warning, {
			type: "warning",
		});

		this.getLogger().warn("Process warning", {
			correlationId: errorReport.id,
			warning: warning.message,
			stack: warning.stack,
		});

		// Don't report warnings as errors, but track them
		this.trackWarning(errorReport);
	}

	/**
	 * Create a comprehensive error report
	 */
	async createErrorReport(
		error: Error,
		context: Record<string, unknown> = {},
	): Promise<ErrorReport> {
		const correlationId = this.generateCorrelationId();
		const configService = getConfigurationService();
		const config = await configService.getConfiguration();

		const metadata: ErrorMetadata = {
			correlationId,
			timestamp: new Date().toISOString(),
			environment: config.nodeEnv,
			version: config.appVersion,
		};

		const categorization = this.categorizeError(error);

		return {
			id: correlationId,
			error,
			metadata,
			categorization,
			stackTrace: error.stack || "No stack trace available",
			context,
		};
	}

	/**
	 * Categorize error by type and severity
	 */
	private categorizeError(error: Error): CategorizedError {
		const message = error.message.toLowerCase();
		const name = error.name.toLowerCase();

		// System errors
		if (name.includes("configuration") || message.includes("environment")) {
			return {
				type: "system",
				severity: "high",
				category: "configuration",
				isRecoverable: false,
				shouldRetry: false,
			};
		}

		// Database errors
		if (message.includes("database") || message.includes("connection")) {
			return {
				type: "external",
				severity: "high",
				category: "database",
				isRecoverable: true,
				shouldRetry: true,
			};
		}

		// Network/API errors
		if (
			message.includes("fetch") ||
			message.includes("network") ||
			message.includes("timeout")
		) {
			return {
				type: "external",
				severity: "medium",
				category: "network",
				isRecoverable: true,
				shouldRetry: true,
			};
		}

		// Validation errors (typically user errors)
		if (message.includes("validation") || message.includes("invalid")) {
			return {
				type: "user",
				severity: "low",
				category: "validation",
				isRecoverable: true,
				shouldRetry: false,
			};
		}

		// Authentication/authorization errors
		if (message.includes("auth") || message.includes("permission")) {
			return {
				type: "user",
				severity: "medium",
				category: "authorization",
				isRecoverable: true,
				shouldRetry: false,
			};
		}

		// Default categorization
		return {
			type: "unknown",
			severity: "medium",
			category: "general",
			isRecoverable: false,
			shouldRetry: false,
		};
	}

	/**
	 * Report error to monitoring systems
	 */
	private async reportError(errorReport: ErrorReport): Promise<void> {
		try {
			// Report to telemetry if enabled
			const telemetryService = getTelemetryService();
			if (await telemetryService.isEnabled()) {
				// In a real implementation, this would send to OpenTelemetry
				this.getLogger().debug("Error reported to telemetry", {
					correlationId: errorReport.id,
					type: errorReport.categorization.type,
					severity: errorReport.categorization.severity,
				});
			}

			// Store error for analysis (in production, this might go to a database)
			this.storeErrorForAnalysis(errorReport);
		} catch (reportingError) {
			this.getLogger().error("Failed to report error", {
				originalError: errorReport.error.message,
				reportingError:
					reportingError instanceof Error
						? reportingError.message
						: String(reportingError),
			});
		}
	}

	/**
	 * Store error for analysis (placeholder for production implementation)
	 */
	private storeErrorForAnalysis(errorReport: ErrorReport): void {
		// In production, this would store to a database or send to an external service
		this.getLogger().debug("Error stored for analysis", {
			correlationId: errorReport.id,
			category: errorReport.categorization.category,
		});
	}

	/**
	 * Track warning for monitoring
	 */
	private trackWarning(errorReport: ErrorReport): void {
		this.getLogger().debug("Warning tracked", {
			correlationId: errorReport.id,
		});
	}

	/**
	 * Update error rate metrics
	 */
	private updateErrorMetrics(): void {
		this.errorCount++;
		this.lastErrorTime = Date.now();

		// Check for error rate spikes
		const errorRate = this.calculateErrorRate();
		if (errorRate > this.getErrorRateThreshold()) {
			this.getLogger().warn("High error rate detected", {
				errorRate,
				threshold: this.getErrorRateThreshold(),
				errorCount: this.errorCount,
			});
		}
	}

	/**
	 * Calculate current error rate
	 */
	private calculateErrorRate(): number {
		const now = Date.now();
		const timeWindow = 60000; // 1 minute
		const timeSinceLastError = now - this.lastErrorTime;

		if (timeSinceLastError > timeWindow) {
			this.errorCount = 1; // Reset count for new window
			return 1;
		}

		return this.errorCount;
	}

	/**
	 * Get error rate threshold based on environment
	 */
	private getErrorRateThreshold(): number {
		return this.isProduction() ? 5 : 10; // Lower threshold in production
	}

	/**
	 * Check if running in production
	 */
	private async isProduction(): Promise<boolean> {
		try {
			const configService = getConfigurationService();
			return await configService.isProduction();
		} catch {
			return process.env.NODE_ENV === "production";
		}
	}

	/**
	 * Generate correlation ID for error tracking
	 */
	private generateCorrelationId(): string {
		return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Initiate graceful shutdown
	 */
	private initiateGracefulShutdown(): void {
		this.getLogger().info("Initiating graceful shutdown due to critical error");

		// Give some time for logging to complete
		setTimeout(() => {
			process.exit(1);
		}, 1000);
	}

	/**
	 * Get error statistics
	 */
	getErrorStatistics() {
		return {
			errorCount: this.errorCount,
			lastErrorTime: this.lastErrorTime,
			errorRate: this.calculateErrorRate(),
			isInitialized: this.initialized,
		};
	}

	/**
	 * Reset error handler (primarily for testing)
	 */
	reset(): void {
		this.errorCount = 0;
		this.lastErrorTime = 0;
		this.initialized = false;
		this.logger = null;
	}
}

/**
 * Global error handler instance
 */
let _globalErrorHandler: GlobalErrorHandler | null = null;

/**
 * Get the global error handler instance
 */
export function getGlobalErrorHandler(): GlobalErrorHandler {
	if (!_globalErrorHandler) {
		_globalErrorHandler = new GlobalErrorHandler();
	}
	return _globalErrorHandler;
}

/**
 * Initialize global error handling
 * Should be called at application startup
 */
export function initializeGlobalErrorHandling(): void {
	const logger = createContextLogger("error-handling-init");

	try {
		logger.info("Initializing global error handling...");

		const handler = getGlobalErrorHandler();
		handler.initialize();

		logger.info("Global error handling initialized successfully");
		console.log("🛡️ Global error handling initialized successfully");
	} catch (error) {
		logger.error("Failed to initialize global error handling", {
			error: error instanceof Error ? error : String(error),
		});
		console.error("❌ Failed to initialize global error handling:", error);
	}
}

/**
 * Reset global error handler (primarily for testing)
 */
export function resetGlobalErrorHandler(): void {
	if (_globalErrorHandler) {
		_globalErrorHandler.reset();
		_globalErrorHandler = null;
	}
}
