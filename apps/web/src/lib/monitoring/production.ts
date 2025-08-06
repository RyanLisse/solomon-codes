/**
 * Production monitoring and observability configuration
 * Provides comprehensive monitoring, alerting, and performance tracking for production deployments
 */

import * as os from "node:os";
import {
	type Span,
	SpanKind,
	/* SpanStatusCode, */ trace,
} from "@opentelemetry/api"; // SpanStatusCode unused
import type { ContextAwareLogger } from "@/lib/logging/factory";
import { createApiLogger } from "@/lib/logging/factory";

// Production monitoring configuration
export interface ProductionMonitoringConfig {
	metrics: {
		enabled: boolean;
		interval: number; // Collection interval in ms
		retention: number; // Retention period in ms
	};
	alerting: {
		enabled: boolean;
		thresholds: {
			errorRate: number; // Error rate threshold (0-1)
			responseTime: number; // Response time threshold in ms
			memoryUsage: number; // Memory usage threshold (0-1)
			cpuUsage: number; // CPU usage threshold (0-1)
		};
		channels: {
			email?: string[];
			webhook?: string;
			slack?: string;
		};
	};
	tracing: {
		enabled: boolean;
		samplingRate: number; // Sampling rate (0-1)
		exportInterval: number; // Export interval in ms
	};
	logging: {
		level: "error" | "warn" | "info" | "debug";
		structured: boolean;
		enableConsole: boolean;
		enableFile: boolean;
		retention: number; // Log retention in days
	};
}

// Performance metrics interface
export interface PerformanceMetrics {
	timestamp: number;
	responseTime: {
		avg: number;
		p50: number;
		p95: number;
		p99: number;
	};
	errorRate: number;
	throughput: number; // Requests per second
	memory: {
		used: number;
		total: number;
		percentage: number;
	};
	cpu: {
		usage: number;
		loadAverage: number[];
	};
	activeConnections: number;
	uptime: number;
}

// Alert severity levels
export enum AlertSeverity {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
	CRITICAL = "critical",
}

// Alert interface
export interface Alert {
	id: string;
	timestamp: number;
	severity: AlertSeverity;
	title: string;
	description: string;
	metrics: Partial<PerformanceMetrics>;
	threshold: number;
	currentValue: number;
}

/**
 * Production monitoring service
 */
export class ProductionMonitoringService {
	private config: ProductionMonitoringConfig;
	private logger: ContextAwareLogger;
	private metricsBuffer: PerformanceMetrics[] = [];
	private alertHistory: Alert[] = [];
	private isEnabled = false;

	constructor() {
		this.config = this.getProductionConfig();
		this.logger = createApiLogger("production-monitoring");
		this.initialize();
	}

	/**
	 * Get production monitoring configuration
	 */
	private getProductionConfig(): ProductionMonitoringConfig {
		const isProduction = process.env.NODE_ENV === "production";

		return {
			metrics: {
				enabled: isProduction,
				interval: Number.parseInt(process.env.METRICS_INTERVAL || "30000"), // 30 seconds
				retention: Number.parseInt(process.env.METRICS_RETENTION || "86400000"), // 24 hours
			},
			alerting: {
				enabled: isProduction && Boolean(process.env.ALERTING_ENABLED),
				thresholds: {
					errorRate: Number.parseFloat(
						process.env.ERROR_RATE_THRESHOLD || "0.05",
					), // 5%
					responseTime: Number.parseInt(
						process.env.RESPONSE_TIME_THRESHOLD || "2000",
					), // 2 seconds
					memoryUsage: Number.parseFloat(
						process.env.MEMORY_THRESHOLD || "0.85",
					), // 85%
					cpuUsage: Number.parseFloat(process.env.CPU_THRESHOLD || "0.80"), // 80%
				},
				channels: {
					email: process.env.ALERT_EMAIL
						? process.env.ALERT_EMAIL.split(",")
						: undefined,
					webhook: process.env.ALERT_WEBHOOK,
					slack: process.env.ALERT_SLACK_WEBHOOK,
				},
			},
			tracing: {
				enabled: isProduction,
				samplingRate: Number.parseFloat(
					process.env.TRACE_SAMPLING_RATE || "0.1",
				), // 10%
				exportInterval: Number.parseInt(
					process.env.TRACE_EXPORT_INTERVAL || "5000",
				), // 5 seconds
			},
			logging: {
				level:
					(process.env.LOG_LEVEL as "error" | "warn" | "info" | "debug") ||
					"info",
				structured: isProduction,
				enableConsole: true,
				enableFile: isProduction,
				retention: Number.parseInt(process.env.LOG_RETENTION_DAYS || "30"), // 30 days
			},
		};
	}

