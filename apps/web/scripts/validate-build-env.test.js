/**
 * Tests for build-time environment validation script
 * Using Bun test framework with proper mocking
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";

describe("Environment Validation Script", () => {
	let originalEnv;
	let consoleSpy;
	let exitSpy;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };

		// Clear test-related environment variables
		Object.keys(process.env).forEach((key) => {
			if (
				key.startsWith("NEXT_") ||
				key.startsWith("NODE_") ||
				key.startsWith("OPENAI_") ||
				key.startsWith("E2B_") ||
				key.startsWith("BROWSERBASE_") ||
				key.startsWith("DATABASE_") ||
				key.startsWith("OTEL_") ||
				key.startsWith("JWT_") ||
				key.startsWith("CF_") ||
				key.startsWith("RAILWAY_") ||
				key.startsWith("VERCEL_")
			) {
				delete process.env[key];
			}
		});

		// Mock console methods
		consoleSpy = {
			log: spyOn(console, "log").mockImplementation(() => {}),
			warn: spyOn(console, "warn").mockImplementation(() => {}),
			error: spyOn(console, "error").mockImplementation(() => {}),
		};

		// Mock process.exit
		exitSpy = spyOn(process, "exit").mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;

		// Restore console methods
		Object.values(consoleSpy).forEach((spy) => spy.mockRestore());

		// Restore process.exit
		exitSpy.mockRestore();

		// Clear all mocks
		mock.restore();
	});

	describe("Environment Variable Definitions", () => {
		it("should have all required environment variable definitions", async () => {
			// Mock fs and path modules before importing
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { ENV_DEFINITIONS } = await import("./validate-build-env.js");

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

		it("should validate NEXT_PUBLIC_SERVER_URL correctly", async () => {
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { ENV_DEFINITIONS } = await import("./validate-build-env.js");
			const definition = ENV_DEFINITIONS.NEXT_PUBLIC_SERVER_URL;

			// Valid URLs
			expect(definition.validate("https://example.com")).toBe(true);
			expect(definition.validate("http://localhost:3000")).toBe(true);

			// Invalid URLs
			expect(definition.validate("not-a-url")).toBe("Must be a valid URL");
			expect(definition.validate("://invalid")).toBe("Must be a valid URL");

			// Empty value (should be allowed for optional)
			expect(definition.validate("")).toBe(true);
			expect(definition.validate(null)).toBe(true);
		});

		it("should validate NODE_ENV correctly", async () => {
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { ENV_DEFINITIONS } = await import("./validate-build-env.js");
			const definition = ENV_DEFINITIONS.NODE_ENV;

			// Valid environments
			expect(definition.validate("development")).toBe(true);
			expect(definition.validate("staging")).toBe(true);
			expect(definition.validate("production")).toBe(true);
			expect(definition.validate("test")).toBe(true);

			// Invalid environments
			expect(definition.validate("invalid")).toBe(
				"Must be one of: development, staging, production, test",
			);
		});

		it("should validate OpenAI API key format", async () => {
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { ENV_DEFINITIONS } = await import("./validate-build-env.js");
			const definition = ENV_DEFINITIONS.OPENAI_API_KEY;

			// Valid format
			expect(definition.validate("sk-1234567890abcdef")).toBe(true);

			// Invalid format
			expect(definition.validate("invalid-key")).toBe("Must start with sk-");

			// Empty value
			expect(definition.validate("")).toBe(true);
		});

		it("should validate database URL format", async () => {
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { ENV_DEFINITIONS } = await import("./validate-build-env.js");
			const definition = ENV_DEFINITIONS.DATABASE_URL;

			// Valid PostgreSQL URLs
			expect(definition.validate("postgres://user:pass@localhost/db")).toBe(
				true,
			);
			expect(definition.validate("postgresql://user:pass@localhost/db")).toBe(
				true,
			);

			// Invalid URLs
			expect(definition.validate("mysql://user:pass@localhost/db")).toBe(
				"Must be a valid PostgreSQL connection string",
			);

			// Empty value
			expect(definition.validate("")).toBe(true);
		});

		it("should validate OTEL sampling ratio", async () => {
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { ENV_DEFINITIONS } = await import("./validate-build-env.js");
			const definition = ENV_DEFINITIONS.OTEL_SAMPLING_RATIO;

			// Valid ratios
			expect(definition.validate("0.0")).toBe(true);
			expect(definition.validate("0.5")).toBe(true);
			expect(definition.validate("1.0")).toBe(true);

			// Invalid ratios
			expect(definition.validate("-0.1")).toBe("Must be between 0 and 1");
			expect(definition.validate("1.1")).toBe("Must be between 0 and 1");
			expect(definition.validate("invalid")).toBe("Must be between 0 and 1");
		});
	});

	describe("Deployment Target Configurations", () => {
		it("should have all deployment target configurations", async () => {
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { DEPLOYMENT_TARGETS } = await import("./validate-build-env.js");
			const expectedTargets = ["cloudflare", "railway", "vercel"];

			expectedTargets.forEach((target) => {
				expect(DEPLOYMENT_TARGETS).toHaveProperty(target);
				expect(DEPLOYMENT_TARGETS[target]).toHaveProperty("name");
				expect(DEPLOYMENT_TARGETS[target]).toHaveProperty("validate");
			});
		});

		it("should validate Cloudflare deployment requirements", async () => {
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { DEPLOYMENT_TARGETS } = await import("./validate-build-env.js");
			const cloudflareConfig = DEPLOYMENT_TARGETS.cloudflare;

			const mockEnv = {
				NEXT_PUBLIC_SERVER_URL: "https://app.pages.dev",
				NODE_ENV: "production",
			};

			const result = cloudflareConfig.validate(mockEnv);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should validate Railway deployment requirements", async () => {
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { DEPLOYMENT_TARGETS } = await import("./validate-build-env.js");
			const railwayConfig = DEPLOYMENT_TARGETS.railway;

			const mockEnv = {
				DATABASE_URL: "postgres://user:pass@railway.app/db",
				RAILWAY_ENVIRONMENT: "production",
			};

			const result = railwayConfig.validate(mockEnv);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should validate Vercel deployment requirements", async () => {
			const mockFs = {
				existsSync: mock(() => false),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			const { DEPLOYMENT_TARGETS } = await import("./validate-build-env.js");
			const vercelConfig = DEPLOYMENT_TARGETS.vercel;

			// Missing required URL for production
			const invalidEnv = {
				VERCEL_ENV: "production",
			};

			const invalidResult = vercelConfig.validate(invalidEnv);
			expect(invalidResult).toContain(
				"NEXT_PUBLIC_SERVER_URL is required for Vercel production deployment",
			);

			// Valid configuration
			const validEnv = {
				VERCEL_ENV: "production",
				NEXT_PUBLIC_SERVER_URL: "https://app.vercel.app",
			};

			const validResult = vercelConfig.validate(validEnv);
			expect(validResult).toEqual([]);
		});
	});

	describe("Validation Logic Integration", () => {
		it("should validate production environment with missing variables", async () => {
			// Save current environment state
			const savedEnv = { ...process.env };

			// Set NODE_ENV to production
			process.env.NODE_ENV = "production";

			// Clear all environment variables that could affect validation
			delete process.env.NEXT_PUBLIC_SERVER_URL;
			delete process.env.OPENAI_API_KEY;
			delete process.env.E2B_API_KEY;
			delete process.env.BROWSERBASE_API_KEY;
			delete process.env.BROWSERBASE_PROJECT_ID;
			delete process.env.DATABASE_URL;
			delete process.env.JWT_SECRET;
			delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
			delete process.env.LOG_LEVEL;

			// Mock fs.existsSync to return false for all .env files to prevent loading any env files
			const originalExistsSync = require("node:fs").existsSync;
			require("node:fs").existsSync = mock((path) => {
				if (path.includes(".env")) {
					return false;
				}
				return originalExistsSync(path);
			});

			try {
				// Clear module cache and import fresh module
				delete require.cache[require.resolve("./validate-build-env.js")];
				const module = require("./validate-build-env.js");

				// Call validateEnvironment which should call process.exit(1)
				module.validateEnvironment();

				// Should call process.exit with 1 due to missing variables
				expect(exitSpy).toHaveBeenCalledWith(1);
			} finally {
				// Restore fs.existsSync
				require("node:fs").existsSync = originalExistsSync;
				// Restore environment
				process.env = savedEnv;
			}
		});

		it("should pass validation with all required variables for production", async () => {
			process.env.NODE_ENV = "production";

			// Set all required production variables
			const requiredVars = {
				NODE_ENV: "production",
				NEXT_PUBLIC_SERVER_URL: "https://production.app.com",
				OPENAI_API_KEY: "sk-1234567890abcdef",
				E2B_API_KEY: "12345678901234567890123456789012",
				BROWSERBASE_API_KEY: "browserbase_key",
				BROWSERBASE_PROJECT_ID: "project_123",
				DATABASE_URL: "postgresql://user:pass@localhost/testdb",
				OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.endpoint.com",
				JWT_SECRET: "12345678901234567890123456789012",
			};

			Object.assign(process.env, requiredVars);

			// Ensure LOG_LEVEL is either unset or has a valid value
			if (process.env.LOG_LEVEL) {
				process.env.LOG_LEVEL = process.env.LOG_LEVEL.toLowerCase();
			}

			const envFileContent = Object.entries(requiredVars)
				.map(([key, value]) => `${key}=${value}`)
				.join("\n");

			// Mock fs and path modules
			const mockFs = {
				existsSync: mock(() => true),
				readFileSync: mock(() => envFileContent),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			// Clear module cache and import fresh module
			delete require.cache[require.resolve("./validate-build-env.js")];
			const module = await import(`./validate-build-env.js?t=${Date.now()}`);

			// Call validateEnvironment and capture any thrown errors
			try {
				// Capture console output to see validation errors
				const consoleLogs = [];
				const originalLog = console.log;
				console.log = (...args) => {
					consoleLogs.push(args.join(" "));
					originalLog(...args);
				};

				module.validateEnvironment();

				// Restore console.log
				console.log = originalLog;

				// If process.exit was called, log the console output for debugging
				if (exitSpy.mock.calls.length > 0) {
					console.error("Validation failed. Console output:");
					consoleLogs.forEach((log) => console.error(log));
				}

				// Should not exit with error since all variables are provided
				expect(exitSpy).not.toHaveBeenCalledWith(1);
			} catch (error) {
				// If validation throws an error, log it for debugging
				console.error("Validation error:", error);
				throw error;
			}
		});

		it("should handle deployment-specific validation", async () => {
			process.env.NODE_ENV = "production";
			process.env.CF_PAGES = "true";
			process.env.NEXT_PUBLIC_SERVER_URL = "https://app.pages.dev";

			// Mock fs and path modules
			const mockFs = {
				existsSync: mock(() => true),
				readFileSync: mock(
					() => "NEXT_PUBLIC_SERVER_URL=https://app.pages.dev",
				),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			// Clear module cache and import fresh module
			delete require.cache[require.resolve("./validate-build-env.js")];
			const module = await import(`./validate-build-env.js?t=${Date.now()}`);

			// Call validateEnvironment
			module.validateEnvironment();

			// Should handle deployment-specific validation
			expect(consoleSpy.log).toHaveBeenCalled();
		});
	});

	describe("Error Handling", () => {
		it("should handle file system errors gracefully", async () => {
			// Mock fs to throw error when accessing files
			const mockFs = {
				existsSync: mock(() => {
					throw new Error("File system error");
				}),
				readFileSync: mock(() => ""),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			// Clear module cache and import fresh module
			delete require.cache[require.resolve("./validate-build-env.js")];
			const module = await import(`./validate-build-env.js?t=${Date.now()}`);

			// Should handle error gracefully
			expect(() => {
				module.validateEnvironment();
			}).not.toThrow("File system error");
		});

		it("should handle malformed .env files", async () => {
			// Mock fs and path modules
			const mockFs = {
				existsSync: mock(() => true),
				readFileSync: mock(
					() => `
MALFORMED_LINE_NO_EQUALS
=NO_KEY_BEFORE_EQUALS
NORMAL_VAR=normal_value
      `,
				),
			};
			const mockPath = {
				join: mock((...args) => args.join("/")),
			};

			mock.module("fs", () => mockFs);
			mock.module("path", () => mockPath);

			// Clear module cache and import fresh module
			delete require.cache[require.resolve("./validate-build-env.js")];
			const module = await import(`./validate-build-env.js?t=${Date.now()}`);

			// Should handle malformed lines without crashing
			expect(() => {
				module.validateEnvironment();
			}).not.toThrow();
		});
	});
});
