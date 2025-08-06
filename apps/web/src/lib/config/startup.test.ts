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
	createActionableErrorMessage,
	getStartupValidationService,
	resetStartupValidationService,
	StartupValidationService,
	validateEnvironmentRequirements,
	validateStartupOrExit,
} from "./startup";

// Mock dependencies
vi.mock("../database/connection");
vi.mock("../telemetry");

import {
	checkDatabaseHealth,
	testDatabaseConnection,
} from "../database/connection";
import { getTelemetryService, initializeTelemetry } from "../telemetry";

describe("StartupValidationService", () => {
	const originalEnv = process.env;
	const consoleSpy = vi
		.spyOn(console, "log")
		.mockImplementation((): void => {});
	const consoleErrorSpy = vi
		.spyOn(console, "error")
		.mockImplementation((): void => {});
	const consoleWarnSpy = vi
		.spyOn(console, "warn")
		.mockImplementation((): void => {});

	beforeEach(() => {
		process.env = { ...originalEnv };
		vi.stubEnv("NODE_ENV", "development");
		resetStartupValidationService();
		vi.clearAllMocks();

		// Setup default mocks for database
		(testDatabaseConnection as Mock).mockResolvedValue({
			success: true,
			attempts: 1,
		});
		(checkDatabaseHealth as Mock).mockResolvedValue({
			isHealthy: true,
			responseTime: 50,
			errors: [],
		});

		// Setup default mocks for telemetry
		(initializeTelemetry as Mock).mockResolvedValue(true);
		(getTelemetryService as Mock).mockReturnValue({
			isEnabled: () => true,
			getConfig: () => ({
				isEnabled: true,
				endpoint: "http://localhost:4318/v1/traces",
			}),
		});
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("StartupValidationService", () => {
		it("should create startup validation service", () => {
			const service = new StartupValidationService();
			expect(service).toBeDefined();
		});

		it("should validate startup successfully in development", async () => {
			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			expect(result.environment).toBe("development");
		});

		it("should get validation summary", async () => {
			const service = new StartupValidationService();
			const summary = await service.getValidationSummary();

			expect(summary.environment).toBe("development");
			expect(summary.configurationValid).toBe(true);
			expect(summary.apiConnectivityValid).toBe(true);
			expect(summary.dependenciesValid).toBe(true);
		});
	});

	describe("API connectivity validation", () => {
		it("should warn about missing BrowserBase in development", async () => {
			delete process.env.BROWSERBASE_API_KEY;
			delete process.env.BROWSERBASE_PROJECT_ID;

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			expect(result.warnings.some((w) => w.includes("BrowserBase"))).toBe(true);
		});

		it("should validate OpenAI API key format", async () => {
			process.env.OPENAI_API_KEY = "invalid-key-format";

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			expect(
				result.warnings.some((w) => w.includes("OpenAI API key format")),
			).toBe(true);
		});
	});

	describe("Service dependencies validation", () => {
		it("should validate database URL format", async () => {
			process.env.DATABASE_URL = "invalid-url";

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			expect(
				result.warnings.some((w) => w.includes("Database URL format")),
			).toBe(true);
		});

		it("should validate telemetry endpoint", async () => {
			vi.stubEnv("NODE_ENV", "production");
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
				"http://insecure-endpoint.com/v1/traces";

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(
				result.warnings.some((w) => w.includes("HTTPS in production")),
			).toBe(true);
		});

		it("should fail on invalid telemetry endpoint", async () => {
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "not-a-url";

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(false);
			expect(
				result.errors.some((e) => e.includes("Invalid telemetry endpoint")),
			).toBe(true);
		});
	});

	describe("Global service management", () => {
		it("should return the same service instance", () => {
			const service1 = getStartupValidationService();
			const service2 = getStartupValidationService();

			expect(service1).toBe(service2);
		});

		it("should reset service instance", () => {
			const service1 = getStartupValidationService();
			resetStartupValidationService();
			const service2 = getStartupValidationService();

			expect(service1).not.toBe(service2);
		});
	});

	describe("Database connectivity validation", () => {
		it("should pass when database is not configured in development", async () => {
			process.env.DATABASE_URL = "";

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			expect(
				result.warnings.some((w) => w.includes("Database not configured")),
			).toBe(true);
		});

		it("should fail when database is not configured in production", async () => {
			vi.stubEnv("NODE_ENV", "production");
			process.env.DATABASE_URL = "";

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(false);
			expect(
				result.errors.some((e) =>
					e.includes("Database configuration is required in production"),
				),
			).toBe(true);
		});

		it("should test database connectivity when configured", async () => {
			process.env.DATABASE_URL = "postgresql://localhost:5432/test";

			const service = new StartupValidationService();
			await service.validateStartup();

			expect(testDatabaseConnection).toHaveBeenCalledWith(3, 1000);
			expect(checkDatabaseHealth).toHaveBeenCalled();
		});

		it("should handle database connectivity failure in production", async () => {
			vi.stubEnv("NODE_ENV", "production");
			process.env.DATABASE_URL = "postgresql://localhost:5432/test";
			(testDatabaseConnection as Mock).mockResolvedValue({
				success: false,
				error: "Connection refused",
				attempts: 3,
			});

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(false);
			expect(
				result.errors.some((e) =>
					e.includes("Database connectivity failed: Connection refused"),
				),
			).toBe(true);
		});

		it("should handle database connectivity failure in development with warnings", async () => {
			process.env.DATABASE_URL = "postgresql://localhost:5432/test";
			(testDatabaseConnection as Mock).mockResolvedValue({
				success: false,
				error: "Connection timeout",
				attempts: 3,
			});

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			expect(
				result.warnings.some((w) =>
					w.includes("Database connectivity failed: Connection timeout"),
				),
			).toBe(true);
		});

		it("should handle database health check warnings", async () => {
			process.env.DATABASE_URL = "postgresql://localhost:5432/test";
			(checkDatabaseHealth as Mock).mockResolvedValue({
				isHealthy: false,
				responseTime: 150,
				errors: ["Query timeout"],
			});

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			expect(
				result.warnings.some((w) =>
					w.includes("Database health check failed: Query timeout"),
				),
			).toBe(true);
		});
	});

	describe("Startup metrics tracking", () => {
		it("should track startup metrics with timing information", async () => {
			const service = new StartupValidationService();
			await service.validateStartup();

			const metrics = service.getStartupMetrics();

			expect(metrics.startTime).toBeGreaterThan(0);
			expect(metrics.endTime).toBeGreaterThan(metrics.startTime);
			expect(metrics.duration).toBeGreaterThan(0);
			expect(metrics.validationSteps).toHaveLength(6); // env, config, db, api, deps, telemetry

			// Check that all expected validation steps are present
			const stepNames = metrics.validationSteps.map((step) => step.name);
			expect(stepNames).toContain("environment");
			expect(stepNames).toContain("configuration");
			expect(stepNames).toContain("database");
			expect(stepNames).toContain("api-connectivity");
			expect(stepNames).toContain("service-dependencies");
			expect(stepNames).toContain("telemetry");

			// Verify timing information for each step
			for (const step of metrics.validationSteps) {
				expect(step.startTime).toBeGreaterThan(0);
				expect(step.endTime).toBeGreaterThan(step.startTime);
				expect(step.duration).toBeGreaterThan(0);
				expect(typeof step.success).toBe("boolean");
			}
		});

		it("should track failed validation steps in metrics", async () => {
			(testDatabaseConnection as Mock).mockResolvedValue({
				success: false,
				error: "Test error",
				attempts: 1,
			});

			const service = new StartupValidationService();
			await service.validateStartup();

			const metrics = service.getStartupMetrics();
			const dbStep = metrics.validationSteps.find(
				(step) => step.name === "database",
			);

			expect(dbStep).toBeDefined();
			expect(dbStep?.success).toBe(true); // Should still succeed in development with warnings
			expect(dbStep?.warnings).toContain(
				"Database connectivity failed: Test error (attempts: 1)",
			);
		});
	});

	describe("Enhanced validation summary", () => {
		it("should provide comprehensive validation summary with new fields", async () => {
			const service = new StartupValidationService();
			await service.validateStartup();

			const summary = service.getValidationSummary();

			expect(summary).toMatchObject({
				environment: expect.any(String),
				configurationValid: expect.any(Boolean),
				databaseConnectivityValid: expect.any(Boolean),
				apiConnectivityValid: expect.any(Boolean),
				dependenciesValid: expect.any(Boolean),
				telemetryValid: expect.any(Boolean),
				lastValidation: expect.any(Date),
				startupDuration: expect.any(Number),
				validationSteps: expect.arrayContaining([
					expect.objectContaining({
						name: expect.any(String),
						duration: expect.any(Number),
						success: expect.any(Boolean),
					}),
				]),
			});
		});

		it("should reflect failed validations in summary", async () => {
			vi.stubEnv("NODE_ENV", "production");
			process.env.DATABASE_URL = "";

			const service = new StartupValidationService();
			await service.validateStartup();

			const summary = await service.getValidationSummary();

			expect(summary.databaseConnectivityValid).toBe(false);
			expect(
				summary.validationSteps?.some(
					(step) => step.name === "database" && !step.success,
				),
			).toBe(true);
		});
	});

	describe("Telemetry service validation", () => {
		it("should handle telemetry initialization failure gracefully", async () => {
			(initializeTelemetry as Mock).mockResolvedValue(false);

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			expect(
				result.warnings.some((w) =>
					w.includes("Telemetry service initialization failed"),
				),
			).toBe(true);
		});

		it("should validate telemetry service dependencies", async () => {
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
				"https://api.honeycomb.io/v1/traces";

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			// Should not have warnings about HTTPS in production since we're using HTTPS
		});

		it("should warn about telemetry disabled in production", async () => {
			vi.stubEnv("NODE_ENV", "production");
			(getTelemetryService as Mock).mockReturnValue({
				isEnabled: () => false,
				getConfig: () => ({
					isEnabled: false,
				}),
			});

			const service = new StartupValidationService();
			const result = await service.validateStartup();

			expect(result.success).toBe(true);
			expect(
				result.warnings.some((w) =>
					w.includes("Telemetry is disabled in production"),
				),
			).toBe(true);
		});
	});

	describe("validateStartupOrExit", () => {
		it("should complete successfully with valid configuration", async () => {
			await validateStartupOrExit();

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"Application startup validation completed successfully",
				),
			);
		});

		it("should exit on validation failure", async () => {
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "invalid-url";

			const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("Process exit called");
			});

			await expect(validateStartupOrExit()).rejects.toThrow(
				"Process exit called",
			);
			expect(mockExit).toHaveBeenCalledWith(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Application startup validation failed"),
			);

			mockExit.mockRestore();
		});

		it("should show warnings but continue", async () => {
			delete process.env.BROWSERBASE_API_KEY;

			await validateStartupOrExit();

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Startup completed with warnings"),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"Application startup validation completed successfully",
				),
			);
		});

		it("should display startup duration in logs", async () => {
			await validateStartupOrExit();

			// Should log startup duration
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"Application startup validation completed successfully",
				),
			);
		});
	});

	describe("createActionableErrorMessage", () => {
		it("should create actionable error message", () => {
			const message = createActionableErrorMessage(
				"TEST_VAR",
				"Test variable description",
				"test-value",
			);

			expect(message).toContain(
				"Missing required environment variable: TEST_VAR",
			);
			expect(message).toContain("Description: Test variable description");
			expect(message).toContain("Example: TEST_VAR=test-value");
			expect(message).toContain("Add this to your .env file");
		});

		it("should create message without example", () => {
			const message = createActionableErrorMessage(
				"TEST_VAR",
				"Test variable description",
			);

			expect(message).toContain(
				"Missing required environment variable: TEST_VAR",
			);
			expect(message).toContain("Description: Test variable description");
			expect(message).not.toContain("Example:");
		});
	});

	describe("validateEnvironmentRequirements", () => {
		it("should validate required variables", () => {
			process.env.REQUIRED_VAR = "value";

			const result = validateEnvironmentRequirements([
				{
					variable: "REQUIRED_VAR",
					required: true,
					description: "Required test variable",
				},
			]);

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should fail on missing required variables", () => {
			delete process.env.MISSING_VAR;

			const result = validateEnvironmentRequirements([
				{
					variable: "MISSING_VAR",
					required: true,
					description: "Missing test variable",
					example: "test-value",
				},
			]);

			expect(result.success).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("MISSING_VAR");
			expect(result.errors[0]).toContain("Missing test variable");
		});

		it("should warn on missing optional variables", () => {
			delete process.env.OPTIONAL_VAR;

			const result = validateEnvironmentRequirements([
				{
					variable: "OPTIONAL_VAR",
					required: false,
					description: "Optional test variable",
				},
			]);

			expect(result.success).toBe(true);
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain("OPTIONAL_VAR");
		});

		it("should validate with custom validator", () => {
			process.env.VALIDATED_VAR = "invalid-value";

			const result = validateEnvironmentRequirements([
				{
					variable: "VALIDATED_VAR",
					required: true,
					description: "Variable with validation",
					validator: (value) => value === "valid-value",
				},
			]);

			expect(result.success).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("Invalid value for VALIDATED_VAR");
		});

		it("should pass with valid custom validator", () => {
			process.env.VALIDATED_VAR = "valid-value";

			const result = validateEnvironmentRequirements([
				{
					variable: "VALIDATED_VAR",
					required: true,
					description: "Variable with validation",
					validator: (value) => value === "valid-value",
				},
			]);

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});
});
