/**
 * Comprehensive tests for error handling hooks
 * Tests useErrorHandler, useAsyncOperation, useFormValidation, useApiCall, and useDebouncedError
 */

import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCodes } from "./error-handler";
import {
	type UseErrorHandlerOptions,
	useApiCall,
	useAsyncOperation,
	useDebouncedError,
	useErrorHandler,
	useFormValidation,
} from "./hooks";

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
	},
}));

const mockToast = vi.mocked(toast);
const mockToastError = vi.mocked(toast.error);

describe("useErrorHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Basic Error Handling", () => {
		it("should handle AppError correctly", () => {
			const { result } = renderHook(() => useErrorHandler());

			const appError = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
				userMessage: "User friendly message",
			});

			act(() => {
				result.current.handleError(appError);
			});

			expect(result.current.hasError).toBe(true);
			expect(result.current.error).toBe(appError);
			expect(result.current.isRecoverable).toBe(true);
		});

		it("should convert regular Error to AppError", () => {
			const { result } = renderHook(() => useErrorHandler());

			const regularError = new Error("Regular error");

			act(() => {
				result.current.handleError(regularError);
			});

			expect(result.current.hasError).toBe(true);
			expect(result.current.error).toBeInstanceOf(AppError);
			expect(result.current.error?.code).toBe("API_ERROR");
			expect(result.current.error?.originalError).toBe(regularError);
		});

		it("should handle unknown error types", () => {
			const { result } = renderHook(() => useErrorHandler());

			act(() => {
				result.current.handleError("string error");
			});

			expect(result.current.hasError).toBe(true);
			expect(result.current.error).toBeInstanceOf(AppError);
			expect(result.current.error?.code).toBe("UNKNOWN_API_ERROR");
		});

		it("should clear error state", () => {
			const { result } = renderHook(() => useErrorHandler());

			act(() => {
				result.current.handleError(new Error("Test error"));
			});

			expect(result.current.hasError).toBe(true);

			act(() => {
				result.current.clearError();
			});

			expect(result.current.hasError).toBe(false);
			expect(result.current.error).toBeNull();
			expect(result.current.isRecoverable).toBe(false);
		});
	});

	describe("Toast Notifications", () => {
		it("should show toast by default", () => {
			const { result } = renderHook(() => useErrorHandler());

			const appError = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
				userMessage: "User message",
			});

			act(() => {
				result.current.handleError(appError);
			});

			expect(mockToast.error).toHaveBeenCalledWith("User message", {
				description: "TEST_ERROR",
				action: {
					label: "Retry",
					onClick: expect.any(Function),
				},
			});
		});

		it("should not show toast when disabled", () => {
			const { result } = renderHook(() =>
				useErrorHandler({ showToast: false }),
			);

			act(() => {
				result.current.handleError(new Error("Test error"));
			});

			expect(mockToast.error).not.toHaveBeenCalled();
		});

		it("should not show retry action for non-recoverable errors", () => {
			const { result } = renderHook(() => useErrorHandler());

			const nonRecoverableError = new AppError({
				message: "Non-recoverable error",
				code: "NON_RECOVERABLE",
				recoverable: false,
			});

			act(() => {
				result.current.handleError(nonRecoverableError);
			});

			expect(mockToast.error).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					action: undefined,
				}),
			);
		});

		it("should trigger clearError when retry action is clicked", () => {
			const { result } = renderHook(() => useErrorHandler());

			act(() => {
				result.current.handleError(new Error("Test error"));
			});

			const toastCall = mockToastError.mock.calls[0];
			const retryAction = toastCall[1]?.action as
				| { label: string; onClick: () => void }
				| undefined;

			expect(retryAction).toBeDefined();

			act(() => {
				retryAction?.onClick();
			});

			expect(result.current.hasError).toBe(false);
		});
	});

	describe("Error Logging", () => {
		it("should log errors by default", () => {
			const consoleSpy = vi.spyOn(console, "error");
			const { result } = renderHook(() => useErrorHandler());

			const appError = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
			});

			act(() => {
				result.current.handleError(appError);
			});

			expect(consoleSpy).toHaveBeenCalledWith(
				"Error handled:",
				expect.objectContaining({
					message: "Test error",
					code: "TEST_ERROR",
				}),
			);
		});

		it("should not log errors when disabled", () => {
			const consoleSpy = vi.spyOn(console, "error");
			const { result } = renderHook(() => useErrorHandler({ logError: false }));

			act(() => {
				result.current.handleError(new Error("Test error"));
			});

			expect(consoleSpy).not.toHaveBeenCalled();
		});
	});

	describe("Custom Error Handler", () => {
		it("should call custom error handler", () => {
			const onError = vi.fn();
			const { result } = renderHook(() => useErrorHandler({ onError }));

			const appError = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
			});

			act(() => {
				result.current.handleError(appError);
			});

			expect(onError).toHaveBeenCalledWith(appError);
		});

		it("should merge context with additional context", () => {
			const onError = vi.fn();
			const context = { component: "test-component" };
			const { result } = renderHook(() =>
				useErrorHandler({ onError, context }),
			);

			act(() => {
				result.current.handleError(new Error("Test error"), {
					action: "test-action",
				});
			});

			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					context: expect.objectContaining({
						component: "test-component",
						action: "test-action",
					}),
				}),
			);
		});
	});

	describe("Hook Dependencies", () => {
		it("should update when options change", () => {
			const onError1 = vi.fn();
			const onError2 = vi.fn();

			const { result, rerender } = renderHook(
				({ onError }: UseErrorHandlerOptions) => useErrorHandler({ onError }),
				{ initialProps: { onError: onError1 } },
			);

			act(() => {
				result.current.handleError(new Error("Test error"));
			});

			expect(onError1).toHaveBeenCalled();

			rerender({ onError: onError2 });

			act(() => {
				result.current.handleError(new Error("Another error"));
			});

			expect(onError2).toHaveBeenCalled();
		});
	});
});

