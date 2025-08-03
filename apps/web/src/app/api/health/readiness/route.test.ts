import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/config/startup");
vi.mock("@/lib/database/connection");
vi.mock("@/lib/logging/factory");

import { getStartupValidationService } from "@/lib/config/startup";
import { checkDatabaseHealth } from "@/lib/database/connection";
import { createApiLogger } from "@/lib/logging/factory";

describe("/api/health/readiness", () => {
	const mockLogger = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	};

	const mockStartupService = {
		getValidationSummary: vi.fn(),
		getStartupMetrics: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default mocks
		(createApiLogger as Mock).mockReturnValue(mockLogger);
		(getStartupValidationService as Mock).mockReturnValue(mockStartupService);

		// Default validation summary - all healthy
		mockStartupService.getValidationSummary.mockReturnValue({
			environment: "test",
			configurationValid: true,
			databaseConnectivityValid: true,
			apiConnectivityValid: true,
			dependenciesValid: true,
			telemetryValid: true,
		});

		// Default startup metrics - all steps successful
		mockStartupService.getStartupMetrics.mockReturnValue({
			startTime: Date.now() - 1000,
			endTime: Date.now(),
			duration: 150,
			validationSteps: [
				{
					name: "environment",
					startTime: 0,
					endTime: 25,
					duration: 25,
					success: true,
				},
				{
					name: "configuration",
					startTime: 25,
					endTime: 40,
					duration: 15,
					success: true,
				},
				{
					name: "database",
					startTime: 40,
					endTime: 90,
					duration: 50,
					success: true,
				},
				{
					name: "api-connectivity",
					startTime: 90,
					endTime: 120,
					duration: 30,
					success: true,
				},
				{
					name: "service-dependencies",
					startTime: 120,
					endTime: 140,
					duration: 20,
					success: true,
				},
				{
					name: "telemetry",
					startTime: 140,
					endTime: 150,
					duration: 10,
					success: true,
				},
			],
		});

		// Default database health
		(checkDatabaseHealth as Mock).mockResolvedValue({
			isHealthy: true,
			responseTime: 45,
			errors: [],
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("GET", () => {
		it("should return ready when all critical checks pass", async () => {
			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toMatchObject({
				ready: true,
				timestamp: expect.any(String),
				checks: {
					startup: true,
					database: true,
					configuration: true,
				},
				message: "Application is ready",
				details: {
					errors: [],
					warnings: [],
				},
			});
		});

		it("should return not ready when configuration is invalid", async () => {
			mockStartupService.getValidationSummary.mockReturnValue({
				...mockStartupService.getValidationSummary(),
				configurationValid: false,
			});

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(503);
			expect(data.ready).toBe(false);
			expect(data.checks.configuration).toBe(false);
			expect(data.message).toBe("Application is not ready to accept traffic");
			expect(data.details.errors).toContain("Configuration validation failed");
		});

		it("should return not ready when database is unhealthy", async () => {
			(checkDatabaseHealth as Mock).mockResolvedValue({
				isHealthy: false,
				responseTime: 500,
				errors: ["Connection timeout", "Query failed"],
			});

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(503);
			expect(data.ready).toBe(false);
			expect(data.checks.database).toBe(false);
			expect(data.message).toBe("Application is not ready to accept traffic");
			expect(data.details.errors).toContain(
				"Database not ready: Connection timeout, Query failed",
			);
		});

		it("should return not ready when database check fails", async () => {
			(checkDatabaseHealth as Mock).mockRejectedValue(
				new Error("Database connection failed"),
			);

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(503);
			expect(data.ready).toBe(false);
			expect(data.checks.database).toBe(false);
			expect(data.details.errors).toContain(
				"Database readiness check failed: Database connection failed",
			);
		});

		it("should return not ready when critical startup steps fail", async () => {
			mockStartupService.getValidationSummary.mockReturnValue({
				...mockStartupService.getValidationSummary(),
				configurationValid: false,
			});

			mockStartupService.getStartupMetrics.mockReturnValue({
				...mockStartupService.getStartupMetrics(),
				validationSteps: [
					{
						name: "environment",
						startTime: 0,
						endTime: 25,
						duration: 25,
						success: true,
					},
					{
						name: "configuration",
						startTime: 25,
						endTime: 40,
						duration: 15,
						success: false,
					},
					{
						name: "database",
						startTime: 40,
						endTime: 90,
						duration: 50,
						success: true,
					},
				],
			});

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(503);
			expect(data.ready).toBe(false);
			expect(data.checks.startup).toBe(false);
			expect(data.details.errors).toContain(
				"Critical startup steps failed: configuration",
			);
		});

		it("should be ready with warnings when non-critical steps fail", async () => {
			mockStartupService.getStartupMetrics.mockReturnValue({
				...mockStartupService.getStartupMetrics(),
				validationSteps: [
					{
						name: "environment",
						startTime: 0,
						endTime: 25,
						duration: 25,
						success: true,
					},
					{
						name: "configuration",
						startTime: 25,
						endTime: 40,
						duration: 15,
						success: true,
					},
					{
						name: "database",
						startTime: 40,
						endTime: 90,
						duration: 50,
						success: true,
					},
					{
						name: "telemetry",
						startTime: 90,
						endTime: 100,
						duration: 10,
						success: false,
					},
					{
						name: "api-connectivity",
						startTime: 100,
						endTime: 120,
						duration: 20,
						success: false,
					},
				],
			});

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.ready).toBe(true);
			expect(data.message).toBe("Application is ready but with warnings");
			expect(data.details.warnings).toContain(
				"Non-critical startup steps failed: telemetry, api-connectivity",
			);
		});

		it("should identify critical vs non-critical validation steps correctly", async () => {
			// Environment and configuration are critical
			// Telemetry and api-connectivity are non-critical
			mockStartupService.getStartupMetrics.mockReturnValue({
				...mockStartupService.getStartupMetrics(),
				validationSteps: [
					{
						name: "environment",
						startTime: 0,
						endTime: 25,
						duration: 25,
						success: false,
					},
					{
						name: "configuration",
						startTime: 25,
						endTime: 40,
						duration: 15,
						success: true,
					},
					{
						name: "telemetry",
						startTime: 40,
						endTime: 50,
						duration: 10,
						success: false,
					},
				],
			});

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(503);
			expect(data.ready).toBe(false);
			expect(data.details.errors).toContain(
				"Critical startup steps failed: environment",
			);
			expect(data.details.warnings).toContain(
				"Non-critical startup steps failed: telemetry",
			);
		});

		it("should handle readiness probe errors gracefully", async () => {
			(getStartupValidationService as Mock).mockImplementation(() => {
				throw new Error("Startup service unavailable");
			});

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(503);
			expect(data.ready).toBe(false);
			expect(data.message).toBe("Readiness probe error");
			expect(data.checks.startup).toBe(false);
			expect(data.checks.database).toBe(false);
			expect(data.checks.configuration).toBe(false);
			expect(data.details.errors).toContain("Startup service unavailable");
		});

		it("should log readiness probe activity", async () => {
			await GET();

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Readiness probe requested",
			);
			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Readiness probe completed",
				expect.objectContaining({
					ready: true,
					errors: 0,
					warnings: 0,
				}),
			);
		});

		it("should log readiness probe failures", async () => {
			mockStartupService.getValidationSummary.mockReturnValue({
				...mockStartupService.getValidationSummary(),
				configurationValid: false,
			});

			await GET();

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Readiness probe completed",
				expect.objectContaining({
					ready: false,
					errors: expect.any(Number),
				}),
			);
		});

		it("should handle endpoint errors and log them", async () => {
			(getStartupValidationService as Mock).mockImplementation(() => {
				throw new Error("Critical service failure");
			});

			await GET();

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Readiness probe error",
				expect.objectContaining({
					error: "Critical service failure",
					stack: expect.any(String),
				}),
			);
		});

		it("should return proper timestamp format", async () => {
			const beforeTime = new Date().toISOString();
			const response = await GET();
			const afterTime = new Date().toISOString();
			const data = await response.json();

			expect(data.timestamp).toMatch(
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
			);
			expect(new Date(data.timestamp).getTime()).toBeGreaterThanOrEqual(
				new Date(beforeTime).getTime(),
			);
			expect(new Date(data.timestamp).getTime()).toBeLessThanOrEqual(
				new Date(afterTime).getTime(),
			);
		});

		it("should maintain consistent check structure", async () => {
			const response = await GET();
			const data = await response.json();

			expect(data.checks).toHaveProperty("startup");
			expect(data.checks).toHaveProperty("database");
			expect(data.checks).toHaveProperty("configuration");

			expect(typeof data.checks.startup).toBe("boolean");
			expect(typeof data.checks.database).toBe("boolean");
			expect(typeof data.checks.configuration).toBe("boolean");
		});

		it("should prioritize errors over warnings in message", async () => {
			// Setup scenario with both errors and warnings
			mockStartupService.getValidationSummary.mockReturnValue({
				...mockStartupService.getValidationSummary(),
				configurationValid: false, // This will cause an error
			});

			mockStartupService.getStartupMetrics.mockReturnValue({
				...mockStartupService.getStartupMetrics(),
				validationSteps: [
					{
						name: "environment",
						startTime: 0,
						endTime: 25,
						duration: 25,
						success: true,
					},
					{
						name: "configuration",
						startTime: 25,
						endTime: 40,
						duration: 15,
						success: false,
					},
					{
						name: "telemetry",
						startTime: 40,
						endTime: 50,
						duration: 10,
						success: false,
					}, // This will cause a warning
				],
			});

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(503);
			expect(data.ready).toBe(false);
			expect(data.message).toBe("Application is not ready to accept traffic");
			expect(data.details.errors.length).toBeGreaterThan(0);
			expect(data.details.warnings.length).toBeGreaterThan(0);
		});
	});
});
