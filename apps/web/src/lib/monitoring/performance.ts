/**
 * Performance monitoring and alerting service
 */

import { createContextLogger } from "../logging/factory";
import { getTelemetryService } from "../telemetry";

export interface PerformanceMetric {
	name: string;
	value: number;
	unit: "ms" | "bytes" | "count" | "percentage" | "rate";
	timestamp: string;
	tags: Record<string, string>;
}

export interface PerformanceBaseline {
	metric: string;
	p50: number;
	p95: number;
	p99: number;
	mean: number;
	count: number;
	lastUpdated: string;
}

export interface PerformanceAlert {
	id: string;
	metric: string;
	threshold: number;
	currentValue: number;
	severity: "warning" | "critical";
	message: string;
	timestamp: string;
}

export interface ResourceUtilization {
	cpu: {
		usage: number;
		loadAverage: number[];
	};
	memory: {
		used: number;
		total: number;
		percentage: number;
		heapUsed: number;
		heapTotal: number;
	};
	disk: {
		used: number;
		total: number;
		percentage: number;
	};
	network: {
		bytesIn: number;
		bytesOut: number;
		connectionsActive: number;
	};
}

export interface PerformanceConfig {
	enabled: boolean;
	metricsRetention: number; // days
	baselineWindow: number; // hours
	alertingEnabled: boolean;
	thresholds: {
		responseTime: number; // ms
		memoryUsage: number; // percentage
		errorRate: number; // percentage
		cpuUsage: number; // percentage
	};
}

/**
 * Performance monitoring service
 */
export class PerformanceMonitoringService {
	private logger: ReturnType<typeof createContextLogger> | null = null;
	private config: PerformanceConfig;
	private metrics: PerformanceMetric[] = [];
	private baselines = new Map<string, PerformanceBaseline>();
	private alerts: PerformanceAlert[] = [];
	private monitoringInterval: NodeJS.Timeout | null = null;
	private initialized = false;

	constructor(config?: Partial<PerformanceConfig>) {
		this.config = {
			enabled: true,
			metricsRetention: 7, // 7 days
			baselineWindow: 24, // 24 hours
			alertingEnabled: true,
			thresholds: {
				responseTime: 1000, // 1 second
				memoryUsage: 80, // 80%
				errorRate: 5, // 5%
				cpuUsage: 80, // 80%
			},
			...config,
		};
	}

	private getLogger() {
		if (!this.logger) {
			this.logger = createContextLogger("performance-monitoring");
		}
		return this.logger;
	}

	/**
	 * Initialize performance monitoring
	 */
	initialize(): void {
		if (this.initialized) {
			this.getLogger().debug("Performance monitoring already initialized");
			return;
		}

		if (!this.config.enabled) {
			this.getLogger().info("Performance monitoring disabled");
			return;
		}

		try {
			// Start monitoring
			this.startMonitoring();

			// Load existing baselines
			this.loadBaselines();

			this.initialized = true;
			this.getLogger().info("Performance monitoring initialized", {
				retention: this.config.metricsRetention,
				baselineWindow: this.config.baselineWindow,
				alertingEnabled: this.config.alertingEnabled,
			});
		} catch (error) {
			this.getLogger().error("Failed to initialize performance monitoring", {
				error: error instanceof Error ? error : String(error),
			});
		}
	}

	/**
	 * Record a performance metric
	 */
	recordMetric(
		name: string,
		value: number,
		unit: PerformanceMetric["unit"],
		tags: Record<string, string> = {},
	): void {
		if (!this.config.enabled) return;

		const metric: PerformanceMetric = {
			name,
			value,
			unit,
			timestamp: new Date().toISOString(),
			tags,
		};

		this.metrics.push(metric);

		// Clean old metrics
		this.cleanOldMetrics();

		// Update baselines
		this.updateBaseline(metric);

		// Check for alerts
		this.checkAlerts(metric);

		// Send to telemetry
		this.sendToTelemetry(metric);

		this.getLogger().debug("Performance metric recorded", {
			name,
			value,
			unit,
			tags,
		});
	}