describe("useAsyncOperation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("Successful Operations", () => {
		it("should execute async operation successfully", async () => {
			const asyncFn = vi.fn().mockResolvedValue("success result");
			const { result } = renderHook(() => useAsyncOperation(asyncFn));

			expect(result.current.loading).toBe(false);
			expect(result.current.data).toBeNull();

			let executePromise: Promise<unknown>;
			act(() => {
				executePromise = result.current.execute();
			});

			expect(result.current.loading).toBe(true);

			await act(async () => {
				const resultData = await executePromise;
				expect(resultData).toBe("success result");
			});

			expect(result.current.loading).toBe(false);
			expect(result.current.data).toBe("success result");
			expect(result.current.hasError).toBe(false);
			expect(asyncFn).toHaveBeenCalledTimes(1);
		});

		it("should reset state before execution", async () => {
			const asyncFn = vi.fn().mockResolvedValue("result");
			const { result } = renderHook(() => useAsyncOperation(asyncFn));

			// First execution with error
			asyncFn.mockRejectedValueOnce(new Error("Initial error"));
			await act(async () => {
				await result.current.execute();
			});

			expect(result.current.hasError).toBe(true);

			// Second execution should reset state
			asyncFn.mockResolvedValueOnce("success");
			let executePromise: Promise<unknown>;
			act(() => {
				executePromise = result.current.execute();
			});

			expect(result.current.hasError).toBe(false);
			expect(result.current.error).toBeNull();

			await act(async () => {
				await executePromise;
			});
		});
	});

	describe("Error Handling", () => {
		it("should handle async operation errors", async () => {
			const error = new Error("Async error");
			const asyncFn = vi.fn().mockRejectedValue(error);
			const { result } = renderHook(() => useAsyncOperation(asyncFn));

			await act(async () => {
				const resultData = await result.current.execute();
				expect(resultData).toBeNull();
			});

			expect(result.current.loading).toBe(false);
			expect(result.current.data).toBeNull();
			expect(result.current.hasError).toBe(true);
			expect(result.current.error).toBeInstanceOf(AppError);
			expect(result.current.error?.originalError).toBe(error);
		});

		it("should include attempt metadata in error context", async () => {
			const onError = vi.fn();
			const asyncFn = vi.fn().mockRejectedValue(new Error("Test error"));
			const { result } = renderHook(() =>
				useAsyncOperation(asyncFn, { onError, retryAttempts: 2 }),
			);

			await act(async () => {
				await result.current.execute();
			});

			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					context: expect.objectContaining({
						action: "async_operation",
						attempt: 2, // Final attempt
						maxAttempts: 2,
					}),
				}),
			);
		});
	});

	describe("Retry Logic", () => {
		it("should retry on recoverable errors", async () => {
			const asyncFn = vi
				.fn()
				.mockRejectedValueOnce(new Error("First failure"))
				.mockRejectedValueOnce(new Error("Second failure"))
				.mockResolvedValueOnce("success");

			const { result } = renderHook(() =>
				useAsyncOperation(asyncFn, { retryAttempts: 3, retryDelay: 100 }),
			);

			const executePromise = act(async () => {
				return result.current.execute();
			});

			// Advance timers for retries
			await act(async () => {
				vi.advanceTimersByTime(100);
				await Promise.resolve();
				vi.advanceTimersByTime(200);
				await Promise.resolve();
			});

			const resultData = await executePromise;

			expect(resultData).toBe("success");
			expect(asyncFn).toHaveBeenCalledTimes(3);
			expect(result.current.data).toBe("success");
			expect(result.current.hasError).toBe(false);
		});

		it("should stop retrying after max attempts", async () => {
			const asyncFn = vi.fn().mockRejectedValue(new Error("Persistent error"));
			const { result } = renderHook(() =>
				useAsyncOperation(asyncFn, { retryAttempts: 2, retryDelay: 100 }),
			);

			const executePromise = act(async () => {
				return result.current.execute();
			});

			await act(async () => {
				vi.advanceTimersByTime(300);
				await Promise.resolve();
			});

			const resultData = await executePromise;

			expect(resultData).toBeNull();
			expect(asyncFn).toHaveBeenCalledTimes(2);
			expect(result.current.hasError).toBe(true);
		});

		it("should not retry non-recoverable errors", async () => {
			const nonRecoverableError = new AppError({
				message: "Non-recoverable error",
				code: "NON_RECOVERABLE",
				recoverable: false,
			});

			const asyncFn = vi.fn().mockRejectedValue(nonRecoverableError);
			const { result } = renderHook(() =>
				useAsyncOperation(asyncFn, { retryAttempts: 3 }),
			);

			await act(async () => {
				await result.current.execute();
			});

			expect(asyncFn).toHaveBeenCalledTimes(1); // No retries
			expect(result.current.hasError).toBe(true);
			expect(result.current.error).toBe(nonRecoverableError);
		});

		it("should use exponential backoff for retries", async () => {
			const asyncFn = vi
				.fn()
				.mockRejectedValueOnce(new Error("First failure"))
				.mockRejectedValueOnce(new Error("Second failure"))
				.mockResolvedValueOnce("success");

			const { result } = renderHook(() =>
				useAsyncOperation(asyncFn, { retryAttempts: 3, retryDelay: 100 }),
			);

			const _startTime = Date.now();
			const executePromise = act(async () => {
				return result.current.execute();
			});

			// First retry: 100ms delay
			await act(async () => {
				vi.advanceTimersByTime(100);
				await Promise.resolve();
			});

			// Second retry: 200ms delay (100 * 2)
			await act(async () => {
				vi.advanceTimersByTime(200);
				await Promise.resolve();
			});

			await executePromise;

			expect(asyncFn).toHaveBeenCalledTimes(3);
		});
	});

	describe("Reset Functionality", () => {
		it("should reset state to initial values", async () => {
			const asyncFn = vi.fn().mockRejectedValue(new Error("Test error"));
			const { result } = renderHook(() => useAsyncOperation(asyncFn));

			await act(async () => {
				await result.current.execute();
			});

			expect(result.current.hasError).toBe(true);

			act(() => {
				result.current.reset();
			});

			expect(result.current.data).toBeNull();
			expect(result.current.loading).toBe(false);
			expect(result.current.error).toBeNull();
			expect(result.current.hasError).toBe(false);
		});
	});

	describe("Concurrent Executions", () => {
		it("should handle concurrent executions correctly", async () => {
			const asyncFn = vi
				.fn()
				.mockImplementationOnce(
					() =>
						new Promise((resolve) => setTimeout(() => resolve("first"), 100)),
				)
				.mockImplementationOnce(
					() =>
						new Promise((resolve) => setTimeout(() => resolve("second"), 50)),
				);

			const { result } = renderHook(() => useAsyncOperation(asyncFn));

			const [firstPromise, secondPromise] = await act(async () => {
				const first = result.current.execute();
				const second = result.current.execute();
				return [first, second];
			});

			await act(async () => {
				vi.advanceTimersByTime(100);
			});

			const [_firstResult, _secondResult] = await Promise.all([
				firstPromise,
				secondPromise,
			]);

			// The last execution should win
			expect(result.current.data).toBe("second");
		});
	});
});

