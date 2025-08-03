"use client";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { Bot, Loader, Terminal, User } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { fetchRealtimeSubscriptionToken } from "@/app/actions/inngest";
import { Markdown } from "@/components/markdown";
import { StreamingIndicator } from "@/components/streaming-indicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { useTask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

interface Props {
	id: string;
}

interface StreamingMessage {
	role: "user" | "assistant";
	type: string;
	data: Record<string, unknown> & {
		text?: string;
		isStreaming?: boolean;
		streamId?: string;
		chunkIndex?: number;
		totalChunks?: number;
	};
}

interface TaskMessage {
	role: "user" | "assistant";
	type: string;
	data: Record<string, unknown> & {
		text?: string;
		call_id?: string;
		action?: {
			command?: string[];
		};
		output?: string;
		id?: string;
		created_at?: string;
	};
}

// Memoized message component for performance
const MessageItem = memo(function MessageItem({
	message,
	getOutputForCall,
}: {
	message: TaskMessage;
	getOutputForCall: (callId: string) => TaskMessage | undefined;
}) {
	const isUserMessage = message.role === "user";
	const isAssistantMessage = message.role === "assistant";
	const isShellCall = message.type === "local_shell_call";
	const outputMessage =
		isShellCall && message.data?.call_id
			? getOutputForCall(message.data.call_id as string)
			: null;

	return (
		<div
			className={cn(
				"mb-4 flex",
				isUserMessage ? "justify-end" : "justify-start",
			)}
		>
			<div
				className={cn(
					"flex max-w-[80%] gap-3",
					isUserMessage && "flex-row-reverse",
				)}
			>
				<div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
					{isUserMessage ? (
						<User className="h-4 w-4" />
					) : (
						<Bot className="h-4 w-4" />
					)}
				</div>
				<div
					className={cn(
						"flex flex-col gap-2 rounded-lg px-3 py-2",
						isUserMessage ? "bg-primary text-primary-foreground" : "bg-muted",
					)}
				>
					{isShellCall && (
						<div className="rounded bg-black p-2 font-mono text-green-400 text-sm">
							<div className="mb-1 flex items-center gap-2">
								<Terminal className="h-3 w-3" />
								<span className="text-gray-400 text-xs">Shell Command</span>
							</div>
							<div>{message.data?.action?.command?.join(" ")}</div>
							{outputMessage && (
								<div className="mt-2 border-gray-600 border-t pt-2">
									<div className="mb-1 text-gray-400 text-xs">Output:</div>
									<pre className="whitespace-pre-wrap text-xs">
										{outputMessage.data?.output}
									</pre>
								</div>
							)}
						</div>
					)}
					{isAssistantMessage && message.data?.text && (
						<Markdown>{message.data.text}</Markdown>
					)}
					{isUserMessage && <div>{message.data?.text}</div>}
				</div>
			</div>
		</div>
	);
});

// Memoized streaming message component
const StreamingMessage = memo(function StreamingMessage({
	message,
}: {
	message: StreamingMessage;
}) {
	return (
		<div className="mb-4 flex justify-start">
			<div className="flex max-w-[80%] gap-3">
				<div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
					<Bot className="h-4 w-4" />
				</div>
				<div className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-2">
					<Markdown>{message.data.text || ""}</Markdown>
					<StreamingIndicator />
				</div>
			</div>
		</div>
	);
});

