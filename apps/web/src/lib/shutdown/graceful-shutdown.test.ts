import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import {
	GracefulShutdownService,
	getGracefulShutdownService,
	initiateGracefulShutdown,
	registerShutdownHandler,
	resetGracefulShutdownService,
	type ShutdownHandler,
} from "./graceful-shutdown";

// Mock dependencies
vi.mock("../logging/factory");
vi.mock("../telemetry");
vi.mock("../database/connection");

import { closeDatabaseConnections } from "../database/connection";
import { createContextLogger } from "../logging/factory";
import { shutdownTelemetry } from "../telemetry";

describe("GracefulShutdownService", () => {
	const mockLogger = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	};

	// Store original process methods
	const originalExit = process.exit;
	const originalConsoleLog = console.log;
	const originalConsoleError = console.error;

	beforeEach(() => {
		vi.clearAllMocks();
		resetGracefulShutdownService();

		// Setup default mocks
		(createContextLogger as Mock).mockReturnValue(mockLogger);
		(shutdownTelemetry as Mock).mockResolvedValue(undefined);
		(closeDatabaseConnections as Mock).mockResolvedValue(undefined);

		// Mock process.exit to prevent actual exit during tests
		process.exit = vi.fn() as unknown as (code?: number) => never;
		console.log = vi.fn();
		console.error = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();

		// Restore original process methods
		process.exit = originalExit;
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
	});

	describe("constructor", () => {
		it("should initialize with default handlers", () => {
			const service = new GracefulShutdownService();
			expect(service).toBeInstanceOf(GracefulShutdownService);
		});

		it("should setup signal handlers", () => {
			const processOnSpy = vi.spyOn(process, "on");
			new GracefulShutdownService();

			expect(processOnSpy).toHaveBeenCalledWith(
				"SIGTERM",
				expect.any(Function),
			);
			expect(processOnSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
			expect(processOnSpy).toHaveBeenCalledWith(
				"uncaughtException",
				expect.any(Function),
			);
			expect(processOnSpy).toHaveBeenCalledWith(
				"unhandledRejection",
				expect.any(Function),
			);
		});
	});

	describe("registerHandler", () => {
		it("should register shutdown handler", () => {
			const service = new GracefulShutdownService();
			const handler: ShutdownHandler = {
				name: "test-handler",
				priority: 5,
				handler: vi.fn().mockResolvedValue(undefined),
			};

			service.registerHandler(handler);

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Shutdown handler registered",
				expect.objectContaining({
					name: "test-handler",
					priority: 5,
					totalHandlers: expect.any(Number),
				}),
			);
		});

		it("should sort handlers by priority", () => {
			const service = new GracefulShutdownService();
			const handler1: ShutdownHandler = {
				name: "low-priority",
				priority: 10,
				handler: vi.fn().mockResolvedValue(undefined),
			};
			const handler2: ShutdownHandler = {
				name: "high-priority",
				priority: 1,
				handler: vi.fn().mockResolvedValue(undefined),
			};

			service.registerHandler(handler1);
			service.registerHandler(handler2);

			// Verify handlers are sorted by calling shutdown
			service.shutdown("test");

			// The high-priority handler should be called first
			expect(handler2.handler).toHaveBeenCalled();
			expect(handler1.handler).toHaveBeenCalled();
		});

		it("should not register handler during shutdown", () => {
			const service = new GracefulShutdownService();

			// Start shutdown
			service.shutdown("test");

			const handler: ShutdownHandler = {
				name: "late-handler",
				priority: 5,
				handler: vi.fn().mockResolvedValue(undefined),
			};

			service.registerHandler(handler);

			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Cannot register handler during shutdown",
				expect.objectContaining({
					handlerName: "late-handler",
				}),
			);
		});
	});

	describe("unregisterHandler", () => {
		it("should unregister handler by name", () => {
			const service = new GracefulShutdownService();
			const handler: ShutdownHandler = {
				name: "test-handler",
				priority: 5,
				handler: vi.fn().mockResolvedValue(undefined),
			};

			service.registerHandler(handler);
			service.unregisterHandler("test-handler");

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Shutdown handler unregistered",
				expect.objectContaining({
					name: "test-handler",
					remainingHandlers: expect.any(Number),
				}),
			);
		});

		it("should handle unregistering non-existent handler", () => {
			const service = new GracefulShutdownService();

			// Should not throw
			service.unregisterHandler("non-existent");
		});
	});

	describe("shutdown", () => {
		it("should execute shutdown sequence successfully", async () => {
			const service = new GracefulShutdownService();
			const handlerMock = vi.fn().mockResolvedValue(undefined);

			const handler: ShutdownHandler = {
				name: "test-handler",
				priority: 5,
				handler: handlerMock,
				timeout: 1000,
			};

			service.registerHandler(handler);

			await service.shutdown("SIGTERM", 5000);

			expect(handlerMock).toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith(
				"Initiating graceful shutdown",
				expect.objectContaining({
					signal: "SIGTERM",
					timeout: 5000,
					handlerCount: expect.any(Number),
				}),
			);
			expect(console.log).toHaveBeenCalledWith(
				"🛑 Initiating graceful shutdown (signal: SIGTERM)",
			);
			expect(process.exit).toHaveBeenCalledWith(0);
		});

		it("should handle already in progress shutdown", async () => {
			const service = new GracefulShutdownService();

			// Start first shutdown
			const shutdownPromise1 = service.shutdown("SIGTERM");

			// Try to start second shutdown
			const shutdownPromise2 = service.shutdown("SIGINT");

			expect(shutdownPromise1).toBe(shutdownPromise2);
			expect(mockLogger.info).toHaveBeenCalledWith(
				"Shutdown already in progress, waiting for completion",
			);
		});

		it("should handle handler execution errors", async () => {
			const service = new GracefulShutdownService();
			const errorHandler: ShutdownHandler = {
				name: "error-handler",
				priority: 5,
				handler: vi.fn().mockRejectedValue(new Error("Handler failed")),
			};
			const successHandler: ShutdownHandler = {
				name: "success-handler",
				priority: 6,
				handler: vi.fn().mockResolvedValue(undefined),
			};

			service.registerHandler(errorHandler);
			service.registerHandler(successHandler);

			await service.shutdown("SIGTERM");

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Shutdown handler failed",
				expect.objectContaining({
					name: "error-handler",
					error: "Handler failed",
				}),
			);

			// Should still continue with other handlers
			expect(successHandler.handler).toHaveBeenCalled();
			expect(process.exit).toHaveBeenCalledWith(0);
		});

		it("should handle handler timeout", async () => {
			const service = new GracefulShutdownService();
			const slowHandler: ShutdownHandler = {
				name: "slow-handler",
				priority: 5,
				handler: vi
					.fn()
					.mockImplementation(
						() => new Promise((resolve) => setTimeout(resolve, 2000)),
					),
				timeout: 100, // Very short timeout
			};

			service.registerHandler(slowHandler);

			await service.shutdown("SIGTERM");

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Shutdown handler failed",
				expect.objectContaining({
					name: "slow-handler",
					error: "Handler timeout",
				}),
			);
		});

		it("should force shutdown on overall timeout", async () => {
			const service = new GracefulShutdownService();
			const slowHandler: ShutdownHandler = {
				name: "very-slow-handler",
				priority: 5,
				handler: vi
					.fn()
					.mockImplementation(
						() => new Promise((resolve) => setTimeout(resolve, 2000)),
					),
			};

			service.registerHandler(slowHandler);

			// Use very short overall timeout
			await service.shutdown("SIGTERM", 50);

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Shutdown timeout reached, forcing exit",
				expect.objectContaining({
					timeout: 50,
				}),
			);
			expect(process.exit).toHaveBeenCalledWith(1);
		});
	});

	describe("forceShutdown", () => {
		it("should force immediate shutdown", () => {
			const service = new GracefulShutdownService();

			expect(() => service.forceShutdown(2)).toThrow();

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Forcing immediate shutdown",
				expect.objectContaining({
					exitCode: 2,
				}),
			);
			expect(console.error).toHaveBeenCalledWith(
				"💥 Forcing immediate shutdown due to timeout or critical error",
			);
		});
	});

	describe("metrics", () => {
		it("should track shutdown metrics", async () => {
			const service = new GracefulShutdownService();
			const handler: ShutdownHandler = {
				name: "test-handler",
				priority: 5,
				handler: vi.fn().mockResolvedValue(undefined),
			};

			service.registerHandler(handler);

			await service.shutdown("SIGTERM");

			const metrics = service.getMetrics();

			expect(metrics.startTime).toBeGreaterThan(0);
			expect(metrics.endTime).toBeGreaterThan(metrics.startTime);
			expect(metrics.duration).toBeGreaterThan(0);
			expect(metrics.signal).toBe("SIGTERM");
			expect(metrics.forced).toBe(false);
			expect(metrics.handlersExecuted).toHaveLength(expect.any(Number));

			// Check handler execution metrics
			const handlerMetric = metrics.handlersExecuted.find(
				(h) => h.name === "test-handler",
			);
			expect(handlerMetric).toBeDefined();
			expect(handlerMetric?.success).toBe(true);
			expect(handlerMetric?.duration).toBeGreaterThan(0);
		});

		it("should track failed handler in metrics", async () => {
			const service = new GracefulShutdownService();
			const failedHandler: ShutdownHandler = {
				name: "failed-handler",
				priority: 5,
				handler: vi.fn().mockRejectedValue(new Error("Test error")),
			};

			service.registerHandler(failedHandler);

			await service.shutdown("SIGTERM");

			const metrics = service.getMetrics();
			const handlerMetric = metrics.handlersExecuted.find(
				(h) => h.name === "failed-handler",
			);

			expect(handlerMetric).toBeDefined();
			expect(handlerMetric?.success).toBe(false);
			expect(handlerMetric?.error).toBe("Test error");
		});
	});

	describe("isShutdownInProgress", () => {
		it("should return false initially", () => {
			const service = new GracefulShutdownService();
			expect(service.isShutdownInProgress()).toBe(false);
		});

		it("should return true during shutdown", () => {
			const service = new GracefulShutdownService();
			service.shutdown("SIGTERM");
			expect(service.isShutdownInProgress()).toBe(true);
		});
	});

	describe("default handlers", () => {
		it("should execute default shutdown handlers", async () => {
			const service = new GracefulShutdownService();

			await service.shutdown("SIGTERM");

			expect(shutdownTelemetry).toHaveBeenCalled();
			expect(closeDatabaseConnections).toHaveBeenCalled();
		});

		it("should handle default handler failures gracefully", async () => {
			const service = new GracefulShutdownService();

			// Make telemetry shutdown fail
			(shutdownTelemetry as Mock).mockRejectedValue(
				new Error("Telemetry shutdown failed"),
			);

			await service.shutdown("SIGTERM");

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Shutdown handler failed",
				expect.objectContaining({
					name: "shutdown-telemetry",
					error: "Telemetry shutdown failed",
				}),
			);

			// Should still proceed to exit
			expect(process.exit).toHaveBeenCalledWith(0);
		});
	});

	describe("global functions", () => {
		it("should return singleton instance", () => {
			const service1 = getGracefulShutdownService();
			const service2 = getGracefulShutdownService();

			expect(service1).toBe(service2);
			expect(service1).toBeInstanceOf(GracefulShutdownService);
		});

		it("should register handler via global function", () => {
			const handler: ShutdownHandler = {
				name: "global-handler",
				priority: 5,
				handler: vi.fn().mockResolvedValue(undefined),
			};

			registerShutdownHandler(handler);

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Shutdown handler registered",
				expect.objectContaining({
					name: "global-handler",
				}),
			);
		});

		it("should initiate shutdown via global function", async () => {
			await initiateGracefulShutdown("SIGUSR1", 10000);

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Initiating graceful shutdown",
				expect.objectContaining({
					signal: "SIGUSR1",
					timeout: 10000,
				}),
			);
		});

		it("should reset service instance", () => {
			const service1 = getGracefulShutdownService();
			resetGracefulShutdownService();
			const service2 = getGracefulShutdownService();

			expect(service1).not.toBe(service2);
		});
	});

	describe("signal handlers", () => {
		it("should handle SIGTERM signal", () => {
			const processOnSpy = vi.spyOn(process, "on");
			new GracefulShutdownService();

			// Get the SIGTERM handler
			const sigtermCall = processOnSpy.mock.calls.find(
				(call) => call[0] === "SIGTERM",
			);
			expect(sigtermCall).toBeDefined();

			const sigtermHandler = sigtermCall?.[1] as (...args: unknown[]) => void;

			// Trigger the handler
			sigtermHandler();

			expect(mockLogger.info).toHaveBeenCalledWith("Received SIGTERM signal");
		});

		it("should handle SIGINT signal", () => {
			const processOnSpy = vi.spyOn(process, "on");
			new GracefulShutdownService();

			// Get the SIGINT handler
			const sigintCall = processOnSpy.mock.calls.find(
				(call) => call[0] === "SIGINT",
			);
			expect(sigintCall).toBeDefined();

			const sigintHandler = sigintCall?.[1] as (...args: unknown[]) => void;

			// Trigger the handler
			sigintHandler();

			expect(mockLogger.info).toHaveBeenCalledWith("Received SIGINT signal");
		});

		it("should handle uncaught exceptions", () => {
			const processOnSpy = vi.spyOn(process, "on");
			new GracefulShutdownService();

			// Get the uncaughtException handler
			const exceptionCall = processOnSpy.mock.calls.find(
				(call) => call[0] === "uncaughtException",
			);
			expect(exceptionCall).toBeDefined();

			const exceptionHandler = exceptionCall?.[1] as (
				...args: unknown[]
			) => void;
			const testError = new Error("Test uncaught exception");

			// Trigger the handler
			expect(() => exceptionHandler(testError)).toThrow();

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Uncaught exception, initiating emergency shutdown",
				expect.objectContaining({
					error: "Test uncaught exception",
					stack: expect.any(String),
				}),
			);
			expect(console.error).toHaveBeenCalledWith(
				"💥 Uncaught exception:",
				testError,
			);
		});

		it("should handle unhandled promise rejections", () => {
			const processOnSpy = vi.spyOn(process, "on");
			new GracefulShutdownService();

			// Get the unhandledRejection handler
			const rejectionCall = processOnSpy.mock.calls.find(
				(call) => call[0] === "unhandledRejection",
			);
			expect(rejectionCall).toBeDefined();

			const rejectionHandler = rejectionCall?.[1] as (
				...args: unknown[]
			) => void;
			const testReason = new Error("Test unhandled rejection");

			// Trigger the handler
			expect(() => rejectionHandler(testReason, Promise.resolve())).toThrow();

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Unhandled promise rejection, initiating emergency shutdown",
				expect.objectContaining({
					reason: "Test unhandled rejection",
					stack: expect.any(String),
				}),
			);
			expect(console.error).toHaveBeenCalledWith(
				"💥 Unhandled promise rejection:",
				testReason,
			);
		});
	});
});
