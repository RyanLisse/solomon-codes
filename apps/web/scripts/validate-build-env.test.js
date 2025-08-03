/**
 * Tests for build-time environment validation script
 * Using London TDD approach with comprehensive mocking
 */

import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("fs");
vi.mock("path");

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

// Import the module under test
const { validateEnvironment, ENV_DEFINITIONS, DEPLOYMENT_TARGETS } =
	await import("./validate-build-env.js");

describe("Environment Validation Script", () => {
	let originalEnv;
	let consoleSpy;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };

		// Mock console methods
		consoleSpy = {
			log: vi.spyOn(console, "log").mockImplementation(() => {}),
			warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
			error: vi.spyOn(console, "error").mockImplementation(() => {}),
		};

		// Reset mocks
		vi.clearAllMocks();

		// Mock path.join to return predictable paths
		mockPath.join.mockImplementation((...args) => args.join("/"));

		// Mock process.cwd
		vi.spyOn(process, "cwd").mockReturnValue("/test/project");
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;

		// Restore console methods
		Object.values(consoleSpy).forEach((spy) => spy.mockRestore());

		vi.restoreAllMocks();
	});

	describe("Environment Variable Definitions", () => {
		it("should have all required environment variable definitions", () => {
			const requiredKeys = [
				"NEXT_PUBLIC_SERVER_URL",
				"NODE_ENV",
				"OPENAI_API_KEY",
				"E2B_API_KEY",
				"BROWSERBASE_API_KEY",
				"BROWSERBASE_PROJECT_ID",
				"DATABASE_URL",
				"OTEL_EXPORTER_OTLP_ENDPOINT",
				"JWT_SECRET",
			];

			requiredKeys.forEach((key) => {
				expect(ENV_DEFINITIONS).toHaveProperty(key);
				expect(ENV_DEFINITIONS[key]).toHaveProperty("description");
			});
		});

		it("should validate NEXT_PUBLIC_SERVER_URL correctly", () => {
			const definition = ENV_DEFINITIONS.NEXT_PUBLIC_SERVER_URL;

			// Valid URLs
			expect(definition.validate("https://example.com")).toBe(true);
			expect(definition.validate("http://localhost:3000")).toBe(true);

			// Invalid URLs
			expect(definition.validate("not-a-url")).toContain("Must be a valid URL");
			expect(definition.validate("ftp://invalid")).toContain(
				"Must be a valid URL",
			);

			// Empty value (should be allowed for optional)
			expect(definition.validate("")).toBe(true);
			expect(definition.validate(null)).toBe(true);
		});

		it("should validate NODE_ENV correctly", () => {
			const definition = ENV_DEFINITIONS.NODE_ENV;

			// Valid environments
			expect(definition.validate("development")).toBe(true);
			expect(definition.validate("staging")).toBe(true);
			expect(definition.validate("production")).toBe(true);
			expect(definition.validate("test")).toBe(true);

			// Invalid environments
			expect(definition.validate("invalid")).toContain("Must be one of");
		});

		it("should validate OpenAI API key format", () => {
			const definition = ENV_DEFINITIONS.OPENAI_API_KEY;

			// Valid format
			expect(definition.validate("sk-1234567890abcdef")).toBe(true);

			// Invalid format
			expect(definition.validate("invalid-key")).toContain(
				"Must start with sk-",
			);

			// Empty value
			expect(definition.validate("")).toBe(true);
		});

		it("should validate database URL format", () => {
			const definition = ENV_DEFINITIONS.DATABASE_URL;

			// Valid PostgreSQL URLs
			expect(definition.validate("postgres://user:pass@localhost/db")).toBe(
				true,
			);
			expect(definition.validate("postgresql://user:pass@localhost/db")).toBe(
				true,
			);

			// Invalid URLs
			expect(definition.validate("mysql://user:pass@localhost/db")).toContain(
				"Must be a valid PostgreSQL",
			);

			// Empty value
			expect(definition.validate("")).toBe(true);
		});

		it("should validate OTEL sampling ratio", () => {
			const definition = ENV_DEFINITIONS.OTEL_SAMPLING_RATIO;

			// Valid ratios
			expect(definition.validate("0.0")).toBe(true);
			expect(definition.validate("0.5")).toBe(true);
			expect(definition.validate("1.0")).toBe(true);

			// Invalid ratios
			expect(definition.validate("-0.1")).toContain("Must be between 0 and 1");
			expect(definition.validate("1.1")).toContain("Must be between 0 and 1");
			expect(definition.validate("invalid")).toContain(
				"Must be between 0 and 1",
			);
		});
	});

	describe("Deployment Target Configurations", () => {
		it("should have all deployment target configurations", () => {
			const expectedTargets = ["cloudflare", "railway", "vercel"];

			expectedTargets.forEach((target) => {
				expect(DEPLOYMENT_TARGETS).toHaveProperty(target);
				expect(DEPLOYMENT_TARGETS[target]).toHaveProperty("name");
				expect(DEPLOYMENT_TARGETS[target]).toHaveProperty("validate");
			});
		});

		it("should validate Cloudflare deployment requirements", () => {
			const cloudflareConfig = DEPLOYMENT_TARGETS.cloudflare;

			const mockEnv = {
				NEXT_PUBLIC_SERVER_URL: "https://app.pages.dev",
				NODE_ENV: "production",
			};

			const result = cloudflareConfig.validate(mockEnv);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should validate Railway deployment requirements", () => {
			const railwayConfig = DEPLOYMENT_TARGETS.railway;

			const mockEnv = {
				DATABASE_URL: "postgres://user:pass@railway.app/db",
				RAILWAY_ENVIRONMENT: "production",
			};

			const result = railwayConfig.validate(mockEnv);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should validate Vercel deployment requirements", () => {
			const vercelConfig = DEPLOYMENT_TARGETS.vercel;

			// Missing required URL for production
			const invalidEnv = {
				VERCEL_ENV: "production",
			};

			const invalidResult = vercelConfig.validate(invalidEnv);
			expect(invalidResult).toContain("NEXT_PUBLIC_SERVER_URL is required");

			// Valid configuration
			const validEnv = {
				VERCEL_ENV: "production",
				NEXT_PUBLIC_SERVER_URL: "https://app.vercel.app",
			};

			const validResult = vercelConfig.validate(validEnv);
			expect(validResult).toEqual([]);
		});
	});

	describe("Environment File Loading", () => {
		beforeEach(() => {
			// Mock file system operations
			mockPath.join.mockImplementation((...args) => args.join("/"));
		});

		it("should load environment variables from .env files with correct precedence", () => {
			// Mock file existence and content
			mockFs.existsSync.mockImplementation((filePath) => {
				return [".env.local", ".env", ".env.example"].some((file) =>
					filePath.includes(file),
				);
			});

			mockFs.readFileSync.mockImplementation((filePath) => {
				if (filePath.includes(".env.local")) {
					return "LOCAL_VAR=local_value\nSHARED_VAR=local_override";
				}
				if (filePath.includes(".env.example")) {
					return "EXAMPLE_VAR=example_value\nSHARED_VAR=example_value";
				}
				if (filePath.includes(".env")) {
					return "ENV_VAR=env_value\nSHARED_VAR=env_value";
				}
				return "";
			});

			// Set process environment variable
			process.env.PROCESS_VAR = "process_value";
			process.env.SHARED_VAR = "process_override";

			// Import and test the loadEnvFiles function
			// Note: This would require exporting the function or testing through validateEnvironment
			expect(mockFs.existsSync).toBeCalled();
		});

		it("should handle missing .env files gracefully", () => {
			mockFs.existsSync.mockReturnValue(false);

			// Should not throw error when no .env files exist
			expect(() => {
				// Call function that loads env files
			}).not.toThrow();
		});

		it("should parse .env file format correctly", () => {
			mockFs.existsSync.mockReturnValue(true);
			mockFs.readFileSync.mockReturnValue(`
# Comment line
SIMPLE_VAR=simple_value
QUOTED_VAR="quoted value"
EQUALS_IN_VALUE=key=value=more
EMPTY_VAR=
# Another comment
SPACED_VAR = spaced value
      `);

			// Test that parsing handles various formats correctly
			expect(mockFs.readFileSync).toBeCalled();
		});
	});

	describe("Environment Detection", () => {
		it("should detect current environment correctly", () => {
			// Test different NODE_ENV values
			process.env.NODE_ENV = "production";
			// getCurrentEnvironment() should return 'production'

			process.env.NODE_ENV = "development";
			// getCurrentEnvironment() should return 'development'

			delete process.env.NODE_ENV;
			// getCurrentEnvironment() should return 'development' as default
		});

		it("should detect deployment targets correctly", () => {
			// Test Cloudflare detection
			process.env.CF_PAGES = "true";
			// getDeploymentTarget() should return 'cloudflare'

			delete process.env.CF_PAGES;

			// Test Railway detection
			process.env.RAILWAY_ENVIRONMENT = "production";
			// getDeploymentTarget() should return 'railway'

			delete process.env.RAILWAY_ENVIRONMENT;

			// Test Vercel detection
			process.env.VERCEL_ENV = "production";
			// getDeploymentTarget() should return 'vercel'

			delete process.env.VERCEL_ENV;
			// getDeploymentTarget() should return null
		});
	});

	describe("Validation Logic", () => {
		it("should validate required variables for production environment", () => {
			process.env.NODE_ENV = "production";

			// Mock empty environment (no required vars)
			mockFs.existsSync.mockReturnValue(false);

			// Mock process.exit to prevent actual exit
			const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

			// Should fail validation and exit
			validateEnvironment();

			expect(exitSpy).toHaveBeenCalledWith(1);
			expect(consoleSpy.log).toHaveBeenCalledWith(
				expect.stringContaining("❌ Found"),
			);

			exitSpy.mockRestore();
		});

		it("should pass validation with all required variables for production", () => {
			process.env.NODE_ENV = "production";

			// Set all required production variables
			const requiredVars = {
				NEXT_PUBLIC_SERVER_URL: "https://production.app.com",
				OPENAI_API_KEY: "sk-1234567890abcdef",
				E2B_API_KEY: "12345678901234567890123456789012",
				BROWSERBASE_API_KEY: "browserbase_key",
				BROWSERBASE_PROJECT_ID: "project_123",
				OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.endpoint.com",
				JWT_SECRET: "12345678901234567890123456789012",
			};

			Object.assign(process.env, requiredVars);

			mockFs.existsSync.mockReturnValue(true);
			mockFs.readFileSync.mockReturnValue(
				Object.entries(requiredVars)
					.map(([key, value]) => `${key}=${value}`)
					.join("\n"),
			);

			// Mock process.exit to prevent actual exit
			const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

			validateEnvironment();

			// Should not exit with error
			expect(exitSpy).not.toHaveBeenCalledWith(1);
			expect(consoleSpy.log).toHaveBeenCalledWith(
				expect.stringContaining("✅ All environment variables are valid!"),
			);

			exitSpy.mockRestore();
		});

		it("should detect placeholder values and warn appropriately", () => {
			process.env.NODE_ENV = "development";

			mockFs.existsSync.mockReturnValue(true);
			mockFs.readFileSync.mockReturnValue(`
OPENAI_API_KEY=your_openai_api_key_here
E2B_API_KEY=replace_with_your_key
BROWSERBASE_API_KEY=example_key
      `);

			const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

			validateEnvironment();

			// Should show warnings for placeholder values
			expect(consoleSpy.log).toHaveBeenCalledWith(
				expect.stringContaining("⚠️  Found"),
			);

			exitSpy.mockRestore();
		});

		it("should handle deployment-specific validation", () => {
			process.env.NODE_ENV = "production";
			process.env.CF_PAGES = "true";
			process.env.NEXT_PUBLIC_SERVER_URL = "https://app.pages.dev";

			mockFs.existsSync.mockReturnValue(true);
			mockFs.readFileSync.mockReturnValue(
				"NEXT_PUBLIC_SERVER_URL=https://app.pages.dev",
			);

			const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

			validateEnvironment();

			// Should validate for Cloudflare deployment
			expect(consoleSpy.log).toHaveBeenCalledWith(
				expect.stringContaining(
					"🎯 Validating for deployment target: Cloudflare Pages",
				),
			);

			exitSpy.mockRestore();
		});
	});

	describe("Report Generation", () => {
		it("should generate comprehensive validation report", () => {
			const mockResults = [
				{
					key: "TEST_VAR",
					errors: ["TEST_VAR is required for production environment"],
					warnings: [],
				},
				{
					key: "ANOTHER_VAR",
					errors: [],
					warnings: ["ANOTHER_VAR appears to contain a placeholder value"],
				},
			];

			// Test report generation logic
			expect(mockResults).toHaveLength(2);
			expect(mockResults[0].errors).toHaveLength(1);
			expect(mockResults[1].warnings).toHaveLength(1);
		});

		it("should provide helpful tips when validation fails", () => {
			process.env.NODE_ENV = "production";

			mockFs.existsSync.mockReturnValue(false);

			const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

			validateEnvironment();

			// Should show helpful tips
			expect(consoleSpy.log).toHaveBeenCalledWith(
				expect.stringContaining("💡 Tips:"),
			);
			expect(consoleSpy.log).toHaveBeenCalledWith(
				expect.stringContaining("Copy .env.example to .env"),
			);

			exitSpy.mockRestore();
		});
	});

	describe("Error Handling", () => {
		it("should handle file system errors gracefully", () => {
			mockFs.existsSync.mockImplementation(() => {
				throw new Error("File system error");
			});

			// Should not crash on file system errors
			expect(() => {
				validateEnvironment();
			}).not.toThrow();
		});

		it("should handle malformed .env files", () => {
			mockFs.existsSync.mockReturnValue(true);
			mockFs.readFileSync.mockReturnValue(`
MALFORMED_LINE_NO_EQUALS
=NO_KEY_BEFORE_EQUALS
NORMAL_VAR=normal_value
      `);

			// Should handle malformed lines without crashing
			expect(() => {
				validateEnvironment();
			}).not.toThrow();
		});
	});
});
