import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getEnvironmentRequirements,
	hasRequiredEnvironmentVariables,
	printValidationResults,
	type ValidationResult,
	validateEnvironment,
	validateOptionalEnvVars,
	validateRequiredEnvVars,
} from "./validation";

describe("Environment Validation", () => {
	const originalEnv = process.env;
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		process.env = { ...originalEnv };
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		process.env = originalEnv;
		consoleSpy.mockRestore();
	});

	describe("validateEnvironment", () => {
		it("should validate development environment successfully", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "development";

			const result = validateEnvironment();

			expect(result.success).toBe(true);
			expect(result.environment).toBe("development");
			expect(result.errors).toHaveLength(0);
			expect(result.warnings.length).toBeGreaterThan(0); // Should have warnings for optional vars
		});

		it("should fail validation for production without required vars", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "production";
			// Clear required production environment variables
			delete process.env.OPENAI_API_KEY;
			delete process.env.BROWSERBASE_API_KEY;
			delete process.env.BROWSERBASE_PROJECT_ID;
			delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

			const result = validateEnvironment();

			expect(result.success).toBe(false);
			expect(result.environment).toBe("production");
			expect(result.errors.length).toBeGreaterThan(0);
			expect(
				result.errors.some((error) => error.includes("OPENAI_API_KEY")),
			).toBe(true);
		});

		it("should validate production environment with all required vars", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "production";
			process.env.OPENAI_API_KEY = "sk-test-key";
			process.env.BROWSERBASE_API_KEY = "bb-test-key";
			process.env.BROWSERBASE_PROJECT_ID = "test-project";
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
				"https://jaeger.example.com/v1/traces";

			const result = validateEnvironment();

			expect(result.success).toBe(true);
			expect(result.environment).toBe("production");
			expect(result.errors).toHaveLength(0);
		});

		it("should validate custom validators", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "production";
			process.env.OPENAI_API_KEY = "sk-test-key";
			process.env.BROWSERBASE_API_KEY = "bb-test-key";
			process.env.BROWSERBASE_PROJECT_ID = "test-project";
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
				"http://insecure-endpoint.com/v1/traces"; // Should fail HTTPS validation

			const result = validateEnvironment();

			expect(result.success).toBe(false);
			expect(
				result.errors.some((error) =>
					error.includes("OTEL_EXPORTER_OTLP_ENDPOINT"),
				),
			).toBe(true);
		});

		it("should validate staging environment", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "staging";
			process.env.OPENAI_API_KEY = "sk-test-key";

			const result = validateEnvironment();

			expect(result.success).toBe(true);
			expect(result.environment).toBe("staging");
		});

		it("should handle unknown environment as development", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "unknown";

			const result = validateEnvironment();

			expect(result.success).toBe(true);
			expect(result.environment).toBe("unknown");
		});

		it("should validate optional environment variables", () => {
			process.env.OTEL_SAMPLING_RATIO = "invalid-number";

			const result = validateEnvironment();

			expect(
				result.warnings.some((warning) =>
					warning.includes("OTEL_SAMPLING_RATIO"),
				),
			).toBe(true);
		});
	});

	describe("validateRequiredEnvVars", () => {
		it("should validate specific required variables", () => {
			process.env.TEST_VAR_1 = "value1";
			process.env.TEST_VAR_2 = "value2";

			const result = validateRequiredEnvVars(["TEST_VAR_1", "TEST_VAR_2"]);

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should fail when required variables are missing", () => {
			const result = validateRequiredEnvVars([
				"MISSING_VAR_1",
				"MISSING_VAR_2",
			]);

			expect(result.success).toBe(false);
			expect(result.errors).toHaveLength(2);
			expect(result.errors[0]).toContain("MISSING_VAR_1");
			expect(result.errors[1]).toContain("MISSING_VAR_2");
		});
	});

	describe("validateOptionalEnvVars", () => {
		it("should always succeed for optional variables", () => {
			const result = validateOptionalEnvVars({
				OPTIONAL_VAR_1: "default1",
				OPTIONAL_VAR_2: "default2",
			});

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should provide warnings for missing optional variables", () => {
			const result = validateOptionalEnvVars({
				MISSING_OPTIONAL_VAR: "default-value",
			});

			expect(result.success).toBe(true);
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain("MISSING_OPTIONAL_VAR");
			expect(result.warnings[0]).toContain("default-value");
		});

		it("should not warn for present optional variables", () => {
			process.env.PRESENT_OPTIONAL_VAR = "actual-value";

			const result = validateOptionalEnvVars({
				PRESENT_OPTIONAL_VAR: "default-value",
			});

			expect(result.success).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});
	});

	describe("getEnvironmentRequirements", () => {
		it("should return production requirements", () => {
			const requirements = getEnvironmentRequirements("production");

			expect(requirements.length).toBeGreaterThan(0);
			expect(requirements.some((req) => req.name === "OPENAI_API_KEY")).toBe(
				true,
			);
			expect(
				requirements.some((req) => req.name === "BROWSERBASE_API_KEY"),
			).toBe(true);
		});

		it("should return staging requirements", () => {
			const requirements = getEnvironmentRequirements("staging");

			expect(requirements.length).toBeGreaterThan(0);
			expect(requirements.some((req) => req.name === "OPENAI_API_KEY")).toBe(
				true,
			);
		});

		it("should return development requirements", () => {
			const requirements = getEnvironmentRequirements("development");

			expect(requirements.length).toBeGreaterThan(0);
			expect(requirements.some((req) => req.name === "OPENAI_API_KEY")).toBe(
				true,
			);
		});

		it("should return empty array for unknown environment", () => {
			const requirements = getEnvironmentRequirements("unknown");

			expect(requirements).toHaveLength(0);
		});

		it("should use NODE_ENV when no environment specified", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "production";

			const requirements = getEnvironmentRequirements();

			expect(requirements.length).toBeGreaterThan(0);
			expect(requirements.some((req) => req.name === "OPENAI_API_KEY")).toBe(
				true,
			);
		});
	});

	describe("hasRequiredEnvironmentVariables", () => {
		it("should return true when all required variables are present", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "development";

			const result = hasRequiredEnvironmentVariables();

			expect(result).toBe(true);
		});

		it("should return false when required variables are missing", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "production";
			// Don't set required production variables

			const result = hasRequiredEnvironmentVariables();

			expect(result).toBe(false);
		});
	});

	describe("printValidationResults", () => {
		it("should print successful validation", () => {
			const result: ValidationResult = {
				success: true,
				errors: [],
				warnings: [],
				timestamp: new Date("2024-01-01T00:00:00Z"),
				environment: "development",
			};

			// Clear the spy before the test
			consoleSpy.mockClear();

			printValidationResults(result);

			expect(consoleSpy).toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Environment Validation (development)"),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"✅ All required environment variables are present",
				),
			);
		});

		it("should print validation errors", () => {
			const result: ValidationResult = {
				success: false,
				errors: ["Missing OPENAI_API_KEY", "Invalid OTEL_ENDPOINT"],
				warnings: [],
				timestamp: new Date("2024-01-01T00:00:00Z"),
				environment: "production",
			};

			// Clear the spy before the test
			consoleSpy.mockClear();

			printValidationResults(result);

			expect(consoleSpy).toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("❌ Environment validation failed"),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Missing OPENAI_API_KEY"),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Invalid OTEL_ENDPOINT"),
			);
		});

		it("should print validation warnings", () => {
			const result: ValidationResult = {
				success: true,
				errors: [],
				warnings: [
					"Optional LOG_LEVEL not set",
					"Optional SERVICE_NAME not set",
				],
				timestamp: new Date("2024-01-01T00:00:00Z"),
				environment: "development",
			};

			// Clear the spy before the test
			consoleSpy.mockClear();

			printValidationResults(result);

			expect(consoleSpy).toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("⚠️  Warnings:"),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Optional LOG_LEVEL not set"),
			);
		});

		it("should print timestamp", () => {
			const result: ValidationResult = {
				success: true,
				errors: [],
				warnings: [],
				timestamp: new Date("2024-01-01T12:00:00Z"),
				environment: "development",
			};

			// Clear the spy before the test
			consoleSpy.mockClear();

			printValidationResults(result);

			expect(consoleSpy).toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("2024-01-01T12:00:00.000Z"),
			);
		});
	});
});