	/**
	 * Record response time metric
	 */
	recordResponseTime(
		endpoint: string,
		duration: number,
		statusCode: number,
	): void {
		this.recordMetric("response_time", duration, "ms", {
			endpoint,
			status_code: statusCode.toString(),
		});
	}

	/**
	 * Record database query performance
	 */
	recordDatabaseQuery(query: string, duration: number, success: boolean): void {
		this.recordMetric("db_query_time", duration, "ms", {
			query_type: this.extractQueryType(query),
			success: success.toString(),
		});
	}

	/**
	 * Record memory usage
	 */
	recordMemoryUsage(): void {
		const memUsage = process.memoryUsage();

		this.recordMetric("memory_heap_used", memUsage.heapUsed, "bytes");
		this.recordMetric("memory_heap_total", memUsage.heapTotal, "bytes");
		this.recordMetric("memory_rss", memUsage.rss, "bytes");
		this.recordMetric("memory_external", memUsage.external, "bytes");
	}

	/**
	 * Record CPU usage
	 */
	recordCPUUsage(): void {
		const cpuUsage = process.cpuUsage();
		const uptimeMs = process.uptime() * 1000;

		// Calculate CPU percentage
		const userCpuPercent = (cpuUsage.user / 1000 / uptimeMs) * 100;
		const systemCpuPercent = (cpuUsage.system / 1000 / uptimeMs) * 100;
		const totalCpuPercent = userCpuPercent + systemCpuPercent;

		this.recordMetric("cpu_usage_user", userCpuPercent, "percentage");
		this.recordMetric("cpu_usage_system", systemCpuPercent, "percentage");
		this.recordMetric("cpu_usage_total", totalCpuPercent, "percentage");
	}

	/**
	 * Get resource utilization
	 */
	getResourceUtilization(): ResourceUtilization {
		const memUsage = process.memoryUsage();
		const cpuUsage = process.cpuUsage();
		const uptime = process.uptime();

		// Calculate CPU percentage
		const totalCpuPercent =
			((cpuUsage.user + cpuUsage.system) / 1000 / (uptime * 1000)) * 100;

		return {
			cpu: {
				usage: totalCpuPercent,
				loadAverage: [0, 0, 0], // Not available in Node.js
			},
			memory: {
				used: memUsage.heapUsed,
				total: memUsage.heapTotal,
				percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
				heapUsed: memUsage.heapUsed,
				heapTotal: memUsage.heapTotal,
			},
			disk: {
				used: 0, // Would require additional libraries
				total: 0,
				percentage: 0,
			},
			network: {
				bytesIn: 0, // Would require tracking
				bytesOut: 0,
				connectionsActive: 0,
			},
		};
	}

	/**
	 * Get performance metrics for a time range
	 */
	getMetrics(name?: string, hours = 1): PerformanceMetric[] {
		const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

		return this.metrics.filter((metric) => {
			const metricTime = new Date(metric.timestamp);
			return metricTime > cutoff && (!name || metric.name === name);
		});
	}

	/**
	 * Get performance baseline for a metric
	 */
	getBaseline(metricName: string): PerformanceBaseline | null {
		return this.baselines.get(metricName) || null;
	}

	/**
	 * Get current alerts
	 */
	getAlerts(): PerformanceAlert[] {
		// Return only recent alerts (last 24 hours)
		const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
		return this.alerts.filter((alert) => new Date(alert.timestamp) > cutoff);
	}

	/**
	 * Get performance summary
	 */
	getPerformanceSummary(hours = 1) {
		const metrics = this.getMetrics(undefined, hours);
		const alerts = this.getAlerts();
		const resourceUtilization = this.getResourceUtilization();

		// Calculate averages by metric
		const averages = new Map<string, number>();
		const counts = new Map<string, number>();

		for (const metric of metrics) {
			const current = averages.get(metric.name) || 0;
			const count = counts.get(metric.name) || 0;
			averages.set(metric.name, current + metric.value);
			counts.set(metric.name, count + 1);
		}

		for (const [name, total] of averages) {
			const count = counts.get(name) || 1;
			averages.set(name, total / count);
		}

		return {
			timeRange: `${hours} hours`,
			totalMetrics: metrics.length,
			activeAlerts: alerts.length,
			resourceUtilization,
			averages: Object.fromEntries(averages),
			baselines: Object.fromEntries(this.baselines),
		};
	}

