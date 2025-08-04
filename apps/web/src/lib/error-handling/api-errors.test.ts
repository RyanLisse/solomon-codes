/**
 * Unit tests for API error handling utilities
 */

import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	apiRequest,
	createHttpError,
	handleFetchError,
	withApiErrorHandler,
	withRetry,
} from "./api-errors";
import { AppError, ErrorCodes } from "./error-handler";

// Mock Next.js modules
vi.mock("next/server", () => ({
	NextResponse: {
		json: vi.fn((data, options) => ({
			data,
			status: options?.status || 200,
		})),
	},
}));

// Mock error handler
interface MockAppErrorConfig {
	message: string;
	code: string;
	context?: Record<string, unknown>;
	severity?: string;
	recoverable?: boolean;
}

vi.mock("./error-handler", () => ({
	AppError: class MockAppError extends Error {
		constructor(public config: MockAppErrorConfig) {
			super(config.message);
			this.name = "AppError";
		}

		static fromApiError(error: unknown, context?: Record<string, unknown>) {
			const errorMessage = error instanceof Error ? error.message : "API Error";
			return new MockAppError({
				message: errorMessage,
				code: ErrorCodes.INTERNAL_SERVER_ERROR,
				context,
			});
		}

		get code() {
			return this.config.code;
		}
		get severity() {
			return this.config.severity;
		}
		get recoverable() {
			return this.config.recoverable;
		}
		get context() {
			return this.config.context;
		}
	},
	createErrorResponse: vi.fn((error) => ({
		success: false,
		error: error.message,
		code: error.code,
	})),
	ErrorCodes: {
		VALIDATION_ERROR: "VALIDATION_ERROR",
		UNAUTHORIZED: "UNAUTHORIZED",
		FORBIDDEN: "FORBIDDEN",
		RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
		RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
		API_RATE_LIMIT: "API_RATE_LIMIT",
		INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
		EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
		SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
		TIMEOUT_ERROR: "TIMEOUT_ERROR",
		INVALID_INPUT: "INVALID_INPUT",
		MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
		TOKEN_EXPIRED: "TOKEN_EXPIRED",
		OPERATION_FAILED: "OPERATION_FAILED",
		NETWORK_ERROR: "NETWORK_ERROR",
	},
}));

