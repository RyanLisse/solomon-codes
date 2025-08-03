"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import {
	createClientLogger,
	getGlobalClientErrorHandler,
} from "@/lib/logging/client";

export interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorId: string | null;
	retryCount: number;
}

export interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: (error: Error, errorId: string, retry: () => void) => ReactNode;
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
	enableRetry?: boolean;
	maxRetries?: number;
	resetOnPropsChange?: boolean;
	resetKeys?: Array<string | number>;
}

/**
 * Comprehensive error boundary component with fallback UI and recovery
 */
export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	private logger: ReturnType<typeof createClientLogger> | null = null;
	private resetTimeoutId: NodeJS.Timeout | null = null;

	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorId: null,
			retryCount: 0,
		};
	}

	private getLogger() {
		if (!this.logger) {
			this.logger = createClientLogger("error-boundary");
		}
		return this.logger;
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		// Generate error ID immediately
		const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Update state so the next render will show the fallback UI
		return {
			hasError: true,
			error,
			errorId,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		// Use the errorId from state (set in getDerivedStateFromError)
		const errorId =
			this.state.errorId ||
			`error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Report error to global error handler
		const errorHandler = getGlobalClientErrorHandler();
		errorHandler.handleError(error, {
			componentStack: errorInfo.componentStack,
			errorBoundary: true,
			retryCount: this.state.retryCount,
			errorId,
		});

		// Update state with errorId if not already set
		if (!this.state.errorId) {
			this.setState({
				errorId,
			});
		}

		this.getLogger().error("Error boundary caught error", {
			correlationId: errorId,
			error: error.message,
			componentStack: errorInfo.componentStack,
			retryCount: this.state.retryCount,
		});

		// Call custom error handler if provided
		if (this.props.onError) {
			try {
				this.props.onError(error, errorInfo);
			} catch (handlerError) {
				this.getLogger().error("Error in custom error handler", {
					handlerError:
						handlerError instanceof Error
							? handlerError.message
							: String(handlerError),
				});
			}
		}
	}

	componentDidUpdate(prevProps: ErrorBoundaryProps): void {
		const { resetKeys, resetOnPropsChange } = this.props;

		// Reset error state if resetKeys have changed
		if (this.state.hasError && resetKeys) {
			const hasResetKeyChanged = resetKeys.some(
				(key, idx) => prevProps.resetKeys?.[idx] !== key,
			);

			if (hasResetKeyChanged) {
				this.resetErrorState();
			}
		}

		// Reset on any prop change if enabled
		if (this.state.hasError && resetOnPropsChange && prevProps !== this.props) {
			this.resetErrorState();
		}
	}

	componentWillUnmount(): void {
		if (this.resetTimeoutId) {
			clearTimeout(this.resetTimeoutId);
		}
	}

	private resetErrorState = (): void => {
		this.getLogger().info("Resetting error boundary state", {
			errorId: this.state.errorId,
			retryCount: this.state.retryCount,
		});

		this.setState({
			hasError: false,
			error: null,
			errorId: null,
			retryCount: 0,
		});
	};

	private retry = (): void => {
		const { maxRetries = 3 } = this.props;
		const newRetryCount = this.state.retryCount + 1;

		if (newRetryCount > maxRetries) {
			this.getLogger().warn("Maximum retry attempts exceeded", {
				errorId: this.state.errorId,
				retryCount: newRetryCount,
				maxRetries,
			});
			return;
		}

		this.getLogger().info("Retrying after error", {
			errorId: this.state.errorId,
			retryCount: newRetryCount,
		});

		this.setState({
			hasError: false,
			error: null,
			errorId: null,
			retryCount: newRetryCount,
		});
	};

	render(): ReactNode {
		if (this.state.hasError && this.state.error && this.state.errorId) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback(
					this.state.error,
					this.state.errorId,
					this.retry,
				);
			}

			// Default fallback UI
			return (
				<DefaultErrorFallback
					error={this.state.error}
					errorId={this.state.errorId}
					retry={this.retry}
					retryCount={this.state.retryCount}
					maxRetries={this.props.maxRetries || 3}
					enableRetry={this.props.enableRetry !== false}
				/>
			);
		}

		return this.props.children;
	}
}

/**
 * Default error fallback component
 */
interface DefaultErrorFallbackProps {
	error: Error;
	errorId: string;
	retry: () => void;
	retryCount: number;
	maxRetries: number;
	enableRetry: boolean;
}

function DefaultErrorFallback({
	error,
	errorId,
	retry,
	retryCount,
	maxRetries,
	enableRetry,
}: DefaultErrorFallbackProps): React.JSX.Element {
	const canRetry = enableRetry && retryCount < maxRetries;
	const _showRetryButton = enableRetry;

	return (
		<div className="error-boundary-fallback mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
			<div className="mb-4 flex items-center">
				<div className="mr-3 text-red-500">
					<svg
						className="h-6 w-6"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<title>Error warning icon</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
						/>
					</svg>
				</div>
				<h2 className="font-semibold text-lg text-red-800">
					Something went wrong
				</h2>
			</div>

			<div className="mb-4">
				<p className="mb-2 text-red-700">
					We encountered an unexpected error. Our team has been notified.
				</p>
				<details className="text-sm">
					<summary className="cursor-pointer text-red-600 hover:text-red-800">
						Technical Details
					</summary>
					<div className="mt-2 rounded border bg-red-100 p-3">
						<p className="mb-1 font-mono text-red-800 text-xs">
							Error ID: {errorId}
						</p>
						<p className="font-mono text-red-800 text-xs">{error.message}</p>
					</div>
				</details>
			</div>

			<div className="flex gap-2">
				{enableRetry && (
					<button
						type="button"
						onClick={retry}
						className={`rounded px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
							canRetry
								? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
								: "cursor-not-allowed bg-gray-400"
						}`}
					>
						Retry ({retryCount}/{maxRetries})
					</button>
				)}
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
				>
					Reload Page
				</button>
			</div>
		</div>
	);
}

/**
 * HOC to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
	Component: React.ComponentType<P>,
	errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
) {
	const WrappedComponent = (props: P) => (
		<ErrorBoundary {...errorBoundaryProps}>
			<Component {...props} />
		</ErrorBoundary>
	);

	WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

	return WrappedComponent;
}

/**
 * Hook to get error boundary context (for manual error reporting)
 */
export function useErrorHandler() {
	const reportError = React.useCallback(
		(error: Error, context?: Record<string, unknown>) => {
			const errorHandler = getGlobalClientErrorHandler();
			errorHandler.handleError(error, {
				...context,
				source: "manual-report",
				timestamp: new Date().toISOString(),
			});

			const logger = createClientLogger("error-handler-hook");
			logger.error("Manual error report", {
				error: error.message,
				context,
			});
		},
		[],
	);

	return { reportError };
}
