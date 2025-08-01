import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

// Mock dependencies following London School TDD principles
vi.mock("@/lib/config/service", () => ({
	getConfigurationService: vi.fn(() => ({
		getConfiguration: vi.fn(),
		getEnvironmentInfo: vi.fn(),
	})),
}));

vi.mock("@/lib/logging/factory", () => ({
	createApiLogger: vi.fn(() => ({
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	})),
}));

vi.mock("next/server", () => ({
	NextResponse: {
		json: vi.fn(),
	},
}));

import { GET } from "./route";

/**
 * London School TDD Test Suite for Version Endpoint
 * 
 * Following London School (mockist) approach:
 * - Outside-in development from behavior down to implementation
 * - Mock all collaborators to test interactions
 * - Focus on behavior verification over state testing
 * - Test how objects collaborate, not what they contain
 */
describe("GET /api/version - London School TDD", () => {
	// Test fixture data following contract definitions
	const mockConfig = {
		appVersion: "unknown",
		serviceName: "solomon-codes",
		nodeEnv: "test",
	};

	const mockEnvironmentInfo = {
		environment: "test",
		profile: "development",
		description: "Test environment for unit testing",
		features: {
			enableDebugTools: true,
			enableMockData: true,
			enableDetailedLogging: true,
		},
		version: "unknown",
		serviceName: "solomon-codes",
	};

	beforeEach(() => {
		// Reset all mocks before each test to ensure test isolation
		vi.clearAllMocks();

		// Mock system functions
		vi.spyOn(process, "uptime").mockReturnValue(12345);
		vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T12:00:00.000Z");

		// Setup default successful behaviors for happy path
		const { getConfigurationService } = vi.mocked(require("@/lib/config/service"));
		const mockConfigService = getConfigurationService();
		mockConfigService.getConfiguration.mockReturnValue(mockConfig);
		mockConfigService.getEnvironmentInfo.mockReturnValue(mockEnvironmentInfo);

		const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
		const mockLogger = createApiLogger();
		// Logger methods are already mocked by the vi.mock setup

		const { NextResponse } = vi.mocked(require("next/server"));
		NextResponse.json.mockReturnValue({ status: 200 });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Successful version retrieval workflow", () => {
		it("should orchestrate version information collection through proper collaboration sequence", async () => {
			// Act - Execute the endpoint behavior
			await GET();

			// Assert - Verify the conversation sequence between collaborators
			// London School focuses on HOW objects collaborate
			
			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const { getConfigurationService } = vi.mocked(require("@/lib/config/service"));
			
			// 1. Should create logger with correct route context
			expect(createApiLogger).toHaveBeenCalledWith("version");
			expect(createApiLogger).toHaveBeenCalledTimes(1);

			// 2. Should retrieve configuration service
			expect(getConfigurationService).toHaveBeenCalledTimes(1);

			const mockConfigService = getConfigurationService();
			const mockLogger = createApiLogger();

			// 3. Should log the incoming request
			expect(mockLogger.info).toHaveBeenCalledWith("Version information requested");

			// 4. Should fetch configuration data through proper sequence
			expect(mockConfigService.getConfiguration).toHaveBeenCalledTimes(1);
			expect(mockConfigService.getEnvironmentInfo).toHaveBeenCalledTimes(1);

			// 5. Should log successful retrieval with context
			expect(mockLogger.info).toHaveBeenCalledWith("Version information retrieved", {
				version: mockConfig.appVersion,
				environment: mockEnvironmentInfo.environment,
			});

			// 6. Verify total logger interactions (2 info calls)
			expect(mockLogger.info).toHaveBeenCalledTimes(2);
		});

		it("should construct version response with all required fields from collaborator data", async () => {
			// Act
			await GET();

			// Assert - Verify the data contract and response construction
			const { NextResponse } = vi.mocked(require("next/server"));
			
			expect(NextResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					// Core version data from configuration service
					version: mockConfig.appVersion,
					serviceName: mockConfig.serviceName,
					environment: mockEnvironmentInfo.environment,
					profile: mockEnvironmentInfo.profile,
					description: mockEnvironmentInfo.description,
					features: mockEnvironmentInfo.features,
					
					// System runtime information
					uptime: 12345,
					nodeVersion: process.version,
					platform: process.platform,
					
					// Timestamps
					buildTimestamp: "2024-01-01T12:00:00.000Z",
					timestamp: "2024-01-01T12:00:00.000Z",
				}),
				{
					status: 200,
					headers: {
						"Cache-Control": "public, max-age=300",
					},
				}
			);
		});

		it("should apply proper caching headers for performance optimization", async () => {
			// Act
			await GET();

			// Assert - Verify caching behavior
			const { NextResponse } = vi.mocked(require("next/server"));
			
			expect(NextResponse.json).toHaveBeenCalledWith(
				expect.any(Object),
				expect.objectContaining({
					status: 200,
					headers: expect.objectContaining({
						"Cache-Control": "public, max-age=300",
					}),
				})
			);
		});
	});

	describe("Configuration service error handling workflow", () => {
		it("should handle configuration retrieval errors with proper error logging and response", async () => {
			// Arrange - Setup error scenario in collaborator
			const configError = new Error("Configuration service unavailable");
			const { getConfigurationService } = vi.mocked(require("@/lib/config/service"));
			const mockConfigService = getConfigurationService();
			mockConfigService.getConfiguration.mockImplementation(() => {
				throw configError;
			});

			// Act
			await GET();

			// Assert - Verify error handling collaboration
			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const { NextResponse } = vi.mocked(require("next/server"));
			const mockLogger = createApiLogger();

			// 1. Should still create logger and log initial request
			expect(createApiLogger).toHaveBeenCalledWith("version");
			expect(mockLogger.info).toHaveBeenCalledWith("Version information requested");

			// 2. Should attempt to get configuration service
			expect(getConfigurationService).toHaveBeenCalledTimes(1);
			expect(mockConfigService.getConfiguration).toHaveBeenCalledTimes(1);

			// 3. Should log the error with proper context
			expect(mockLogger.error).toHaveBeenCalledWith("Version endpoint error", {
				error: configError.message,
				stack: configError.stack,
			});

			// 4. Should return error response with proper format
			expect(NextResponse.json).toHaveBeenCalledWith(
				{
					error: "Failed to retrieve version information",
					details: {
						error: configError.message,
					},
					timestamp: "2024-01-01T12:00:00.000Z",
				},
				{ status: 500 }
			);

			// 5. Verify no success logging occurred
			expect(mockLogger.info).toHaveBeenCalledTimes(1); // Only initial request log
		});

		it("should handle environment info retrieval errors with proper error workflow", async () => {
			// Arrange - Setup error in environment info retrieval
			const envError = new Error("Environment info not available");
			const { getConfigurationService } = vi.mocked(require("@/lib/config/service"));
			const mockConfigService = getConfigurationService();
			mockConfigService.getEnvironmentInfo.mockImplementation(() => {
				throw envError;
			});

			// Act
			await GET();

			// Assert - Verify error handling sequence
			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const { NextResponse } = vi.mocked(require("next/server"));
			const mockLogger = createApiLogger();

			expect(mockConfigService.getConfiguration).toHaveBeenCalledTimes(1);
			expect(mockConfigService.getEnvironmentInfo).toHaveBeenCalledTimes(1);
			
			expect(mockLogger.error).toHaveBeenCalledWith("Version endpoint error", {
				error: envError.message,
				stack: envError.stack,
			});

			expect(NextResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					error: "Failed to retrieve version information",
					details: {
						error: envError.message,
					},
				}),
				{ status: 500 }
			);
		});

		it("should handle non-Error exceptions with proper string conversion", async () => {
			// Arrange - Setup non-Error exception scenario
			const stringError = "Configuration timeout";
			const { getConfigurationService } = vi.mocked(require("@/lib/config/service"));
			const mockConfigService = getConfigurationService();
			mockConfigService.getConfiguration.mockImplementation(() => {
				throw stringError;
			});

			// Act
			await GET();

			// Assert - Verify proper handling of non-Error exceptions
			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const { NextResponse } = vi.mocked(require("next/server"));
			const mockLogger = createApiLogger();

			expect(mockLogger.error).toHaveBeenCalledWith("Version endpoint error", {
				error: stringError,
				stack: undefined, // No stack for non-Error types
			});

			expect(NextResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					error: "Failed to retrieve version information",
					details: {
						error: stringError,
					},
				}),
				{ status: 500 }
			);
		});
	});

	describe("Logger collaboration patterns", () => {
		it("should create logger with correct context and use it throughout the request lifecycle", async () => {
			// Act
			await GET();

			// Assert - Verify logger collaboration contract
			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const mockLogger = createApiLogger();

			// 1. Logger creation with proper context
			expect(createApiLogger).toHaveBeenCalledWith("version");

			// 2. Logger usage pattern verification
			expect(mockLogger.info).toHaveBeenNthCalledWith(1, "Version information requested");
			expect(mockLogger.info).toHaveBeenNthCalledWith(2, "Version information retrieved", {
				version: mockConfig.appVersion,
				environment: mockEnvironmentInfo.environment,
			});

			// 3. No error logging in success case
			expect(mockLogger.error).not.toHaveBeenCalled();
			expect(mockLogger.warn).not.toHaveBeenCalled();
		});

		it("should provide structured logging context for monitoring and debugging", async () => {
			// Act
			await GET();

			// Assert - Verify structured logging contract
			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const mockLogger = createApiLogger();
			
			const secondInfoCall = mockLogger.info.mock.calls[1];
			expect(secondInfoCall[0]).toBe("Version information retrieved");
			expect(secondInfoCall[1]).toEqual({
				version: mockConfig.appVersion,
				environment: mockEnvironmentInfo.environment,
			});
		});
	});

	describe("Mock interaction verification - London School contract testing", () => {
		it("should verify all collaborator interactions are called exactly once in success scenario", async () => {
			// Act
			await GET();

			// Assert - Comprehensive interaction verification
			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const { getConfigurationService } = vi.mocked(require("@/lib/config/service"));
			const { NextResponse } = vi.mocked(require("next/server"));
			
			const mockConfigService = getConfigurationService();
			const mockLogger = createApiLogger();

			expect(createApiLogger).toHaveBeenCalledTimes(1);
			expect(getConfigurationService).toHaveBeenCalledTimes(1);
			expect(mockConfigService.getConfiguration).toHaveBeenCalledTimes(1);
			expect(mockConfigService.getEnvironmentInfo).toHaveBeenCalledTimes(1);
			expect(mockLogger.info).toHaveBeenCalledTimes(2);
			expect(mockLogger.error).toHaveBeenCalledTimes(0);
			expect(NextResponse.json).toHaveBeenCalledTimes(1);
		});

		it("should verify no unnecessary collaborator calls are made", async () => {
			// Act
			await GET();

			// Assert - Verify minimal necessary interactions
			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const { getConfigurationService } = vi.mocked(require("@/lib/config/service"));
			
			const mockConfigService = getConfigurationService();
			const mockLogger = createApiLogger();

			expect(mockLogger.warn).not.toHaveBeenCalled();
			expect(mockLogger.debug).not.toHaveBeenCalled();
			
			// Verify configuration service is called with no parameters
			expect(mockConfigService.getConfiguration).toHaveBeenCalledWith();
			expect(mockConfigService.getEnvironmentInfo).toHaveBeenCalledWith();
		});
	});

	describe("Response format contract verification", () => {
		it("should always include timestamp in both success and error responses", async () => {
			// Test success case
			await GET();
			
			const { NextResponse } = vi.mocked(require("next/server"));
			expect(NextResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					timestamp: "2024-01-01T12:00:00.000Z",
				}),
				expect.any(Object)
			);

			// Reset and test error case
			vi.clearAllMocks();
			const { getConfigurationService } = vi.mocked(require("@/lib/config/service"));
			const mockConfigService = getConfigurationService();
			mockConfigService.getConfiguration.mockImplementation(() => {
				throw new Error("Test error");
			});

			await GET();
			expect(NextResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					timestamp: "2024-01-01T12:00:00.000Z",
				}),
				expect.any(Object)
			);
		});

		it("should maintain consistent response structure contract", async () => {
			// Act
			await GET();

			// Assert - Verify response contract compliance
			const { NextResponse } = vi.mocked(require("next/server"));
			const responseCall = NextResponse.json.mock.calls[0];
			const responseData = responseCall[0];
			const responseOptions = responseCall[1];

			// Verify required fields presence
			expect(responseData).toHaveProperty("version");
			expect(responseData).toHaveProperty("serviceName");
			expect(responseData).toHaveProperty("environment");
			expect(responseData).toHaveProperty("profile");
			expect(responseData).toHaveProperty("description");
			expect(responseData).toHaveProperty("features");
			expect(responseData).toHaveProperty("uptime");
			expect(responseData).toHaveProperty("nodeVersion");
			expect(responseData).toHaveProperty("platform");
			expect(responseData).toHaveProperty("buildTimestamp");
			expect(responseData).toHaveProperty("timestamp");

			// Verify response options
			expect(responseOptions).toHaveProperty("status", 200);
			expect(responseOptions).toHaveProperty("headers");
		});
	});

	describe("Edge cases and boundary conditions", () => {
		it("should handle undefined configuration values gracefully", async () => {
			// Arrange - Setup edge case data
			const edgeCaseConfig = {
				appVersion: undefined,
				serviceName: null,
				nodeEnv: "",
			};
			const edgeCaseEnvInfo = {
				environment: undefined,
				profile: null,
				description: "",
				features: null,
			};

			const { getConfigurationService } = vi.mocked(require("@/lib/config/service"));
			const mockConfigService = getConfigurationService();
			mockConfigService.getConfiguration.mockReturnValue(edgeCaseConfig as any);
			mockConfigService.getEnvironmentInfo.mockReturnValue(edgeCaseEnvInfo as any);

			// Act
			await GET();

			// Assert - Verify graceful handling
			const { NextResponse } = vi.mocked(require("next/server"));
			expect(NextResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					version: undefined,
					serviceName: null,
					environment: undefined,
					profile: null,
					description: "",
					features: null,
				}),
				expect.any(Object)
			);

			// Verify logging still works with edge case data
			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const mockLogger = createApiLogger();
			expect(mockLogger.info).toHaveBeenCalledWith("Version information retrieved", {
				version: undefined,
				environment: undefined,
			});
		});

		it("should handle system function failures gracefully", async () => {
			// Arrange - Mock system function failure
			vi.spyOn(process, "uptime").mockImplementation(() => {
				throw new Error("System uptime not available");
			});

			// Act & Assert - Should propagate error through normal error handling
			await GET();

			const { createApiLogger } = vi.mocked(require("@/lib/logging/factory"));
			const mockLogger = createApiLogger();
			expect(mockLogger.error).toHaveBeenCalledWith("Version endpoint error", 
				expect.objectContaining({
					error: "System uptime not available",
				})
			);
		});
	});
});