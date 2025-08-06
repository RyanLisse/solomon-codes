import { getCwd, isNodeRuntime } from "../utils/runtime";

// Note: These imports are only available in Node.js runtime, not Edge Runtime
// Only import if we're in a Node.js environment
const isNodeEnvironment = isNodeRuntime();

// Edge Runtime safe - no Node.js module imports
// Version loading will be handled server-side only

import type { z } from "zod";
import { type AppConfig, configSchema, ENV_VAR_MAP } from "./schema";

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
export interface BaseErrorContext {
	correlationId?: string;
	userId?: string;
	sessionId?: string;
	requestId?: string;
	component?: string;
	action?: string;
	metadata?: Record<string, unknown>;
	timestamp?: Date;
	stackTrace?: string;
	fingerprint?: string;
}

/**
 * Base class for all application errors with enhanced context
 */
export abstract class BaseApplicationError extends Error {
	public readonly severity: ErrorSeverity;
	public readonly category: ErrorCategory;
	public readonly context: BaseErrorContext;
	public readonly code: string;
	public readonly recoverable: boolean;
	public readonly retryable: boolean;

	constructor(
		message: string,
		code: string,
		severity: ErrorSeverity,
		category: ErrorCategory,
		context: BaseErrorContext = {},
		options: {
			recoverable?: boolean;
			retryable?: boolean;
		} = {},
	) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
		this.severity = severity;
		this.category = category;
		this.recoverable = options.recoverable ?? false;
		this.retryable = options.retryable ?? false;
		this.context = {
			...context,
			timestamp: context.timestamp ?? new Date(),
			stackTrace: context.stackTrace ?? this.stack,
		};

		// Ensure proper prototype chain for instanceof checks
		Object.setPrototypeOf(this, new.target.prototype);
	}

	/**
	 * Get error fingerprint for deduplication
	 */
	getFingerprint(): string {
		if (this.context.fingerprint) {
			return this.context.fingerprint;
		}

		// Generate fingerprint from error code, message, and component
		const components = [
			this.code,
			this.message.replace(/\d+/g, "N"), // Replace numbers for deduplication
			this.context.component,
		].filter(Boolean);

		return btoa(components.join(":")).slice(0, 16);
	}

	/**
	 * Convert error to structured format for logging/reporting
	 */
	toStructuredError() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			severity: this.severity,
			category: this.category,
			recoverable: this.recoverable,
			retryable: this.retryable,
			fingerprint: this.getFingerprint(),
			context: this.context,
			stack: this.stack,
		};
	}
}

/**
 * User-related errors (authentication, authorization, validation)
 */
export class UserError extends BaseApplicationError {
	constructor(
		message: string,
		code: string,
		context: BaseErrorContext = {},
		severity: ErrorSeverity = ErrorSeverity.LOW,
	) {
		super(message, code, severity, ErrorCategory.USER, context, {
			recoverable: true,
			retryable: false,
		});
	}
}

/**
 * System-related errors (internal failures, bugs)
 */
export class SystemError extends BaseApplicationError {
	constructor(
		message: string,
		code: string,
		context: BaseErrorContext = {},
		severity: ErrorSeverity = ErrorSeverity.HIGH,
	) {
		super(message, code, severity, ErrorCategory.SYSTEM, context, {
			recoverable: false,
			retryable: true,
		});
	}
}

/**
 * External service errors (API failures, third-party issues)
 */
export class ExternalServiceError extends BaseApplicationError {
	constructor(
		message: string,
		code: string,
		context: BaseErrorContext = {},
		severity: ErrorSeverity = ErrorSeverity.MEDIUM,
	) {
		super(message, code, severity, ErrorCategory.EXTERNAL, context, {
			recoverable: true,
			retryable: true,
		});
	}
}

/**
 * Network-related errors (timeouts, connectivity issues)
 */
