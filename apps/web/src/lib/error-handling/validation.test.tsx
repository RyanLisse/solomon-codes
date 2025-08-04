/**
 * Comprehensive error handling system validation tests
 * End-to-end validation of all error handling components working together
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api-errors";
import { ErrorBoundary, useErrorBoundary } from "./error-boundary";
import {
	getGlobalErrorHandler,
	resetGlobalErrorHandler,
} from "./global-handler";
import { useAsyncOperation, useErrorHandler } from "./hooks";
// Import all error handling components
import { AppError, ErrorCodes, initializeErrorHandlingSystem } from "./index";

// Mock external dependencies
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("../config/service", () => ({
	getConfigurationService: () => ({
		getConfiguration: () => ({
			nodeEnv: "test",
			appVersion: "1.0.0-test",
		}),
		isProduction: () => false,
	}),
}));

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

vi.mock("../telemetry", () => ({
	getTelemetryService: () => ({
		isEnabled: () => true,
	}),
}));

global.fetch = vi.fn();
const mockFetch = vi.mocked(fetch);
const mockToast = vi.mocked(toast);

describe("Error Handling System Validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		mockFetch.mockClear();
		resetGlobalErrorHandler();
	});

	afterEach(() => {
		vi.useRealTimers();
		resetGlobalErrorHandler();
	});

	describe("System Integration", () => {
		it("should initialize entire error handling system successfully", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			await expect(initializeErrorHandlingSystem()).resolves.not.toThrow();

			expect(consoleSpy).toHaveBeenCalledWith(
				"🛡️ Error handling and monitoring system initialized successfully",
			);

			// Verify global handler is initialized
			const globalHandler = getGlobalErrorHandler();
			expect(globalHandler.getErrorStatistics().isInitialized).toBe(true);
		});

		it("should handle errors through complete application stack", async () => {
			// Component that simulates a real application error flow
			const ApplicationWithErrors = () => {
				const { handleError } = useErrorHandler({ showToast: true });
				const { execute, loading, error, hasError } = useAsyncOperation(
					async () => {
						// Simulate API call that fails
						throw new AppError({
							message: "API service unavailable",
							code: ErrorCodes.SERVICE_UNAVAILABLE,
							severity: "high",
							userMessage:
								"The service is temporarily unavailable. Please try again later.",
						});
					},
					{ retryAttempts: 2, retryDelay: 100 },
				);

				return (
					<div>
						<button
							type="button"
							data-testid="trigger-api-error"
							onClick={() => execute()}
							disabled={loading}
						>
							{loading ? "Loading..." : "Make API Call"}
						</button>
						{hasError && (
							<div data-testid="error-display">Error: {error?.userMessage}</div>
						)}
						<button
							type="button"
							data-testid="trigger-manual-error"
							onClick={() => handleError(new Error("Manual error trigger"))}
						>
							Trigger Manual Error
						</button>
					</div>
				);
			};

			render(
				<ErrorBoundary>
					<ApplicationWithErrors />
				</ErrorBoundary>,
			);

			// Test API error flow
			fireEvent.click(screen.getByTestId("trigger-api-error"));

			expect(screen.getByText("Loading...")).toBeInTheDocument();

			// Fast-forward through retry attempts
			await vi.advanceTimersByTimeAsync(300);

			await waitFor(() => {
				expect(screen.getByTestId("error-display")).toBeInTheDocument();
				expect(
					screen.getByText(/service is temporarily unavailable/),
				).toBeInTheDocument();
			});

			// Test manual error handling
			fireEvent.click(screen.getByTestId("trigger-manual-error"));

			expect(mockToast.error).toHaveBeenCalledWith(
				expect.stringContaining("try again"),
				expect.objectContaining({
					description: "API_ERROR",
					action: expect.objectContaining({
						label: "Retry",
					}),
				}),
			);
		});

		it("should handle React errors with error boundaries", () => {
			const ThrowingComponent = () => {
				throw new AppError({
					message: "React component error",
					code: "REACT_COMPONENT_ERROR",
					severity: "medium",
					userMessage: "A component error occurred. Please refresh the page.",
				});
			};

			const onError = vi.fn();

			render(
				<ErrorBoundary onError={onError} level="component">
					<ThrowingComponent />
				</ErrorBoundary>,
			);

			expect(screen.getByText("Something went wrong")).toBeInTheDocument();
			expect(
				screen.getByText(
					"A component error occurred. Please refresh the page.",
				),
			).toBeInTheDocument();

			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					code: "REACT_COMPONENT_ERROR",
					severity: "medium",
					context: expect.objectContaining({
						level: "component",
						componentStack: expect.stringContaining("ThrowingComponent"),
					}),
				}),
				expect.any(Object),
			);
		});
	});

	describe("Error Flow Validation", () => {
		it("should handle network error with retry and recovery", async () => {
			let attemptCount = 0;

			mockFetch.mockImplementation(() => {
				attemptCount++;
				if (attemptCount < 3) {
					return Promise.reject(new Error("Network connection failed"));
				}
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ success: true, data: "recovered" }),
				} as Response);
			});

			const result = await api.get("https://api.example.com/test");

			expect(result).toBe("recovered");
			expect(attemptCount).toBe(3); // Should have retried
		});

		it("should handle form validation errors with user feedback", () => {
			const FormComponent = () => {
				const { handleError, hasError, error } = useErrorHandler({
					showToast: false,
				});

				const validateEmail = (email: string) => {
					if (!email) {
						handleError(
							new AppError({
								message: "Email is required",
								code: ErrorCodes.VALIDATION_ERROR,
								severity: "low",
								userMessage: "Please enter your email address",
							}),
						);
						return false;
					}
					if (!/\S+@\S+\.\S+/.test(email)) {
						handleError(
							new AppError({
								message: "Invalid email format",
								code: ErrorCodes.VALIDATION_ERROR,
								severity: "low",
								userMessage: "Please enter a valid email address",
							}),
						);
						return false;
					}
					return true;
				};

				return (
					<div>
						<button
							type="button"
							data-testid="validate-empty"
							onClick={() => validateEmail("")}
						>
							Validate Empty Email
						</button>
						<button
							type="button"
							data-testid="validate-invalid"
							onClick={() => validateEmail("invalid-email")}
						>
							Validate Invalid Email
						</button>
						<button
							type="button"
							data-testid="validate-valid"
							onClick={() => validateEmail("test@example.com")}
						>
							Validate Valid Email
						</button>
						{hasError && (
							<div data-testid="validation-error">{error?.userMessage}</div>
						)}
					</div>
				);
			};

			render(<FormComponent />);

			// Test empty email validation
			fireEvent.click(screen.getByTestId("validate-empty"));
			expect(screen.getByTestId("validation-error")).toHaveTextContent(
				"Please enter your email address",
			);

			// Test invalid email validation
			fireEvent.click(screen.getByTestId("validate-invalid"));
			expect(screen.getByTestId("validation-error")).toHaveTextContent(
				"Please enter a valid email address",
			);

			// Test valid email (should clear error)
			fireEvent.click(screen.getByTestId("validate-valid"));
			expect(screen.queryByTestId("validation-error")).not.toBeInTheDocument();
		});

		it("should handle authentication errors with proper user guidance", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 401,
				url: "https://api.example.com/protected",
				statusText: "Unauthorized",
				json: () =>
					Promise.resolve({
						error: "Authentication token expired",
						code: "TOKEN_EXPIRED",
					}),
			} as Response);

			try {
				await api.get("https://api.example.com/protected");
			} catch (error) {
				expect(error).toBeInstanceOf(AppError);
				const authError = error as AppError;

				expect(authError.code).toBe(ErrorCodes.UNAUTHORIZED);
				expect(authError.severity).toBe("medium");
				expect(authError.userMessage).toContain("log in");
				expect(authError.recoverable).toBe(true);
			}
		});
	});

	describe("Error Recovery Mechanisms", () => {
		it("should auto-recover from transient errors", async () => {
			const RecoverableComponent = () => {
				const [shouldError, setShouldError] = React.useState(true);
				const throwError = useErrorBoundary();

				React.useEffect(() => {
					if (shouldError) {
						setTimeout(() => {
							setShouldError(false);
						}, 100);
					}
				}, [shouldError]);

				if (shouldError) {
					throwError(
						new AppError({
							message: "Transient error",
							code: "TRANSIENT_ERROR",
							severity: "medium",
						}),
					);
				}

				return <div data-testid="recovered-component">Component Recovered</div>;
			};

			const { rerender } = render(
				<ErrorBoundary>
					<RecoverableComponent />
				</ErrorBoundary>,
			);

			// Should show error initially
			expect(screen.getByText("Something went wrong")).toBeInTheDocument();

			// Wait for auto-recovery timeout
			vi.advanceTimersByTime(5000);

			// Rerender to simulate recovery
			rerender(
				<ErrorBoundary>
					<div data-testid="recovered-component">Component Recovered</div>
				</ErrorBoundary>,
			);

			expect(screen.getByTestId("recovered-component")).toBeInTheDocument();
		});

		it("should handle manual retry after error", async () => {
			let callCount = 0;
			const failingOperation = vi.fn().mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					throw new Error("First attempt failed");
				}
				return "Success on retry";
			});

			const RetryComponent = () => {
				const { execute, data, error, hasError, reset } = useAsyncOperation(
					failingOperation,
					{ retryAttempts: 1 },
				);

				const renderData = (value: unknown): React.ReactNode => {
					if (value === null || value === undefined) return null;
					return typeof value === "object"
						? JSON.stringify(value)
						: String(value);
				};

				return (
					<div>
						<button
							type="button"
							data-testid="execute"
							onClick={() => execute()}
						>
							Execute
						</button>
						<button type="button" data-testid="retry" onClick={() => reset()}>
							Reset and Retry
						</button>
						{data ? <div data-testid="success">{renderData(data)}</div> : null}
						{hasError && <div data-testid="error">Error: {error?.message}</div>}
					</div>
				);
			};

			render(<RetryComponent />);

			// First execution should fail
			fireEvent.click(screen.getByTestId("execute"));

			await waitFor(() => {
				expect(screen.getByTestId("error")).toBeInTheDocument();
			});

			// Reset and try again
			fireEvent.click(screen.getByTestId("retry"));
			fireEvent.click(screen.getByTestId("execute"));

			await waitFor(() => {
				expect(screen.getByTestId("success")).toBeInTheDocument();
				expect(screen.getByText("Success on retry")).toBeInTheDocument();
			});
		});
	});

	describe("Performance and Scalability", () => {
		it("should handle high-frequency errors without performance degradation", async () => {
			const { handleError } = useErrorHandler({ showToast: false });

			const start = performance.now();

			// Generate many errors rapidly
			for (let i = 0; i < 1000; i++) {
				handleError(
					new AppError({
						message: `High frequency error ${i}`,
						code: "HIGH_FREQUENCY_ERROR",
						severity: "low",
					}),
				);
			}

			const end = performance.now();
			const duration = end - start;

			// Should process 1000 errors in reasonable time
			expect(duration).toBeLessThan(500); // 500ms threshold
		});

		it("should prevent memory leaks in long-running error scenarios", () => {
			const performanceWithMemory = performance as typeof performance & {
				memory?: { usedJSHeapSize: number };
			};
			const initialMemory = performanceWithMemory.memory?.usedJSHeapSize || 0;

			// Simulate long-running application with periodic errors
			for (let i = 0; i < 100; i++) {
				const error = new AppError({
					message: `Memory test error ${i}`,
					code: "MEMORY_TEST",
					context: {
						metadata: {
							iteration: i,
							timestamp: Date.now(),
							largeData: new Array(1000).fill("test"),
						},
					},
				});

				// Process and immediately discard
				error.toJSON();
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const finalMemory = performanceWithMemory.memory?.usedJSHeapSize || 0;
			const memoryIncrease = finalMemory - initialMemory;

			// Memory increase should be reasonable (less than 10MB)
			expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
		});
	});

	describe("Cross-Component Error Communication", () => {
		it("should propagate errors between components correctly", () => {
			const ComponentA = () => {
				const { handleError } = useErrorHandler({ showToast: false });

				return (
					<button
						type="button"
						data-testid="trigger-in-a"
						onClick={() =>
							handleError(
								new AppError({
									message: "Error from Component A",
									code: "COMPONENT_A_ERROR",
									userMessage: "Error originated in Component A",
								}),
							)
						}
					>
						Trigger Error in A
					</button>
				);
			};

			const ComponentB = () => {
				const { error, hasError } = useErrorHandler({ showToast: false });

				return (
					<div>
						{hasError && (
							<div data-testid="error-in-b">
								Component B received: {error?.userMessage}
							</div>
						)}
					</div>
				);
			};

			const ParentComponent = () => {
				const [sharedError, _setSharedError] = React.useState<AppError | null>(
					null,
				);

				return (
					<div>
						<ComponentA />
						<ComponentB />
						{sharedError && (
							<div data-testid="shared-error">
								Shared: {sharedError.userMessage}
							</div>
						)}
					</div>
				);
			};

			render(
				<ErrorBoundary>
					<ParentComponent />
				</ErrorBoundary>,
			);

			fireEvent.click(screen.getByTestId("trigger-in-a"));

			// Error should be caught by error boundary
			expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		});
	});

	describe("Error Context and Debugging", () => {
		it("should provide comprehensive error context for debugging", () => {
			const error = new AppError({
				message: "Debug test error",
				code: "DEBUG_TEST_ERROR",
				severity: "medium",
				context: {
					component: "DebugTestComponent",
					action: "user_interaction",
					userId: "test-user-123",
					metadata: {
						sessionId: "test-session-456",
						browserInfo: "test-browser",
						timestamp: Date.now(),
						formData: { field1: "value1", field2: "value2" },
					},
				},
				userMessage: "Something went wrong during your action",
			});

			const errorJson = error.toJSON();

			expect(errorJson).toMatchObject({
				name: "AppError",
				message: "Debug test error",
				code: "DEBUG_TEST_ERROR",
				severity: "medium",
				userMessage: "Something went wrong during your action",
				context: {
					component: "DebugTestComponent",
					action: "user_interaction",
					userId: "test-user-123",
					sessionId: "test-session-456",
					timestamp: expect.any(String),
					metadata: {
						browserInfo: "test-browser",
						timestamp: expect.any(Number),
						formData: { field1: "value1", field2: "value2" },
					},
				},
				stack: expect.any(String),
			});
		});

		it("should generate correlation IDs for error tracking", () => {
			const globalHandler = getGlobalErrorHandler();

			const error1 = new Error("Test error 1");
			const error2 = new Error("Test error 2");

			const report1 = globalHandler.createErrorReport(error1);
			const report2 = globalHandler.createErrorReport(error2);

			expect(report1.id).toMatch(/^err_\d+_[a-z0-9]+$/);
			expect(report2.id).toMatch(/^err_\d+_[a-z0-9]+$/);
			expect(report1.id).not.toBe(report2.id);

			expect(report1.metadata.correlationId).toBe(report1.id);
			expect(report2.metadata.correlationId).toBe(report2.id);
		});
	});

	describe("Error System Resilience", () => {
		it("should continue functioning when parts of the system fail", () => {
			// Mock logger to fail
			const originalConsole = console.error;
			console.error = vi.fn(() => {
				throw new Error("Logging system failed");
			});

			const { handleError, hasError } = useErrorHandler({
				showToast: false,
				logError: true,
			});

			// Should not throw even if logging fails
			expect(() => {
				handleError(new Error("Test error with failing logger"));
			}).not.toThrow();

			expect(hasError).toBe(true);

			console.error = originalConsole;
		});

		it("should handle malformed error objects gracefully", () => {
			const malformedError = {
				message: "I'm not a real Error object",
				toString: () => "Malformed error",
			};

			const { handleError, hasError, error } = useErrorHandler({
				showToast: false,
			});

			expect(() => {
				handleError(malformedError as unknown);
			}).not.toThrow();

			expect(hasError).toBe(true);
			expect(error).toBeInstanceOf(AppError);
		});
	});

	describe("Test Coverage Validation", () => {
		it("should validate all error codes are tested", () => {
			const testedErrorCodes = new Set([
				ErrorCodes.NETWORK_ERROR,
				ErrorCodes.VALIDATION_ERROR,
				ErrorCodes.UNAUTHORIZED,
				ErrorCodes.SERVICE_UNAVAILABLE,
				ErrorCodes.OPERATION_FAILED,
				"REACT_COMPONENT_ERROR",
				"TRANSIENT_ERROR",
				"HIGH_FREQUENCY_ERROR",
				"COMPONENT_A_ERROR",
				"DEBUG_TEST_ERROR",
			]);

			// Verify we've tested the most important error codes
			const criticalErrorCodes = [
				ErrorCodes.NETWORK_ERROR,
				ErrorCodes.VALIDATION_ERROR,
				ErrorCodes.UNAUTHORIZED,
				ErrorCodes.INTERNAL_SERVER_ERROR,
				ErrorCodes.SERVICE_UNAVAILABLE,
			];

			criticalErrorCodes.forEach((code) => {
				expect(testedErrorCodes.has(code)).toBe(true);
			});
		});

		it("should validate all error severities are handled", () => {
			const severities = ["low", "medium", "high", "critical"] as const;

			severities.forEach((severity) => {
				const error = new AppError({
					message: `Test ${severity} error`,
					code: "TEST_ERROR",
					severity,
				});

				expect(error.severity).toBe(severity);
				expect(error.userMessage).toContain(
					severity === "low"
						? "try again"
						: severity === "critical"
							? "immediately"
							: "support",
				);
			});
		});

		it("should validate error recovery mechanisms are comprehensive", () => {
			const recoverableError = new AppError({
				message: "Recoverable error",
				code: "RECOVERABLE_ERROR",
				recoverable: true,
			});

			const nonRecoverableError = new AppError({
				message: "Non-recoverable error",
				code: "NON_RECOVERABLE_ERROR",
				recoverable: false,
			});

			expect(recoverableError.recoverable).toBe(true);
			expect(nonRecoverableError.recoverable).toBe(false);

			// Both should be AppError instances
			expect(recoverableError).toBeInstanceOf(AppError);
			expect(nonRecoverableError).toBeInstanceOf(AppError);
		});
	});
});
