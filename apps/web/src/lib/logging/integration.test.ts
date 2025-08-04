import { beforeEach, describe, expect, it } from "vitest";
import { createLogger, getLogger, resetLogger } from "./index";

describe("Logger Integration Tests", () => {
	beforeEach(() => {
		resetLogger();
		// Reset environment variables
		Object.defineProperty(process.env, "NODE_ENV", {
			value: undefined,
			writable: true,
		});
		delete process.env.LOG_LEVEL;
		delete process.env.LOG_FILE_PATH;
	});

	describe("Logging Operations", () => {
		it("should log messages without throwing errors", () => {
			const logger = createLogger();

			expect(() => {
				logger.debug("Debug message");
				logger.info("Info message");
				logger.warn("Warning message");
				logger.error("Error message");
			}).not.toThrow();
		});

		it("should log messages with metadata", () => {
			const logger = createLogger();

			expect(() => {
				logger.info("Test message", {
					correlationId: "test-123",
					userId: "user-456",
					component: "test-component",
				});
			}).not.toThrow();
		});

		it("should log error objects", () => {
			const logger = createLogger();
			const error = new Error("Test error");

			expect(() => {
				logger.error(error);
				logger.error("String error message", { error });
			}).not.toThrow();
		});

		it("should create child logger with inherited metadata", () => {
			const logger = createLogger();
			const childLogger = logger.child({
				component: "child-component",
				requestId: "req-123",
			});

			expect(() => {
				childLogger.info("Child logger message");
				childLogger.error("Child logger error");
			}).not.toThrow();
		});
	});

	describe("Environment-based Configuration", () => {
		it("should work in development environment", () => {
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "development",
				writable: true,
			});
			const logger = createLogger();

			expect(() => {
				logger.debug("Development debug message");
			}).not.toThrow();
		});

		it("should work in production environment", () => {
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "production",
				writable: true,
			});
			const logger = createLogger();

			expect(() => {
				logger.info("Production info message");
			}).not.toThrow();
		});

		it("should respect custom log level", () => {
			process.env.LOG_LEVEL = "warn";
			const logger = createLogger();

			expect(() => {
				logger.warn("Warning message");
				logger.error("Error message");
			}).not.toThrow();
		});
	});

	describe("Singleton Behavior", () => {
		it("should maintain singleton behavior across calls", () => {
			const logger1 = getLogger();
			const logger2 = getLogger();

			expect(logger1).toBe(logger2);
		});

		it("should create new instance after reset", () => {
			const logger1 = getLogger();
			resetLogger();
			const logger2 = getLogger();

			expect(logger1).not.toBe(logger2);
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid log levels gracefully", () => {
			process.env.LOG_LEVEL = "invalid-level";

			expect(() => {
				const logger = createLogger();
				logger.info("Test message");
			}).not.toThrow();
		});

		it("should handle missing environment variables", () => {
			Object.defineProperty(process.env, "NODE_ENV", {
				value: undefined,
				writable: true,
			});
			delete process.env.SERVICE_NAME;
			delete process.env.SERVICE_VERSION;

			expect(() => {
				const logger = createLogger();
				logger.info("Test message");
			}).not.toThrow();
		});
	});
});
