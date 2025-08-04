import type { NextRequest } from "next/server";
import type { LogMetadata, PerformanceMetrics, RequestContext } from "../types";
import { generateCorrelationId, getCorrelationId } from "./correlation";

/**
 * Create request context from Next.js request
 */
export function createRequestContext(request: NextRequest): RequestContext {
	const correlationId =
		getCorrelationId() ||
		request.headers.get("x-correlation-id") ||
		generateCorrelationId();

	return {
		correlationId,
		traceId: request.headers.get("x-trace-id") || undefined,
		spanId: request.headers.get("x-span-id") || undefined,
		userId: request.headers.get("x-user-id") || undefined,
		sessionId: request.headers.get("x-session-id") || undefined,
		requestId: request.headers.get("x-request-id") || correlationId,
		method: request.method,
		url: request.url,
		userAgent: request.headers.get("user-agent") || undefined,
		ip:
			request.headers.get("x-forwarded-for") ||
			request.headers.get("x-real-ip") ||
			"unknown",
	};
}

/**
 * Create performance metrics object
 */
export function createPerformanceMetrics(
	startTime: number,
	endTime?: number,
): PerformanceMetrics {
	const end = endTime || Date.now();
	const duration = end - startTime;

	return {
		duration,
		memoryUsage: process.memoryUsage(),
		cpuUsage: process.cpuUsage(),
		timestamp: new Date().toISOString(),
	};
}

/**
 * Create log metadata with common fields
 */
export function createLogMetadata(
	additionalMeta: Partial<LogMetadata> = {},
): LogMetadata {
	const correlationId = getCorrelationId();

	return {
		correlationId,
		timestamp: new Date().toISOString(),
		...additionalMeta,
	};
}

/**
 * Extract user context from request headers
 */
export function extractUserContext(request: NextRequest): Partial<LogMetadata> {
	return {
		userId: request.headers.get("x-user-id") || undefined,
		sessionId: request.headers.get("x-session-id") || undefined,
		userAgent: request.headers.get("user-agent") || undefined,
		ip:
			request.headers.get("x-forwarded-for") ||
			request.headers.get("x-real-ip") ||
			"unknown",
	};
}

/**
 * Create component-specific metadata
 */
export function createComponentMetadata(
	component: string,
	operation?: string,
	additionalMeta: Partial<LogMetadata> = {},
): LogMetadata {
	return createLogMetadata({
		component,
		operation,
		...additionalMeta,
	});
}

/**
 * Create error metadata from Error object
 */
export function createErrorMetadata(
	error: Error | string,
	additionalMeta: Partial<LogMetadata> = {},
): LogMetadata {
	const errorMeta: Partial<LogMetadata> = {};

	if (error instanceof Error) {
		errorMeta.error = {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	} else {
		errorMeta.error = error;
	}

	return createLogMetadata({
		...errorMeta,
		...additionalMeta,
	});
}

/**
 * Create timing metadata for performance tracking
 */
export function createTimingMetadata(
	operation: string,
	startTime: number,
	endTime?: number,
	additionalMeta: Partial<LogMetadata> = {},
): LogMetadata {
	const end = endTime || Date.now();
	const duration = end - startTime;

	return createLogMetadata({
		operation,
		duration,
		startTime: new Date(startTime).toISOString(),
		endTime: new Date(end).toISOString(),
		...additionalMeta,
	});
}

/**
 * Sanitize sensitive data from metadata
 */
export function sanitizeMetadata(metadata: LogMetadata): LogMetadata {
	const sensitiveKeys = [
		"password",
		"token",
		"secret",
		"key",
		"authorization",
		"cookie",
		"session",
		"apikey",
		"api_key",
	];

	const sanitized = { ...metadata };

	// Recursively sanitize nested objects
	function sanitizeObject(obj: unknown): unknown {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map(sanitizeObject);
		}

		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			const lowerKey = key.toLowerCase();
			if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
				result[key] = "[REDACTED]";
			} else {
				result[key] = sanitizeObject(value);
			}
		}
		return result;
	}

	return sanitizeObject(sanitized) as LogMetadata;
}

/**
 * Merge multiple metadata objects with precedence
 */
export function mergeMetadata(
	...metadataObjects: Partial<LogMetadata>[]
): LogMetadata {
	const merged: Partial<LogMetadata> = {};
	for (const meta of metadataObjects) {
		Object.assign(merged, meta);
	}

	// Ensure we have a correlation ID
	if (!merged.correlationId) {
		merged.correlationId = getCorrelationId();
	}

	// Ensure we have a timestamp
	if (!merged.timestamp) {
		merged.timestamp = new Date().toISOString();
	}

	return merged as LogMetadata;
}

/**
 * Create metadata for database operations
 */
export function createDatabaseMetadata(
	operation: {
		query?: string;
		queryType?: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "TRANSACTION";
		affectedRows?: number;
		executionTime?: number;
		database?: string;
		table?: string;
	},
	additionalMeta: Partial<LogMetadata> = {},
): LogMetadata {
	return createLogMetadata({
		component: "database",
		...operation,
		...additionalMeta,
	});
}

/**
 * Create metadata for API operations
 */
export function createApiMetadata(
	request: NextRequest,
	response?: {
		statusCode?: number;
		responseTime?: number;
		responseSize?: number;
	},
	additionalMeta: Partial<LogMetadata> = {},
): LogMetadata {
	const requestContext = createRequestContext(request);

	return createLogMetadata({
		component: "api",
		method: requestContext.method,
		url: requestContext.url,
		userAgent: requestContext.userAgent,
		ip: requestContext.ip,
		...response,
		...additionalMeta,
	});
}
