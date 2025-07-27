"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { getGlobalErrorHandler } from "@/lib/error-handling/global-handler";
import { createContextLogger } from "@/lib/logging/factory";

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
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	private logger: ReturnType<typeof createContextLogger> | null = null;
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
			this.logger = createContextLogger("error-boundary");
		}
		return this.logger;
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		// Update state so the next render will show the fallback UI
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		// Report error to global error handler
		const errorHandler = getGlobalErrorHandler();
		const errorReport = errorHandler.createErrorReport(error, {
			componentStack: errorInfo.componentStack,
			errorBoundary: true,
			retryCount: this.state.retryCount,
		});

		this.setState({
			errorId: errorReport.id,
		});

		this.getLogger().error("Error boundary caught error", {
			correlationId: errorReport.id,
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
					handlerError: handlerError instanceof Error ? handlerError.message : String(handlerError),
				});
			}
		}
	}

	componentDidUpdate(prevProps: ErrorBoundaryProps): void {
		const { resetKeys, resetOnPropsChange } = this.props;
		
		// Reset error state if resetKeys have changed
		if (this.state.hasError && resetKeys) {
			const hasResetKeyChanged = resetKeys.some((key, idx) => 
				prevProps.resetKeys?.[idx] !== key
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

	private autoRetry = (): void => {
		// Auto-retry after a delay for transient errors
		this.resetTimeoutId = setTimeout(() => {
			if (this.state.hasError && this.state.retryCount < (this.props.maxRetries || 3)) {
				this.retry();
			}
		}, 2000 + (this.state.retryCount * 1000)); // Exponential backoff
	};

	render(): ReactNode {
		if (this.state.hasError && this.state.error && this.state.errorId) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback(this.state.error, this.state.errorId, this.retry);
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
}: DefaultErrorFallbackProps): JSX.Element {
	const canRetry = enableRetry && retryCount < maxRetries;

	return (
		<div className="error-boundary-fallback p-6 max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg">
			<div className="flex items-center mb-4">
				<div className="text-red-500 mr-3">
					<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path 
							strokeLinecap="round" 
							strokeLinejoin="round" 
							strokeWidth={2} 
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
						/>
					</svg>
				</div>
				<h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
			</div>
			
			<div className="mb-4">
				<p className="text-red-700 mb-2">
					We encountered an unexpected error. Our team has been notified.
				</p>
				<details className="text-sm">
					<summary className="cursor-pointer text-red-600 hover:text-red-800">
						Technical Details
					</summary>
					<div className="mt-2 p-3 bg-red-100 rounded border">
						<p className="font-mono text-xs text-red-800 mb-1">
							Error ID: {errorId}
						</p>
						<p className="font-mono text-xs text-red-800">
							{error.message}
						</p>
					</div>
				</details>
			</div>

			<div className="flex gap-2">
				{canRetry && (
					<button
						onClick={retry}
						className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
					>
						Retry ({retryCount}/{maxRetries})
					</button>
				)}
				<button
					onClick={() => window.location.reload()}
					className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
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
	errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
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
	const reportError = React.useCallback((error: Error, context?: Record<string, unknown>) => {
		const errorHandler = getGlobalErrorHandler();
		const errorReport = errorHandler.createErrorReport(error, {
			...context,
			source: "manual-report",
			timestamp: new Date().toISOString(),
		});

		const logger = createContextLogger("error-handler-hook");
		logger.error("Manual error report", {
			correlationId: errorReport.id,
			error: error.message,
			context,
		});
	}, []);

	return { reportError };
}