// React 19 optimized component using concurrent features
export default function OptimizedTaskClient({ id }: Props) {
	const { data: task, isLoading, error } = useTask(id);

	// Memoized output lookup function
	const getOutputForCall = useCallback(
		(callId: string) => {
			return task?.messages.find(
				(message: TaskMessage) =>
					message.type === "local_shell_call_output" &&
					message.data?.call_id === callId,
			);
		},
		[task?.messages],
	);

	// Memoized sorted messages for performance
	const sortedMessages = useMemo(() => {
		if (!task?.messages) return [];
		return [...task.messages]
			.filter(
				(message: TaskMessage) => message.type !== "local_shell_call_output",
			)
			.sort((a: TaskMessage, b: TaskMessage) => {
				const aDate = new Date(
					a.data.created_at ||
						(a as TaskMessage & { createdAt?: string }).createdAt ||
						"",
				).getTime();
				const bDate = new Date(
					b.data.created_at ||
						(b as TaskMessage & { createdAt?: string }).createdAt ||
						"",
				).getTime();
				return aDate - bDate;
			});
	}, [task?.messages]);

	const { latestData } = useInngestSubscription({
		refreshToken: fetchRealtimeSubscriptionToken,
		bufferInterval: 0,
		enabled: true,
	});

	// State for streaming messages with memory management
	const [streamingMessages, setStreamingMessages] = useState<
		Map<string, StreamingMessage>
	>(new Map());

	// Handle streaming messages with proper type checking
	useEffect(() => {
		if (latestData?.channel === "tasks" && latestData.topic === "update") {
			const { taskId, message } = latestData.data;
			if (
				taskId === id &&
				message &&
				typeof message === "object" &&
				"data" in message
			) {
				const messageData = message.data as Record<string, unknown>;
				if (
					messageData?.isStreaming &&
					messageData.streamId &&
					typeof messageData.streamId === "string"
				) {
					const MAX_STREAMING_MESSAGES = 50;
					setStreamingMessages((prev) => {
						const newMap = new Map(prev);
						if (newMap.size >= MAX_STREAMING_MESSAGES) {
							const oldestKey = newMap.keys().next().value;
							if (oldestKey) newMap.delete(oldestKey);
						}
						newMap.set(
							messageData.streamId as string,
							message as unknown as StreamingMessage,
						);
						return newMap;
					});
				}
			}
		}
	}, [latestData, id]);

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2">
					<Loader className="h-4 w-4 animate-spin" />
					<span>Loading task...</span>
				</div>
			</div>
		);
	}

	if (error || !task) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center">
					<h2 className="font-semibold text-lg">Task not found</h2>
					<p className="text-muted-foreground">
						The task you&apos;re looking for doesn&apos;t exist or has been
						deleted.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="border-b p-4">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-semibold text-lg">{task.title}</h1>
						<p className="text-muted-foreground text-sm">
							Created {new Date(task.createdAt).toLocaleDateString()}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<TextShimmer className="px-2 py-1 text-xs">
							{task.status}
						</TextShimmer>
					</div>
				</div>
			</div>

			<ScrollArea className="flex-1 p-4">
				<div className="space-y-4">
					{/* Render regular messages */}
					{sortedMessages.map((message, index) => (
						<MessageItem
							key={`message-${index}-${message.type}`}
							message={message}
							getOutputForCall={getOutputForCall}
						/>
					))}

					{/* Render streaming messages */}
					{Array.from(streamingMessages.values()).map((message) => (
						<StreamingMessage key={message.data.streamId} message={message} />
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

/**
 * React Error Boundaries with comprehensive error handling and fallback UI
 * Integrates with the global error handling system
 */

import { AlertTriangle, Bug, Home, RefreshCw } from "lucide-react";
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ErrorCodes, ErrorSeverity, SystemError } from "@/lib/config";
import { getGlobalClientErrorHandler } from "@/lib/logging/client";

export interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
	errorId: string | null;
	retryCount: number;
	lastRetryTime: number | null;
}

export interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	level?: "page" | "component" | "section";
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
	enableRetry?: boolean;
	maxRetries?: number;
	retryDelay?: number;
	showErrorDetails?: boolean;
	recovery?: {
		enabled: boolean;
		strategies: Array<"retry" | "refresh" | "fallback" | "redirect">;
		redirectUrl?: string;
	};
}

/**
 * Enhanced Error Boundary with comprehensive error handling
 */
