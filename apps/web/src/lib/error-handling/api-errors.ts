/**
 * API-specific error handling utilities
 * Provides standardized error handling for API routes and client-side requests
 */

import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/common";
import {
	AppError,
	createErrorResponse,
	ErrorCodes,
	type ErrorContext,
} from "./error-handler";

// HTTP status code to error code mapping
const HTTP_STATUS_TO_ERROR_CODE: Record<number, string> = {
	400: ErrorCodes.VALIDATION_ERROR,
	401: ErrorCodes.UNAUTHORIZED,
	403: ErrorCodes.FORBIDDEN,
	404: ErrorCodes.RESOURCE_NOT_FOUND,
	409: ErrorCodes.RESOURCE_CONFLICT,
	429: ErrorCodes.API_RATE_LIMIT,
	500: ErrorCodes.INTERNAL_SERVER_ERROR,
	502: ErrorCodes.EXTERNAL_SERVICE_ERROR,
	503: ErrorCodes.SERVICE_UNAVAILABLE,
	504: ErrorCodes.TIMEOUT_ERROR,
};

// Error severity based on HTTP status codes
const getErrorSeverityFromStatus = (status: number) => {
	if (status >= 500) return "critical";
	if (status >= 400) return "medium";
	return "low";
};

/**
 * Creates an AppError from an HTTP response
 */
export function createHttpError(
	status: number,
	message?: string,
	context?: ErrorContext,
): AppError {
	const code =
		HTTP_STATUS_TO_ERROR_CODE[status] || ErrorCodes.INTERNAL_SERVER_ERROR;
	const severity = getErrorSeverityFromStatus(status);

	return new AppError({
		message: message || `HTTP ${status} error`,
		code,
		severity,
		context: {
			...context,
			httpStatus: status,
		},
		recoverable: status < 500, // 5xx errors are generally not recoverable
	});
}

/**
 * Handles fetch API errors and converts them to AppErrors
 */
export async function handleFetchError(
	response: Response,
	context?: ErrorContext,
): Promise<AppError> {
	let errorMessage = `Request failed with status ${response.status}`;

	try {
		const errorData = await response.json();
		if (errorData.error) {
			errorMessage = errorData.error;
		} else if (errorData.message) {
			errorMessage = errorData.message;
		}
	} catch {
		// If response is not JSON, use default message
	}

	return createHttpError(response.status, errorMessage, {
		...context,
		url: response.url,
		statusText: response.statusText,
	});
}

/**
 * API error handler wrapper for Next.js API routes
 */
export function withApiErrorHandler<T = unknown>(
	handler: (req: Request) => Promise<ApiResponse<T>>,
) {
	return async (req: Request): Promise<NextResponse> => {
		try {
			const result = await handler(req);

			if (result.success) {
				return NextResponse.json(result, { status: 200 });
			}
			// Determine appropriate HTTP status from error code
			const status = getHttpStatusFromErrorCode(result.code);
			return NextResponse.json(result, { status });
		} catch (error) {
			console.error("API Error:", error);

			const appError =
				error instanceof AppError
					? error
					: new AppError({
							message: error instanceof Error ? error.message : "Unknown error",
							code: ErrorCodes.INTERNAL_SERVER_ERROR,
							severity: "critical",
							context: {
								component: "api_handler",
								url: req.url,
								method: req.method,
							},
							originalError: error instanceof Error ? error : undefined,
						});

			const errorResponse = createErrorResponse(appError);
			const status = getHttpStatusFromErrorCode(appError.code);

			return NextResponse.json(errorResponse, { status });
		}
	};
}

/**
 * Maps error codes to appropriate HTTP status codes
 */
function getHttpStatusFromErrorCode(code?: string): number {
	switch (code) {
		case ErrorCodes.VALIDATION_ERROR:
		case ErrorCodes.INVALID_INPUT:
		case ErrorCodes.MISSING_REQUIRED_FIELD:
			return 400;
		case ErrorCodes.UNAUTHORIZED:
		case ErrorCodes.TOKEN_EXPIRED:
			return 401;
		case ErrorCodes.FORBIDDEN:
			return 403;
		case ErrorCodes.RESOURCE_NOT_FOUND:
			return 404;
		case ErrorCodes.RESOURCE_CONFLICT:
			return 409;
		case ErrorCodes.API_RATE_LIMIT:
			return 429;
		case ErrorCodes.EXTERNAL_SERVICE_ERROR:
			return 502;
		case ErrorCodes.SERVICE_UNAVAILABLE:
			return 503;
		case ErrorCodes.TIMEOUT_ERROR:
			return 504;
		default:
			return 500;
	}
}