export class NetworkError extends BaseApplicationError {
	constructor(
		message: string,
		code: string,
		context: BaseErrorContext = {},
		severity: ErrorSeverity = ErrorSeverity.MEDIUM,
	) {
		super(message, code, severity, ErrorCategory.NETWORK, context, {
			recoverable: true,
			retryable: true,
		});
	}
}

/**
 * Database-related errors
 */
export class DatabaseError extends BaseApplicationError {
	constructor(
		message: string,
		code: string,
		context: BaseErrorContext = {},
		severity: ErrorSeverity = ErrorSeverity.HIGH,
	) {
		super(message, code, severity, ErrorCategory.DATABASE, context, {
			recoverable: false,
			retryable: true,
		});
	}
}

/**
 * Performance-related errors (timeouts, resource exhaustion)
 */
export class PerformanceError extends BaseApplicationError {
	constructor(
		message: string,
		code: string,
		context: BaseErrorContext = {},
		severity: ErrorSeverity = ErrorSeverity.MEDIUM,
	) {
		super(message, code, severity, ErrorCategory.PERFORMANCE, context, {
			recoverable: true,
			retryable: true,
		});
	}
}

/**
 * Security-related errors
 */
export class SecurityError extends BaseApplicationError {
	constructor(
		message: string,
		code: string,
		context: BaseErrorContext = {},
		severity: ErrorSeverity = ErrorSeverity.CRITICAL,
	) {
		super(message, code, severity, ErrorCategory.SECURITY, context, {
			recoverable: false,
			retryable: false,
		});
	}
}

/**
 * Validation errors
 */
export class ValidationError extends UserError {
	constructor(
		message: string,
		code: string,
		public readonly validationErrors: Record<string, string[]>,
		context: BaseErrorContext = {},
	) {
		super(message, code, {
			...context,
			metadata: {
				...context.metadata,
				validationErrors,
			},
		});
	}
}

/**
 * Enhanced ConfigurationError that extends the base error system
 */
export class EnhancedConfigurationError extends BaseApplicationError {
	constructor(
		message: string,
		public readonly details: {
			variable?: string;
			expected?: string;
			received?: string;
			suggestion?: string;
		} = {},
		context: BaseErrorContext = {},
	) {
		super(
			message,
			"CONFIG_ERROR",
			ErrorSeverity.HIGH,
			ErrorCategory.CONFIGURATION,
			{
				...context,
				metadata: {
					...context.metadata,
					configDetails: details,
				},
			},
			{
				recoverable: false,
				retryable: false,
			},
		);
	}
}

/**
 * Error codes for common application errors
 */
export const ErrorCodes = {
	// User errors
	UNAUTHORIZED: "USER_UNAUTHORIZED",
	FORBIDDEN: "USER_FORBIDDEN",
	INVALID_INPUT: "USER_INVALID_INPUT",
	VALIDATION_FAILED: "USER_VALIDATION_FAILED",
	NOT_FOUND: "USER_NOT_FOUND",

	// System errors
	INTERNAL_ERROR: "SYSTEM_INTERNAL_ERROR",
	SERVICE_UNAVAILABLE: "SYSTEM_SERVICE_UNAVAILABLE",
	TIMEOUT: "SYSTEM_TIMEOUT",
	RESOURCE_EXHAUSTED: "SYSTEM_RESOURCE_EXHAUSTED",

	// External service errors
	EXTERNAL_API_ERROR: "EXTERNAL_API_ERROR",
	EXTERNAL_TIMEOUT: "EXTERNAL_TIMEOUT",
	EXTERNAL_RATE_LIMITED: "EXTERNAL_RATE_LIMITED",

	// Network errors
	NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
	NETWORK_UNAVAILABLE: "NETWORK_UNAVAILABLE",
	NETWORK_DNS_ERROR: "NETWORK_DNS_ERROR",

	// Database errors
	DATABASE_CONNECTION_ERROR: "DATABASE_CONNECTION_ERROR",
	DATABASE_QUERY_ERROR: "DATABASE_QUERY_ERROR",
	DATABASE_CONSTRAINT_ERROR: "DATABASE_CONSTRAINT_ERROR",

	// Performance errors
	PERFORMANCE_TIMEOUT: "PERFORMANCE_TIMEOUT",
	PERFORMANCE_MEMORY_ERROR: "PERFORMANCE_MEMORY_ERROR",

	// Security errors
	SECURITY_BREACH: "SECURITY_BREACH",
	SECURITY_SUSPICIOUS_ACTIVITY: "SECURITY_SUSPICIOUS_ACTIVITY",

	// Configuration errors
	CONFIG_ERROR: "CONFIG_ERROR",
	CONFIG_MISSING: "CONFIG_MISSING",
	CONFIG_INVALID: "CONFIG_INVALID",
} as const;