export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	private retryTimeoutId: NodeJS.Timeout | null = null;

	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			errorId: null,
			retryCount: 0,
			lastRetryTime: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		// Generate unique error ID for tracking
		const errorId = `ui-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		return {
			hasError: true,
			error,
			errorId,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		// Report error to global error handler
		const globalErrorHandler = getGlobalClientErrorHandler();

		const structuredError = new SystemError(
			error.message,
			ErrorCodes.INTERNAL_ERROR,
			{
				component: "error-boundary",
				action: "component-error",
				metadata: {
					componentStack: errorInfo.componentStack,
					errorBoundaryLevel: this.props.level || "component",
					retryCount: this.state.retryCount,
					props: this.props,
				},
				stackTrace: error.stack,
			},
			ErrorSeverity.MEDIUM,
		);

		if (globalErrorHandler) {
			globalErrorHandler.handleError(structuredError);
		}

		// Update state with error info
		this.setState({ errorInfo });

		// Call custom error handler if provided
		this.props.onError?.(error, errorInfo);

		// Auto-retry if enabled and within limits
		if (this.shouldAutoRetry()) {
			this.scheduleRetry();
		}
	}

	private shouldAutoRetry(): boolean {
		const { enableRetry = true, maxRetries = 3 } = this.props;
		return enableRetry && this.state.retryCount < maxRetries;
	}

	private scheduleRetry(): void {
		const { retryDelay = 2000 } = this.props;
		const delay = retryDelay * 2 ** this.state.retryCount; // Exponential backoff

		this.retryTimeoutId = setTimeout(() => {
			this.handleRetry();
		}, delay);
	}

	private handleRetry = (): void => {
		this.setState((prevState) => ({
			hasError: false,
			error: null,
			errorInfo: null,
			errorId: null,
			retryCount: prevState.retryCount + 1,
			lastRetryTime: Date.now(),
		}));
	};

	private handleRefresh = (): void => {
		window.location.reload();
	};

	private handleGoHome = (): void => {
		window.location.href = "/";
	};

	private handleReportError = (): void => {
		if (this.state.error && this.state.errorId) {
			// Open error reporting dialog or send to external service
			console.log("Reporting error:", {
				errorId: this.state.errorId,
				error: this.state.error.message,
				stack: this.state.error.stack,
				componentStack: this.state.errorInfo?.componentStack,
			});
		}
	};

	componentWillUnmount() {
		if (this.retryTimeoutId) {
			clearTimeout(this.retryTimeoutId);
		}
	}

	render() {
		if (this.state.hasError) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Render appropriate error UI based on level
			return this.renderErrorUI();
		}

		return this.props.children;
	}

	private renderErrorUI(): ReactNode {
		const { level = "component", showErrorDetails: _showErrorDetails = false } =
			this.props;
		const {
			error: _error,
			errorId: _errorId,
			retryCount: _retryCount,
		} = this.state;

		switch (level) {
			case "page":
				return this.renderPageErrorUI();
			case "section":
				return this.renderSectionErrorUI();
			default:
				return this.renderComponentErrorUI();
		}
	}

	private renderPageErrorUI(): ReactNode {
		const { error, errorId, retryCount } = this.state;
		const canRetry = this.shouldAutoRetry();

		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-4">
				<Card className="w-full max-w-lg">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="h-6 w-6 text-destructive" />
						</div>
						<CardTitle>Something went wrong</CardTitle>
						<CardDescription>
							We apologize for the inconvenience. An unexpected error has
							occurred.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{errorId && (
							<Alert>
								<Bug className="h-4 w-4" />
								<AlertDescription>
									Error ID: <code className="text-sm">{errorId}</code>
								</AlertDescription>
							</Alert>
						)}

						{retryCount > 0 && (
							<Alert>
								<AlertDescription>Retry attempt: {retryCount}</AlertDescription>
							</Alert>
						)}

						<div className="flex flex-col gap-2 sm:flex-row">
							{canRetry && (
								<Button
									onClick={this.handleRetry}
									variant="default"
									className="flex-1"
								>
									<RefreshCw className="mr-2 h-4 w-4" />
									Try Again
								</Button>
							)}
							<Button
								onClick={this.handleRefresh}
								variant="outline"
								className="flex-1"
							>
								<RefreshCw className="mr-2 h-4 w-4" />
								Refresh Page
							</Button>
							<Button
								onClick={this.handleGoHome}
								variant="outline"
								className="flex-1"
							>
								<Home className="mr-2 h-4 w-4" />
								Go Home
							</Button>
						</div>

						{this.props.showErrorDetails && error && (
							<details className="mt-4">
								<summary className="cursor-pointer text-muted-foreground text-sm">
									Error Details
								</summary>
								<pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
									{error.stack}
								</pre>
							</details>
						)}

						<Button
							onClick={this.handleReportError}
							variant="ghost"
							size="sm"
							className="w-full"
						>
							<Bug className="mr-2 h-4 w-4" />
							Report Error
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	private renderSectionErrorUI(): ReactNode {
		const { error: _error, errorId: _errorId } = this.state;
		const canRetry = this.shouldAutoRetry();

		return (
			<Card className="w-full border-destructive/50">
				<CardHeader>
					<div className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-destructive" />
						<CardTitle className="text-base">Section Error</CardTitle>
					</div>
					<CardDescription>
						This section encountered an error and couldn&apos;t load properly.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex gap-2">
						{canRetry && (
							<Button onClick={this.handleRetry} size="sm" variant="outline">
								<RefreshCw className="mr-2 h-4 w-4" />
								Retry
							</Button>
						)}
						<Button onClick={this.handleReportError} size="sm" variant="ghost">
							<Bug className="mr-2 h-4 w-4" />
							Report
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	private renderComponentErrorUI(): ReactNode {
		const canRetry = this.shouldAutoRetry();

		return (
			<Alert variant="destructive" className="my-2">
				<AlertTriangle className="h-4 w-4" />
				<AlertDescription className="flex items-center justify-between">
					<span>Component failed to load</span>
					{canRetry && (
						<Button onClick={this.handleRetry} size="sm" variant="outline">
							<RefreshCw className="mr-1 h-4 w-4" />
							Retry
						</Button>
					)}
				</AlertDescription>
			</Alert>
		);
	}
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
	WrappedComponent: React.ComponentType<P>,
	errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
) {
	const WithErrorBoundaryComponent = (props: P) => (
		<ErrorBoundary {...errorBoundaryProps}>
			<WrappedComponent {...props} />
		</ErrorBoundary>
	);

	WithErrorBoundaryComponent.displayName = `withErrorBoundary(${
		WrappedComponent.displayName || WrappedComponent.name
	})`;

	return WithErrorBoundaryComponent;
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
	const handleError = React.useCallback(
		(error: Error, context?: Record<string, unknown>) => {
			const globalErrorHandler = getGlobalClientErrorHandler();

			if (globalErrorHandler) {
				globalErrorHandler.handleError(error, {
					component: "functional-component",
					action: "hook-error",
					metadata: context,
				});
			}
		},
		[],
	);

	return { handleError };
}

/**
 * Error boundary for specific UI patterns
 */
export const PageErrorBoundary = (props: Omit<ErrorBoundaryProps, "level">) => (
	<ErrorBoundary {...props} level="page" />
);

export const SectionErrorBoundary = (
	props: Omit<ErrorBoundaryProps, "level">,
) => <ErrorBoundary {...props} level="section" />;

export const ComponentErrorBoundary = (
	props: Omit<ErrorBoundaryProps, "level">,
) => <ErrorBoundary {...props} level="component" />;

/**
 * Async error boundary for handling promise rejections in components
 */
export function useAsyncError() {
	const [, setError] = React.useState();

	return React.useCallback((error: Error) => {
		setError(() => {
			throw error;
		});
	}, []);
}
