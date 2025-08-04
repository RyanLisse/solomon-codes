"use client";

/**
 * Client-safe logging utilities
 * This file provides logging functionality that works in browser environments
 */

export interface ClientLogger {
	debug(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string | Error, meta?: Record<string, unknown>): void;
	child(defaultMeta: Record<string, unknown>): ClientLogger;
}

/**
 * Client-side logger implementation
 */
class ClientLoggerImpl implements ClientLogger {
	private context: Record<string, unknown>;
	private component: string;

	constructor(component: string, context: Record<string, unknown> = {}) {
		this.component = component;
		this.context = { ...context };
	}

	private formatMessage(
		level: string,
		message: string,
		meta?: Record<string, unknown>,
	) {
		const timestamp = new Date().toISOString();
		const logData = {
			timestamp,
			level,
			component: this.component,
			message,
			...this.context,
			...meta,
		};

		return logData;
	}

	private log(level: string, message: string, meta?: Record<string, unknown>) {
		const logData = this.formatMessage(level, message, meta);

		// In development, use console with nice formatting
		if (process.env.NODE_ENV === "development") {
			const consoleMethod =
				level === "error"
					? "error"
					: level === "warn"
						? "warn"
						: level === "debug"
							? "debug"
							: "log";

			console[consoleMethod](
				`[${level.toUpperCase()}] ${this.component}:`,
				message,
				meta || "",
			);
		} else {
			// In production, send to analytics endpoint if available
			if (typeof window !== "undefined" && typeof window.fetch === "function") {
				fetch("/api/analytics/logs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(logData),
				}).catch(() => {
					// Fallback to console if analytics endpoint fails
					console.log(`[${level.toUpperCase()}] ${this.component}:`, message);
				});
			}
		}
	}

	debug(message: string, meta?: Record<string, unknown>): void {
		this.log("debug", message, meta);
	}

	info(message: string, meta?: Record<string, unknown>): void {
		this.log("info", message, meta);
	}

	warn(message: string, meta?: Record<string, unknown>): void {
		this.log("warn", message, meta);
	}

	error(message: string | Error, meta?: Record<string, unknown>): void {
		const errorMessage = message instanceof Error ? message.message : message;
		const errorMeta =
			message instanceof Error
				? { ...meta, stack: message.stack, name: message.name }
				: meta;

		this.log("error", errorMessage, errorMeta);
	}

	child(defaultMeta: Record<string, unknown>): ClientLogger {
		return new ClientLoggerImpl(this.component, {
			...this.context,
			...defaultMeta,
		});
	}
}

/**
 * Create a client-safe logger for components
 */
export function createClientLogger(
	component: string,
	context?: Record<string, unknown>,
): ClientLogger {
	return new ClientLoggerImpl(component, context);
}

/**
 * Context-aware logger for client components
 */
export interface ClientLoggerContext {
	component: string;
	userId?: string;
	sessionId?: string;
	correlationId?: string;
}

/**
 * Create a context-aware client logger
 */
export function createContextClientLogger(
	component: string,
	initialContext?: Partial<ClientLoggerContext>,
): ClientLogger {
	const context = {
		component,
		...initialContext,
		// Add browser-specific context
		userAgent:
			typeof window !== "undefined" ? window.navigator.userAgent : undefined,
		url: typeof window !== "undefined" ? window.location.href : undefined,
	};

	return new ClientLoggerImpl(component, context);
}

/**
 * Global error handler for client-side errors
 */
export class ClientErrorHandler {
	private logger: ClientLogger;

	constructor() {
		this.logger = createClientLogger("client-error-handler");
		this.setupGlobalErrorHandling();
	}

	private setupGlobalErrorHandling() {
		if (typeof window !== "undefined") {
			// Handle unhandled errors
			window.addEventListener("error", (event) => {
				this.logger.error("Unhandled error", {
					message: event.message,
					filename: event.filename,
					lineno: event.lineno,
					colno: event.colno,
					stack: event.error?.stack,
				});
			});

			// Handle unhandled promise rejections
			window.addEventListener("unhandledrejection", (event) => {
				this.logger.error("Unhandled promise rejection", {
					reason: event.reason,
					stack: event.reason?.stack,
				});
			});
		}
	}

	handleError(error: Error, context?: Record<string, unknown>) {
		this.logger.error(error, context);
	}
}

// Global client error handler instance
let globalClientErrorHandler: ClientErrorHandler | null = null;

/**
 * Get the global client error handler
 */
export function getGlobalClientErrorHandler(): ClientErrorHandler {
	if (!globalClientErrorHandler) {
		globalClientErrorHandler = new ClientErrorHandler();
	}
	return globalClientErrorHandler;
}

/**
 * Hook for React components to get a logger
 */
export function useClientLogger(
	component: string,
	context?: Record<string, unknown>,
) {
	return createClientLogger(component, context);
}
