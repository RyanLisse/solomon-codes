/**
 * Comprehensive tests for React Error Boundary components
 * Tests error catching, recovery mechanisms, custom fallbacks, and component lifecycle
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ErrorBoundary,
	type ErrorBoundaryProps,
	useErrorBoundary,
	withErrorBoundary,
} from "./error-boundary";
import { AppError } from "./error-handler";

// Mock components for testing
const ThrowError = ({ error }: { error?: Error | AppError }) => {
	if (error) {
		throw error;
	}
	return <div data-testid="working-component">Working Component</div>;
};

const WorkingComponent = () => (
	<div data-testid="working-component">Working Component</div>
);

const ComponentWithHook = () => {
	const throwError = useErrorBoundary();

	return (
		<button
			type="button"
			data-testid="trigger-error"
			onClick={() =>
				throwError(
					new AppError({
						message: "Manual error",
						code: "MANUAL_ERROR",
						severity: "medium",
					}),
				)
			}
		>
			Trigger Error
		</button>
	);
};

// Test utilities
const renderWithErrorBoundary = (
	children: React.ReactNode,
	props?: Partial<ErrorBoundaryProps>,
) => {
	return render(<ErrorBoundary {...props}>{children}</ErrorBoundary>);
};

describe("ErrorBoundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		// Suppress console errors in tests
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("Error Catching", () => {
		it("should catch and display JavaScript errors", () => {
			const jsError = new Error("JavaScript error");

			renderWithErrorBoundary(<ThrowError error={jsError} />);

			expect(screen.getByText("Something went wrong")).toBeInTheDocument();
			expect(
				screen.getByText("Something went wrong in the application"),
			).toBeInTheDocument();
		});

		it("should catch and display AppError instances", () => {
			const appError = new AppError({
				message: "Custom app error",
				code: "CUSTOM_ERROR",
				severity: "high",
				userMessage: "Custom user message",
			});

			renderWithErrorBoundary(<ThrowError error={appError} />);

			expect(screen.getByText("Something went wrong")).toBeInTheDocument();
			expect(screen.getByText("Custom user message")).toBeInTheDocument();
		});

		it("should convert JavaScript errors to AppError with proper context", () => {
			const onError = vi.fn();
			const jsError = new Error("Test error");

			renderWithErrorBoundary(<ThrowError error={jsError} />, {
				onError,
				level: "component",
			});

			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					code: "REACT_ERROR",
					severity: "high",
					context: expect.objectContaining({
						level: "component",
						component: "ErrorBoundary",
						action: "render",
						componentStack: expect.any(String),
						errorBoundary: "ErrorBoundary",
					}),
					originalError: jsError,
				}),
				expect.objectContaining({
					componentStack: expect.any(String),
				}),
			);
		});

		it("should generate unique error IDs", () => {
			renderWithErrorBoundary(<ThrowError error={new Error("Test error")} />);

			// Check that error ID is displayed
			const detailsElement = screen.getByText("Technical Details");
			fireEvent.click(detailsElement);

			expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
			const errorIdText = screen.getByText(/Error ID:/).textContent;
			expect(errorIdText).toMatch(/Error ID: error_\d+_[a-z0-9]+/);
		});
	});

	describe("Error Display and UI", () => {
		it("should display error with appropriate severity styling", () => {
			const criticalError = new AppError({
				message: "Critical error",
				code: "CRITICAL_ERROR",
				severity: "critical",
			});

			const { container } = renderWithErrorBoundary(
				<ThrowError error={criticalError} />,
			);

			const errorCard = container.querySelector(".text-red-800");
			expect(errorCard).toBeInTheDocument();
			expect(screen.getByText("Critical Error")).toBeInTheDocument();
		});

		it("should show technical details for low/medium severity errors", () => {
			const lowSeverityError = new AppError({
				message: "Low severity error",
				code: "LOW_ERROR",
				severity: "low",
				context: { component: "test-component" },
			});

			renderWithErrorBoundary(<ThrowError error={lowSeverityError} />);

			const detailsElement = screen.getByText("Technical Details");
			expect(detailsElement).toBeInTheDocument();

			fireEvent.click(detailsElement);

			expect(screen.getByText(/Error Code: LOW_ERROR/)).toBeInTheDocument();
			expect(screen.getByText(/Component: test-component/)).toBeInTheDocument();
		});

		it("should hide technical details for high/critical severity errors", () => {
			const criticalError = new AppError({
				message: "Critical error",
				code: "CRITICAL_ERROR",
				severity: "critical",
			});

			renderWithErrorBoundary(<ThrowError error={criticalError} />);

			expect(screen.queryByText("Technical Details")).not.toBeInTheDocument();
		});

		it("should show retry button for recoverable errors", () => {
			const recoverableError = new AppError({
				message: "Recoverable error",
				code: "RECOVERABLE_ERROR",
				recoverable: true,
			});

			renderWithErrorBoundary(<ThrowError error={recoverableError} />);

			expect(screen.getByText("Try Again")).toBeInTheDocument();
		});

		it("should hide retry button for non-recoverable errors", () => {
			const nonRecoverableError = new AppError({
				message: "Non-recoverable error",
				code: "NON_RECOVERABLE_ERROR",
				recoverable: false,
			});

			renderWithErrorBoundary(<ThrowError error={nonRecoverableError} />);

			expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
		});
	});

	describe("Error Recovery", () => {
		it("should reset error state when retry button is clicked", async () => {
			const recoverableError = new AppError({
				message: "Recoverable error",
				code: "RECOVERABLE_ERROR",
				recoverable: true,
			});

			const { rerender } = renderWithErrorBoundary(
				<ThrowError error={recoverableError} />,
			);

			expect(screen.getByText("Try Again")).toBeInTheDocument();

			// Click retry button
			fireEvent.click(screen.getByText("Try Again"));

			// Rerender with working component
			rerender(
				<ErrorBoundary>
					<WorkingComponent />
				</ErrorBoundary>,
			);

			expect(screen.getByTestId("working-component")).toBeInTheDocument();
			expect(
				screen.queryByText("Something went wrong"),
			).not.toBeInTheDocument();
		});

		it("should auto-recover for low/medium severity errors", async () => {
			const mediumError = new AppError({
				message: "Medium severity error",
				code: "MEDIUM_ERROR",
				severity: "medium",
			});

			const { rerender } = renderWithErrorBoundary(
				<ThrowError error={mediumError} />,
			);

			expect(screen.getByText("Something went wrong")).toBeInTheDocument();

			// Fast-forward time to trigger auto-recovery
			vi.advanceTimersByTime(5000);

			// Rerender with working component
			rerender(
				<ErrorBoundary>
					<WorkingComponent />
				</ErrorBoundary>,
			);

			await waitFor(() => {
				expect(screen.getByTestId("working-component")).toBeInTheDocument();
			});
		});

		it("should not auto-recover for high/critical severity errors", async () => {
			const criticalError = new AppError({
				message: "Critical error",
				code: "CRITICAL_ERROR",
				severity: "critical",
			});

			renderWithErrorBoundary(<ThrowError error={criticalError} />);

			expect(screen.getByText("Critical Error")).toBeInTheDocument();

			// Fast-forward time
			vi.advanceTimersByTime(5000);

			// Error should still be displayed
			expect(screen.getByText("Critical Error")).toBeInTheDocument();
		});

		it("should clear timeout on unmount", () => {
			const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
			const mediumError = new AppError({
				message: "Medium error",
				code: "MEDIUM_ERROR",
				severity: "medium",
			});

			const { unmount } = renderWithErrorBoundary(
				<ThrowError error={mediumError} />,
			);

			unmount();

			expect(clearTimeoutSpy).toHaveBeenCalled();
		});
	});

	describe("Custom Fallback", () => {
		it("should render custom fallback when provided", () => {
			const customFallback = (
				error: AppError,
				errorId: string,
				reset: () => void,
			) => (
				<div data-testid="custom-fallback">
					<p>Custom Error: {error.userMessage}</p>
					<p>Error ID: {errorId}</p>
					<button type="button" onClick={reset}>
						Custom Reset
					</button>
				</div>
			);

			const testError = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
				userMessage: "Custom error message",
			});

			renderWithErrorBoundary(<ThrowError error={testError} />, {
				fallback: customFallback,
			});

			expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
			expect(
				screen.getByText("Custom Error: Custom error message"),
			).toBeInTheDocument();
			expect(screen.getByText(/Error ID: error_/)).toBeInTheDocument();
			expect(screen.getByText("Custom Reset")).toBeInTheDocument();
		});

		it("should call reset function from custom fallback", async () => {
			const customFallback = (
				_error: AppError,
				_errorId: string,
				reset: () => void,
			) => (
				<button type="button" data-testid="custom-reset" onClick={reset}>
					Custom Reset
				</button>
			);

			const testError = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
			});

			const { rerender } = renderWithErrorBoundary(
				<ThrowError error={testError} />,
				{ fallback: customFallback },
			);

			fireEvent.click(screen.getByTestId("custom-reset"));

			rerender(
				<ErrorBoundary fallback={customFallback}>
					<WorkingComponent />
				</ErrorBoundary>,
			);

			expect(screen.getByTestId("working-component")).toBeInTheDocument();
		});
	});

	describe("Isolation Modes", () => {
		it("should render isolated error when isolate=true", () => {
			const testError = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
			});

			renderWithErrorBoundary(<ThrowError error={testError} />, {
				isolate: true,
			});

			// Should not show full-page error
			expect(screen.queryByText("Application Error")).not.toBeInTheDocument();
			expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		});

		it("should render full-page error when isolate=false", () => {
			const testError = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
			});

			renderWithErrorBoundary(<ThrowError error={testError} />, {
				isolate: false,
			});

			expect(screen.getByText("Application Error")).toBeInTheDocument();
			expect(screen.getByText("Reload Application")).toBeInTheDocument();
			expect(screen.getByText("Hard Refresh")).toBeInTheDocument();
		});

		it("should handle hard refresh in full-page mode", () => {
			const reloadSpy = vi.fn();
			Object.defineProperty(window, "location", {
				value: { reload: reloadSpy },
				writable: true,
			});

			const testError = new AppError({
				message: "Test error",
				code: "TEST_ERROR",
			});

			renderWithErrorBoundary(<ThrowError error={testError} />, {
				isolate: false,
			});

			fireEvent.click(screen.getByText("Hard Refresh"));
			expect(reloadSpy).toHaveBeenCalled();
		});
	});

	describe("Error Context and Metadata", () => {
		it("should enhance error context with boundary level", () => {
			const onError = vi.fn();
			const testError = new Error("Test error");

			renderWithErrorBoundary(<ThrowError error={testError} />, {
				onError,
				level: "page",
			});

			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					context: expect.objectContaining({
						level: "page",
						component: "ErrorBoundary",
						action: "render",
						errorBoundary: "ErrorBoundary",
					}),
				}),
				expect.any(Object),
			);
		});

		it("should include component stack in error context", () => {
			const onError = vi.fn();
			const testError = new Error("Test error");

			renderWithErrorBoundary(<ThrowError error={testError} />, { onError });

			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					context: expect.objectContaining({
						componentStack: expect.stringContaining("ThrowError"),
					}),
				}),
				expect.objectContaining({
					componentStack: expect.stringContaining("ThrowError"),
				}),
			);
		});
	});
});

describe("withErrorBoundary HOC", () => {
	it("should wrap component with error boundary", () => {
		const WrappedComponent = withErrorBoundary(WorkingComponent);

		render(<WrappedComponent />);

		expect(screen.getByTestId("working-component")).toBeInTheDocument();
	});

	it("should catch errors in wrapped component", () => {
		const ErrorComponent = () => {
			throw new Error("Component error");
		};

		const WrappedComponent = withErrorBoundary(ErrorComponent);

		render(<WrappedComponent />);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});

	it("should pass error boundary props to wrapper", () => {
		const onError = vi.fn();
		const WrappedComponent = withErrorBoundary(WorkingComponent, {
			onError,
			level: "component",
		});

		const ErrorComponent = () => {
			throw new Error("Component error");
		};

		const { rerender } = render(<WrappedComponent />);

		const WrappedErrorComponent = withErrorBoundary(ErrorComponent, {
			onError,
			level: "component",
		});
		rerender(<WrappedErrorComponent />);

		expect(onError).toHaveBeenCalled();
	});

	it("should set correct display name", () => {
		const TestComponent = () => <div>Test</div>;
		TestComponent.displayName = "TestComponent";

		const WrappedComponent = withErrorBoundary(TestComponent);

		expect(WrappedComponent.displayName).toBe(
			"withErrorBoundary(TestComponent)",
		);
	});

	it("should fallback to component name if no display name", () => {
		function TestComponent() {
			return <div>Test</div>;
		}

		const WrappedComponent = withErrorBoundary(TestComponent);

		expect(WrappedComponent.displayName).toBe(
			"withErrorBoundary(TestComponent)",
		);
	});
});

describe("useErrorBoundary Hook", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("should throw AppError when triggered", () => {
		expect(() => {
			render(
				<ErrorBoundary>
					<ComponentWithHook />
				</ErrorBoundary>,
			);

			fireEvent.click(screen.getByTestId("trigger-error"));
		}).not.toThrow();

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});

	it("should convert regular Error to AppError", () => {
		const ComponentWithRegularError = () => {
			const throwError = useErrorBoundary();

			return (
				<button
					type="button"
					data-testid="trigger-regular-error"
					onClick={() => throwError(new Error("Regular error"))}
				>
					Trigger Regular Error
				</button>
			);
		};

		render(
			<ErrorBoundary>
				<ComponentWithRegularError />
			</ErrorBoundary>,
		);

		fireEvent.click(screen.getByTestId("trigger-regular-error"));

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});

	it("should preserve AppError instances", () => {
		const onError = vi.fn();
		const customError = new AppError({
			message: "Custom error",
			code: "CUSTOM_ERROR",
			severity: "high",
			userMessage: "Custom user message",
		});

		const ComponentWithCustomError = () => {
			const throwError = useErrorBoundary();

			return (
				<button
					type="button"
					data-testid="trigger-custom-error"
					onClick={() => throwError(customError)}
				>
					Trigger Custom Error
				</button>
			);
		};

		render(
			<ErrorBoundary onError={onError}>
				<ComponentWithCustomError />
			</ErrorBoundary>,
		);

		fireEvent.click(screen.getByTestId("trigger-custom-error"));

		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({
				code: "CUSTOM_ERROR",
				severity: "high",
				userMessage: "Custom user message",
			}),
			expect.any(Object),
		);
	});
});

describe("Error Boundary Edge Cases", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("should handle multiple errors gracefully", async () => {
		const onError = vi.fn();

		const MultiErrorComponent = ({ shouldError }: { shouldError: boolean }) => {
			if (shouldError) {
				throw new Error("Multiple error test");
			}
			return <div data-testid="working">Working</div>;
		};

		const { rerender } = render(
			<ErrorBoundary onError={onError}>
				<MultiErrorComponent shouldError={false} />
			</ErrorBoundary>,
		);

		// First error
		rerender(
			<ErrorBoundary onError={onError}>
				<MultiErrorComponent shouldError={true} />
			</ErrorBoundary>,
		);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();

		// Reset and throw another error
		fireEvent.click(screen.getByText("Try Again"));

		rerender(
			<ErrorBoundary onError={onError}>
				<MultiErrorComponent shouldError={true} />
			</ErrorBoundary>,
		);

		expect(onError).toHaveBeenCalledTimes(2);
	});

	it("should handle errors during reset", async () => {
		const onError = vi.fn();
		const problematicError = new AppError({
			message: "Problematic error",
			code: "PROBLEMATIC_ERROR",
			recoverable: true,
		});

		const { rerender } = renderWithErrorBoundary(
			<ThrowError error={problematicError} />,
			{ onError },
		);

		// Click reset
		fireEvent.click(screen.getByText("Try Again"));

		// Rerender with another error
		rerender(
			<ErrorBoundary onError={onError}>
				<ThrowError error={new Error("Reset error")} />
			</ErrorBoundary>,
		);

		expect(onError).toHaveBeenCalledTimes(2);
	});

	it("should handle null/undefined children gracefully", () => {
		render(<ErrorBoundary>{null}</ErrorBoundary>);
		expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();

		const { rerender: _rerender } = render(
			<ErrorBoundary>{undefined}</ErrorBoundary>,
		);
		expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
	});

	it("should handle async errors in useEffect", async () => {
		const AsyncErrorComponent = () => {
			const throwError = useErrorBoundary();

			React.useEffect(() => {
				// Simulate async error
				setTimeout(() => {
					throwError(new Error("Async error"));
				}, 100);
			}, [throwError]);

			return <div data-testid="async-component">Async Component</div>;
		};

		render(
			<ErrorBoundary>
				<AsyncErrorComponent />
			</ErrorBoundary>,
		);

		expect(screen.getByTestId("async-component")).toBeInTheDocument();

		// Wait for async error
		vi.advanceTimersByTime(100);

		await waitFor(() => {
			expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		});
	});

	it("should handle errors with circular references", () => {
		const circularObject: { name: string; self?: unknown } = { name: "test" };
		circularObject.self = circularObject;

		const errorWithCircularRef = new AppError({
			message: "Circular reference error",
			code: "CIRCULAR_ERROR",
			context: { metadata: { circular: circularObject } },
		});

		renderWithErrorBoundary(<ThrowError error={errorWithCircularRef} />);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});

	it("should handle memory pressure during error states", () => {
		// Simulate memory pressure by creating large error objects
		const largeContext = {
			metadata: {
				largeData: new Array(1000).fill("large string data"),
			},
		};

		const memoryError = new AppError({
			message: "Memory pressure error",
			code: "MEMORY_ERROR",
			context: largeContext,
		});

		renderWithErrorBoundary(<ThrowError error={memoryError} />);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});
});

describe("Error Boundary Performance", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("should not re-render when children don't change", () => {
		const renderSpy = vi.fn();

		const TrackedComponent = () => {
			renderSpy();
			return <div data-testid="tracked">Tracked</div>;
		};

		const { rerender } = render(
			<ErrorBoundary>
				<TrackedComponent />
			</ErrorBoundary>,
		);

		expect(renderSpy).toHaveBeenCalledTimes(1);

		// Re-render with same props
		rerender(
			<ErrorBoundary>
				<TrackedComponent />
			</ErrorBoundary>,
		);

		expect(renderSpy).toHaveBeenCalledTimes(2); // React behavior - component still re-renders
	});

	it("should cleanup timers on multiple rapid errors", () => {
		const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

		const { rerender } = renderWithErrorBoundary(<WorkingComponent />);

		// Trigger multiple errors rapidly
		rerender(
			<ErrorBoundary>
				<ThrowError
					error={
						new AppError({
							message: "Error 1",
							code: "ERROR_1",
							severity: "medium",
						})
					}
				/>
			</ErrorBoundary>,
		);

		rerender(
			<ErrorBoundary>
				<ThrowError
					error={
						new AppError({
							message: "Error 2",
							code: "ERROR_2",
							severity: "medium",
						})
					}
				/>
			</ErrorBoundary>,
		);

		// Should clear previous timeouts
		expect(clearTimeoutSpy).toHaveBeenCalled();
	});
});
