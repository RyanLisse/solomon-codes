// Conditional imports based on environment
import type { Logger, LoggerConfig, LogMetadata } from "./types";

// Conditional imports using dynamic requires (ESLint disable needed for this pattern)
/* eslint-disable @typescript-eslint/no-require-imports */
function getClientLogger() {
	try {
		return require("./client");
	} catch (_error) {
		// Fallback for test environments
		return {
			createClientLogger: () => ({
				info: () => {},
				warn: () => {},
				error: () => {},
				debug: () => {},
				child: () => ({
					info: () => {},
					warn: () => {},
					error: () => {},
					debug: () => {},
				}),
			}),
		};
	}
}

function getServerLogger() {
	try {
		return require("./server");
	} catch (_error) {
		// Fallback for test environments
		return {
			createServerLogger: () => ({
				info: () => {},
				warn: () => {},
				error: () => {},
				debug: () => {},
				child: () => ({
					info: () => {},
					warn: () => {},
					error: () => {},
					debug: () => {},
				}),
			}),
		};
	}
}
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Create logger with the specified configuration
 * Returns client-safe logger on client-side, server logger on server-side
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
	// Client-side: return client-safe logger
	if (typeof window !== "undefined") {
		const { createClientLogger } = getClientLogger();
		return createClientLogger(config?.serviceName || "app", config);
	}

	// Server-side: use server logger
	const { createServerLogger } = getServerLogger();
	return createServerLogger(config);
}

/**
 * Default logger instance
 */
let defaultLogger: Logger | null = null;

/**
 * Get the default logger instance (singleton)
 */
export function getLogger(): Logger {
	if (!defaultLogger) {
		defaultLogger = createLogger();
	}
	return defaultLogger;
}

/**
 * Create a child logger with additional metadata
 */
export function createChildLogger(metadata: LogMetadata): Logger {
	return getLogger().child(metadata);
}

/**
 * Reset the default logger (useful for testing)
 */
export function resetLogger(): void {
	defaultLogger = null;
}

// Export types for external use
export type { Logger, LoggerConfig, LogMetadata } from "./types";
