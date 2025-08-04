/**
 * React Error Boundary Components
 * Provides error boundaries for catching and handling React errors
 */

"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppError, type ErrorSeverity } from "./error-handler";

export interface ErrorBoundaryState {
	hasError: boolean;
	error: AppError | null;
	errorId: string | null;
}

export interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: (error: AppError, errorId: string, reset: () => void) => ReactNode;
	onError?: (error: AppError, errorInfo: ErrorInfo) => void;
	isolate?: boolean; // Whether to isolate errors to this boundary
	level?: "page" | "section" | "component"; // Error boundary level for context
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	private resetTimeoutId: number | null = null;

	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorId: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const appError =
			error instanceof AppError
				? error
				: new AppError({
						message: error.message,
						code: "REACT_ERROR",
						severity: "high",
						userMessage: "Something went wrong in the application",
						context: {
							component: "ErrorBoundary",
							action: "render",
						},
						originalError: error,
					});

		return {
			hasError: true,
			error: appError,
			errorId,
		};
	}

	componentDidCatch(_error: Error, errorInfo: ErrorInfo) {
		const { onError, level = "component" } = this.props;
		const { error: appError } = this.state;

		if (appError) {
			// Enhance error context with React-specific information
			const enhancedError = new AppError({
				message: appError.message,
				code: appError.code,
				severity: appError.severity,
				context: {
					...appError.context,
					level,
					componentStack: errorInfo.componentStack ?? undefined,
					errorBoundary: this.constructor.name,
				},
				originalError: appError.originalError,
				userMessage: appError.userMessage,
				recoverable: appError.recoverable,
			});

			onError?.(enhancedError, errorInfo);

			// Auto-recovery for non-critical errors
			if (
				enhancedError.severity === "low" ||
				enhancedError.severity === "medium"
			) {
				this.scheduleAutoRecovery();
			}
		}
	}

	private scheduleAutoRecovery = () => {
		// Clear any existing timeout
		if (this.resetTimeoutId) {
			window.clearTimeout(this.resetTimeoutId);
		}

		// Auto-reset after 5 seconds for recoverable errors
		this.resetTimeoutId = window.setTimeout(() => {
			this.handleReset();
		}, 5000);
	};

	private handleReset = () => {
		if (this.resetTimeoutId) {
			window.clearTimeout(this.resetTimeoutId);
			this.resetTimeoutId = null;
		}

		this.setState({
			hasError: false,
			error: null,
			errorId: null,
		});
	};

	componentWillUnmount() {
		if (this.resetTimeoutId) {
			window.clearTimeout(this.resetTimeoutId);
		}
	}

	render() {
		const { hasError, error, errorId } = this.state;
		const { children, fallback, isolate = true } = this.props;

		if (hasError && error && errorId) {
			if (fallback) {
				return fallback(error, errorId, this.handleReset);
			}

			return (
				<ErrorFallback
					error={error}
					errorId={errorId}
					onReset={this.handleReset}
					isolate={isolate}
				/>
			);
		}

		return children;
	}
}

interface ErrorFallbackProps {
	error: AppError;
	errorId: string;
	onReset: () => void;
	isolate?: boolean;
}

function ErrorFallback({
	error,
	errorId,
	onReset,
	isolate = true,
}: ErrorFallbackProps) {
	const getSeverityColor = (severity: ErrorSeverity): string => {
		switch (severity) {
			case "low":
				return "text-yellow-600 bg-yellow-50 border-yellow-200";
			case "medium":
				return "text-orange-600 bg-orange-50 border-orange-200";
			case "high":
				return "text-red-600 bg-red-50 border-red-200";
			case "critical":
				return "text-red-800 bg-red-100 border-red-300";
			default:
				return "text-gray-600 bg-gray-50 border-gray-200";
		}
	};

	const shouldShowTechnicalDetails =
		error.severity === "low" || error.severity === "medium";

	if (isolate) {
		return (
			<Card className={`m-4 ${getSeverityColor(error.severity)}`}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5" />
						{error.severity === "critical"
							? "Critical Error"
							: "Something went wrong"}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm">{error.userMessage}</p>

					{shouldShowTechnicalDetails && (
						<details className="text-xs">
							<summary className="cursor-pointer font-medium">
								Technical Details
							</summary>
							<div className="mt-2 space-y-1">
								<div>
									<strong>Error Code:</strong> {error.code}
								</div>
								<div>
									<strong>Error ID:</strong> {errorId}
								</div>
								{error.context?.component && (
									<div>
										<strong>Component:</strong> {error.context.component}
									</div>
								)}
							</div>
						</details>
					)}

					{error.recoverable && (
						<Button
							onClick={onReset}
							variant="outline"
							size="sm"
							className="flex items-center gap-2"
						>
							<RefreshCw className="h-4 w-4" />
							Try Again
						</Button>
					)}
				</CardContent>
			</Card>
		);
	}

	// Full-page error fallback
	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-center">
						<AlertTriangle className="h-6 w-6 text-red-500" />
						Application Error
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-center">
					<p className="text-muted-foreground">{error.userMessage}</p>

					<div className="space-y-2">
						<Button onClick={onReset} className="w-full">
							<RefreshCw className="mr-2 h-4 w-4" />
							Reload Application
						</Button>
						<Button
							variant="outline"
							onClick={() => window.location.reload()}
							className="w-full"
						>
							Hard Refresh
						</Button>
					</div>

					{shouldShowTechnicalDetails && (
						<details className="text-left text-xs">
							<summary className="cursor-pointer text-center font-medium">
								Error Details
							</summary>
							<div className="mt-2 space-y-1 rounded bg-muted p-2">
								<div>
									<strong>Error ID:</strong> {errorId}
								</div>
								<div>
									<strong>Code:</strong> {error.code}
								</div>
								<div>
									<strong>Timestamp:</strong> {error.context?.timestamp}
								</div>
							</div>
						</details>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// Higher-order component for wrapping components with error boundaries
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

// Hook for triggering error boundaries programmatically
export function useErrorBoundary() {
	return (error: Error | AppError) => {
		throw error instanceof AppError
			? error
			: new AppError({
					message: error.message,
					code: "MANUAL_ERROR",
					severity: "medium",
					originalError: error instanceof Error ? error : undefined,
				});
	};
}