describe("useFormValidation", () => {
	interface TestForm extends Record<string, unknown> {
		name: string;
		email: string;
		age: number;
		password: string;
		extraField?: string;
	}

	const initialValues: TestForm = {
		name: "",
		email: "",
		age: 0,
		password: "",
	};

	const validationRules = {
		name: { required: true, minLength: 2, maxLength: 50 },
		email: {
			required: true,
			pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		},
		age: {
			required: true,
			custom: (value: unknown) =>
				typeof value === "number" && value < 18 ? "Must be 18 or older" : null,
		},
		password: { required: true, minLength: 8 },
	};

	describe("Field Validation", () => {
		it("should validate required fields", () => {
			const { result } = renderHook(() =>
				useFormValidation(initialValues, validationRules),
			);

			act(() => {
				result.current.handleFieldBlur("name");
			});

			expect(result.current.getFieldError("name")).toBe("name is required");
			expect(result.current.hasErrors).toBe(true);
		});

		it("should validate minimum length", () => {
			const { result } = renderHook(() =>
				useFormValidation({ ...initialValues, name: "a" }, validationRules),
			);

			act(() => {
				result.current.handleFieldBlur("name");
			});

			expect(result.current.getFieldError("name")).toBe(
				"name must be at least 2 characters",
			);
		});

		it("should validate maximum length", () => {
			const { result } = renderHook(() =>
				useFormValidation(
					{ ...initialValues, name: "a".repeat(51) },
					validationRules,
				),
			);

			act(() => {
				result.current.handleFieldBlur("name");
			});

			expect(result.current.getFieldError("name")).toBe(
				"name must not exceed 50 characters",
			);
		});

		it("should validate pattern matching", () => {
			const { result } = renderHook(() =>
				useFormValidation(
					{ ...initialValues, email: "invalid-email" },
					validationRules,
				),
			);

			act(() => {
				result.current.handleFieldBlur("email");
			});

			expect(result.current.getFieldError("email")).toBe(
				"email format is invalid",
			);
		});

		it("should validate custom rules", () => {
			const { result } = renderHook(() =>
				useFormValidation({ ...initialValues, age: 16 }, validationRules),
			);

			act(() => {
				result.current.handleFieldBlur("age");
			});

			expect(result.current.getFieldError("age")).toBe("Must be 18 or older");
		});

		it("should pass validation with valid values", () => {
			const { result } = renderHook(() =>
				useFormValidation(
					{
						name: "John Doe",
						email: "john@example.com",
						age: 25,
						password: "securepassword",
					},
					validationRules,
				),
			);

			act(() => {
				(["name", "email", "age", "password"] as const).forEach((field) => {
					result.current.handleFieldBlur(field);
				});
			});

			expect(result.current.hasErrors).toBe(false);
		});
	});

	describe("Form Validation", () => {
		it("should validate entire form", () => {
			const { result } = renderHook(() =>
				useFormValidation(initialValues, validationRules),
			);

			let isValid = false;
			act(() => {
				isValid = result.current.validateForm();
			});

			expect(isValid).toBe(false);
			expect(result.current.hasErrors).toBe(true);
			expect(Object.keys(result.current.errors)).toHaveLength(4);
		});

		it("should return true for valid form", () => {
			const validValues: TestForm = {
				name: "John Doe",
				email: "john@example.com",
				age: 25,
				password: "securepassword",
			};

			const { result } = renderHook(() =>
				useFormValidation(validValues, validationRules),
			);

			let isValid = false;
			act(() => {
				isValid = result.current.validateForm();
			});

			expect(isValid).toBe(true);
			expect(result.current.hasErrors).toBe(false);
		});
	});

	describe("Field Change Handling", () => {
		it("should update field values", () => {
			const { result } = renderHook(() =>
				useFormValidation(initialValues, validationRules),
			);

			act(() => {
				result.current.handleFieldChange("name", "John");
			});

			expect(result.current.values.name).toBe("John");
		});

		it("should clear field error when value changes", () => {
			const { result } = renderHook(() =>
				useFormValidation(initialValues, validationRules),
			);

			// Create an error
			act(() => {
				result.current.handleFieldBlur("name");
			});

			expect(result.current.getFieldError("name")).toBe("name is required");

			// Change field value should clear error
			act(() => {
				result.current.handleFieldChange("name", "John");
			});

			expect(result.current.getFieldError("name")).toBeUndefined();
		});
	});

	describe("Touch State Management", () => {
		it("should track field touch state", () => {
			const { result } = renderHook(() =>
				useFormValidation(initialValues, validationRules),
			);

			expect(result.current.isFieldTouched("name")).toBe(false);

			act(() => {
				result.current.handleFieldBlur("name");
			});

			expect(result.current.isFieldTouched("name")).toBe(true);
		});

		it("should validate field on blur", () => {
			const { result } = renderHook(() =>
				useFormValidation({ ...initialValues, name: "Jo" }, validationRules),
			);

			act(() => {
				result.current.handleFieldBlur("name");
			});

			expect(result.current.getFieldError("name")).toBe(
				"name must be at least 2 characters",
			);
			expect(result.current.isFieldTouched("name")).toBe(true);
		});
	});

	describe("Reset Functionality", () => {
		it("should reset form to initial values", () => {
			const { result } = renderHook(() =>
				useFormValidation(initialValues, validationRules),
			);

			// Make changes
			act(() => {
				result.current.handleFieldChange("name", "John");
				result.current.handleFieldBlur("name");
			});

			expect(result.current.values.name).toBe("John");
			expect(result.current.isFieldTouched("name")).toBe(true);

			// Reset
			act(() => {
				result.current.reset();
			});

			expect(result.current.values).toEqual(initialValues);
			expect(result.current.hasErrors).toBe(false);
			expect(result.current.isFieldTouched("name")).toBe(false);
		});
	});

	describe("Edge Cases", () => {
		it("should handle fields without validation rules", () => {
			const { result } = renderHook(() =>
				useFormValidation(
					{ ...initialValues, extraField: "test" },
					validationRules,
				),
			);

			act(() => {
				result.current.handleFieldBlur("extraField");
			});

			expect(result.current.getFieldError("extraField")).toBeUndefined();
		});

		it("should handle null/undefined values", () => {
			const { result } = renderHook(() =>
				useFormValidation(
					{ ...initialValues, name: null as unknown },
					validationRules,
				),
			);

			act(() => {
				result.current.handleFieldBlur("name");
			});

			expect(result.current.getFieldError("name")).toBe("name is required");
		});
	});
});

