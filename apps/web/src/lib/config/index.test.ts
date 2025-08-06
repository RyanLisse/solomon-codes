import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ConfigurationError,
	getConfig,
	isConfigLoaded,
	resetConfig,
	validateConfig,
} from "./index";

describe("Configuration System", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		// Reset environment and configuration
		process.env = { ...originalEnv };
		resetConfig();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("validateConfig", () => {
		it("should validate configuration with default values", async () => {
			// Set minimal required environment
			vi.stubEnv("NODE_ENV", "development");

			const config = await validateConfig();

			expect(config).toBeDefined();
			expect(config.nodeEnv).toBe("development");
			expect(config.serverUrl).toBe("http://localhost:3001");
			expect(config.port).toBe(3001);
			expect(config.logLevel).toBe("info");
			expect(config.otelSamplingRatio).toBe(1.0);
		});

		it("should load configuration from environment variables", async () => {
			vi.stubEnv("NODE_ENV", "production");
			process.env.NEXT_PUBLIC_SERVER_URL = "https://example.com";
			process.env.PORT = "8080";
			process.env.OPENAI_API_KEY = "sk-test-key";
			process.env.LOG_LEVEL = "warn";
			process.env.OTEL_SAMPLING_RATIO = "0.5";

			const config = await validateConfig();

			expect(config.nodeEnv).toBe("production");
			expect(config.serverUrl).toBe("https://example.com");
			expect(config.port).toBe(8080);
			expect(config.openaiApiKey).toBe("sk-test-key");
			expect(config.logLevel).toBe("warn");
			expect(config.otelSamplingRatio).toBe(0.5);
		});

		it("should parse OTEL headers as JSON", async () => {
			process.env.OTEL_EXPORTER_OTLP_HEADERS =
				'{"Authorization":"Bearer token"}';

			const config = await validateConfig();

			expect(config.otelHeaders).toEqual({ Authorization: "Bearer token" });
		});

		it("should handle invalid JSON in OTEL headers", () => {
			process.env.OTEL_EXPORTER_OTLP_HEADERS = "invalid-json";

			expect(() => validateConfig()).toThrow(ConfigurationError);
		});

		it("should validate URL formats", () => {
			process.env.NEXT_PUBLIC_SERVER_URL = "not-a-url";

			expect(() => validateConfig()).toThrow(ConfigurationError);
		});

		it("should validate port ranges", () => {
			process.env.PORT = "99999";

			expect(() => validateConfig()).toThrow(ConfigurationError);
		});

		it("should validate sampling ratio bounds", () => {
			process.env.OTEL_SAMPLING_RATIO = "1.5";

			expect(() => validateConfig()).toThrow(ConfigurationError);
		});

		it("should validate log levels", () => {
			process.env.LOG_LEVEL = "invalid";

			expect(() => validateConfig()).toThrow(ConfigurationError);
		});

		it("should load app version from environment or default to unknown", async () => {
			process.env.APP_VERSION = "2.1.0";

			const config = await validateConfig();

			expect(config.appVersion).toBe("2.1.0");
		});

		it("should use unknown version when not provided", async () => {
			delete process.env.APP_VERSION;

			const config = await validateConfig();

			expect(config.appVersion).toBe("unknown");
		});

		it("should provide detailed error messages", () => {
			process.env.NEXT_PUBLIC_SERVER_URL = "invalid-url";

			try {
				validateConfig();
				expect.fail("Should have thrown ConfigurationError");
			} catch (error) {
				expect(error).toBeInstanceOf(ConfigurationError);
				expect((error as ConfigurationError).message).toContain(
					"SERVER_URL must be a valid URL",
				);
				expect((error as ConfigurationError).details.variable).toBe(
					"NEXT_PUBLIC_SERVER_URL",
				);
				expect((error as ConfigurationError).details.suggestion).toContain(
					"Set the NEXT_PUBLIC_SERVER_URL",
				);
			}
		});
	});

	describe("getConfig", () => {
		it("should return the same configuration instance", async () => {
			const config1 = await getConfig();
			const config2 = await getConfig();

			expect(config1).toBe(config2);
			expect(isConfigLoaded()).toBe(true);
		});

		it("should reload configuration after reset", async () => {
			const config1 = await getConfig();
			resetConfig();

			expect(isConfigLoaded()).toBe(false);

			const config2 = await getConfig();

			expect(config1).not.toBe(config2);
			expect(isConfigLoaded()).toBe(true);
		});
	});

	describe("ConfigurationError", () => {
		it("should create error with details", () => {
			const error = new ConfigurationError("Test error", {
				variable: "TEST_VAR",
				expected: "string",
				received: "number",
				suggestion: "Set TEST_VAR to a string value",
			});

			expect(error.name).toBe("ConfigurationError");
			expect(error.message).toBe("Test error");
			expect(error.details.variable).toBe("TEST_VAR");
			expect(error.details.expected).toBe("string");
			expect(error.details.received).toBe("number");
			expect(error.details.suggestion).toBe("Set TEST_VAR to a string value");
		});

		it("should create error without details", () => {
			const error = new ConfigurationError("Simple error");

			expect(error.name).toBe("ConfigurationError");
			expect(error.message).toBe("Simple error");
			expect(error.details).toEqual({});
		});
	});

	describe("Environment-specific validation", () => {
		it("should handle development environment", async () => {
			vi.stubEnv("NODE_ENV", "development");

			const config = await validateConfig();

			expect(config.nodeEnv).toBe("development");
			// OpenAI API key is optional in development
			expect(config.openaiApiKey).toBeUndefined();
		});

		it("should handle staging environment", async () => {
			vi.stubEnv("NODE_ENV", "staging");

			const config = await validateConfig();

			expect(config.nodeEnv).toBe("staging");
		});

		it("should handle production environment", async () => {
			vi.stubEnv("NODE_ENV", "production");

			const config = await validateConfig();

			expect(config.nodeEnv).toBe("production");
		});
	});
});
