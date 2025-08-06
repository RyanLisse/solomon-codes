import { beforeEach, describe, expect, it, vi } from "vitest";
import * as configService from "../config/service";
import {
	getDefaultLoggerConfig,
	getEnvironment,
	getLogLevel,
	getServiceVersion,
} from "./config";
import { createLogger, getLogger, resetLogger } from "./index";

describe("Winston Logger Configuration", () => {
	beforeEach(() => {
		// Reset environment variables
		Object.defineProperty(process.env, "NODE_ENV", {
			value: undefined,
			writable: true,
		});
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
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "production",
				writable: true,
			});
			const env = getEnvironment();
			expect(env).toBe("production");
		});

		it("should return debug as default log level in development", () => {
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "development",
				writable: true,
			});
			const level = getLogLevel();
			expect(level).toBe("debug");
		});

		it("should return info as default log level in production", () => {
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "production",
				writable: true,
			});
			const level = getLogLevel();
			expect(level).toBe("info");
		});

		it("should respect LOG_LEVEL environment variable", () => {
			process.env.LOG_LEVEL = "warn";
			const level = getLogLevel();
			expect(level).toBe("warn");
		});

		it("should return unknown as default service version when no environment variable set", () => {
			const version = getServiceVersion();
			expect(version).toBe("unknown");
		});

		it("should return SERVICE_VERSION environment variable when set", () => {
			process.env.SERVICE_VERSION = "2.1.0";
			const version = getServiceVersion();
			expect(version).toBe("2.1.0");
		});

		it("should fall back to unknown when ConfigurationService throws", () => {
			// Mock the ConfigurationService to throw an error
			const spy = vi
				.spyOn(configService, "getConfigurationService")
				.mockImplementation(() => {
					throw new Error("Configuration service error");
				});

			const version = getServiceVersion();
			expect(version).toBe("unknown");

			// Restore the original function
			spy.mockRestore();
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
		it("should provide default configuration", async () => {
			const config = await getDefaultLoggerConfig();

			expect(config).toBeDefined();
			expect(config.serviceName).toBe("solomon-codes-web");
			expect(config.serviceVersion).toBe("unknown");
			expect(config.enableConsole).toBe(true);
		});

		it("should include service metadata in default config", async () => {
			const config = await getDefaultLoggerConfig();

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