describe("useApiCall", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Successful API Calls", () => {
		it("should handle successful API call", async () => {
			const apiCall = vi.fn().mockResolvedValue({ id: 1, name: "Test" });
			const { result } = renderHook(() => useApiCall());

			expect(result.current.loading).toBe(false);

			let callPromise: Promise<unknown>;
			act(() => {
				callPromise = result.current.call(apiCall);
			});

			expect(result.current.loading).toBe(true);

			const resultData = await act(async () => {
				return await callPromise;
			});

			expect(resultData).toEqual({ id: 1, name: "Test" });
			expect(result.current.loading).toBe(false);
			expect(result.current.data).toEqual({ id: 1, name: "Test" });
			expect(result.current.error).toBeNull();
		});

		it("should clear previous errors on new call", async () => {
			const { result } = renderHook(() => useApiCall());

			// First call fails
			const failingCall = vi.fn().mockRejectedValue(new Error("API Error"));
			await act(async () => {
				await result.current.call(failingCall);
			});

			expect(result.current.error).not.toBeNull();

			// Second call succeeds
			const successCall = vi.fn().mockResolvedValue("success");
			let callPromise: Promise<unknown>;
			act(() => {
				callPromise = result.current.call(successCall);
			});

			expect(result.current.error).toBeNull();

			await act(async () => {
				await callPromise;
			});
		});
	});

	describe("Error Handling", () => {
		it("should handle API call errors", async () => {
			const error = new Error("Network error");
			const apiCall = vi.fn().mockRejectedValue(error);
			const { result } = renderHook(() => useApiCall());

			const resultData = await act(async () => {
				return await result.current.call(apiCall);
			});

			expect(resultData).toBeNull();
			expect(result.current.loading).toBe(false);
			expect(result.current.error).toBeInstanceOf(AppError);
			expect(result.current.error?.code).toBe(ErrorCodes.NETWORK_ERROR);
			expect(result.current.error?.originalError).toBe(error);
		});

		it("should create network error with proper context", async () => {
			const onError = vi.fn();
			const apiCall = vi.fn().mockRejectedValue(new Error("Fetch failed"));
			const { result } = renderHook(() => useApiCall({ onError }));

			await act(async () => {
				await result.current.call(apiCall);
			});

			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					code: ErrorCodes.NETWORK_ERROR,
					context: expect.objectContaining({
						action: "api_call",
					}),
				}),
			);
		});

		it("should handle non-Error exceptions", async () => {
			const apiCall = vi.fn().mockRejectedValue("String error");
			const { result } = renderHook(() => useApiCall());

			await act(async () => {
				await result.current.call(apiCall);
			});

			expect(result.current.error).toBeInstanceOf(AppError);
			expect(result.current.error?.message).toContain("String error");
		});
	});

	describe("Reset Functionality", () => {
		it("should reset state to initial values", async () => {
			const apiCall = vi.fn().mockRejectedValue(new Error("Test error"));
			const { result } = renderHook(() => useApiCall());

			await act(async () => {
				await result.current.call(apiCall);
			});

			expect(result.current.error).not.toBeNull();

			act(() => {
				result.current.reset();
			});

			expect(result.current.data).toBeNull();
			expect(result.current.loading).toBe(false);
			expect(result.current.error).toBeNull();
		});
	});

	describe("Generic Type Support", () => {
		it("should support typed API responses", async () => {
			interface User {
				id: number;
				name: string;
			}

			const userData: User = { id: 1, name: "John" };
			const apiCall = vi.fn().mockResolvedValue(userData);
			const { result } = renderHook(() => useApiCall<User>());

			const resultData = await act(async () => {
				return await result.current.call(() => apiCall());
			});

			expect(resultData).toEqual(userData);
			expect(result.current.data).toEqual(userData);
		});
	});
});