	/**
	 * Initialize monitoring service
	 */
	private initialize(): void {
		if (!this.config.metrics.enabled) {
			this.logger.info(
				"Production monitoring disabled for non-production environment",
			);
			return;
		}

		this.isEnabled = true;
		this.logger.info("Initializing production monitoring service");

		// Start metrics collection
		if (this.config.metrics.enabled) {
			this.startMetricsCollection();
		}

		// Setup graceful shutdown
		process.on("SIGTERM", () => this.shutdown());
		process.on("SIGINT", () => this.shutdown());

		this.logger.info("Production monitoring service initialized");
	}

	/**
	 * Start metrics collection
	 */
	private startMetricsCollection(): void {
		setInterval(() => {
			this.collectMetrics();
		}, this.config.metrics.interval);

		// Cleanup old metrics
		setInterval(() => {
			this.cleanupOldMetrics();
		}, this.config.metrics.interval * 10); // Cleanup every 10 intervals
	}

	/**
	 * Collect performance metrics
	 */
	private async collectMetrics(): Promise<void> {
		try {
			const metrics = await this.gatherSystemMetrics();
			this.metricsBuffer.push(metrics);

			// Check for alerts
			if (this.config.alerting.enabled) {
				await this.checkAlertThresholds(metrics);
			}

			// Log metrics in structured format
			this.logger.info("Performance metrics collected", {
				metrics,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			this.logger.error("Failed to collect metrics", {
				error: error instanceof Error ? error : String(error),
			});
		}
	}

	/**
	 * Gather system metrics
	 */
	private async gatherSystemMetrics(): Promise<PerformanceMetrics> {
		const memoryUsage = process.memoryUsage();
		const cpuUsage = process.cpuUsage();

		// Calculate response time percentiles from recent requests
		const responseTimes = this.getRecentResponseTimes();

		return {
			timestamp: Date.now(),
			responseTime: {
				avg: this.calculateAverage(responseTimes),
				p50: this.calculatePercentile(responseTimes, 0.5),
				p95: this.calculatePercentile(responseTimes, 0.95),
				p99: this.calculatePercentile(responseTimes, 0.99),
			},
			errorRate: this.calculateErrorRate(),
			throughput: this.calculateThroughput(),
			memory: {
				used: memoryUsage.heapUsed,
				total: memoryUsage.heapTotal,
				percentage: memoryUsage.heapUsed / memoryUsage.heapTotal,
			},
			cpu: {
				usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
				loadAverage: process.platform !== "win32" ? os.loadavg() : [0, 0, 0],
			},
			activeConnections: this.getActiveConnectionCount(),
			uptime: process.uptime(),
		};
	}

	/**
	 * Check alert thresholds and send notifications
	 */
	private async checkAlertThresholds(
		metrics: PerformanceMetrics,
	): Promise<void> {
		const alerts: Alert[] = [];

		// Check error rate threshold
		if (metrics.errorRate > this.config.alerting.thresholds.errorRate) {
			alerts.push({
				id: `error-rate-${Date.now()}`,
				timestamp: Date.now(),
				severity:
					metrics.errorRate > 0.1 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
				title: "High Error Rate Detected",
				description: `Error rate (${(metrics.errorRate * 100).toFixed(2)}%) exceeds threshold (${(this.config.alerting.thresholds.errorRate * 100).toFixed(2)}%)`,
				metrics,
				threshold: this.config.alerting.thresholds.errorRate,
				currentValue: metrics.errorRate,
			});
		}

		// Check response time threshold
		if (
			metrics.responseTime.p95 > this.config.alerting.thresholds.responseTime
		) {
			alerts.push({
				id: `response-time-${Date.now()}`,
				timestamp: Date.now(),
				severity:
					metrics.responseTime.p95 >
					this.config.alerting.thresholds.responseTime * 2
						? AlertSeverity.CRITICAL
						: AlertSeverity.HIGH,
				title: "High Response Time Detected",
				description: `95th percentile response time (${metrics.responseTime.p95.toFixed(0)}ms) exceeds threshold (${this.config.alerting.thresholds.responseTime}ms)`,
				metrics,
				threshold: this.config.alerting.thresholds.responseTime,
				currentValue: metrics.responseTime.p95,
			});
		}

		// Check memory usage threshold
		if (
			metrics.memory.percentage > this.config.alerting.thresholds.memoryUsage
		) {
			alerts.push({
				id: `memory-usage-${Date.now()}`,
				timestamp: Date.now(),
				severity:
					metrics.memory.percentage > 0.95
						? AlertSeverity.CRITICAL
						: AlertSeverity.HIGH,
				title: "High Memory Usage Detected",
				description: `Memory usage (${(metrics.memory.percentage * 100).toFixed(1)}%) exceeds threshold (${(this.config.alerting.thresholds.memoryUsage * 100).toFixed(1)}%)`,
				metrics,
				threshold: this.config.alerting.thresholds.memoryUsage,
				currentValue: metrics.memory.percentage,
			});
		}

		// Send alerts
		for (const alert of alerts) {
			await this.sendAlert(alert);
			this.alertHistory.push(alert);
		}
	}

	/**
	 * Send alert notification
	 */
	private async sendAlert(alert: Alert): Promise<void> {
		this.logger.warn("Alert triggered", { alert });

		// Send to configured channels
		const promises: Promise<void>[] = [];

		if (this.config.alerting.channels.webhook) {
			promises.push(this.sendWebhookAlert(alert));
		}

		if (this.config.alerting.channels.slack) {
			promises.push(this.sendSlackAlert(alert));
		}

		if (this.config.alerting.channels.email) {
			promises.push(this.sendEmailAlert(alert));
		}

		await Promise.allSettled(promises);
	}

	/**
	 * Send webhook alert
	 */
	private async sendWebhookAlert(alert: Alert): Promise<void> {
		try {
			const response = await fetch(
				this.config.alerting.channels.webhook || "",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						alert,
						service: "solomon-codes-web",
						environment: process.env.NODE_ENV,
						timestamp: new Date().toISOString(),
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Webhook request failed: ${response.status}`);
			}
		} catch (error) {
			this.logger.error("Failed to send webhook alert", {
				error: error instanceof Error ? error : String(error),
				alert,
			});
		}
	}

	/**
	 * Send Slack alert
	 */
	private async sendSlackAlert(alert: Alert): Promise<void> {
		try {
			const color = {
				[AlertSeverity.LOW]: "#36a64f",
				[AlertSeverity.MEDIUM]: "#ffaa00",
				[AlertSeverity.HIGH]: "#ff6600",
				[AlertSeverity.CRITICAL]: "#ff0000",
			}[alert.severity];

			const payload = {
				attachments: [
					{
						color,
						title: `🚨 ${alert.title}`,
						text: alert.description,
						fields: [
							{
								title: "Severity",
								value: alert.severity.toUpperCase(),
								short: true,
							},
							{
								title: "Environment",
								value: process.env.NODE_ENV,
								short: true,
							},
							{
								title: "Threshold",
								value: alert.threshold.toString(),
								short: true,
							},
							{
								title: "Current Value",
								value: alert.currentValue.toString(),
								short: true,
							},
						],
						timestamp: Math.floor(alert.timestamp / 1000),
					},
				],
			};

			const response = await fetch(this.config.alerting.channels.slack || "", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				throw new Error(`Slack webhook request failed: ${response.status}`);
			}
		} catch (error) {
			this.logger.error("Failed to send Slack alert", {
				error: error instanceof Error ? error : String(error),
				alert,
			});
		}
	}

	/**
	 * Send email alert (placeholder implementation)
	 */
	private async sendEmailAlert(alert: Alert): Promise<void> {
		// This would integrate with your email service
		this.logger.info("Email alert would be sent", {
			alert,
			recipients: this.config.alerting.channels.email,
		});
	}

	/**
	 * Create monitoring middleware for Next.js API routes
	 */
	public createApiMiddleware() {
		interface Request {
			method: string;
			url: string;
			headers?: Record<string, string>;
		}

		interface Response {
			statusCode: number;
			end?: (...args: unknown[]) => void;
		}

		return async (request: Request, response: Response, next?: () => void) => {
			if (!this.isEnabled) {
				if (next) next();
				return;
			}

			const tracer = trace.getTracer("api-monitoring");
			const startTime = Date.now();

			return tracer.startActiveSpan(
				`${request.method} ${request.url}`,
				{
					kind: SpanKind.SERVER,
					attributes: {
						"http.method": request.method,
						"http.url": request.url,
						"http.user_agent": request.headers?.["user-agent"] || "unknown",
					},
				},
				(span: Span) => {
					// Call next middleware if provided
					if (next) next();

					// Set up response completion tracking
					if (response.end) {
						const originalEnd = response.end;
						response.end = function (...args: unknown[]) {
							const endTime = Date.now();
							const duration = endTime - startTime;

							// Record metrics
							span.setAttributes({
								"http.response_time_ms": duration,
								"http.status_code": response.statusCode,
							});

							span.end();

							// Call original end function
							return originalEnd.apply(this, args);
						};
					} else {
						// For cases where response.end is not available
						const endTime = Date.now();
						const duration = endTime - startTime;

						span.setAttributes({
							"http.response_time_ms": duration,
						});

						span.end();
					}
				},
			);
		};
	}

	/**
	 * Get monitoring dashboard data
	 */
	public getDashboardData(): {
		metrics: PerformanceMetrics[];
		alerts: Alert[];
		config: ProductionMonitoringConfig;
	} {
		return {
			metrics: this.metricsBuffer.slice(-100), // Last 100 metrics
			alerts: this.alertHistory.slice(-50), // Last 50 alerts
			config: this.config,
		};
	}

	/**
	 * Cleanup old metrics to prevent memory leaks
	 */
	private cleanupOldMetrics(): void {
		const cutoffTime = Date.now() - this.config.metrics.retention;
		this.metricsBuffer = this.metricsBuffer.filter(
			(metric) => metric.timestamp > cutoffTime,
		);
		this.alertHistory = this.alertHistory.filter(
			(alert) => alert.timestamp > cutoffTime,
		);
	}

	/**
	 * Graceful shutdown
	 */
	private shutdown(): void {
		this.logger.info("Shutting down production monitoring service");
		// Perform any cleanup here
	}

	// Helper methods for metric calculations
	private getRecentResponseTimes(): number[] {
		// This would typically come from request tracking
		// For now, return empty array
		return [];
	}

	private calculateAverage(values: number[]): number {
		if (values.length === 0) return 0;
		return values.reduce((sum, val) => sum + val, 0) / values.length;
	}

	private calculatePercentile(values: number[], percentile: number): number {
		if (values.length === 0) return 0;
		const sorted = values.sort((a, b) => a - b);
		const index = Math.ceil(sorted.length * percentile) - 1;
		return sorted[index] || 0;
	}

	private calculateErrorRate(): number {
		// This would typically come from request tracking
		// For now, return 0
		return 0;
	}

	private calculateThroughput(): number {
		// This would typically come from request tracking
		// For now, return 0
		return 0;
	}

	private getActiveConnectionCount(): number {
		// This would typically come from server metrics
		// For now, return 0
		return 0;
	}

	// Test-only methods for accessing private functionality
	/**
	 * Test-only method to access sendAlert functionality
	 * @internal
	 */
	public testSendAlert(alert: Alert): Promise<void> {
		return this.sendAlert(alert);
	}

	/**
	 * Test-only method to access cleanupOldMetrics functionality
	 * @internal
	 */
	public testCleanupOldMetrics(): void {
		this.cleanupOldMetrics();
	}

	/**
	 * Test-only method to access calculatePercentile functionality
	 * @internal
	 */
	public testCalculatePercentile(values: number[], percentile: number): number {
		return this.calculatePercentile(values, percentile);
	}

	/**
	 * Test-only method to access calculateAverage functionality
	 * @internal
	 */
	public testCalculateAverage(values: number[]): number {
		return this.calculateAverage(values);
	}

	/**
	 * Test-only method to access checkAlertThresholds functionality
	 * @internal
	 */
	public testCheckAlertThresholds(metrics: PerformanceMetrics): Promise<void> {
		return this.checkAlertThresholds(metrics);
	}

	/**
	 * Test-only method to access shutdown functionality
	 * @internal
	 */
	public testShutdown(): void {
		this.shutdown();
	}
}

// Export singleton instance
export const productionMonitoring = new ProductionMonitoringService();