describe("api-errors", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createHttpError", () => {
		it("should create error with correct status code mapping", () => {
			const testCases = [
				{
					status: 400,
					expectedCode: "VALIDATION_ERROR",
					expectedSeverity: "medium",
				},
				{
					status: 401,
					expectedCode: "UNAUTHORIZED",
					expectedSeverity: "medium",
				},
				{ status: 403, expectedCode: "FORBIDDEN", expectedSeverity: "medium" },
				{
					status: 404,
					expectedCode: "RESOURCE_NOT_FOUND",
					expectedSeverity: "medium",
				},
				{
					status: 409,
					expectedCode: "RESOURCE_CONFLICT",
					expectedSeverity: "medium",
				},
				{
					status: 429,
					expectedCode: "API_RATE_LIMIT",
					expectedSeverity: "medium",
				},
				{
					status: 500,
					expectedCode: "INTERNAL_SERVER_ERROR",
					expectedSeverity: "critical",
				},
				{
					status: 502,
					expectedCode: "EXTERNAL_SERVICE_ERROR",
					expectedSeverity: "critical",
				},
				{
					status: 503,
					expectedCode: "SERVICE_UNAVAILABLE",
					expectedSeverity: "critical",
				},
				{
					status: 504,
					expectedCode: "TIMEOUT_ERROR",
					expectedSeverity: "critical",
				},
			];

			testCases.forEach(({ status, expectedCode, expectedSeverity }) => {
				const error = createHttpError(status);

				expect(error).toBeInstanceOf(AppError);
				expect(error.code).toBe(expectedCode);
				expect(error.severity).toBe(expectedSeverity);
				expect(error.context?.httpStatus).toBe(status);
			});
		});

		it("should use default values for unknown status codes", () => {
			const error = createHttpError(418); // I'm a teapot

			expect(error.code).toBe("INTERNAL_SERVER_ERROR");
			expect(error.severity).toBe("medium");
		});

		it("should use custom message when provided", () => {
			const customMessage = "Custom error message";
			const error = createHttpError(400, customMessage);

			expect(error.message).toBe(customMessage);
		});

		it("should include context information", () => {
			const context = { userId: "123", action: "test" };
			const error = createHttpError(500, "Test error", context);

			expect(error.context).toMatchObject({
				...context,
				httpStatus: 500,
			});
		});

		it("should set recoverable flag based on status code", () => {
			const clientError = createHttpError(400);
			const serverError = createHttpError(500);

			expect(clientError.recoverable).toBe(true);
			expect(serverError.recoverable).toBe(false);
		});
	});

	describe("handleFetchError", () => {
		let mockResponse: Partial<Response>;

		beforeEach(() => {
			mockResponse = {
				status: 400,
				url: "https://api.example.com/test",
				statusText: "Bad Request",
				json: vi.fn(),
			};
		});

		it("should handle JSON error response", async () => {
			mockResponse.json = vi.fn().mockResolvedValue({
				error: "Invalid request format",
			});

			const error = await handleFetchError(mockResponse as Response);

			expect(error).toBeInstanceOf(AppError);
			expect(error.message).toBe("Invalid request format");
			expect(error.context?.url).toBe("https://api.example.com/test");
			expect(error.context?.statusText).toBe("Bad Request");
		});

		it("should handle JSON response with message field", async () => {
			mockResponse.json = vi.fn().mockResolvedValue({
				message: "Validation failed",
			});

			const error = await handleFetchError(mockResponse as Response);

			expect(error.message).toBe("Validation failed");
		});

		it("should handle non-JSON response", async () => {
			mockResponse.json = vi.fn().mockRejectedValue(new Error("Not JSON"));

			const error = await handleFetchError(mockResponse as Response);

			expect(error.message).toBe("Request failed with status 400");
		});

		it("should include custom context", async () => {
			mockResponse.json = vi.fn().mockResolvedValue({});
			const context = { component: "test-component" };

			const error = await handleFetchError(mockResponse as Response, context);

			expect(error.context?.component).toBe("test-component");
		});
	});

	describe("withApiErrorHandler", () => {
		let mockRequest: Request;

		beforeEach(() => {
			mockRequest = {
				url: "https://api.example.com/test",
				method: "GET",
			} as Request;
		});

		it("should return successful response", async () => {
			const handler = vi.fn().mockResolvedValue({
				success: true,
				data: { id: 1, name: "Test" },
			});

			const wrappedHandler = withApiErrorHandler(handler);
			const response = await wrappedHandler(mockRequest);

			expect(response.status).toBe(200);
			expect(NextResponse.json).toHaveBeenCalledWith(
				{ success: true, data: { id: 1, name: "Test" } },
				{ status: 200 },
			);
		});

		it("should handle error response from handler", async () => {
			const handler = vi.fn().mockResolvedValue({
				success: false,
				error: "Validation failed",
				code: "VALIDATION_ERROR",
			});

			const wrappedHandler = withApiErrorHandler(handler);
			const response = await wrappedHandler(mockRequest);

			expect(response.status).toBe(400); // VALIDATION_ERROR maps to 400
		});

		it("should handle thrown AppError", async () => {
			const appError = new AppError({
				message: "Test error",
				code: "UNAUTHORIZED",
				severity: "medium",
			});

			const handler = vi.fn().mockRejectedValue(appError);

			const wrappedHandler = withApiErrorHandler(handler);
			const response = await wrappedHandler(mockRequest);

			expect(response.status).toBe(401); // UNAUTHORIZED maps to 401
		});

		it("should handle thrown generic error", async () => {
			const handler = vi.fn().mockRejectedValue(new Error("Generic error"));

			const wrappedHandler = withApiErrorHandler(handler);
			const response = await wrappedHandler(mockRequest);

			expect(response.status).toBe(500);
		});

		it("should handle unknown thrown value", async () => {
			const handler = vi.fn().mockRejectedValue("String error");

			const wrappedHandler = withApiErrorHandler(handler);
			const response = await wrappedHandler(mockRequest);

			expect(response.status).toBe(500);
		});
	});

	describe("apiRequest", () => {
		let mockFetch: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			mockFetch = vi.fn();
			global.fetch = mockFetch;
			vi.spyOn(global, "setTimeout").mockImplementation((fn) => {
				if (typeof fn === "function") fn();
				return 123 as unknown as NodeJS.Timeout;
			});
			vi.spyOn(global, "clearTimeout").mockImplementation(() => {});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should make successful request", async () => {
			const responseData = { id: 1, name: "Test" };
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(responseData),
			});

			const result = await apiRequest("/api/test");

			expect(result).toEqual(responseData);
			expect(mockFetch).toHaveBeenCalledWith("/api/test", {
				signal: expect.any(AbortSignal),
				headers: { "Content-Type": "application/json" },
			});
		});

		it("should handle API response format", async () => {
			const responseData = { data: { id: 1 } };
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(responseData),
			});

			const result = await apiRequest("/api/test");

			expect(result).toEqual({ id: 1 });
		});

		it("should handle failed API response", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						success: false,
						error: "Operation failed",
						code: "OPERATION_FAILED",
					}),
			});

			await expect(apiRequest("/api/test")).rejects.toThrow("Operation failed");
		});

		it("should handle HTTP error response", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
				url: "/api/test",
				statusText: "Not Found",
				json: () => Promise.resolve({ error: "Resource not found" }),
			});

			await expect(apiRequest("/api/test")).rejects.toThrow();
		});

		it("should handle timeout", async () => {
			const mockAbortController = {
				abort: vi.fn(),
				signal: {} as AbortSignal,
			};
			vi.spyOn(global, "AbortController").mockImplementation(
				() => mockAbortController as AbortController,
			);

			mockFetch.mockRejectedValue({ name: "AbortError" });

			await expect(apiRequest("/api/test", { timeout: 5000 })).rejects.toThrow(
				"Request timeout",
			);
		});

		it("should handle network error", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			await expect(apiRequest("/api/test")).rejects.toThrow("Network error");
		});

		it("should include custom headers", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({}),
			});

			await apiRequest("/api/test", {
				headers: { Authorization: "Bearer token" },
			});

			expect(mockFetch).toHaveBeenCalledWith("/api/test", {
				signal: expect.any(AbortSignal),
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer token",
				},
			});
		});
	});

	describe("api helpers", () => {
		let mockApiRequest: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			// Mock the apiRequest function
			mockApiRequest = vi.fn();
			vi.doMock("./api-errors", async () => {
				const actual = await vi.importActual("./api-errors");
				return {
					...actual,
					apiRequest: mockApiRequest,
				};
			});
		});

		it("should call GET request correctly", async () => {
			const { api } = await import("./api-errors");
			mockApiRequest.mockResolvedValue({ data: "test" });

			await api.get("/api/test", { timeout: 5000 });

			expect(mockApiRequest).toHaveBeenCalledWith("/api/test", {
				method: "GET",
				timeout: 5000,
			});
		});

		it("should call POST request with data", async () => {
			const { api } = await import("./api-errors");
			mockApiRequest.mockResolvedValue({ data: "test" });

			const postData = { name: "Test" };
			await api.post("/api/test", postData);

			expect(mockApiRequest).toHaveBeenCalledWith("/api/test", {
				method: "POST",
				body: JSON.stringify(postData),
			});
		});

		it("should call PUT request with data", async () => {
			const { api } = await import("./api-errors");
			mockApiRequest.mockResolvedValue({ data: "test" });

			const putData = { id: 1, name: "Updated" };
			await api.put("/api/test/1", putData);

			expect(mockApiRequest).toHaveBeenCalledWith("/api/test/1", {
				method: "PUT",
				body: JSON.stringify(putData),
			});
		});

		it("should call PATCH request with data", async () => {
			const { api } = await import("./api-errors");
			mockApiRequest.mockResolvedValue({ data: "test" });

			const patchData = { name: "Patched" };
			await api.patch("/api/test/1", patchData);

			expect(mockApiRequest).toHaveBeenCalledWith("/api/test/1", {
				method: "PATCH",
				body: JSON.stringify(patchData),
			});
		});

		it("should call DELETE request correctly", async () => {
			const { api } = await import("./api-errors");
			mockApiRequest.mockResolvedValue({ success: true });

			await api.delete("/api/test/1");

			expect(mockApiRequest).toHaveBeenCalledWith("/api/test/1", {
				method: "DELETE",
			});
		});
	});

	describe("withRetry", () => {
		beforeEach(() => {
			vi.spyOn(global, "setTimeout").mockImplementation((fn, _delay) => {
				if (typeof fn === "function") fn();
				return 123 as unknown as NodeJS.Timeout;
			});
		});

		it("should return result on first successful attempt", async () => {
			const apiCall = vi.fn().mockResolvedValue("success");

			const result = await withRetry(apiCall);

			expect(result).toBe("success");
			expect(apiCall).toHaveBeenCalledTimes(1);
		});

		it("should retry on recoverable error", async () => {
			const recoverableError = new AppError({
				message: "Temporary error",
				code: "SERVICE_UNAVAILABLE",
				recoverable: true,
				severity: "medium",
			});

			const apiCall = vi
				.fn()
				.mockRejectedValueOnce(recoverableError)
				.mockResolvedValue("success");

			const result = await withRetry(apiCall);

			expect(result).toBe("success");
			expect(apiCall).toHaveBeenCalledTimes(2);
		});

		it("should not retry on non-recoverable error", async () => {
			const nonRecoverableError = new AppError({
				message: "Critical error",
				code: "INTERNAL_SERVER_ERROR",
				recoverable: false,
				severity: "critical",
			});

			const apiCall = vi.fn().mockRejectedValue(nonRecoverableError);

			await expect(withRetry(apiCall)).rejects.toThrow("Critical error");
			expect(apiCall).toHaveBeenCalledTimes(1);
		});

		it("should respect max attempts", async () => {
			const retryableError = new AppError({
				message: "Retryable error",
				code: "SERVICE_UNAVAILABLE",
				recoverable: true,
				severity: "medium",
			});

			const apiCall = vi.fn().mockRejectedValue(retryableError);

			await expect(withRetry(apiCall, { maxAttempts: 3 })).rejects.toThrow(
				"Retryable error",
			);
			expect(apiCall).toHaveBeenCalledTimes(3);
		});

		it("should use custom retry condition", async () => {
			const error = new AppError({
				message: "Custom error",
				code: "VALIDATION_ERROR",
				recoverable: true,
				severity: "medium",
			});

			const apiCall = vi.fn().mockRejectedValue(error);
			const retryCondition = vi.fn().mockReturnValue(false);

			await expect(withRetry(apiCall, { retryCondition })).rejects.toThrow(
				"Custom error",
			);
			expect(apiCall).toHaveBeenCalledTimes(1);
			expect(retryCondition).toHaveBeenCalledWith(error);
		});

		it("should handle non-AppError", async () => {
			const genericError = new Error("Generic error");
			const apiCall = vi.fn().mockRejectedValue(genericError);

			await expect(withRetry(apiCall)).rejects.toThrow();
			expect(apiCall).toHaveBeenCalledTimes(3); // Should retry generic errors
		});

		it("should implement exponential backoff", async () => {
			const setTimeoutSpy = vi.spyOn(global, "setTimeout");
			const error = new AppError({
				message: "Retry error",
				code: "SERVICE_UNAVAILABLE",
				recoverable: true,
				severity: "medium",
			});

			const apiCall = vi.fn().mockRejectedValue(error);

			await expect(
				withRetry(apiCall, {
					maxAttempts: 3,
					delay: 1000,
					backoffMultiplier: 2,
				}),
			).rejects.toThrow();

			// Should have been called for retry delays
			expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
			expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
		});
	});
});
