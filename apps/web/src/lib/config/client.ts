"use client";

/**
 * Client-safe configuration utilities
 * This file contains only configuration that can be safely used in the browser
 */

/**
 * Error severity levels for categorization and alerting
 */
export enum ErrorSeverity {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
	CRITICAL = "critical",
}

/**
 * Error categories for classification and routing
 */
export enum ErrorCategory {
	USER = "user",
	SYSTEM = "system",
	EXTERNAL = "external",
	SECURITY = "security",
	PERFORMANCE = "performance",
	CONFIGURATION = "configuration",
	VALIDATION = "validation",
	NETWORK = "network",
	DATABASE = "database",
}

/**
 * Base interface for all application errors
 */
export interface BaseApplicationError {
	id: string;
	message: string;
	severity: ErrorSeverity;
	category: ErrorCategory;
	timestamp: Date;
	context?: Record<string, unknown>;
	stack?: string;
	userId?: string;
	sessionId?: string;
	correlationId?: string;
	toStructuredError(): StructuredError;
}

/**
 * Structured error format for logging and monitoring
 */
export interface StructuredError {
	id: string;
	message: string;
	severity: ErrorSeverity;
	category: ErrorCategory;
	timestamp: string;
	context?: Record<string, unknown>;
	stack?: string;
	userId?: string;
	sessionId?: string;
	correlationId?: string;
	fingerprint: string;
}

/**
 * Configuration validation error with detailed information
 */
export class ConfigurationError extends Error {
	constructor(
		message: string,
		public readonly details: {
			variable?: string;
			expected?: string;
			received?: string;
			suggestion?: string;
		} = {},
	) {
		super(message);
		this.name = "ConfigurationError";
	}
}

/**
 * Create a structured error from basic error information
 * Client-safe version that doesn't require server-side dependencies
 */
export function createStructuredError(
	message: string,
	severity: ErrorSeverity = ErrorSeverity.MEDIUM,
	category: ErrorCategory = ErrorCategory.SYSTEM,
	context?: Record<string, unknown>,
): StructuredError {
	const timestamp = new Date();
	const id = `error_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`;

	// Create a simple fingerprint for client-side errors
	const fingerprint = btoa(message + severity + category).substr(0, 16);

	return {
		id,
		message,
		severity,
		category,
		timestamp: timestamp.toISOString(),
		context,
		fingerprint,
	};
}

/**
 * Client-safe environment variable access
 */
export function getClientEnv(key: string): string | undefined {
	if (typeof window !== "undefined") {
		// Browser environment - only access public env vars
		return process.env[`NEXT_PUBLIC_${key}`];
	}
	return undefined;
}

/**
 * Check if we're in a client-side environment
 */
export function isClientSide(): boolean {
	return typeof window !== "undefined";
}

/**
 * Check if we're in a server-side environment
 */
export function isServerSide(): boolean {
	return typeof window === "undefined";
}