/**
 * Helper function to create structured error from any error
 */
export function createStructuredError(
	error: unknown,
	context: BaseErrorContext = {},
): BaseApplicationError {
	if (error instanceof BaseApplicationError) {
		return error;
	}

	if (error instanceof Error) {
		// Convert standard Error to SystemError
		return new SystemError(error.message, ErrorCodes.INTERNAL_ERROR, {
			...context,
			stackTrace: error.stack,
		});
	}

	// Handle non-Error types (strings, objects, etc.)
	const message = typeof error === "string" ? error : "Unknown error occurred";
	return new SystemError(message, ErrorCodes.INTERNAL_ERROR, {
		...context,
		metadata: {
			...context.metadata,
			originalError: error,
		},
	});
}

/**
 * Helper function to determine if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof BaseApplicationError) {
		return error.retryable;
	}

	// Default retry logic for non-application errors
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("timeout") ||
			message.includes("network") ||
			message.includes("connection") ||
			message.includes("rate limit")
		);
	}

	return false;
}

/**
 * Helper function to determine error severity from HTTP status codes
 */
export function getErrorSeverityFromStatus(status: number): ErrorSeverity {
	if (status >= 500) return ErrorSeverity.HIGH;
	if (status >= 400) return ErrorSeverity.MEDIUM;
	return ErrorSeverity.LOW;
}

/**
 * Load application version from package.json (async, Edge Runtime safe)
 */