	/**
	 * Start monitoring system resources
	 */
	private startMonitoring(): void {
		this.monitoringInterval = setInterval(() => {
			try {
				this.recordMemoryUsage();
				this.recordCPUUsage();

				// Record uptime
				this.recordMetric("uptime", process.uptime(), "count");
			} catch (error) {
				this.getLogger().error("Error during system monitoring", {
					error: error instanceof Error ? error : String(error),
				});
			}
		}, 30000); // Every 30 seconds
	}

	/**
	 * Update baseline for a metric
	 */
	private updateBaseline(metric: PerformanceMetric): void {
		const windowStart = new Date(
			Date.now() - this.config.baselineWindow * 60 * 60 * 1000,
		);
		const recentMetrics = this.metrics.filter(
			(m) => m.name === metric.name && new Date(m.timestamp) > windowStart,
		);

		if (recentMetrics.length < 10) return; // Need enough data points

		const values = recentMetrics.map((m) => m.value).sort((a, b) => a - b);
		const count = values.length;

		const baseline: PerformanceBaseline = {
			metric: metric.name,
			p50: this.percentile(values, 50),
			p95: this.percentile(values, 95),
			p99: this.percentile(values, 99),
			mean: values.reduce((sum, val) => sum + val, 0) / count,
			count,
			lastUpdated: new Date().toISOString(),
		};

		this.baselines.set(metric.name, baseline);
	}

	/**
	 * Check for performance alerts
	 */
	private checkAlerts(metric: PerformanceMetric): void {
		if (!this.config.alertingEnabled) return;

		const baseline = this.baselines.get(metric.name);
		if (!baseline) return;

		// Check if metric exceeds thresholds
		let alertTriggered = false;
		let severity: "warning" | "critical" = "warning";
		let message = "";

		// Response time alerts
		if (
			metric.name === "response_time" &&
			metric.value > this.config.thresholds.responseTime
		) {
			alertTriggered = true;
			severity =
				metric.value > this.config.thresholds.responseTime * 2
					? "critical"
					: "warning";
			message = `Response time ${metric.value}ms exceeds threshold ${this.config.thresholds.responseTime}ms`;
		}

		// Memory usage alerts
		if (metric.name === "memory_heap_used") {
			const memUsage = process.memoryUsage();
			const percentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
			if (percentage > this.config.thresholds.memoryUsage) {
				alertTriggered = true;
				severity =
					percentage > this.config.thresholds.memoryUsage * 1.2
						? "critical"
						: "warning";
				message = `Memory usage ${percentage.toFixed(1)}% exceeds threshold ${this.config.thresholds.memoryUsage}%`;
			}
		}

		// CPU usage alerts
		if (
			metric.name === "cpu_usage_total" &&
			metric.value > this.config.thresholds.cpuUsage
		) {
			alertTriggered = true;
			severity =
				metric.value > this.config.thresholds.cpuUsage * 1.2
					? "critical"
					: "warning";
			message = `CPU usage ${metric.value.toFixed(1)}% exceeds threshold ${this.config.thresholds.cpuUsage}%`;
		}

		if (alertTriggered) {
			const alert: PerformanceAlert = {
				id: this.generateAlertId(),
				metric: metric.name,
				threshold: this.getThresholdForMetric(metric.name),
				currentValue: metric.value,
				severity,
				message,
				timestamp: new Date().toISOString(),
			};

			this.alerts.push(alert);

			this.getLogger().warn("Performance alert triggered", {
				alertId: alert.id,
				metric: alert.metric,
				severity: alert.severity,
				message: alert.message,
			});
		}
	}