/**
 * Enhanced fetch wrapper with built-in error handling
 */
export async function apiRequest<T = unknown>(
	url: string,
	options: RequestInit & {
		timeout?: number;
		context?: ErrorContext;
	} = {},
): Promise<T> {
	const { timeout = 10000, context, ...fetchOptions } = options;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			...fetchOptions,
			signal: controller.signal,
			headers: {
				"Content-Type": "application/json",
				...fetchOptions.headers,
			},
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw await handleFetchError(response, {
				...context,
				action: "api_request",
				url,
				method: fetchOptions.method || "GET",
			});
		}

		const data = await response.json();

		// Handle API response format
		if (data.success === false) {
			throw new AppError({
				message: data.error || "API request failed",
				code: data.code || ErrorCodes.OPERATION_FAILED,
				severity: "medium",
				context: {
					...context,
					url,
					method: fetchOptions.method || "GET",
				},
			});
		}

		return data.data || data;
	} catch (error) {
		clearTimeout(timeoutId);

		if (error instanceof AppError) {
			throw error;
		}

		if (error instanceof Error) {
			if (error.name === "AbortError") {
				throw new AppError({
					message: "Request timeout",
					code: ErrorCodes.TIMEOUT_ERROR,
					severity: "medium",
					context: {
						...context,
						url,
						timeout,
					},
					originalError: error,
				});
			}

			throw new AppError({
				message: error.message,
				code: ErrorCodes.NETWORK_ERROR,
				severity: "medium",
				context: {
					...context,
					url,
					method: fetchOptions.method || "GET",
				},
				originalError: error,
			});
		}

		throw new AppError({
			message: "Unknown network error",
			code: ErrorCodes.NETWORK_ERROR,
			severity: "medium",
			context: {
				...context,
				url,
			},
		});
	}
}

/**
 * Typed API request helpers
 */
export const api = {
	get: <T = unknown>(
		url: string,
		options?: Omit<Parameters<typeof apiRequest>[1], "method">,
	) => apiRequest<T>(url, { ...options, method: "GET" }),

	post: <T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<Parameters<typeof apiRequest>[1], "method" | "body">,
	) =>
		apiRequest<T>(url, {
			...options,
			method: "POST",
			body: data ? JSON.stringify(data) : undefined,
		}),

	put: <T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<Parameters<typeof apiRequest>[1], "method" | "body">,
	) =>
		apiRequest<T>(url, {
			...options,
			method: "PUT",
			body: data ? JSON.stringify(data) : undefined,
		}),

	patch: <T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<Parameters<typeof apiRequest>[1], "method" | "body">,
	) =>
		apiRequest<T>(url, {
			...options,
			method: "PATCH",
			body: data ? JSON.stringify(data) : undefined,
		}),

	delete: <T = unknown>(
		url: string,
		options?: Omit<Parameters<typeof apiRequest>[1], "method">,
	) => apiRequest<T>(url, { ...options, method: "DELETE" }),
};

/**
 * Retry wrapper for API requests
 */
export async function withRetry<T>(
	apiCall: () => Promise<T>,
	options: {
		maxAttempts?: number;
		delay?: number;
		backoffMultiplier?: number;
		retryCondition?: (error: AppError) => boolean;
	} = {},
): Promise<T> {
	const {
		maxAttempts = 3,
		delay = 1000,
		backoffMultiplier = 2,
		retryCondition = (error) =>
			error.recoverable && error.severity !== "critical",
	} = options;

	let lastError: AppError | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await apiCall();
		} catch (error) {
			const appError =
				error instanceof AppError
					? error
					: AppError.fromApiError(error, { attempt, maxAttempts });

			lastError = appError;

			// Don't retry on last attempt or if error is not retryable
			if (attempt === maxAttempts || !retryCondition(appError)) {
				throw appError;
			}

			// Wait before retry with exponential backoff
			const waitTime = delay * backoffMultiplier ** (attempt - 1);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}
	}

	// This should never happen if maxAttempts > 0, but handle edge case
	throw lastError || new Error("All retry attempts failed");
}
