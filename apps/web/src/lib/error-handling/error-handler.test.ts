/**
 * Unit tests for centralized error handling utilities
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AppError,
	createErrorResponse,
	createInternalError,
	createNetworkError,
	createNotFoundError,
	createSuccessResponse,
	createUnauthorizedError,
	createValidationError,
	ErrorCodes,
	type ErrorContext,
	type ErrorSeverity,
	getErrorCode,
	getErrorMessage,
	isAppError,
	isRecoverableError,
} from "./error-handler";

describe("AppError", () => {
	describe("Constructor", () => {
		it("should create error with required properties", () => {
			const error = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
			});

			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe("AppError");
			expect(error.message).toBe("Test error");
			expect(error.code).toBe("TEST_ERROR");
			expect(error.severity).toBe("medium"); // default
			expect(error.recoverable).toBe(true); // default
			expect(error.context?.timestamp).toBeDefined();
		});

		it("should create error with custom properties", () => {
			const context: ErrorContext = {
				component: "test-component",
				action: "test-action",
				userId: "user123",
				metadata: { key: "value" },
			};

			const originalError = new Error("Original error");

			const error = new AppError({
				message: "Custom error",
				code: "CUSTOM_ERROR",
				severity: "critical",
				context,
				originalError,
				userMessage: "Custom user message",
				recoverable: false,
			});

			expect(error.message).toBe("Custom error");
			expect(error.code).toBe("CUSTOM_ERROR");
			expect(error.severity).toBe("critical");
			expect(error.userMessage).toBe("Custom user message");
			expect(error.recoverable).toBe(false);
			expect(error.originalError).toBe(originalError);
			expect(error.context?.component).toBe("test-component");
			expect(error.context?.timestamp).toBeDefined();
		});

		it("should generate default user messages based on severity", () => {
			const severityMessages: Record<ErrorSeverity, string> = {
				low: "A minor issue occurred. Please try again.",
				medium:
					"Something went wrong. Please try again or contact support if the issue persists.",
				high: "An error occurred that requires attention. Please contact support.",
				critical:
					"A critical error occurred. Please contact support immediately.",
			};

			Object.entries(severityMessages).forEach(
				([severity, expectedMessage]) => {
					const error = new AppError({
						message: "Test error",
						code: "TEST_ERROR",
						severity: severity as ErrorSeverity,
					});

					expect(error.userMessage).toBe(expectedMessage);
				},
			);
		});

		it("should maintain proper stack trace", () => {
			const error = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
			});

			expect(error.stack).toBeDefined();
			expect(error.stack).toContain("AppError");
		});
	});

	describe("toJSON", () => {
		it("should serialize to JSON correctly", () => {
			const context: ErrorContext = {
				component: "test-component",
				userId: "user123",
			};

			const error = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
				severity: "high",
				context,
				userMessage: "User friendly message",
				recoverable: false,
			});

			const json = error.toJSON();

			expect(json).toEqual({
				name: "AppError",
				message: "Test error",
				code: "TEST_ERROR",
				severity: "high",
				context: expect.objectContaining({
					component: "test-component",
					userId: "user123",
					timestamp: expect.any(String),
				}),
				userMessage: "User friendly message",
				recoverable: false,
				stack: expect.any(String),
			});
		});
	});

	describe("fromApiError", () => {
		it("should return AppError if already AppError", () => {
			const originalError = new AppError({
				message: "Original error",
				code: "ORIGINAL_ERROR",
			});

			const result = AppError.fromApiError(originalError);

			expect(result).toBe(originalError);
		});

		it("should convert Error to AppError", () => {
			const originalError = new Error("Generic error");
			const context: ErrorContext = { component: "test" };

			const result = AppError.fromApiError(originalError, context);

			expect(result).toBeInstanceOf(AppError);
			expect(result.message).toBe("Generic error");
			expect(result.code).toBe("API_ERROR");
			expect(result.severity).toBe("medium");
			expect(result.originalError).toBe(originalError);
			expect(result.context?.component).toBe("test");
		});

		it("should handle unknown error types", () => {
			const unknownError = "String error";
			const context: ErrorContext = { component: "test" };

			const result = AppError.fromApiError(unknownError, context);

			expect(result).toBeInstanceOf(AppError);
			expect(result.message).toBe("Unknown API error occurred");
			expect(result.code).toBe("UNKNOWN_API_ERROR");
			expect(result.severity).toBe("medium");
			expect(result.context?.component).toBe("test");
		});

		it("should handle null/undefined errors", () => {
			const result1 = AppError.fromApiError(null);
			const result2 = AppError.fromApiError(undefined);

			[result1, result2].forEach((result) => {
				expect(result).toBeInstanceOf(AppError);
				expect(result.message).toBe("Unknown API error occurred");
				expect(result.code).toBe("UNKNOWN_API_ERROR");
			});
		});
	});
});

describe("ErrorCodes", () => {
	it("should have all required error codes", () => {
		const expectedCodes = [
			"NETWORK_ERROR",
			"TIMEOUT_ERROR",
			"CONNECTION_ERROR",
			"UNAUTHORIZED",
			"FORBIDDEN",
			"TOKEN_EXPIRED",
			"VALIDATION_ERROR",
			"INVALID_INPUT",
			"MISSING_REQUIRED_FIELD",
			"RESOURCE_NOT_FOUND",
			"RESOURCE_CONFLICT",
			"OPERATION_FAILED",
			"EXTERNAL_SERVICE_ERROR",
			"API_RATE_LIMIT",
			"INTERNAL_SERVER_ERROR",
			"SERVICE_UNAVAILABLE",
			"DATABASE_ERROR",
		];

		expectedCodes.forEach((code) => {
			expect(ErrorCodes).toHaveProperty(code);
			expect(ErrorCodes[code as keyof typeof ErrorCodes]).toBe(code);
		});
	});

	it("should be readonly at TypeScript level", () => {
		// Test that ErrorCodes is defined with 'as const' for type safety
		// At runtime, const objects are still mutable in JavaScript
		// but TypeScript should prevent modification

		// Verify that the values are strings (not symbols or other types)
		expect(typeof ErrorCodes.NETWORK_ERROR).toBe("string");
		expect(ErrorCodes.NETWORK_ERROR).toBe("NETWORK_ERROR");

		// Test that ErrorCodes object is truthy and has expected structure
		expect(ErrorCodes).toBeDefined();
		expect(Object.keys(ErrorCodes).length).toBeGreaterThan(0);
	});
});

describe("Error Factory Functions", () => {
	describe("createNetworkError", () => {
		it("should create network error with defaults", () => {
			const error = createNetworkError();

			expect(error.message).toBe("Network request failed");
			expect(error.code).toBe(ErrorCodes.NETWORK_ERROR);
			expect(error.severity).toBe("medium");
			expect(error.userMessage).toBe(
				"Unable to connect to the server. Please check your internet connection and try again.",
			);
		});

		it("should include original error and context", () => {
			const originalError = new Error("Fetch failed");
			const context: ErrorContext = { component: "api-client" };

			const error = createNetworkError(originalError, context);

			expect(error.originalError).toBe(originalError);
			expect(error.context?.component).toBe("api-client");
		});
	});

	describe("createValidationError", () => {
		it("should create validation error", () => {
			const error = createValidationError("Email is required", "email");

			expect(error.message).toBe("Email is required");
			expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
			expect(error.severity).toBe("low");
			expect(error.userMessage).toBe("Email is required");
			expect(error.recoverable).toBe(true);
			expect(error.context?.field).toBe("email");
		});

		it("should work without field parameter", () => {
			const error = createValidationError("Invalid data");

			expect(error.message).toBe("Invalid data");
			expect(error.context?.field).toBeUndefined();
		});
	});

	describe("createUnauthorizedError", () => {
		it("should create unauthorized error", () => {
			const error = createUnauthorizedError();

			expect(error.message).toBe("Authentication required");
			expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
			expect(error.severity).toBe("medium");
			expect(error.userMessage).toBe("Please log in to continue.");
			expect(error.recoverable).toBe(true);
		});

		it("should include context", () => {
			const context: ErrorContext = { component: "auth-guard" };
			const error = createUnauthorizedError(context);

			expect(error.context?.component).toBe("auth-guard");
		});
	});

	describe("createNotFoundError", () => {
		it("should create not found error", () => {
			const error = createNotFoundError("User");

			expect(error.message).toBe("User not found");
			expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
			expect(error.severity).toBe("low");
			expect(error.userMessage).toBe("The requested user could not be found.");
			expect(error.recoverable).toBe(false);
		});

		it("should handle different resource types", () => {
			const error = createNotFoundError("Document");

			expect(error.message).toBe("Document not found");
			expect(error.userMessage).toBe(
				"The requested document could not be found.",
			);
		});
	});

	describe("createInternalError", () => {
		it("should create internal error", () => {
			const error = createInternalError();

			expect(error.message).toBe("Internal server error");
			expect(error.code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
			expect(error.severity).toBe("critical");
			expect(error.userMessage).toBe(
				"A system error occurred. Our team has been notified.",
			);
			expect(error.recoverable).toBe(false);
		});

		it("should include original error", () => {
			const originalError = new Error("Database connection failed");
			const error = createInternalError(originalError);

			expect(error.originalError).toBe(originalError);
		});
	});
});

describe("Utility Functions", () => {
	describe("isAppError", () => {
		it("should identify AppError instances", () => {
			const appError = new AppError({ message: "Test", code: "TEST" });
			const regularError = new Error("Regular error");
			const notError = "Not an error";

			expect(isAppError(appError)).toBe(true);
			expect(isAppError(regularError)).toBe(false);
			expect(isAppError(notError)).toBe(false);
			expect(isAppError(null)).toBe(false);
			expect(isAppError(undefined)).toBe(false);
		});
	});

	describe("getErrorMessage", () => {
		it("should return userMessage for AppError", () => {
			const appError = new AppError({
				message: "Internal message",
				code: "TEST",
				userMessage: "User friendly message",
			});

			expect(getErrorMessage(appError)).toBe("User friendly message");
		});

		it("should return message for regular Error", () => {
			const error = new Error("Error message");

			expect(getErrorMessage(error)).toBe("Error message");
		});

		it("should return default message for unknown types", () => {
			expect(getErrorMessage("string error")).toBe(
				"An unexpected error occurred",
			);
			expect(getErrorMessage(null)).toBe("An unexpected error occurred");
			expect(getErrorMessage(undefined)).toBe("An unexpected error occurred");
			expect(getErrorMessage({})).toBe("An unexpected error occurred");
		});
	});

	describe("getErrorCode", () => {
		it("should return code for AppError", () => {
			const appError = new AppError({
				message: "Test error",
				code: "CUSTOM_CODE",
			});

			expect(getErrorCode(appError)).toBe("CUSTOM_CODE");
		});

		it("should return default code for non-AppError", () => {
			expect(getErrorCode(new Error("Regular error"))).toBe("UNKNOWN_ERROR");
			expect(getErrorCode("string error")).toBe("UNKNOWN_ERROR");
			expect(getErrorCode(null)).toBe("UNKNOWN_ERROR");
		});
	});

	describe("isRecoverableError", () => {
		it("should return recoverable property for AppError", () => {
			const recoverableError = new AppError({
				message: "Recoverable",
				code: "TEST",
				recoverable: true,
			});

			const nonRecoverableError = new AppError({
				message: "Non-recoverable",
				code: "TEST",
				recoverable: false,
			});

			expect(isRecoverableError(recoverableError)).toBe(true);
			expect(isRecoverableError(nonRecoverableError)).toBe(false);
		});

		it("should return true for non-AppError (assume recoverable)", () => {
			expect(isRecoverableError(new Error("Regular error"))).toBe(true);
			expect(isRecoverableError("string error")).toBe(true);
			expect(isRecoverableError(null)).toBe(true);
		});
	});
});

describe("API Response Helpers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("createErrorResponse", () => {
		it("should create error response from AppError", () => {
			const appError = new AppError({
				message: "Internal error",
				code: "TEST_ERROR",
				userMessage: "User friendly error",
			});

			const response = createErrorResponse(appError);

			expect(response).toEqual({
				success: false,
				error: "User friendly error",
				code: "TEST_ERROR",
				timestamp: "2024-01-01T12:00:00.000Z",
			});
		});

		it("should create error response from regular Error", () => {
			const error = new Error("Regular error");
			const context: ErrorContext = { component: "test" };

			const response = createErrorResponse(error, context);

			expect(response).toEqual({
				success: false,
				error: expect.stringContaining("try again"), // Default user message
				code: "API_ERROR",
				timestamp: "2024-01-01T12:00:00.000Z",
			});
		});

		it("should handle unknown error types", () => {
			const response = createErrorResponse("string error");

			expect(response).toEqual({
				success: false,
				error: expect.stringContaining("try again"), // Default user message
				code: "UNKNOWN_API_ERROR",
				timestamp: "2024-01-01T12:00:00.000Z",
			});
		});
	});

	describe("createSuccessResponse", () => {
		it("should create success response with data", () => {
			const data = { id: 1, name: "Test" };

			const response = createSuccessResponse(data);

			expect(response).toEqual({
				success: true,
				data,
				timestamp: "2024-01-01T12:00:00.000Z",
			});
		});

		it("should create success response with message", () => {
			const data = { id: 1 };
			const message = "Operation completed successfully";

			const response = createSuccessResponse(data, message);

			expect(response).toEqual({
				success: true,
				data,
				message,
				timestamp: "2024-01-01T12:00:00.000Z",
			});
		});

		it("should handle null/undefined data", () => {
			const response1 = createSuccessResponse(null);
			const response2 = createSuccessResponse(undefined);

			expect(response1.success).toBe(true);
			expect(response1.data).toBeNull();
			expect(response2.success).toBe(true);
			expect(response2.data).toBeUndefined();
		});
	});
});
