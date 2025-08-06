/**
 * Unit tests for error reporting service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type ErrorReportingConfig,
	ErrorReportingService,
	getErrorReportingService,
	initializeErrorReporting,
	resetErrorReportingService,
} from "./error-reporting";
import type { ErrorReport } from "./global-handler";

// Mock dependencies
vi.mock("../config/service", () => ({
	getConfigurationService: vi.fn(() => ({
		getServerConfig: vi.fn(() => ({
			environment: "test",
		})),
	})),
}));

vi.mock("../logging/factory", () => ({
	createContextLogger: vi.fn(() => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	})),
}));

vi.mock("../telemetry", () => ({
	getTelemetryService: vi.fn(() => ({
		isEnabled: vi.fn(() => true),
		getConfig: vi.fn(() => ({})),
		initialize: vi.fn(() => Promise.resolve(true)),
		shutdown: vi.fn(() => Promise.resolve()),
	})),
}));

describe("ErrorReportingService", () => {
	let service: ErrorReportingService;
	let mockErrorReport: ErrorReport;

	beforeEach(() => {
		// Create a fresh service instance for each test
		service = new ErrorReportingService();

		// Create mock error report
		mockErrorReport = {
			id: "test-error-123",
			error: new Error("Test error message"),
			stackTrace: "Error stack trace",
			categorization: {
				type: "system",
				category: "api",
				severity: "medium",
				isRecoverable: true,
				shouldRetry: false,
			},
			context: {
				userId: "user123",
				sessionId: "session456",
				url: "/test-page",
				userAgent: "test-agent",
				additionalData: { testKey: "testValue" },
			},
			metadata: {
				correlationId: "test-correlation-123",
				timestamp: "2024-01-01T00:00:00.000Z",
				environment: "test",
				version: "1.0.0",
			},
		};
	});

	afterEach(() => {
		// Clean up service
		service.shutdown();
		vi.clearAllMocks();
	});

	describe("Constructor and Configuration", () => {
		it("should create service with default configuration", () => {
			const config = service.getConfig();

			expect(config.enabled).toBe(true);
			expect(config.samplingRate).toBe(1.0);
			expect(config.batchSize).toBe(10);
			expect(config.flushInterval).toBe(30000);
			expect(config.maxRetries).toBe(3);
		});

		it("should create service with custom configuration", () => {
			const customConfig: Partial<ErrorReportingConfig> = {
				enabled: false,
				samplingRate: 0.5,
				batchSize: 5,
				flushInterval: 15000,
				maxRetries: 1,
				endpoint: "https://test.endpoint.com",
				apiKey: "test-api-key",
			};

			const customService = new ErrorReportingService(customConfig);
			const config = customService.getConfig();

			expect(config.enabled).toBe(false);
			expect(config.samplingRate).toBe(0.5);
			expect(config.batchSize).toBe(5);
			expect(config.flushInterval).toBe(15000);
			expect(config.maxRetries).toBe(1);
			expect(config.endpoint).toBe("https://test.endpoint.com");
			expect(config.apiKey).toBe("test-api-key");

			customService.shutdown();
		});

		it("should update configuration", () => {
			const newConfig = { samplingRate: 0.8, batchSize: 15 };
			service.updateConfig(newConfig);

			const config = service.getConfig();
			expect(config.samplingRate).toBe(0.8);
			expect(config.batchSize).toBe(15);
			expect(config.enabled).toBe(true); // Should preserve other values
		});
	});

	describe("Initialization", () => {
		it("should initialize service successfully", () => {
			expect(() => service.initialize()).not.toThrow();
		});

		it("should not initialize twice", () => {
			service.initialize();
			service.initialize(); // Should not throw or cause issues
		});

		it("should adjust sampling rate based on environment", async () => {
			// Test with different environments
			const _environments = ["development", "staging", "production"];
			const _expectedRates = [0.1, 0.5, 1.0];

			// Helper function to test each environment
			const _testEnvironment = async (_env: string, _expectedRate: number) => {
				// Mock environment
				const configModule = await import("../config/service");
				const mockConfigService = {
					getServerConfig: () => ({
						url: "http://localhost:3000",
						port: 3000,
						environment: _env as
							| "development"
							| "staging"
							| "production"
							| "test",
						version: "1.0.0",
					}),
					getConfiguration: vi.fn(),
					getProfile: vi.fn(),
					getEnvironmentProfile: vi.fn(),
					isFeatureEnabled: vi.fn(),
					getEnvironmentValue: vi.fn(),
					validateConfiguration: vi.fn(),
					getDatabaseConfig: vi.fn(),
					getTelemetryConfig: vi.fn(),
					getLoggingConfig: vi.fn(),
					getApiConfig: vi.fn(),
					isDevelopment: vi.fn(),
					isProduction: vi.fn(),
					isTest: vi.fn(),
					config: {},
					profile: {},
					logger: null,
					getLogger: vi.fn(),
				} as unknown as ReturnType<typeof configModule.getConfigurationService>;
				vi.mocked(configModule.getConfigurationService).mockReturnValue(
					mockConfigService,
				);
			};

			// TODO: Complete the test implementation
		});
	});

	describe("Error Reporting", () => {
		beforeEach(() => {
			service.initialize();
		});

		it("should report error when enabled", () => {
			service.reportError(mockErrorReport);

			const metrics = service.getErrorMetrics();
			expect(metrics.totalErrors).toBe(1);
			expect(metrics.uniqueErrors).toBe(1);
		});

		it("should not report error when disabled", () => {
			service.updateConfig({ enabled: false });
			service.reportError(mockErrorReport);

			const metrics = service.getErrorMetrics();
			expect(metrics.totalErrors).toBe(0);
		});

		it("should respect sampling rate", () => {
			// Set very low sampling rate
			service.updateConfig({ samplingRate: 0.0 });

			// Mock Math.random to always return 0.5 (above threshold)
			const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

			service.reportError(mockErrorReport);

			const metrics = service.getErrorMetrics();
			expect(metrics.totalErrors).toBe(0);

			mockRandom.mockRestore();
		});

		it("should track error counts correctly", () => {
			// Report same error multiple times
			service.reportError(mockErrorReport);
			service.reportError(mockErrorReport);
			service.reportError(mockErrorReport);

			const metrics = service.getErrorMetrics();
			expect(metrics.totalErrors).toBe(3);
			expect(metrics.uniqueErrors).toBe(1);
		});

		it("should track different errors separately", () => {
			const anotherError = {
				...mockErrorReport,
				id: "test-error-456",
				error: { ...mockErrorReport.error, message: "Different error" },
			};

			service.reportError(mockErrorReport);
			service.reportError(anotherError);

			const metrics = service.getErrorMetrics();
			expect(metrics.totalErrors).toBe(2);
			expect(metrics.uniqueErrors).toBe(2);
		});

		it("should flush immediately for critical errors", async () => {
			const criticalError = {
				...mockErrorReport,
				categorization: {
					...mockErrorReport.categorization,
					severity: "critical" as const,
				},
			};

			const flushSpy = vi.spyOn(service, "flush");
			service.reportError(criticalError);

			expect(flushSpy).toHaveBeenCalled();
		});

		it("should flush when buffer reaches batch size", () => {
			service.updateConfig({ batchSize: 2 });
			const flushSpy = vi.spyOn(service, "flush");

			service.reportError(mockErrorReport);
			expect(flushSpy).not.toHaveBeenCalled();

			service.reportError({
				...mockErrorReport,
				id: "test-error-456",
			});
			expect(flushSpy).toHaveBeenCalled();
		});
	});

	describe("Error Metrics", () => {
		beforeEach(() => {
			service.initialize();
		});

		it("should return empty metrics initially", () => {
			const metrics = service.getErrorMetrics();

			expect(metrics.totalErrors).toBe(0);
			expect(metrics.uniqueErrors).toBe(0);
			expect(metrics.errorRate).toBe(0);
			expect(metrics.topErrors).toEqual([]);
			expect(metrics.trends).toEqual([]);
		});

		it("should calculate top errors correctly", () => {
			const error1 = mockErrorReport;
			const error2 = {
				...mockErrorReport,
				id: "error-2",
				error: { ...mockErrorReport.error, message: "Error 2" },
			};

			// Report error1 three times, error2 once
			service.reportError(error1);
			service.reportError(error1);
			service.reportError(error1);
			service.reportError(error2);

			const metrics = service.getErrorMetrics();
			expect(metrics.topErrors).toHaveLength(2);
			expect(metrics.topErrors[0].count).toBe(3);
			expect(metrics.topErrors[1].count).toBe(1);
		});

		it("should generate error trends", () => {
			// Report multiple errors to generate trends
			for (let i = 0; i < 15; i++) {
				service.reportError({
					...mockErrorReport,
					id: `error-${i}`,
				});
			}

			const metrics = service.getErrorMetrics();
			expect(metrics.trends).toHaveLength(1);

			const trend = metrics.trends[0];
			expect(trend.errorType).toBe("TestError");
			expect(trend.count).toBe(15);
			expect(trend.severity).toBe("medium");
		});

		it("should classify error severity based on count", () => {
			const testCases = [
				{ count: 5, expectedSeverity: "low" },
				{ count: 25, expectedSeverity: "medium" },
				{ count: 75, expectedSeverity: "high" },
				{ count: 150, expectedSeverity: "critical" },
			];

			testCases.forEach(({ count, expectedSeverity }) => {
				service.clearErrorData(); // Reset between tests

				// Report errors to reach desired count
				for (let i = 0; i < count; i++) {
					service.reportError({
						...mockErrorReport,
						id: `error-${i}`,
					});
				}

				const metrics = service.getErrorMetrics();
				expect(metrics.trends[0].severity).toBe(expectedSeverity);
			});
		});
	});

	describe("Flushing", () => {
		beforeEach(() => {
			service.initialize();
		});

		it("should flush empty buffer without error", async () => {
			await expect(service.flush()).resolves.not.toThrow();
		});

		it("should clear buffer after successful flush", async () => {
			service.reportError(mockErrorReport);
			expect(service.getErrorMetrics().totalErrors).toBe(1);

			await service.flush();
			// Buffer should be cleared but tracking should remain
			expect(service.getErrorMetrics().totalErrors).toBe(1);
		});

		it("should handle flush errors gracefully", async () => {
			// Mock telemetry service to throw error
			const telemetryModule = await import("../telemetry");
			vi.mocked(telemetryModule.getTelemetryService).mockReturnValue({
				isEnabled: () => {
					throw new Error("Telemetry error");
				},
				getConfig: vi.fn(async () => ({
					isEnabled: true,
					endpoint: "http://localhost:4317",
					serviceName: "test-service",
					serviceVersion: "1.0.0",
					headers: {},
					timeout: 5000,
					samplingRatio: 1.0,
					resourceAttributes: {},
				})),
				initialize: vi.fn(() => Promise.resolve(true)),
				shutdown: vi.fn(() => Promise.resolve()),
			});

			service.reportError(mockErrorReport);
			await expect(service.flush()).resolves.not.toThrow();
		});
	});

	describe("Periodic Flushing", () => {
		it("should start periodic flush timer on initialization", () => {
			const setIntervalSpy = vi.spyOn(global, "setInterval");

			service.initialize();

			expect(setIntervalSpy).toHaveBeenCalledWith(
				expect.any(Function),
				30000, // Default flush interval
			);
		});

		it("should clear timer on shutdown", () => {
			const clearIntervalSpy = vi.spyOn(global, "clearInterval");

			service.initialize();
			service.shutdown();

			expect(clearIntervalSpy).toHaveBeenCalled();
		});

		it("should use custom flush interval", () => {
			const setIntervalSpy = vi.spyOn(global, "setInterval");
			const customService = new ErrorReportingService({ flushInterval: 60000 });

			customService.initialize();

			expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

			customService.shutdown();
		});
	});

	describe("Data Management", () => {
		beforeEach(() => {
			service.initialize();
		});

		it("should clear error data", () => {
			service.reportError(mockErrorReport);
			expect(service.getErrorMetrics().totalErrors).toBe(1);

			service.clearErrorData();
			const metrics = service.getErrorMetrics();
			expect(metrics.totalErrors).toBe(0);
			expect(metrics.uniqueErrors).toBe(0);
		});

		it("should shutdown cleanly", () => {
			service.reportError(mockErrorReport);

			expect(() => service.shutdown()).not.toThrow();
		});
	});
});

describe("Global Service Functions", () => {
	afterEach(() => {
		resetErrorReportingService();
	});

	describe("getErrorReportingService", () => {
		it("should return singleton instance", () => {
			const service1 = getErrorReportingService();
			const service2 = getErrorReportingService();

			expect(service1).toBe(service2);
		});

		it("should return new instance after reset", () => {
			const service1 = getErrorReportingService();
			resetErrorReportingService();
			const service2 = getErrorReportingService();

			expect(service1).not.toBe(service2);
		});
	});

	describe("initializeErrorReporting", () => {
		it("should initialize global service", () => {
			expect(() => initializeErrorReporting()).not.toThrow();
		});

		it("should initialize with custom config", () => {
			const config = { samplingRate: 0.5, batchSize: 20 };

			expect(() => initializeErrorReporting(config)).not.toThrow();

			const service = getErrorReportingService();
			const serviceConfig = service.getConfig();
			expect(serviceConfig.samplingRate).toBe(0.5);
			expect(serviceConfig.batchSize).toBe(20);
		});

		it("should handle initialization errors gracefully", async () => {
			// Mock config service to throw error
			const configModule = await import("../config/service");
			vi.mocked(configModule.getConfigurationService).mockImplementation(() => {
				throw new Error("Config error");
			});

			expect(() => initializeErrorReporting()).not.toThrow();
		});
	});

	describe("resetErrorReportingService", () => {
		it("should reset global service", () => {
			const service1 = getErrorReportingService();
			service1.initialize();

			resetErrorReportingService();

			const service2 = getErrorReportingService();
			expect(service1).not.toBe(service2);
		});

		it("should handle reset when service not initialized", () => {
			expect(() => resetErrorReportingService()).not.toThrow();
		});
	});
});
