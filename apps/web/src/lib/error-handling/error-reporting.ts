/**
 * Error reporting service for production issue tracking
 */

import { getConfigurationService } from "../config/service";
import { createContextLogger } from "../logging/factory";
import { getTelemetryService } from "../telemetry";
import type { ErrorReport } from "./global-handler";

export interface ErrorReportingConfig {
	enabled: boolean;
	samplingRate: number;
	batchSize: number;
	flushInterval: number;
	maxRetries: number;
	endpoint?: string;
	apiKey?: string;
}

export interface ErrorTrend {
	errorType: string;
	count: number;
	firstSeen: string;
	lastSeen: string;
	trend: "increasing" | "decreasing" | "stable";
	severity: "low" | "medium" | "high" | "critical";
}

export interface ErrorMetrics {
	totalErrors: number;
	errorRate: number;
	uniqueErrors: number;
	topErrors: Array<{ message: string; count: number }>;
	trends: ErrorTrend[];
}

/**
 * Error reporting service implementation
 */
export class ErrorReportingService {
	private logger: ReturnType<typeof createContextLogger> | null = null;
	private config: ErrorReportingConfig;
	private errorBuffer: ErrorReport[] = [];
	private readonly errorCounts = new Map<string, number>();
	private readonly errorFirstSeen = new Map<string, string>();
	private readonly errorLastSeen = new Map<string, string>();
	private flushTimer: NodeJS.Timeout | null = null;
	private initialized = false;

	constructor(config?: Partial<ErrorReportingConfig>) {
		this.config = {
			enabled: true,
			samplingRate: 1.0, // Report all errors by default
			batchSize: 10,
			flushInterval: 30000, // 30 seconds
			maxRetries: 3,
			...config,
		};
	}

	private getLogger() {
		if (!this.logger) {
			this.logger = createContextLogger("error-reporting");
		}
		return this.logger;
	}

