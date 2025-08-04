/**
 * Centralized error handling utilities
 * Provides consistent error management across the application
 */

import type { ApiResponse, BusinessError } from "@/types/common";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export interface ErrorContext {
	component?: string;
	action?: string;
	userId?: string;
	metadata?: Record<string, unknown>;
	timestamp?: string;
	// HTTP-related context
	httpStatus?: number;
	url?: string;
	statusText?: string;
	method?: string;
	// Validation and field-specific context
	field?: string;
	// Retry and attempt context
	attempt?: number;
	maxAttempts?: number;
	timeout?: number;
	// Error reporting context
	level?: string;
	componentStack?: string;
	errorBoundary?: string;
}

export class AppError extends Error implements BusinessError {
	public readonly code: string;
	public readonly severity: ErrorSeverity;
	public readonly context?: ErrorContext;
	public readonly originalError?: Error;
	public readonly userMessage: string;
	public readonly recoverable: boolean;

	constructor({
		message,
		code,
		severity = "medium",
		context,
		originalError,
		userMessage,
		recoverable = true,
	}: {
		message: string;
		code: string;
		severity?: ErrorSeverity;
		context?: ErrorContext;
		originalError?: Error;
		userMessage?: string;
		recoverable?: boolean;
	}) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.severity = severity;
		this.context = { ...context, timestamp: new Date().toISOString() };
		this.originalError = originalError;
		this.userMessage = userMessage || this.getDefaultUserMessage();
		this.recoverable = recoverable;

		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AppError);
		}
	}

	private getDefaultUserMessage(): string {
		switch (this.severity) {
			case "low":
				return "A minor issue occurred. Please try again.";
			case "medium":
				return "Something went wrong. Please try again or contact support if the issue persists.";
			case "high":
				return "An error occurred that requires attention. Please contact support.";
			case "critical":
				return "A critical error occurred. Please contact support immediately.";
			default:
				return "An unexpected error occurred.";
		}
	}

	public toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			severity: this.severity,
			context: this.context,
			userMessage: this.userMessage,
			recoverable: this.recoverable,
			stack: this.stack,
		};
	}

	public static fromApiError(error: unknown, context?: ErrorContext): AppError {
		if (error instanceof AppError) {
			return error;
		}

		if (error instanceof Error) {
			return new AppError({
				message: error.message,
				code: "API_ERROR",
				severity: "medium",
				context,
				originalError: error,
			});
		}

		return new AppError({
			message: "Unknown API error occurred",
			code: "UNKNOWN_API_ERROR",
			severity: "medium",
			context,
		});
	}
}

// Predefined error types for common scenarios
export const ErrorCodes = {
	// Network errors
	NETWORK_ERROR: "NETWORK_ERROR",
	TIMEOUT_ERROR: "TIMEOUT_ERROR",
	CONNECTION_ERROR: "CONNECTION_ERROR",

	// Authentication errors
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",

	// Validation errors
	VALIDATION_ERROR: "VALIDATION_ERROR",
	INVALID_INPUT: "INVALID_INPUT",
	MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

	// Business logic errors
	RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
	RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
	OPERATION_FAILED: "OPERATION_FAILED",

	// External service errors
	EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
	API_RATE_LIMIT: "API_RATE_LIMIT",

	// System errors
	INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
	SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
	DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// Error factory functions for common scenarios
export const createNetworkError = (
	originalError?: Error,
	context?: ErrorContext,
): AppError =>
	new AppError({
		message: "Network request failed",
		code: ErrorCodes.NETWORK_ERROR,
		severity: "medium",
		userMessage:
			"Unable to connect to the server. Please check your internet connection and try again.",
		context,
		originalError,
	});

export const createValidationError = (
	message: string,
	field?: string,
	context?: ErrorContext,
): AppError =>
	new AppError({
		message,
		code: ErrorCodes.VALIDATION_ERROR,
		severity: "low",
		userMessage: message,
		context: { ...context, field },
		recoverable: true,
	});

export const createUnauthorizedError = (context?: ErrorContext): AppError =>
	new AppError({
		message: "Authentication required",
		code: ErrorCodes.UNAUTHORIZED,
		severity: "medium",
		userMessage: "Please log in to continue.",
		context,
		recoverable: true,
	});

export const createNotFoundError = (
	resource: string,
	context?: ErrorContext,
): AppError =>
	new AppError({
		message: `${resource} not found`,
		code: ErrorCodes.RESOURCE_NOT_FOUND,
		severity: "low",
		userMessage: `The requested ${resource.toLowerCase()} could not be found.`,
		context,
		recoverable: false,
	});

export const createInternalError = (
	originalError?: Error,
	context?: ErrorContext,
): AppError =>
	new AppError({
		message: "Internal server error",
		code: ErrorCodes.INTERNAL_SERVER_ERROR,
		severity: "critical",
		userMessage: "A system error occurred. Our team has been notified.",
		context,
		originalError,
		recoverable: false,
	});

// Utility functions for error handling
export const isAppError = (error: unknown): error is AppError =>
	error instanceof AppError;

export const getErrorMessage = (error: unknown): string => {
	if (isAppError(error)) {
		return error.userMessage;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "An unexpected error occurred";
};

export const getErrorCode = (error: unknown): string => {
	if (isAppError(error)) {
		return error.code;
	}
	return "UNKNOWN_ERROR";
};

export const isRecoverableError = (error: unknown): boolean => {
	if (isAppError(error)) {
		return error.recoverable;
	}
	return true; // Assume recoverable by default
};

// API response helpers
export const createErrorResponse = <T = never>(
	error: unknown,
	context?: ErrorContext,
): ApiResponse<T> => {
	const appError = isAppError(error)
		? error
		: AppError.fromApiError(error, context);

	return {
		success: false,
		error: appError.userMessage,
		code: appError.code,
		timestamp: new Date().toISOString(),
	};
};

export const createSuccessResponse = <T>(
	data: T,
	message?: string,
): ApiResponse<T> => ({
	success: true,
	data,
	message,
	timestamp: new Date().toISOString(),
});
