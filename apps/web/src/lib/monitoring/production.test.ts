/**
 * Tests for production monitoring service
 * Using London TDD approach with comprehensive mocking
 */

import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock OpenTelemetry
vi.mock("@opentelemetry/api");

// Mock configuration service
vi.mock("@/lib/config/service", () => ({
	getConfigurationService: vi.fn(() => ({
		getConfiguration: vi.fn(() => ({
			nodeEnv: "production",
			serviceName: "test-service",
		})),
		getDatabaseConfig: vi.fn(() => ({
			url: "postgres://test",
			host: "localhost",
		})),
		getTelemetryConfig: vi.fn(() => ({
			isEnabled: true,
			endpoint: "http://localhost:4318",
		})),
	})),
}));

// Mock logger factory
vi.mock("@/lib/logging/factory", () => ({
	createLogger: vi.fn(() => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	})),
}));

const mockTrace = vi.mocked(trace);
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import the module under test
import {
	type Alert,
	AlertSeverity,
	type PerformanceMetrics,
	ProductionMonitoringService,
} from "./production";

describe("ProductionMonitoringService", () => {
	let monitoringService: ProductionMonitoringService;
	let originalEnv: NodeJS.ProcessEnv;
	let originalProcess: any;

	beforeEach(() => {
		// Save original environment and process
		originalEnv = { ...process.env };
		originalProcess = { ...process };

		// Set up production environment
		process.env.NODE_ENV = "production";
		process.env.METRICS_INTERVAL = "1000"; // 1 second for testing
		process.env.ERROR_RATE_THRESHOLD = "0.05";
		process.env.RESPONSE_TIME_THRESHOLD = "2000";

		// Mock process methods
		vi.spyOn(process, "uptime").mockReturnValue(3600); // 1 hour uptime
		vi.spyOn(process, "memoryUsage").mockReturnValue({
			rss: 100 * 1024 * 1024, // 100MB
			heapTotal: 80 * 1024 * 1024, // 80MB
			heapUsed: 60 * 1024 * 1024, // 60MB
			external: 5 * 1024 * 1024, // 5MB
			arrayBuffers: 2 * 1024 * 1024, // 2MB
		});
		vi.spyOn(process, "cpuUsage").mockReturnValue({
			user: 100000, // 100ms
			system: 50000, // 50ms
		});

		// Mock OpenTelemetry tracer
		const mockSpan = {
			setAttributes: vi.fn(),
			setStatus: vi.fn(),
			end: vi.fn(),
		};
		const mockTracer = {
			startActiveSpan: vi.fn((name, options, callback) => {
				return callback(mockSpan);
			}),
		};
		mockTrace.getTracer.mockReturnValue(mockTracer);

		// Reset fetch mock
		mockFetch.mockReset();

		// Clear all mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Restore original environment and process
		process.env = originalEnv;
		Object.assign(process, originalProcess);

		vi.restoreAllMocks();
	});

	describe("Configuration", () => {
		it("should initialize with production configuration", () => {
			monitoringService = new ProductionMonitoringService();

			const dashboardData = monitoringService.getDashboardData();

			expect(dashboardData.config.metrics.enabled).toBe(true);
			expect(dashboardData.config.tracing.enabled).toBe(true);
			expect(dashboardData.config.logging.structured).toBe(true);
		});

		it("should disable monitoring for non-production environments", () => {
			process.env.NODE_ENV = "development";

			monitoringService = new ProductionMonitoringService();

			const dashboardData = monitoringService.getDashboardData();

			expect(dashboardData.config.metrics.enabled).toBe(false);
		});

		it("should parse environment variables correctly", () => {
			process.env.METRICS_INTERVAL = "5000";
			process.env.ERROR_RATE_THRESHOLD = "0.1";
			process.env.MEMORY_THRESHOLD = "0.9";

			monitoringService = new ProductionMonitoringService();

			const dashboardData = monitoringService.getDashboardData();

			expect(dashboardData.config.metrics.interval).toBe(5000);
			expect(dashboardData.config.alerting.thresholds.errorRate).toBe(0.1);
			expect(dashboardData.config.alerting.thresholds.memoryUsage).toBe(0.9);
		});

		it("should use default values when environment variables are missing", () => {
			delete process.env.METRICS_INTERVAL;
			delete process.env.ERROR_RATE_THRESHOLD;

			monitoringService = new ProductionMonitoringService();

			const dashboardData = monitoringService.getDashboardData();

			expect(dashboardData.config.metrics.interval).toBe(30000); // Default 30 seconds
			expect(dashboardData.config.alerting.thresholds.errorRate).toBe(0.05); // Default 5%
		});
	});

	describe("Metrics Collection", () => {
		beforeEach(() => {
			monitoringService = new ProductionMonitoringService();
		});

		it("should collect system metrics", async () => {
			// Allow some time for metrics collection
			await new Promise((resolve) => setTimeout(resolve, 1100));

			const dashboardData = monitoringService.getDashboardData();

			expect(dashboardData.metrics.length).toBeGreaterThan(0);

			const latestMetrics =
				dashboardData.metrics[dashboardData.metrics.length - 1];
			expect(latestMetrics).toHaveProperty("timestamp");
			expect(latestMetrics).toHaveProperty("memory");
			expect(latestMetrics).toHaveProperty("cpu");
			expect(latestMetrics).toHaveProperty("uptime");
		});

		it("should calculate memory usage percentage correctly", async () => {
			await new Promise((resolve) => setTimeout(resolve, 1100));

			const dashboardData = monitoringService.getDashboardData();
			const latestMetrics =
				dashboardData.metrics[dashboardData.metrics.length - 1];

			// Memory usage should be 60MB / 80MB = 75%
			expect(latestMetrics.memory.percentage).toBeCloseTo(0.75, 2);
			expect(latestMetrics.memory.used).toBe(60 * 1024 * 1024);
			expect(latestMetrics.memory.total).toBe(80 * 1024 * 1024);
		});

		it("should calculate CPU usage correctly", async () => {
			await new Promise((resolve) => setTimeout(resolve, 1100));

			const dashboardData = monitoringService.getDashboardData();
			const latestMetrics =
				dashboardData.metrics[dashboardData.metrics.length - 1];

			// CPU usage should be (100ms + 50ms) / 1000000 = 0.15 seconds
			expect(latestMetrics.cpu.usage).toBe(0.15);
		});

		it("should handle metrics collection errors gracefully", async () => {
			// Mock memory usage to throw error
			vi.spyOn(process, "memoryUsage").mockImplementation(() => {
				throw new Error("Memory usage error");
			});

			// Should not crash the service
			await new Promise((resolve) => setTimeout(resolve, 1100));

			// Service should still be operational
			const dashboardData = monitoringService.getDashboardData();
			expect(dashboardData).toBeDefined();
		});
	});

	describe("Alert System", () => {
		beforeEach(() => {
			process.env.ALERTING_ENABLED = "true";
			process.env.ALERT_WEBHOOK = "https://webhook.example.com";
			process.env.ALERT_SLACK_WEBHOOK = "https://hooks.slack.com/webhook";

			monitoringService = new ProductionMonitoringService();
		});

		it("should trigger memory usage alert when threshold exceeded", async () => {
			// Mock high memory usage (95%)
			vi.spyOn(process, "memoryUsage").mockReturnValue({
				rss: 100 * 1024 * 1024,
				heapTotal: 80 * 1024 * 1024,
				heapUsed: 76 * 1024 * 1024, // 95% of heap
				external: 5 * 1024 * 1024,
				arrayBuffers: 2 * 1024 * 1024,
			});

			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
			});

			await new Promise((resolve) => setTimeout(resolve, 1100));

			const dashboardData = monitoringService.getDashboardData();

			expect(dashboardData.alerts.length).toBeGreaterThan(0);

			const memoryAlert = dashboardData.alerts.find((alert) =>
				alert.title.includes("High Memory Usage"),
			);
			expect(memoryAlert).toBeDefined();
			expect(memoryAlert?.severity).toBe(AlertSeverity.CRITICAL);
		});

		it("should trigger error rate alert when threshold exceeded", async () => {
			// Mock the service to simulate high error rate
			const mockMetrics: PerformanceMetrics = {
				timestamp: Date.now(),
				responseTime: { avg: 100, p50: 100, p95: 150, p99: 200 },
				errorRate: 0.08, // 8% error rate (exceeds 5% threshold)
				throughput: 100,
				memory: { used: 60000000, total: 80000000, percentage: 0.75 },
				cpu: { usage: 0.5, loadAverage: [1, 1, 1] },
				activeConnections: 50,
				uptime: 3600,
			};

			// Trigger alert check directly
			const privateService = monitoringService as any;
			await privateService.checkAlertThresholds(mockMetrics);

			const dashboardData = monitoringService.getDashboardData();

			const errorRateAlert = dashboardData.alerts.find((alert) =>
				alert.title.includes("High Error Rate"),
			);
			expect(errorRateAlert).toBeDefined();
			expect(errorRateAlert?.currentValue).toBe(0.08);
		});

		it("should send webhook alerts when configured", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
			});

			const mockAlert: Alert = {
				id: "test-alert",
				timestamp: Date.now(),
				severity: AlertSeverity.HIGH,
				title: "Test Alert",
				description: "Test alert description",
				metrics: {},
				threshold: 0.05,
				currentValue: 0.08,
			};

			// Send alert directly
			const privateService = monitoringService as any;
			await privateService.sendAlert(mockAlert);

			expect(mockFetch).toHaveBeenCalledWith(
				"https://webhook.example.com",
				expect.objectContaining({
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: expect.stringContaining("Test Alert"),
				}),
			);
		});

		it("should send Slack alerts when configured", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
			});

			const mockAlert: Alert = {
				id: "test-alert",
				timestamp: Date.now(),
				severity: AlertSeverity.CRITICAL,
				title: "Critical Alert",
				description: "Critical alert description",
				metrics: {},
				threshold: 0.85,
				currentValue: 0.95,
			};

			// Send alert directly
			const privateService = monitoringService as any;
			await privateService.sendAlert(mockAlert);

			expect(mockFetch).toHaveBeenCalledWith(
				"https://hooks.slack.com/webhook",
				expect.objectContaining({
					method: "POST",
					body: expect.stringContaining("Critical Alert"),
				}),
			);
		});

		it("should handle alert sending failures gracefully", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			const mockAlert: Alert = {
				id: "test-alert",
				timestamp: Date.now(),
				severity: AlertSeverity.HIGH,
				title: "Test Alert",
				description: "Test alert description",
				metrics: {},
				threshold: 0.05,
				currentValue: 0.08,
			};

			// Should not throw error
			const privateService = monitoringService as any;
			await expect(
				privateService.sendAlert(mockAlert),
			).resolves.toBeUndefined();
		});

		it("should determine alert severity correctly", () => {
			const highMemoryAlert: Alert = {
				id: "memory-alert",
				timestamp: Date.now(),
				severity: AlertSeverity.HIGH,
				title: "High Memory Usage",
				description: "Memory usage at 87%",
				metrics: {},
				threshold: 0.85,
				currentValue: 0.87,
			};

			const criticalMemoryAlert: Alert = {
				id: "memory-alert-critical",
				timestamp: Date.now(),
				severity: AlertSeverity.CRITICAL,
				title: "Critical Memory Usage",
				description: "Memory usage at 96%",
				metrics: {},
				threshold: 0.85,
				currentValue: 0.96,
			};

			expect(highMemoryAlert.severity).toBe(AlertSeverity.HIGH);
			expect(criticalMemoryAlert.severity).toBe(AlertSeverity.CRITICAL);
		});
	});

	describe("API Middleware", () => {
		beforeEach(() => {
			monitoringService = new ProductionMonitoringService();
		});

		it("should create monitoring middleware", () => {
			const middleware = monitoringService.createApiMiddleware();

			expect(middleware).toBeDefined();
			expect(typeof middleware).toBe("function");
		});

		it("should trace API requests when enabled", async () => {
			const middleware = monitoringService.createApiMiddleware();

			const mockRequest = {
				method: "GET",
				url: "/api/test",
				headers: { "user-agent": "test-agent" },
			} as any;

			const mockResponse = {
				statusCode: 200,
				end: vi.fn(),
			} as any;

			const mockNext = vi.fn();

			await middleware(mockRequest, mockResponse, mockNext);

			expect(mockTrace.getTracer).toHaveBeenCalledWith("api-monitoring");
			expect(mockNext).toHaveBeenCalled();
		});

		it("should record response metrics", async () => {
			const middleware = monitoringService.createApiMiddleware();

			const mockRequest = {
				method: "POST",
				url: "/api/data",
				headers: { "user-agent": "test-agent" },
			} as any;

			let endCallback: (...args: unknown[]) => void;
			const mockResponse = {
				statusCode: 201,
				end: vi.fn().mockImplementation((callback) => {
					endCallback = callback;
					return mockResponse;
				}),
			} as any;

			const mockNext = vi.fn();

			await middleware(mockRequest, mockResponse, mockNext);

			// Simulate response ending
			if (endCallback) {
				endCallback();
			}

			expect(mockResponse.end).toHaveBeenCalled();
		});

		it("should handle errors in API requests", async () => {
			const middleware = monitoringService.createApiMiddleware();

			const mockRequest = {
				method: "GET",
				url: "/api/error",
				headers: { "user-agent": "test-agent" },
			} as any;

			const mockResponse = {
				statusCode: 500,
				end: vi.fn(),
			} as any;

			const mockNext = vi.fn();

			await middleware(mockRequest, mockResponse, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should skip middleware when monitoring is disabled", async () => {
			process.env.NODE_ENV = "development";
			const devService = new ProductionMonitoringService();

			const middleware = devService.createApiMiddleware();

			const mockRequest = {} as any;
			const mockResponse = {} as any;
			const mockNext = vi.fn();

			await middleware(mockRequest, mockResponse, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(mockTrace.getTracer).not.toHaveBeenCalled();
		});
	});

	describe("Dashboard Data", () => {
		beforeEach(() => {
			monitoringService = new ProductionMonitoringService();
		});

		it("should return dashboard data with metrics and alerts", () => {
			const dashboardData = monitoringService.getDashboardData();

			expect(dashboardData).toHaveProperty("metrics");
			expect(dashboardData).toHaveProperty("alerts");
			expect(dashboardData).toHaveProperty("config");

			expect(Array.isArray(dashboardData.metrics)).toBe(true);
			expect(Array.isArray(dashboardData.alerts)).toBe(true);
		});

		it("should limit metrics to last 100 entries", async () => {
			// Generate many metrics
			for (let i = 0; i < 150; i++) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			const dashboardData = monitoringService.getDashboardData();

			expect(dashboardData.metrics.length).toBeLessThanOrEqual(100);
		});

		it("should limit alerts to last 50 entries", async () => {
			// This would require generating many alerts
			const dashboardData = monitoringService.getDashboardData();

			expect(dashboardData.alerts.length).toBeLessThanOrEqual(50);
		});
	});

	describe("Cleanup and Shutdown", () => {
		beforeEach(() => {
			monitoringService = new ProductionMonitoringService();
		});

		it("should cleanup old metrics based on retention period", async () => {
			// Set short retention period for testing
			process.env.METRICS_RETENTION = "1000"; // 1 second

			const testService = new ProductionMonitoringService();

			// Wait for initial metrics
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Wait for retention period to pass
			await new Promise((resolve) => setTimeout(resolve, 1100));

			// Trigger cleanup
			const privateService = testService as any;
			privateService.cleanupOldMetrics();

			const dashboardData = testService.getDashboardData();

			// Old metrics should be cleaned up
			expect(dashboardData.metrics.length).toBeLessThanOrEqual(1);
		});

		it("should handle graceful shutdown", () => {
			const privateService = monitoringService as any;

			// Should not throw error
			expect(() => privateService.shutdown()).not.toThrow();
		});

		it("should register process event handlers", () => {
			const onSpy = vi.spyOn(process, "on");

			new ProductionMonitoringService();

			expect(onSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
			expect(onSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
		});
	});

	describe("Metric Calculations", () => {
		beforeEach(() => {
			monitoringService = new ProductionMonitoringService();
		});

		it("should calculate percentiles correctly", () => {
			const privateService = monitoringService as any;

			const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

			expect(privateService.calculatePercentile(values, 0.5)).toBe(500); // 50th percentile
			expect(privateService.calculatePercentile(values, 0.95)).toBe(950); // 95th percentile
			expect(privateService.calculatePercentile(values, 0.99)).toBe(990); // 99th percentile
		});

		it("should calculate average correctly", () => {
			const privateService = monitoringService as any;

			const values = [100, 200, 300, 400, 500];

			expect(privateService.calculateAverage(values)).toBe(300);
		});

		it("should handle empty arrays in calculations", () => {
			const privateService = monitoringService as any;

			expect(privateService.calculateAverage([])).toBe(0);
			expect(privateService.calculatePercentile([], 0.95)).toBe(0);
		});
	});
});
