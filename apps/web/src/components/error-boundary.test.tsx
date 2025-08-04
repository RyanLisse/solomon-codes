import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ErrorBoundary,
	useErrorHandler,
	withErrorBoundary,
} from "./error-boundary";

// Create persistent mock instances
const mockLoggerInstance = {
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
};

const mockErrorHandlerInstance = {
	handleError: vi.fn(),
};

// Mock the logging module
vi.mock("@/lib/logging/client", () => ({
	createClientLogger: vi.fn(() => mockLoggerInstance),
	getGlobalClientErrorHandler: vi.fn(() => mockErrorHandlerInstance),
}));

// Create a component that throws an error
function ThrowError({
	shouldThrow,
	message = "Test error",
}: {
	shouldThrow: boolean;
	message?: string;
}) {
	if (shouldThrow) {
		throw new Error(message);
	}
	return <div>No error</div>;
}

// Create a component for testing the useErrorHandler hook
function TestErrorReporter() {
	const { reportError } = useErrorHandler();

	const handleClick = () => {
		reportError(new Error("Manual error report"), { context: "test" });
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			data-testid="report-error-button"
		>
			Report Error
		</button>
	);
}

// Mock window.location.reload at the module level
const mockReload = vi.fn();
Object.defineProperty(window, "location", {
	value: {
		...window.location,
		reload: mockReload,
	},
	writable: true,
});