async function loadAppVersion(): Promise<string> {
	try {
		// Check for Edge Runtime first - if detected, early return
		if (
			typeof globalThis !== "undefined" &&
			(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime
		) {
			return "unknown";
		}

		// Only attempt to read in Node.js environment
		if (!isNodeEnvironment) {
			return "unknown";
		}

		// Double-check runtime environment before dynamic imports
		const proc = (globalThis as { process?: NodeJS.Process }).process;
		if (!proc?.versions?.node) {
			return "unknown";
		}

		// Use eval to hide imports from static analysis in Edge Runtime
		const fs = await eval('import("node:fs")');
		const path = await eval('import("node:path")');

		// Edge Runtime safe path resolution
		const rootPath = getCwd();
		const packageJsonPath = path.join(rootPath, "package.json");
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
		return packageJson.version || "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Extract environment variables based on the mapping (async, Edge Runtime safe)
 */
async function extractEnvironmentVariables(): Promise<
	Record<string, string | undefined>
> {
	const envVars: Record<string, string | undefined> = {};

	for (const [configKey, envKey] of Object.entries(ENV_VAR_MAP)) {
		envVars[configKey] = process.env[envKey];
	}

	// Special handling for app version - load from package.json if not set
	if (!envVars.appVersion) {
		envVars.appVersion = await loadAppVersion();
	}

	return envVars;
}

/**
 * Format validation errors into user-friendly messages
 */
function formatValidationErrors(zodError: z.ZodError): ConfigurationError[] {
	// Handle case where ZodError is passed directly
	const errors = zodError.issues;

	if (!errors || !Array.isArray(errors) || errors.length === 0) {
		console.error(
			"❌ No validation errors found in ZodError structure:",
			zodError,
		);
		return [
			new ConfigurationError(
				"Configuration validation failed - check environment variables",
			),
		];
	}

	function getExpectedValue(error: { code: string; [key: string]: unknown }) {
		if (error.code === "invalid_union") {
			return "valid enum value";
		}
		if (error.code === "invalid_type") {
			return (
				(error as unknown as { expected?: string }).expected || "valid type"
			);
		}
		return "valid value";
	}

	return errors.map((error) => {
		const path =
			error.path && Array.isArray(error.path) && error.path.length > 0
				? error.path.join(".")
				: "unknown";
		const envVar = Object.entries(ENV_VAR_MAP).find(
			([key]) => key === error.path?.[0],
		)?.[1];

		let suggestion = "";
		if (envVar) {
			if (error.code === "invalid_union") {
				// Handle union/enum validation errors with available options
				suggestion = `Set the ${envVar} environment variable to a valid enum value`;
			} else if (error.code === "invalid_type") {
				const typeError = error as unknown as {
					expected?: string;
					received?: string;
				};
				suggestion = `Set the ${envVar} environment variable (expected ${typeError.expected || "valid type"}, got ${typeError.received || "invalid type"})`;
			} else {
				suggestion = `Set the ${envVar} environment variable correctly`;
			}
		}

		return new ConfigurationError(
			`Configuration validation failed for '${path}': ${error.message}`,
			{
				variable: envVar,
				expected: getExpectedValue(error),
				received:
					error.code === "invalid_type"
						? (error as unknown as { received?: string }).received ||
							"invalid type"
						: "invalid value",
				suggestion,
			},
		);
	});
}

/**
 * Validate and parse configuration from environment variables
 * Implements fail-fast validation with clear error messages (async, Edge Runtime safe)
 */
export async function validateConfig(): Promise<AppConfig> {
	try {
		const envVars = await extractEnvironmentVariables();
		const result = configSchema.safeParse(envVars);

		if (!result.success) {
			// Safely handle Zod errors
			let errors: ConfigurationError[];
			try {
				console.log("❌ Validation failed, raw error:", result.error);
				errors = formatValidationErrors(result.error);
			} catch (formatError) {
				console.error("❌ Error formatting validation errors:", formatError);
				// Fallback error
				throw new ConfigurationError(
					"Configuration validation failed with formatting error",
					{ suggestion: "Check your environment variables" },
				);
			}

			// Log all configuration errors - keep console for critical startup errors
			console.error("❌ Configuration validation failed:");
			for (const error of errors) {
				console.error(`  • ${error.message}`);
				if (error.details.suggestion) {
					console.error(`    💡 ${error.details.suggestion}`);
				}
			}

			// Throw the first error to fail fast
			throw errors[0];
		}

		return result.data;
	} catch (error) {
		if (error instanceof ConfigurationError) {
			throw error;
		}

		// Better error details for debugging
		console.error("❌ Unexpected configuration error:", error);
		throw new ConfigurationError(
			`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Global configuration instance
 * Loaded once at application startup
 */
let _config: AppConfig | null = null;
let _configPromise: Promise<AppConfig> | null = null;

/**
 * Get the validated application configuration (async, Edge Runtime safe)
 * Loads configuration on first access
 */
export async function getConfig(): Promise<AppConfig> {
	if (!_config) {
		if (_configPromise === null) {
			_configPromise = validateConfig();
		}
		_config = await _configPromise;
	}
	return _config;
}

/**
 * Get the validated application configuration (sync version for backward compatibility)
 * Returns cached config or throws if not loaded
 */
export function getConfigSync(): AppConfig {
	if (!_config) {
		throw new ConfigurationError(
			"Configuration not loaded. Call getConfig() first or use getConfigSync() only after config is initialized.",
		);
	}
	return _config;
}

/**
 * Reset configuration (primarily for testing)
 */
export function resetConfig(): void {
	_config = null;
	_configPromise = null;
}

/**
 * Check if configuration is loaded
 */
export function isConfigLoaded(): boolean {
	return _config !== null;
}

// Export types and schema for external use
export type { AppConfig } from "./schema";
export { configSchema, ENV_VAR_MAP } from "./schema";
