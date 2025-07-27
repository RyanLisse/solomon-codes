import { beforeEach, describe, expect, it } from "vitest";
import { getEnvironment, getLogLevel } from "./config";
import {
	createLogger,
	getDefaultConfig,
	getLogger,
	resetLogger,
} from "./index";

describe("Winston Logger Configuration", () => {
	beforeEach(() => {
		// Reset environment variables
		delete process.env.NODE_ENV;
		delete process.env.LOG_LEVEL;
		delete process.env.LOG_FILE_PATH;
		delete process.env.SERVICE_NAME;
		delete process.env.SERVICE_VERSION;
		resetLogger();
	});

	describe("Configuration Functions", () => {
		it("should return development as default environment", () => {
			const env = getEnvironment();
			expect(env).toBe("development");
		});

		it("should return production when NODE_ENV is production", () => {
			process.env.NODE_ENV = "production";
			const env = getEnvironment();
			expect(env).toBe("production");
		});

		it("should return debug as default log level in development", () => {
			process.env.NODE_ENV = "development";
			const level = getLogLevel();
			expect(level).toBe("debug");
		});

		it("should return info as default log level in production", () => {
			process.env.NODE_ENV = "production";
			const level = getLogLevel();
			expect(level).toBe("info");
		});

		it("should respect LOG_LEVEL environment variable", () => {
			process.env.LOG_LEVEL = "warn";
			const level = getLogLevel();
			expect(level).toBe("warn");
		});
	});

	describe("Logger Creation", () => {
		it("should create logger with default configuration", () => {
			const logger = createLogger();

			expect(logger).toBeDefined();
			expect(logger.debug).toBeDefined();
			expect(logger.info).toBeDefined();
			expect(logger.warn).toBeDefined();
			expect(logger.error).toBeDefined();
			expect(logger.child).toBeDefined();
		});

		it("should create logger with custom configuration", () => {
			const logger = createLogger({ level: "warn" });

			expect(logger).toBeDefined();
		});

		it("should return singleton logger from getLogger", () => {
			const logger1 = getLogger();
			const logger2 = getLogger();

			expect(logger1).toBe(logger2);
		});

		it("should create new logger after reset", () => {
			const logger1 = getLogger();
			resetLogger();
			const logger2 = getLogger();

			expect(logger1).not.toBe(logger2);
		});
	});

	describe("Default Configuration", () => {
		it("should provide default configuration", () => {
			const config = getDefaultConfig();

			expect(config).toBeDefined();
			expect(config.serviceName).toBe("solomon-codes-web");
			expect(config.serviceVersion).toBe("1.0.0");
			expect(config.enableConsole).toBe(true);
		});

		it("should include service metadata in default config", () => {
			const config = getDefaultConfig();

			expect(config.defaultMeta).toBeDefined();
			expect(config.defaultMeta?.service).toBe("solomon-codes-web");
			expect(config.defaultMeta?.environment).toBe("development");
		});
	});

	describe("Child Logger", () => {
		it("should create child logger with additional metadata", () => {
			const logger = createLogger();
			const childLogger = logger.child({ component: "test" });

			expect(childLogger).toBeDefined();
			expect(childLogger.debug).toBeDefined();
		});
	});
});