describe("useDebouncedError", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("Debouncing Behavior", () => {
		it("should debounce error handling", () => {
			const { result } = renderHook(() => useDebouncedError(300));

			act(() => {
				result.current.debouncedHandleError(new Error("First error"));
				result.current.debouncedHandleError(new Error("Second error"));
				result.current.debouncedHandleError(new Error("Third error"));
			});

			expect(result.current.debouncedError).toBeNull();

			act(() => {
				vi.advanceTimersByTime(300);
			});

			expect(result.current.debouncedError).toBeInstanceOf(AppError);
			expect(result.current.debouncedError?.originalError?.message).toBe(
				"Third error",
			);
		});

		it("should use custom delay", () => {
			const { result } = renderHook(() => useDebouncedError(500));

			act(() => {
				result.current.debouncedHandleError(new Error("Test error"));
			});

			act(() => {
				vi.advanceTimersByTime(400);
			});

			expect(result.current.debouncedError).toBeNull();

			act(() => {
				vi.advanceTimersByTime(100);
			});

			expect(result.current.debouncedError).not.toBeNull();
		});

		it("should return cleanup function", () => {
			const { result } = renderHook(() => useDebouncedError(300));

			const cleanup = result.current.debouncedHandleError(
				new Error("Test error"),
			);

			expect(typeof cleanup).toBe("function");

			act(() => {
				cleanup();
			});

			act(() => {
				vi.advanceTimersByTime(300);
			});

			expect(result.current.debouncedError).toBeNull();
		});
	});

	describe("Error Context", () => {
		it("should include context in debounced errors", () => {
			const { result } = renderHook(() => useDebouncedError(100));

			act(() => {
				result.current.debouncedHandleError(new Error("Test error"), {
					component: "test-component",
					action: "validation",
				});
			});

			act(() => {
				vi.advanceTimersByTime(100);
			});

			expect(result.current.debouncedError?.context).toMatchObject({
				component: "test-component",
				action: "validation",
			});
		});
	});

	describe("Clear Functionality", () => {
		it("should clear debounced error", () => {
			const { result } = renderHook(() => useDebouncedError(100));

			act(() => {
				result.current.debouncedHandleError(new Error("Test error"));
			});

			act(() => {
				vi.advanceTimersByTime(100);
			});

			expect(result.current.debouncedError).not.toBeNull();

			act(() => {
				result.current.clearDebouncedError();
			});

			expect(result.current.debouncedError).toBeNull();
		});
	});

	describe("Toast Suppression", () => {
		it("should not show toast notifications", () => {
			const { result } = renderHook(() => useDebouncedError(100));

			act(() => {
				result.current.debouncedHandleError(new Error("Test error"));
			});

			act(() => {
				vi.advanceTimersByTime(100);
			});

			expect(mockToast.error).not.toHaveBeenCalled();
		});
	});
});