	/**
	 * Initialize the error reporting service
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			this.getLogger().debug("Error reporting service already initialized");
			return;
		}

		try {
			const configService = getConfigurationService();
			const serverConfig = await configService.getServerConfig();
			const environment = serverConfig.environment;

			// Adjust sampling rate based on environment
			if (environment === "development") {
				this.config.samplingRate = 0.1; // Sample 10% in development
			} else if (environment === "staging") {
				this.config.samplingRate = 0.5; // Sample 50% in staging
			}

			// Start periodic flush
			this.startPeriodicFlush();

			this.initialized = true;
			this.getLogger().info("Error reporting service initialized", {
				samplingRate: this.config.samplingRate,
				batchSize: this.config.batchSize,
				flushInterval: this.config.flushInterval,
			});
		} catch (error) {
			this.getLogger().error("Failed to initialize error reporting service", {
				error: error instanceof Error ? error : String(error),
			});
		}
	}

	/**
	 * Report an error
	 */
	reportError(errorReport: ErrorReport): void {
		if (!this.config.enabled || !this.shouldSampleError()) {
			return;
		}

		try {
			// Update error tracking
			this.updateErrorTracking(errorReport);

			// Add to buffer
			this.errorBuffer.push(errorReport);

			this.getLogger().debug("Error added to reporting buffer", {
				correlationId: errorReport.id,
				bufferSize: this.errorBuffer.length,
				errorType: errorReport.categorization.type,
			});

			// Flush if buffer is full
			if (this.errorBuffer.length >= this.config.batchSize) {
				this.flush();
			}

			// Immediate flush for critical errors
			if (errorReport.categorization.severity === "critical") {
				this.flush();
			}
		} catch (error) {
			this.getLogger().error("Failed to report error", {
				originalErrorId: errorReport.id,
				reportingError: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Update error tracking for trend analysis
	 */
	private updateErrorTracking(errorReport: ErrorReport): void {
		const errorKey = this.getErrorKey(errorReport);
		const timestamp = errorReport.metadata.timestamp;

		// Update counts
		const currentCount = this.errorCounts.get(errorKey) || 0;
		this.errorCounts.set(errorKey, currentCount + 1);

		// Update timestamps
		if (!this.errorFirstSeen.has(errorKey)) {
			this.errorFirstSeen.set(errorKey, timestamp);
		}
		this.errorLastSeen.set(errorKey, timestamp);
	}

	/**
	 * Get unique key for error tracking
	 */
	private getErrorKey(errorReport: ErrorReport): string {
		return `${errorReport.error.name}:${errorReport.error.message}:${errorReport.categorization.category}`;
	}

	/**
	 * Determine if error should be sampled
	 */
	private shouldSampleError(): boolean {
		return Math.random() < this.config.samplingRate;
	}

	/**
	 * Flush error buffer
	 */
	async flush(): Promise<void> {
		if (this.errorBuffer.length === 0) {
			return;
		}

		const errorsToFlush = [...this.errorBuffer];
		this.errorBuffer = [];

		this.getLogger().debug("Flushing error buffer", {
			errorCount: errorsToFlush.length,
		});

		try {
			await this.sendErrors(errorsToFlush);
			this.getLogger().debug("Error buffer flushed successfully", {
				errorCount: errorsToFlush.length,
			});
		} catch (error) {
			this.getLogger().error("Failed to flush error buffer", {
				errorCount: errorsToFlush.length,
				error: error instanceof Error ? error.message : String(error),
			});

			// Re-add errors to buffer for retry (with limit)
			if (this.errorBuffer.length < this.config.batchSize * 2) {
				this.errorBuffer.unshift(...errorsToFlush);
			}
		}
	}

	/**
	 * Send errors to external service
	 */
	private async sendErrors(errors: ErrorReport[]): Promise<void> {
		// In a real implementation, this would send to an external service like Sentry
		const telemetryService = getTelemetryService();

		if (await telemetryService.isEnabled()) {
			// Send to OpenTelemetry
			for (const error of errors) {
				this.sendToTelemetry(error);
			}
		}

		// Log errors for analysis
		this.logErrorsForAnalysis(errors);

		// In production, you might send to external services:
		// await this.sendToSentry(errors);
		// await this.sendToDatadog(errors);
		// await this.sendToCloudWatch(errors);
	}

	/**
	 * Send error to telemetry system
	 */
	private sendToTelemetry(errorReport: ErrorReport): void {
		// This would integrate with OpenTelemetry spans/events
		this.getLogger().debug("Error sent to telemetry", {
			correlationId: errorReport.id,
			errorType: errorReport.categorization.type,
			severity: errorReport.categorization.severity,
		});
	}

	/**
	 * Log errors for analysis
	 */
	private logErrorsForAnalysis(errors: ErrorReport[]): void {
		for (const error of errors) {
			this.getLogger().info("Error report", {
				correlationId: error.id,
				errorMessage: error.error.message,
				errorType: error.categorization.type,
				severity: error.categorization.severity,
				category: error.categorization.category,
				environment: error.metadata.environment,
				version: error.metadata.version,
				isRecoverable: error.categorization.isRecoverable,
				shouldRetry: error.categorization.shouldRetry,
				context: error.context,
			});
		}
	}

	/**
	 * Get error metrics for monitoring
	 */
	getErrorMetrics(): ErrorMetrics {
		const totalErrors = Array.from(this.errorCounts.values()).reduce(
			(sum, count) => sum + count,
			0,
		);
		const uniqueErrors = this.errorCounts.size;

		// Calculate error rate (errors per minute)
		const now = new Date();
		const oneMinuteAgo = new Date(now.getTime() - 60000);
		let recentErrors = 0;

		for (const [errorKey, lastSeen] of this.errorLastSeen) {
			if (new Date(lastSeen) > oneMinuteAgo) {
				recentErrors += this.errorCounts.get(errorKey) || 0;
			}
		}

		// Top errors by count
		const topErrors = Array.from(this.errorCounts.entries())
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)
			.map(([message, count]) => ({
				message: message.split(":")[1] || message, // Extract just the message
				count,
			}));

		// Generate trends
		const trends = this.generateErrorTrends();

		return {
			totalErrors,
			errorRate: recentErrors,
			uniqueErrors,
			topErrors,
			trends,
		};
	}

	/**
	 * Generate error trends for analysis
	 */
	private generateErrorTrends(): ErrorTrend[] {
		const trends: ErrorTrend[] = [];
		const now = new Date();

		for (const [errorKey, count] of this.errorCounts) {
			const firstSeen = this.errorFirstSeen.get(errorKey) || now.toISOString();
			const lastSeen = this.errorLastSeen.get(errorKey) || now.toISOString();

			// Simple trend calculation (would be more sophisticated in production)
			const firstSeenTime = new Date(firstSeen).getTime();
			const lastSeenTime = new Date(lastSeen).getTime();
			const timeSpan = lastSeenTime - firstSeenTime;
			const hoursSinceFirst = timeSpan / (1000 * 60 * 60);

			let trend: "increasing" | "decreasing" | "stable" = "stable";
			if (hoursSinceFirst > 1) {
				const rate = count / hoursSinceFirst;
				if (rate > 1) trend = "increasing";
				else if (rate < 0.1) trend = "decreasing";
			}

			let severity: "low" | "medium" | "high" | "critical" = "low";
			if (count > 100) severity = "critical";
			else if (count > 50) severity = "high";
			else if (count > 10) severity = "medium";

			trends.push({
				errorType: errorKey.split(":")[0] || "unknown",
				count,
				firstSeen,
				lastSeen,
				trend,
				severity,
			});
		}

		return trends.sort((a, b) => b.count - a.count);
	}

	/**
	 * Start periodic flushing
	 */
	private startPeriodicFlush(): void {
		this.flushTimer = setInterval(() => {
			this.flush().catch((error) => {
				this.getLogger().error("Periodic flush failed", { error });
			});
		}, this.config.flushInterval);
	}

	/**
	 * Shutdown the error reporting service
	 */
	shutdown(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}

		// Flush any remaining errors
		this.flush().catch((error) => {
			this.getLogger().error("Final flush failed during shutdown", { error });
		});

		this.initialized = false;
		this.getLogger().info("Error reporting service shutdown");
	}

	/**
	 * Clear error tracking data (for testing/development)
	 */
	clearErrorData(): void {
		this.errorBuffer = [];
		this.errorCounts.clear();
		this.errorFirstSeen.clear();
		this.errorLastSeen.clear();
		this.getLogger().debug("Error tracking data cleared");
	}

	/**
	 * Get current configuration
	 */
	getConfig(): ErrorReportingConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<ErrorReportingConfig>): void {
		this.config = { ...this.config, ...newConfig };
		this.getLogger().info("Error reporting configuration updated", {
			newConfig,
		});
	}
}

/**
 * Global error reporting service instance
 */
let _errorReportingService: ErrorReportingService | null = null;

/**
 * Get the global error reporting service instance
 */
export function getErrorReportingService(): ErrorReportingService {
	if (!_errorReportingService) {
		_errorReportingService = new ErrorReportingService();
	}
	return _errorReportingService;
}

/**
 * Initialize error reporting service
 */
export function initializeErrorReporting(
	config?: Partial<ErrorReportingConfig>,
): void {
	const logger = createContextLogger("error-reporting-init");

	try {
		logger.info("Initializing error reporting service...");

		const service = getErrorReportingService();
		if (config) {
			service.updateConfig(config);
		}
		service.initialize();

		logger.info("Error reporting service initialized successfully");
		console.log("📊 Error reporting service initialized successfully");
	} catch (error) {
		logger.error("Failed to initialize error reporting service", {
			error: error instanceof Error ? error : String(error),
		});
		console.error("❌ Failed to initialize error reporting service:", error);
	}
}

/**
 * Reset error reporting service (primarily for testing)
 */
export function resetErrorReportingService(): void {
	if (_errorReportingService) {
		_errorReportingService.shutdown();
		_errorReportingService = null;
	}
}
