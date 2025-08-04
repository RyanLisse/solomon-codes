import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { createLogger } from "./index";

/**
 * Request correlation ID header name
 */
export const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Request context for storing correlation information
 */
export interface RequestContext {
	correlationId: string;
	startTime: number;
	method: string;
	url: string;
	userAgent?: string;
	ip?: string;
}

/**
 * Global request context storage (using AsyncLocalStorage would be better in production)
 */
const requestContextMap = new Map<string, RequestContext>();

/**
 * Get or create correlation ID from request
 */
export function getOrCreateCorrelationId(request: NextRequest): string {
	// Check if correlation ID already exists in headers
	const existingId = request.headers.get(CORRELATION_ID_HEADER);
	if (existingId) {
		return existingId;
	}

	// Generate new correlation ID
	return randomUUID();
}

/**
 * Create request context from Next.js request
 */
export function createRequestContext(request: NextRequest): RequestContext {
	const correlationId = getOrCreateCorrelationId(request);

	const context: RequestContext = {
		correlationId,
		startTime: Date.now(),
		method: request.method,
		url: request.url,
		userAgent: request.headers.get("user-agent") || undefined,
		ip:
			request.headers.get("x-forwarded-for") ||
			request.headers.get("x-real-ip") ||
			"unknown",
	};

	// Store context for later retrieval
	requestContextMap.set(correlationId, context);

	return context;
}

/**
 * Get request context by correlation ID
 */
export function getRequestContext(
	correlationId: string,
): RequestContext | undefined {
	return requestContextMap.get(correlationId);
}

/**
 * Clean up request context
 */
export function cleanupRequestContext(correlationId: string): void {
	requestContextMap.delete(correlationId);
}

/**
 * Logging middleware for Next.js API routes
 */
export function createLoggingMiddleware() {
	const logger = createLogger({ serviceName: "middleware" });

	return async function loggingMiddleware(
		request: NextRequest,
		response: NextResponse,
	) {
		const context = createRequestContext(request);

		// Log incoming request
		logger.info("Incoming request", {
			correlationId: context.correlationId,
			method: context.method,
			url: context.url,
			userAgent: context.userAgent,
			ip: context.ip,
		});

		// Add correlation ID to response headers
		response.headers.set(CORRELATION_ID_HEADER, context.correlationId);

		// Log response (this would typically be done in a response interceptor)
		const duration = Date.now() - context.startTime;
		logger.info("Request completed", {
			correlationId: context.correlationId,
			method: context.method,
			url: context.url,
			duration,
			status: response.status,
		});

		// Clean up context
		cleanupRequestContext(context.correlationId);

		return response;
	};
}

/**
 * Express-style logging middleware (for compatibility)
 */
import type { ExpressRequest, ExpressResponse } from "../types/cleanup";

export function expressLoggingMiddleware(
	req: ExpressRequest,
	res: ExpressResponse,
	next: () => void,
): void {
	const logger = createLogger({ serviceName: "express-middleware" });
	const correlationId = req.headers[CORRELATION_ID_HEADER] || randomUUID();
	const startTime = Date.now();

	// Add correlation ID to request
	(req as ExpressRequest & { correlationId?: string }).correlationId =
		Array.isArray(correlationId) ? correlationId[0] : correlationId;

	// Add correlation ID to response headers
	res.setHeader(
		CORRELATION_ID_HEADER,
		Array.isArray(correlationId) ? correlationId[0] : correlationId,
	);

	// Log incoming request
	logger.info("Incoming request", {
		correlationId: Array.isArray(correlationId)
			? correlationId[0]
			: correlationId,
		method: req.method,
		url: req.url,
		userAgent: Array.isArray(req.headers["user-agent"])
			? req.headers["user-agent"][0]
			: req.headers["user-agent"],
		ip:
			req.ip ||
			(req as ExpressRequest & { connection?: { remoteAddress?: string } })
				.connection?.remoteAddress,
	});

	// Override res.end to log response
	const originalEnd = res.end;
	res.end = function (chunk: unknown, encoding?: string) {
		const duration = Date.now() - startTime;

		logger.info("Request completed", {
			correlationId: Array.isArray(correlationId)
				? correlationId[0]
				: correlationId,
			method: req.method,
			url: req.url,
			duration,
			status: res.statusCode,
		});

		originalEnd.call(this, chunk, encoding);
	};

	next();
}

/**
 * Get current correlation ID from various contexts
 */
export function getCurrentCorrelationId(): string | undefined {
	// In a real implementation, this would use AsyncLocalStorage
	// For now, return undefined as we can't track context across async boundaries
	return undefined;
}

/**
 * Create logger with automatic correlation ID injection
 */
export function createCorrelatedLogger(context: string) {
	const baseLogger = createLogger({ serviceName: context });

	return {
		debug: (message: string, meta?: object) => {
			const correlationId = getCurrentCorrelationId();
			baseLogger.debug(message, { ...meta, correlationId });
		},
		info: (message: string, meta?: object) => {
			const correlationId = getCurrentCorrelationId();
			baseLogger.info(message, { ...meta, correlationId });
		},
		warn: (message: string, meta?: object) => {
			const correlationId = getCurrentCorrelationId();
			baseLogger.warn(message, { ...meta, correlationId });
		},
		error: (message: string, meta?: object) => {
			const correlationId = getCurrentCorrelationId();
			baseLogger.error(message, { ...meta, correlationId });
		},
	};
}

/**
 * Performance monitoring middleware
 */
export function createPerformanceMiddleware() {
	const logger = createLogger({ serviceName: "performance" });

	return function performanceMiddleware(
		req: ExpressRequest,
		res: ExpressResponse,
		next: () => void,
	): void {
		const startTime = process.hrtime.bigint();
		const correlationId = req.correlationId || randomUUID();

		// Override res.end to measure performance
		const originalEnd = res.end;
		res.end = function (chunk: unknown, encoding?: string) {
			const endTime = process.hrtime.bigint();
			const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

			// Log performance metrics
			logger.info("Request performance", {
				correlationId,
				method: req.method,
				url: req.url,
				status: res.statusCode,
				duration,
				memoryUsage: process.memoryUsage(),
			});

			// Log slow requests
			if (duration > 1000) {
				// Slower than 1 second
				logger.warn("Slow request detected", {
					correlationId,
					method: req.method,
					url: req.url,
					duration,
				});
			}

			originalEnd.call(this, chunk, encoding);
		};

		next();
	};
}

/**
 * Error logging middleware
 */
export function createErrorLoggingMiddleware() {
	const logger = createLogger({ serviceName: "error-middleware" });

	return function errorLoggingMiddleware(
		error: Error,
		req: ExpressRequest,
		_res: ExpressResponse,
		next: (error?: Error) => void,
	): void {
		const correlationId = req.correlationId || "unknown";

		logger.error("Request error", {
			correlationId,
			method: req.method,
			url: req.url,
			error: {
				name: error.name,
				message: error.message,
				stack: error.stack,
			},
			userAgent: Array.isArray(req.headers["user-agent"])
				? req.headers["user-agent"][0]
				: req.headers["user-agent"],
			ip:
				req.ip ||
				(req as ExpressRequest & { connection?: { remoteAddress?: string } })
					.connection?.remoteAddress,
		});

		next(error);
	};
}