describe("Hook Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("should work together in complex scenarios", async () => {
		// Simulate a component using multiple hooks
		const { result } = renderHook(() => {
			const errorHandler = useErrorHandler({ showToast: false });
			const apiCall = useApiCall({ showToast: false });
			const debouncedError = useDebouncedError(100);

			return { errorHandler, apiCall, debouncedError };
		});

		// Test error propagation
		const apiError = new Error("API failure");
		const failingApiCall = vi.fn().mockRejectedValue(apiError);

		await act(async () => {
			await result.current.apiCall.call(failingApiCall);
		});

		expect(result.current.apiCall.error).toBeInstanceOf(AppError);

		// Test manual error handling
		act(() => {
			if (result.current.apiCall.error) {
				result.current.errorHandler.handleError(result.current.apiCall.error);
			}
		});

		expect(result.current.errorHandler.hasError).toBe(true);

		// Test debounced error
		act(() => {
			result.current.debouncedError.debouncedHandleError(
				new Error("Validation error"),
			);
		});

		act(() => {
			vi.advanceTimersByTime(100);
		});

		expect(result.current.debouncedError.debouncedError).toBeInstanceOf(
			AppError,
		);
	});

	it("should handle memory cleanup properly", () => {
		const { unmount } = renderHook(() => {
			const errorHandler = useErrorHandler();
			const apiCall = useApiCall();
			const debouncedError = useDebouncedError(1000);

			// Trigger some operations that create timers
			debouncedError.debouncedHandleError(new Error("Test"));

			return { errorHandler, apiCall, debouncedError };
		});

		// Unmount should not cause memory leaks
		expect(() => unmount()).not.toThrow();
	});

	it("should handle concurrent error scenarios", async () => {
		const { result } = renderHook(() => {
			const asyncOp1 = useAsyncOperation(
				() => Promise.reject(new Error("Op1 Error")),
				{ retryAttempts: 1, retryDelay: 50 },
			);
			const asyncOp2 = useAsyncOperation(
				() => Promise.reject(new Error("Op2 Error")),
				{ retryAttempts: 1, retryDelay: 50 },
			);

			return { asyncOp1, asyncOp2 };
		});

		// Execute both operations concurrently
		const [result1, result2] = await act(async () => {
			const promise1 = result.current.asyncOp1.execute();
			const promise2 = result.current.asyncOp2.execute();

			vi.advanceTimersByTime(100);

			return Promise.all([promise1, promise2]);
		});

		expect(result1).toBeNull();
		expect(result2).toBeNull();
		expect(result.current.asyncOp1.hasError).toBe(true);
		expect(result.current.asyncOp2.hasError).toBe(true);
	});
});
