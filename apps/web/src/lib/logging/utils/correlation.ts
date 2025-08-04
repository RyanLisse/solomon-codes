// Only import AsyncLocalStorage on server-side
let AsyncLocalStorage:
	| typeof import("node:async_hooks").AsyncLocalStorage
	| undefined;
if (typeof window === "undefined") {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	AsyncLocalStorage = require("node:async_hooks").AsyncLocalStorage;
}

import type { NextRequest, NextResponse } from "next/server";

// Extend globalThis to include correlation ID for testing
declare global {
	interface GlobalThis {
		__correlationId?: string;
	}
}

// Types for Express-like middleware
interface MiddlewareRequest {
	headers: Record<string, string | string[] | undefined>;
	correlationId?: string;
}

interface MiddlewareResponse {
	setHeader: (name: string, value: string) => void;
}

/**
 * Correlation ID context storage (server-side only)
 */
const correlationStorage =
	typeof window === "undefined" && AsyncLocalStorage
		? new AsyncLocalStorage<string>()
		: null;

/**
 * Generate a new correlation ID using crypto.randomUUID
 */
export function generateCorrelationId(): string {
	return crypto.randomUUID();
}

/**
 * Get the current correlation ID from context
 */
export function getCorrelationId(): string | undefined {
	// Try AsyncLocalStorage first (server-side only)
	if (correlationStorage) {
		const asyncId = correlationStorage.getStore();
		if (asyncId) return asyncId;
	}

	// Fallback to global storage for testing
	return (globalThis as GlobalThis).__correlationId;
}

/**
 * Set correlation ID in the current context
 * Note: This is mainly for testing purposes. In production, use withCorrelationId
 */
export function setCorrelationId(correlationId: string): void {
	// Store in global for testing purposes
	(globalThis as GlobalThis).__correlationId = correlationId;
}

/**
 * Clear correlation ID from context
 * Note: This is mainly for testing purposes
 */
export function clearCorrelationId(): void {
	delete (globalThis as GlobalThis).__correlationId;
}

/**
 * Execute a function within a correlation ID context
 */
export async function withCorrelationId<T>(
	correlationId: string,
	fn: () => T | Promise<T>,
): Promise<T> {
	return correlationStorage?.run(correlationId, fn) || fn();
}

/**
 * Configuration options for correlation middleware
 */
export interface CorrelationMiddlewareOptions {
	headerName?: string;
	generateId?: () => string;
}

/**
 * Create Express/Next.js middleware for correlation ID handling
 */
export function createCorrelationMiddleware(
	options: CorrelationMiddlewareOptions = {},
) {
	const {
		headerName = "x-correlation-id",
		generateId = generateCorrelationId,
	} = options;

	return (
		req: MiddlewareRequest,
		res: MiddlewareResponse,
		next: () => void,
	) => {
		// Get correlation ID from headers or generate new one
		const headerValue = req.headers[headerName];
		const correlationId = Array.isArray(headerValue)
			? headerValue[0]
			: headerValue || generateId();

		// Store correlation ID in request object
		req.correlationId = correlationId;

		// Set response header
		res.setHeader(headerName, correlationId);

		// Continue to next middleware
		next();
	};
}

/**
 * Next.js middleware function for correlation ID handling
 */
export function nextCorrelationMiddleware(
	request: NextRequest,
	options: CorrelationMiddlewareOptions = {},
): { correlationId: string; response?: NextResponse } {
	const {
		headerName = "x-correlation-id",
		generateId = generateCorrelationId,
	} = options;

	// Get correlation ID from headers or generate new one
	const correlationId = request.headers.get(headerName) || generateId();

	return { correlationId };
}

/**
 * Get correlation ID from request headers
 */
export function getCorrelationIdFromRequest(
	request: NextRequest,
	headerName = "x-correlation-id",
): string | null {
	return request.headers.get(headerName);
}

/**
 * Add correlation ID to response headers
 */
export function addCorrelationIdToResponse(
	response: NextResponse,
	correlationId: string,
	headerName = "x-correlation-id",
): NextResponse {
	response.headers.set(headerName, correlationId);
	return response;
}

/**
 * Create a logger metadata object with correlation ID
 */
export function createCorrelationMetadata(
	additionalMeta: Record<string, unknown> = {},
) {
	const correlationId =
		getCorrelationId() || (globalThis as GlobalThis).__correlationId;

	return {
		...additionalMeta,
		...(correlationId && { correlationId }),
	};
}

/**
 * Utility to wrap async functions with correlation ID context
 */
export function withCorrelationContext<T extends (...args: never[]) => unknown>(
	fn: T,
	correlationId?: string,
): T {
	return ((...args: Parameters<T>) => {
		const id = correlationId || getCorrelationId() || generateCorrelationId();
		return withCorrelationId(id, () => fn(...args));
	}) as T;
}

/**
 * Extract correlation ID from various sources (headers, metadata, etc.)
 */
export function extractCorrelationId(
	sources: {
		headers?: Record<string, string | string[] | undefined>;
		metadata?: Record<string, unknown>;
		request?: NextRequest;
	},
	headerName = "x-correlation-id",
): string | undefined {
	// Try request headers first
	if (sources.request) {
		const id = sources.request.headers.get(headerName);
		if (id) return id;
	}

	// Try headers object
	if (sources.headers) {
		const id = sources.headers[headerName];
		if (typeof id === "string") return id;
		if (Array.isArray(id) && id.length > 0) return id[0];
	}

	// Try metadata
	if (sources.metadata?.correlationId) {
		return String(sources.metadata.correlationId);
	}

	return undefined;
}