	/**
	 * Send metric to telemetry
	 */
	private sendToTelemetry(metric: PerformanceMetric): void {
		try {
			const telemetryService = getTelemetryService();
			if (telemetryService.isEnabled()) {
				// In a real implementation, this would send to OpenTelemetry
				this.getLogger().debug("Metric sent to telemetry", {
					name: metric.name,
					value: metric.value,
					unit: metric.unit,
				});
			}
		} catch (error) {
			this.getLogger().debug("Failed to send metric to telemetry", {
				error: error instanceof Error ? error : String(error),
			});
		}
	}

	/**
	 * Clean old metrics based on retention policy
	 */
	private cleanOldMetrics(): void {
		const cutoff = new Date(
			Date.now() - this.config.metricsRetention * 24 * 60 * 60 * 1000,
		);
		const initialCount = this.metrics.length;

		this.metrics = this.metrics.filter(
			(metric) => new Date(metric.timestamp) > cutoff,
		);

		const removedCount = initialCount - this.metrics.length;
		if (removedCount > 0) {
			this.getLogger().debug("Cleaned old metrics", { removedCount });
		}
	}

	/**
	 * Load existing baselines (placeholder for production implementation)
	 */
	private loadBaselines(): void {
		// In production, this would load from a database or file
		this.getLogger().debug("Loading performance baselines");
	}

	/**
	 * Calculate percentile
	 */
	private percentile(values: number[], p: number): number {
		const index = Math.ceil((p / 100) * values.length) - 1;
		return values[Math.max(0, index)];
	}

	/**
	 * Extract query type from SQL
	 */
	private extractQueryType(query: string): string {
		const normalized = query.trim().toLowerCase();
		if (normalized.startsWith("select")) return "select";
		if (normalized.startsWith("insert")) return "insert";
		if (normalized.startsWith("update")) return "update";
		if (normalized.startsWith("delete")) return "delete";
		return "other";
	}

	/**
	 * Generate unique alert ID
	 */
	private generateAlertId(): string {
		return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Get threshold for metric
	 */
	private getThresholdForMetric(metricName: string): number {
		switch (metricName) {
			case "response_time":
				return this.config.thresholds.responseTime;
			case "memory_heap_used":
				return this.config.thresholds.memoryUsage;
			case "cpu_usage_total":
				return this.config.thresholds.cpuUsage;
			default:
				return 0;
		}
	}

	/**
	 * Shutdown performance monitoring
	 */
	shutdown(): void {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
		}

		this.initialized = false;
		this.getLogger().info("Performance monitoring shutdown");
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<PerformanceConfig>): void {
		this.config = { ...this.config, ...newConfig };
		this.getLogger().info("Performance monitoring configuration updated", {
			newConfig,
		});
	}
}

/**
 * Global performance monitoring service instance
 */
let _performanceMonitoringService: PerformanceMonitoringService | null = null;

/**
 * Get the global performance monitoring service instance
 */
export function getPerformanceMonitoringService(): PerformanceMonitoringService {
	if (!_performanceMonitoringService) {
		_performanceMonitoringService = new PerformanceMonitoringService();
	}
	return _performanceMonitoringService;
}

/**
 * Initialize performance monitoring
 */
export function initializePerformanceMonitoring(
	config?: Partial<PerformanceConfig>,
): void {
	const logger = createContextLogger("performance-monitoring-init");

	try {
		logger.info("Initializing performance monitoring...");

		const service = getPerformanceMonitoringService();
		if (config) {
			service.updateConfig(config);
		}
		service.initialize();

		logger.info("Performance monitoring initialized successfully");
		console.log("📈 Performance monitoring initialized successfully");
	} catch (error) {
		logger.error("Failed to initialize performance monitoring", {
			error: error instanceof Error ? error : String(error),
		});
		console.error("❌ Failed to initialize performance monitoring:", error);
	}
}

/**
 * Reset performance monitoring service (primarily for testing)
 */
export function resetPerformanceMonitoringService(): void {
	if (_performanceMonitoringService) {
		_performanceMonitoringService.shutdown();
		_performanceMonitoringService = null;
	}
}