describe("ErrorBoundary", () => {
	const mockOnError = vi.fn();
	const _mockFallback = vi.fn();
	let mockLogger: typeof mockLoggerInstance;
	let mockErrorHandler: typeof mockErrorHandlerInstance;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Use the persistent mock instances
		mockLogger = mockLoggerInstance;
		mockErrorHandler = mockErrorHandlerInstance;

		// Reset the reload mock
		mockReload.mockClear();

		// Suppress console.error during tests to avoid noise
		vi.spyOn(console, "error").mockImplementation(() => {});

		// Handle uncaught errors that might escape the error boundary during testing
		// This prevents test errors from being treated as uncaught exceptions
		const originalOnError = window.onerror;
		window.onerror = (message, source, lineno, colno, error) => {
			// Only handle errors from our test ThrowError component
			if (error?.message?.includes("Test error")) {
				// Suppress these errors as they're expected in error boundary tests
				return true;
			}
			// Let other errors through
			return originalOnError
				? originalOnError(message, source, lineno, colno, error)
				: false;
		};

		// Handle unhandled promise rejections that might occur during testing
		const originalOnUnhandledRejection = window.onunhandledrejection;
		window.onunhandledrejection = (event) => {
			// Only handle rejections from our test ThrowError component
			if (event.reason?.message?.includes("Test error")) {
				event.preventDefault();
				return;
			}
			// Let other rejections through
			if (originalOnUnhandledRejection) {
				originalOnUnhandledRejection.call(window, event);
			}
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
		// Reset error handlers to prevent side effects between tests
		window.onerror = null;
		window.onunhandledrejection = null;
	});

	it("should render children when no error occurs", () => {
		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={false} />
			</ErrorBoundary>,
		);

		expect(screen.getByText("No error")).toBeInTheDocument();
	});

	it("should render default error fallback when error occurs", () => {
		// Suppress React error boundary warnings in tests
		const originalError = console.error;
		console.error = vi.fn();

		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		expect(
			screen.getByText(/we encountered an unexpected error/i),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /reload page/i }),
		).toBeInTheDocument();

		console.error = originalError;
	});

	it("should call onError callback when error occurs", () => {
		render(
			<ErrorBoundary onError={mockOnError}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		expect(mockOnError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				componentStack: expect.any(String),
			}),
		);
	});

	it("should use custom fallback when provided", () => {
		const customFallback = (
			error: Error,
			errorId: string,
			retry: () => void,
		) => (
			<div data-testid="custom-fallback">
				<p>Custom error: {error.message}</p>
				<p>Error ID: {errorId}</p>
				<button type="button" onClick={retry}>
					Custom Retry
				</button>
			</div>
		);

		render(
			<ErrorBoundary fallback={customFallback}>
				<ThrowError shouldThrow={true} message="Custom error message" />
			</ErrorBoundary>,
		);

		expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
		expect(
			screen.getByText("Custom error: Custom error message"),
		).toBeInTheDocument();
		expect(screen.getByText(/error id:/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /custom retry/i }),
		).toBeInTheDocument();
	});

	it("should handle retry functionality", async () => {
		const user = userEvent.setup();
		let shouldThrow = true;

		function ToggleError() {
			if (shouldThrow) {
				throw new Error("Retry test error");
			}
			return <div>Component recovered</div>;
		}

		render(
			<ErrorBoundary enableRetry={true} maxRetries={2}>
				<ToggleError />
			</ErrorBoundary>,
		);

		// Error should be displayed
		expect(screen.getByText("Something went wrong")).toBeInTheDocument();

		// Fix the error condition
		shouldThrow = false;

		// Click retry button
		const retryButton = screen.getByRole("button", { name: /retry/i });
		await user.click(retryButton);

		// Component should recover
		expect(screen.getByText("Component recovered")).toBeInTheDocument();
	});

	it("should respect maxRetries limit", async () => {
		const user = userEvent.setup();

		render(
			<ErrorBoundary enableRetry={true} maxRetries={2}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		// First retry
		const retryButton = screen.getByRole("button", { name: /retry \(0\/2\)/i });
		await user.click(retryButton);

		// Should show retry count
		expect(
			screen.getByRole("button", { name: /retry \(1\/2\)/i }),
		).toBeInTheDocument();

		// Second retry
		await user.click(screen.getByRole("button", { name: /retry \(1\/2\)/i }));

		// Third retry should be disabled
		expect(
			screen.getByRole("button", { name: /retry \(2\/2\)/i }),
		).toBeInTheDocument();

		// Click again - should not allow more retries
		await user.click(screen.getByRole("button", { name: /retry \(2\/2\)/i }));

		expect(mockLogger.warn).toHaveBeenCalledWith(
			"Maximum retry attempts exceeded",
			expect.objectContaining({
				retryCount: 3,
				maxRetries: 2,
			}),
		);
	});

	it("should disable retry when enableRetry is false", () => {
		render(
			<ErrorBoundary enableRetry={false}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		expect(
			screen.queryByRole("button", { name: /retry/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /reload page/i }),
		).toBeInTheDocument();
	});

	it("should handle reload page functionality", async () => {
		const user = userEvent.setup();

		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		const reloadButton = screen.getByRole("button", { name: /reload page/i });
		await user.click(reloadButton);

		expect(mockReload).toHaveBeenCalled();
	});

	it("should reset on resetKeys change", () => {
		const { rerender } = render(
			<ErrorBoundary resetKeys={["key1"]}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		// Error should be displayed
		expect(screen.getByText("Something went wrong")).toBeInTheDocument();

		// Change resetKeys
		rerender(
			<ErrorBoundary resetKeys={["key2"]}>
				<ThrowError shouldThrow={false} />
			</ErrorBoundary>,
		);

		// Should recover
		expect(screen.getByText("No error")).toBeInTheDocument();
	});

	it("should reset on props change when resetOnPropsChange is true", () => {
		const { rerender } = render(
			<ErrorBoundary resetOnPropsChange={true} maxRetries={3}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		// Error should be displayed
		expect(screen.getByText("Something went wrong")).toBeInTheDocument();

		// Change props
		rerender(
			<ErrorBoundary resetOnPropsChange={true} maxRetries={5}>
				<ThrowError shouldThrow={false} />
			</ErrorBoundary>,
		);

		// Should recover
		expect(screen.getByText("No error")).toBeInTheDocument();
	});

	it("should display technical details when expanded", async () => {
		const user = userEvent.setup();

		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} message="Detailed error message" />
			</ErrorBoundary>,
		);

		// Technical details should be collapsed initially
		expect(screen.queryByText("Detailed error message")).not.toBeVisible();

		// Click to expand technical details
		const detailsToggle = screen.getByText("Technical Details");
		await user.click(detailsToggle);

		// Should show error details
		expect(screen.getByText("Detailed error message")).toBeInTheDocument();
		expect(screen.getByText(/error id:/i)).toBeInTheDocument();
	});

	it("should log errors properly", () => {
		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} message="Logging test error" />
			</ErrorBoundary>,
		);

		expect(mockLogger.error).toHaveBeenCalledWith(
			"Error boundary caught error",
			expect.objectContaining({
				error: "Logging test error",
				componentStack: expect.any(String),
				retryCount: 0,
				correlationId: expect.any(String),
			}),
		);

		expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				componentStack: expect.any(String),
				errorBoundary: true,
				retryCount: 0,
				errorId: expect.any(String),
			}),
		);
	});

	it("should handle errors in custom error handler gracefully", () => {
		const faultyOnError = vi.fn(() => {
			throw new Error("Error in error handler");
		});

		render(
			<ErrorBoundary onError={faultyOnError}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		expect(faultyOnError).toHaveBeenCalled();
		expect(mockLogger.error).toHaveBeenCalledWith(
			"Error in custom error handler",
			expect.objectContaining({
				handlerError: "Error in error handler",
			}),
		);
	});

	it("should generate unique error IDs", () => {
		const { rerender } = render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		const firstErrorId = screen.getByText(/error id:/i).textContent;

		// Reset and trigger another error
		rerender(
			<ErrorBoundary resetKeys={[1]}>
				<ThrowError shouldThrow={false} />
			</ErrorBoundary>,
		);

		rerender(
			<ErrorBoundary resetKeys={[2]}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		const secondErrorId = screen.getByText(/error id:/i).textContent;

		expect(firstErrorId).not.toBe(secondErrorId);
	});

	describe("withErrorBoundary HOC", () => {
		it("should wrap component with error boundary", () => {
			const TestComponent = ({ shouldThrow }: { shouldThrow: boolean }) => (
				<ThrowError shouldThrow={shouldThrow} />
			);

			const WrappedComponent = withErrorBoundary(TestComponent, {
				enableRetry: false,
			});

			render(<WrappedComponent shouldThrow={true} />);

			expect(screen.getByText("Something went wrong")).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: /retry/i }),
			).not.toBeInTheDocument();
		});

		it("should preserve component display name", () => {
			const TestComponent = () => <div>Test</div>;
			TestComponent.displayName = "TestComponent";

			const WrappedComponent = withErrorBoundary(TestComponent);

			expect(WrappedComponent.displayName).toBe(
				"withErrorBoundary(TestComponent)",
			);
		});
	});

	describe("useErrorHandler hook", () => {
		it("should report errors manually", async () => {
			const user = userEvent.setup();

			render(<TestErrorReporter />);

			const reportButton = screen.getByTestId("report-error-button");
			await user.click(reportButton);

			expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
				expect.any(Error),
				expect.objectContaining({
					context: "test",
					source: "manual-report",
					timestamp: expect.any(String),
				}),
			);

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Manual error report",
				expect.objectContaining({
					error: "Manual error report",
					context: { context: "test" },
				}),
			);
		});
	});

	it("should have proper accessibility attributes", () => {
		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		// Check for proper heading hierarchy
		const heading = screen.getByRole("heading", { level: 2 });
		expect(heading).toHaveTextContent("Something went wrong");

		// Check buttons have accessible names
		const retryButton = screen.getByRole("button", { name: /retry/i });
		const reloadButton = screen.getByRole("button", { name: /reload page/i });

		expect(retryButton).toBeInTheDocument();
		expect(reloadButton).toBeInTheDocument();

		// Check SVG has title for screen readers
		const icon = screen.getByTitle("Error warning icon");
		expect(icon).toBeInTheDocument();
	});

	it("should handle component unmounting properly", () => {
		const { unmount } = render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		);

		// Should not throw when unmounting
		expect(() => unmount()).not.toThrow();
	});
});
