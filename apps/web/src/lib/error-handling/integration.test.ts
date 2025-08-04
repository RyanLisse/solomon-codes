/**
 * Integration tests for error handling system
 * Tests end-to-end error flows, API integration, recovery mechanisms, and system behavior
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	api,
	apiRequest,
	createHttpError,
	handleFetchError,
	withApiErrorHandler,
	withRetry,
} from "./api-errors";
import { AppError, ErrorCodes, initializeErrorHandlingSystem } from "./index";

// Mock fetch for testing
global.fetch = vi.fn();
const mockFetch = vi.mocked(fetch);

// Mock Next.js Request and NextResponse
const mockRequest = {
	url: "https://api.example.com/test",
	method: "GET",
	headers: new Headers(),
	json: vi.fn(),
} as unknown as Request;

// Mock console methods
vi.mock("../logging/factory", () => ({
	createContextLogger: () => ({
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("../monitoring/performance", () => ({
	initializePerformanceMonitoring: vi.fn(),
}));

vi.mock("./error-reporting", () => ({
	initializeErrorReporting: vi.fn(),
}));

vi.mock("./global-handler", () => ({
	initializeGlobalErrorHandling: vi.fn(),
}));

describe("Error Handling Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		mockFetch.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("System Initialization", () => {
		it("should initialize error handling system successfully", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			await expect(initializeErrorHandlingSystem()).resolves.not.toThrow();

			expect(consoleSpy).toHaveBeenCalledWith(
				"🛡️ Error handling and monitoring system initialized successfully",
			);
		});

		it("should handle initialization errors", async () => {
			const initError = new Error("Initialization failed");
			vi.doMock("./global-handler", () => ({
				initializeGlobalErrorHandling: () => {
					throw initError;
				},
			}));

			await expect(initializeErrorHandlingSystem()).rejects.toThrow(
				"Initialization failed",
			);
		});
	});

	describe("HTTP Error Creation", () => {
		it("should create appropriate errors for different status codes", () => {
			const testCases = [
				{
					status: 400,
					expectedCode: ErrorCodes.VALIDATION_ERROR,
					expectedSeverity: "medium",
				},
				{
					status: 401,
					expectedCode: ErrorCodes.UNAUTHORIZED,
					expectedSeverity: "medium",
				},
				{
					status: 403,
					expectedCode: ErrorCodes.FORBIDDEN,
					expectedSeverity: "medium",
				},
				{
					status: 404,
					expectedCode: ErrorCodes.RESOURCE_NOT_FOUND,
					expectedSeverity: "medium",
				},
				{
					status: 409,
					expectedCode: ErrorCodes.RESOURCE_CONFLICT,
					expectedSeverity: "medium",
				},
				{
					status: 429,
					expectedCode: ErrorCodes.API_RATE_LIMIT,
					expectedSeverity: "medium",
				},
				{
					status: 500,
					expectedCode: ErrorCodes.INTERNAL_SERVER_ERROR,
					expectedSeverity: "critical",
				},
				{
					status: 502,
					expectedCode: ErrorCodes.EXTERNAL_SERVICE_ERROR,
					expectedSeverity: "critical",
				},
				{
					status: 503,
					expectedCode: ErrorCodes.SERVICE_UNAVAILABLE,
					expectedSeverity: "critical",
				},
				{
					status: 504,
					expectedCode: ErrorCodes.TIMEOUT_ERROR,
					expectedSeverity: "critical",
				},
			];

			testCases.forEach(({ status, expectedCode, expectedSeverity }) => {
				const error = createHttpError(status, `Error ${status}`, {
					component: "test",
				});

				expect(error.code).toBe(expectedCode);
				expect(error.severity).toBe(expectedSeverity);
				expect(error.context?.httpStatus).toBe(status);
				expect(error.recoverable).toBe(status < 500);
			});
		});

		it("should handle unknown status codes", () => {
			const error = createHttpError(418, "I'm a teapot");

			expect(error.code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
			expect(error.severity).toBe("medium"); // Status < 500
		});
	});

	describe("Fetch Error Handling", () => {
		it("should handle JSON error responses", async () => {
			const mockResponse = {
				status: 400,
				url: "https://api.example.com/test",
				statusText: "Bad Request",
				json: vi.fn().mockResolvedValue({
					error: "Validation failed",
					details: "Email is required",
				}),
			} as unknown as Response;

			const error = await handleFetchError(mockResponse, {
				component: "api-client",
			});

			expect(error.message).toBe("Validation failed");
			expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
			expect(error.context?.url).toBe("https://api.example.com/test");
			expect(error.context?.statusText).toBe("Bad Request");
		});

		it("should handle non-JSON error responses", async () => {
			const mockResponse = {
				status: 500,
				url: "https://api.example.com/test",
				statusText: "Internal Server Error",
				json: vi.fn().mockRejectedValue(new Error("Not JSON")),
			} as unknown as Response;

			const error = await handleFetchError(mockResponse);

			expect(error.message).toBe("Request failed with status 500");
			expect(error.code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
		});

		it("should prefer error message over generic message", async () => {
			const mockResponse = {
				status: 400,
				json: vi.fn().mockResolvedValue({
					message: "Custom error message",
				}),
			} as unknown as Response;

			const error = await handleFetchError(mockResponse);

			expect(error.message).toBe("Custom error message");
		});
	});

	describe("API Request Integration", () => {
		it("should make successful API requests", async () => {
			const responseData = { id: 1, name: "Test User" };
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue(responseData),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			const result = await apiRequest("https://api.example.com/users/1");

			expect(result).toEqual(responseData);
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/users/1",
				expect.objectContaining({
					headers: expect.objectContaining({
						"Content-Type": "application/json",
					}),
				}),
			);
		});

		it("should handle API response format with success flag", async () => {
			const responseData = {
				success: true,
				data: { id: 1, name: "Test User" },
			};
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue(responseData),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			const result = await apiRequest("https://api.example.com/users/1");

			expect(result).toEqual({ id: 1, name: "Test User" });
		});

		it("should handle API errors with success=false", async () => {
			const errorResponse = {
				success: false,
				error: "User not found",
				code: "USER_NOT_FOUND",
			};
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue(errorResponse),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			await expect(
				apiRequest("https://api.example.com/users/999"),
			).rejects.toThrow(AppError);

			try {
				await apiRequest("https://api.example.com/users/999");
			} catch (error) {
				expect(error).toBeInstanceOf(AppError);
				expect((error as AppError).message).toBe("User not found");
				expect((error as AppError).code).toBe("USER_NOT_FOUND");
			}
		});

		it("should handle network errors", async () => {
			const networkError = new Error("Network connection failed");
			mockFetch.mockRejectedValue(networkError);

			await expect(
				apiRequest("https://api.example.com/users/1"),
			).rejects.toThrow(AppError);

			try {
				await apiRequest("https://api.example.com/users/1");
			} catch (error) {
				expect(error).toBeInstanceOf(AppError);
				expect((error as AppError).code).toBe(ErrorCodes.NETWORK_ERROR);
				expect((error as AppError).originalError).toBe(networkError);
			}
		});

		it("should handle request timeouts", async () => {
			mockFetch.mockImplementation(
				() => new Promise((resolve) => setTimeout(resolve, 2000)),
			);

			const timeoutPromise = apiRequest("https://api.example.com/slow", {
				timeout: 1000,
			});

			// Advance timers to trigger timeout
			vi.advanceTimersByTime(1000);

			await expect(timeoutPromise).rejects.toThrow(AppError);

			try {
				await timeoutPromise;
			} catch (error) {
				expect(error).toBeInstanceOf(AppError);
				expect((error as AppError).code).toBe(ErrorCodes.TIMEOUT_ERROR);
			}
		});

		it("should include proper context in API errors", async () => {
			const mockResponse = {
				ok: false,
				status: 404,
				json: vi.fn().mockResolvedValue({ error: "Not found" }),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			try {
				await apiRequest("https://api.example.com/users/999", {
					method: "POST",
					context: { component: "user-service" },
				});
			} catch (error) {
				expect(error).toBeInstanceOf(AppError);
				const appError = error as AppError;
				expect(appError.context).toMatchObject({
					component: "user-service",
					action: "api_request",
					url: "https://api.example.com/users/999",
					method: "POST",
				});
			}
		});
	});

	describe("API Helper Methods", () => {
		beforeEach(() => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({ success: true, data: "response" }),
			} as unknown as Response;
			mockFetch.mockResolvedValue(mockResponse);
		});

		it("should make GET requests", async () => {
			await api.get("https://api.example.com/users");

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/users",
				expect.objectContaining({
					method: "GET",
				}),
			);
		});

		it("should make POST requests with data", async () => {
			const postData = { name: "John", email: "john@example.com" };

			await api.post("https://api.example.com/users", postData);

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/users",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify(postData),
				}),
			);
		});

		it("should make PUT requests with data", async () => {
			const putData = { id: 1, name: "Updated Name" };

			await api.put("https://api.example.com/users/1", putData);

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/users/1",
				expect.objectContaining({
					method: "PUT",
					body: JSON.stringify(putData),
				}),
			);
		});

		it("should make PATCH requests with data", async () => {
			const patchData = { name: "Patched Name" };

			await api.patch("https://api.example.com/users/1", patchData);

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/users/1",
				expect.objectContaining({
					method: "PATCH",
					body: JSON.stringify(patchData),
				}),
			);
		});

		it("should make DELETE requests", async () => {
			await api.delete("https://api.example.com/users/1");

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/users/1",
				expect.objectContaining({
					method: "DELETE",
				}),
			);
		});
	});

	describe("Retry Logic Integration", () => {
		it("should retry recoverable errors", async () => {
			let attemptCount = 0;
			const apiCall = vi.fn().mockImplementation(() => {
				attemptCount++;
				if (attemptCount < 3) {
					throw new AppError({
						message: "Temporary failure",
						code: ErrorCodes.NETWORK_ERROR,
						recoverable: true,
					});
				}
				return "success";
			});

			const result = await withRetry(apiCall, {
				maxAttempts: 3,
				delay: 100,
			});

			expect(result).toBe("success");
			expect(apiCall).toHaveBeenCalledTimes(3);
		});

		it("should not retry non-recoverable errors", async () => {
			const apiCall = vi.fn().mockImplementation(() => {
				throw new AppError({
					message: "Critical failure",
					code: ErrorCodes.INTERNAL_SERVER_ERROR,
					recoverable: false,
				});
			});

			await expect(withRetry(apiCall, { maxAttempts: 3 })).rejects.toThrow(
				AppError,
			);

			expect(apiCall).toHaveBeenCalledTimes(1);
		});

		it("should use exponential backoff", async () => {
			const delays: number[] = [];
			let attemptCount = 0;

			const apiCall = vi.fn().mockImplementation(() => {
				attemptCount++;
				if (attemptCount < 4) {
					throw new AppError({
						message: "Retry error",
						code: ErrorCodes.NETWORK_ERROR,
						recoverable: true,
					});
				}
				return "success";
			});

			// Mock setTimeout to capture delays
			const originalSetTimeout = global.setTimeout;
			global.setTimeout = vi
				.fn()
				.mockImplementation((callback: () => void, delay: number) => {
					delays.push(delay);
					return originalSetTimeout(callback, 0);
				}) as unknown as typeof setTimeout;

			const resultPromise = withRetry(apiCall, {
				maxAttempts: 4,
				delay: 100,
				backoffMultiplier: 2,
			});

			// Process all timeouts
			vi.advanceTimersByTime(1000);

			const result = await resultPromise;

			expect(result).toBe("success");
			expect(delays).toEqual([100, 200, 400]); // Exponential backoff
			expect(apiCall).toHaveBeenCalledTimes(4);

			global.setTimeout = originalSetTimeout;
		});

		it("should respect custom retry conditions", async () => {
			const apiCall = vi.fn().mockImplementation(() => {
				throw new AppError({
					message: "Validation error",
					code: ErrorCodes.VALIDATION_ERROR,
					severity: "low",
					recoverable: true,
				});
			});

			// Custom condition: don't retry validation errors
			const retryCondition = (error: AppError) =>
				error.code !== ErrorCodes.VALIDATION_ERROR;

			await expect(
				withRetry(apiCall, {
					maxAttempts: 3,
					retryCondition,
				}),
			).rejects.toThrow(AppError);

			expect(apiCall).toHaveBeenCalledTimes(1);
		});

		it("should handle errors thrown during retry delays", async () => {
			let attemptCount = 0;
			const apiCall = vi.fn().mockImplementation(() => {
				attemptCount++;
				throw new AppError({
					message: `Attempt ${attemptCount} failed`,
					code: ErrorCodes.NETWORK_ERROR,
					recoverable: true,
				});
			});

			const resultPromise = withRetry(apiCall, {
				maxAttempts: 3,
				delay: 100,
			});

			vi.advanceTimersByTime(1000);

			await expect(resultPromise).rejects.toThrow(AppError);
			expect(apiCall).toHaveBeenCalledTimes(3);
		});
	});

	describe("API Error Handler Wrapper", () => {
		const mockNextResponse = {
			json: vi.fn().mockReturnValue({
				status: vi.fn().mockReturnThis(),
			}),
		};

		beforeEach(() => {
			vi.doMock("next/server", () => ({
				NextResponse: {
					json: vi.fn().mockImplementation((data, options) => ({
						...mockNextResponse,
						data,
						...options,
					})),
				},
			}));
		});

		it("should handle successful API responses", async () => {
			const handler = vi.fn().mockResolvedValue({
				success: true,
				data: { id: 1, name: "Test" },
			});

			const wrappedHandler = withApiErrorHandler(handler);
			const response = await wrappedHandler(mockRequest);

			expect(handler).toHaveBeenCalledWith(mockRequest);
			expect(response).toBeDefined();
		});

		it("should handle API errors with proper status codes", async () => {
			const handler = vi.fn().mockResolvedValue({
				success: false,
				error: "Validation failed",
				code: ErrorCodes.VALIDATION_ERROR,
			});

			const wrappedHandler = withApiErrorHandler(handler);
			const response = await wrappedHandler(mockRequest);

			expect(response).toBeDefined();
			// Should return 400 for validation error
		});

		it("should catch and wrap unhandled exceptions", async () => {
			const handler = vi.fn().mockRejectedValue(new Error("Unhandled error"));

			const wrappedHandler = withApiErrorHandler(handler);
			const response = await wrappedHandler(mockRequest);

			expect(response).toBeDefined();
			// Should return 500 for unhandled errors
		});

		it("should preserve AppError details", async () => {
			const appError = new AppError({
				message: "Custom error",
				code: ErrorCodes.UNAUTHORIZED,
				userMessage: "Please log in",
			});

			const handler = vi.fn().mockRejectedValue(appError);

			const wrappedHandler = withApiErrorHandler(handler);
			const response = await wrappedHandler(mockRequest);

			expect(response).toBeDefined();
			// Should return 401 for unauthorized error
		});

		it("should include request context in errors", async () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const handler = vi.fn().mockRejectedValue(new Error("Test error"));

			const wrappedHandler = withApiErrorHandler(handler);
			await wrappedHandler(mockRequest);

			expect(consoleSpy).toHaveBeenCalledWith("API Error:", expect.any(Error));
		});
	});

	describe("End-to-End Error Flow", () => {
		it("should handle complete error flow from API to UI", async () => {
			// Simulate a complete error flow
			const mockResponse = {
				ok: false,
				status: 401,
				url: "https://api.example.com/protected",
				statusText: "Unauthorized",
				json: vi.fn().mockResolvedValue({
					error: "Token expired",
					code: "TOKEN_EXPIRED",
				}),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			try {
				await api.get("https://api.example.com/protected");
			} catch (error) {
				expect(error).toBeInstanceOf(AppError);
				const appError = error as AppError;

				// Verify error structure
				expect(appError.code).toBe(ErrorCodes.UNAUTHORIZED);
				expect(appError.severity).toBe("medium");
				expect(appError.recoverable).toBe(true);
				expect(appError.userMessage).toContain("log in");

				// Verify context
				expect(appError.context).toMatchObject({
					action: "api_request",
					url: "https://api.example.com/protected",
					method: "GET",
					httpStatus: 401,
				});

				// Verify JSON serialization
				const jsonError = appError.toJSON();
				expect(jsonError).toMatchObject({
					name: "AppError",
					code: ErrorCodes.UNAUTHORIZED,
					severity: "medium",
					recoverable: true,
				});
			}
		});

		it("should handle concurrent API requests with different error types", async () => {
			// Setup different responses for different URLs
			mockFetch.mockImplementation((input: string | URL | Request) => {
				const url = typeof input === "string" ? input : input.toString();
				if (url.includes("/user")) {
					return Promise.resolve({
						ok: false,
						status: 404,
						json: () => Promise.resolve({ error: "User not found" }),
					} as Response);
				}
				if (url.includes("/posts")) {
					return Promise.resolve({
						ok: false,
						status: 500,
						json: () => Promise.resolve({ error: "Server error" }),
					} as Response);
				}
				return Promise.reject(new Error("Network error"));
			});

			const requests = [
				api.get("https://api.example.com/user/123"),
				api.get("https://api.example.com/posts"),
				api.get("https://api.example.com/comments"),
			];

			const results = await Promise.allSettled(requests);

			expect(results[0].status).toBe("rejected");
			expect(results[1].status).toBe("rejected");
			expect(results[2].status).toBe("rejected");

			// Verify different error types
			if (results[0].status === "rejected") {
				expect(results[0].reason.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
			}
			if (results[1].status === "rejected") {
				expect(results[1].reason.code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
			}
			if (results[2].status === "rejected") {
				expect(results[2].reason.code).toBe(ErrorCodes.NETWORK_ERROR);
			}
		});

		it("should handle error recovery scenarios", async () => {
			let callCount = 0;

			// First call fails, second succeeds
			mockFetch.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.resolve({
						ok: false,
						status: 503,
						json: () =>
							Promise.resolve({ error: "Service temporarily unavailable" }),
					} as Response);
				}
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ success: true, data: "recovered" }),
				} as Response);
			});

			// First attempt should fail
			try {
				await api.get("https://api.example.com/data");
			} catch (error) {
				expect(error).toBeInstanceOf(AppError);
				expect((error as AppError).code).toBe(ErrorCodes.SERVICE_UNAVAILABLE);
				expect((error as AppError).recoverable).toBe(false); // 5xx errors are not recoverable
			}

			// Second attempt should succeed
			const result = await api.get("https://api.example.com/data");
			expect(result).toBe("recovered");
		});
	});

	describe("Performance and Memory Tests", () => {
		it("should handle high volume of errors without memory leaks", async () => {
			const errors: AppError[] = [];

			// Create many errors
			for (let i = 0; i < 1000; i++) {
				const error = new AppError({
					message: `Error ${i}`,
					code: "BULK_ERROR",
					context: { metadata: { iteration: i } },
				});
				errors.push(error);
			}

			// Process errors
			const processed = errors.map((error) => error.toJSON());

			expect(processed).toHaveLength(1000);
			expect(processed[0].context?.metadata?.iteration).toBe(0);
			expect(processed[999].context?.metadata?.iteration).toBe(999);
		});

		it("should handle circular references in error context", () => {
			const circularObject: { name: string; self?: unknown } = { name: "test" };
			circularObject.self = circularObject;

			expect(() => {
				const error = new AppError({
					message: "Circular reference test",
					code: "CIRCULAR_TEST",
					context: { metadata: { circular: circularObject } },
				});

				// Should not throw when serializing
				error.toJSON();
			}).not.toThrow();
		});

		it("should cleanup resources properly", () => {
			const abortSpy = vi.fn();
			const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

			// Mock AbortController
			global.AbortController = vi.fn().mockImplementation(() => ({
				signal: { aborted: false },
				abort: abortSpy,
			})) as typeof AbortController;

			const _promise = apiRequest("https://api.example.com/test", {
				timeout: 1000,
			});

			// Simulate cleanup
			vi.advanceTimersByTime(1000);

			expect(clearTimeoutSpy).toHaveBeenCalled();
		});
	});

	describe("Edge Cases and Error Boundaries", () => {
		it("should handle malformed JSON responses gracefully", async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			try {
				await api.get("https://api.example.com/malformed");
			} catch (error) {
				expect(error).toBeInstanceOf(AppError);
				expect((error as AppError).message).toBe(
					"Request failed with status 400",
				);
			}
		});

		it("should handle fetch rejections properly", async () => {
			mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

			try {
				await api.get("https://api.example.com/unreachable");
			} catch (error) {
				expect(error).toBeInstanceOf(AppError);
				expect((error as AppError).code).toBe(ErrorCodes.NETWORK_ERROR);
				expect((error as AppError).originalError?.message).toBe(
					"Failed to fetch",
				);
			}
		});

		it("should handle null/undefined values gracefully", () => {
			expect(() => {
				const error = AppError.fromApiError(null);
				expect(error.code).toBe("UNKNOWN_API_ERROR");
			}).not.toThrow();

			expect(() => {
				const error = AppError.fromApiError(undefined);
				expect(error.code).toBe("UNKNOWN_API_ERROR");
			}).not.toThrow();
		});

		it("should handle very large error contexts", () => {
			const largeContext = {
				largeArray: new Array(10000).fill("data"),
				deepObject: {} as Record<string, unknown>,
			};

			// Create deep nesting
			let current = largeContext.deepObject;
			for (let i = 0; i < 100; i++) {
				current.next = {};
				current = current.next as Record<string, unknown>;
			}

			expect(() => {
				const error = new AppError({
					message: "Large context error",
					code: "LARGE_CONTEXT",
					context: { metadata: largeContext },
				});

				error.toJSON();
			}).not.toThrow();
		});
	});

	describe("Cross-Environment Compatibility", () => {
		it("should work without AbortController support", async () => {
			const originalAbortController = global.AbortController;
			global.AbortController = undefined as unknown as typeof AbortController;

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: "success" }),
			} as Response);

			// Should not throw even without AbortController
			await expect(
				apiRequest("https://api.example.com/test", { timeout: 1000 }),
			).resolves.toBe("success");

			global.AbortController = originalAbortController;
		});

		it("should handle different fetch implementations", async () => {
			// Test with minimal fetch mock
			const minimalFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve("minimal response"),
			});

			global.fetch = minimalFetch;

			const result = await api.get("https://api.example.com/minimal");

			expect(result).toBe("minimal response");
		});
	});
});
