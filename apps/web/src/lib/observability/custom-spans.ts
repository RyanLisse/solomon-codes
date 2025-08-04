/**
 * Custom OpenTelemetry spans for business-critical operations
 */

import { type Span, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { createServerLogger } from "../logging/server";

const logger = createServerLogger({ serviceName: "custom-spans" });

// Get tracer instance
const tracer = trace.getTracer("vibeX-custom-spans", "1.0.0");

/**
 * Span attributes for consistent tagging
 */
export const SpanAttributes = {
	// User and session
	USER_ID: "vibeX.user.id",
	SESSION_ID: "vibeX.session.id",

	// Task operations
	TASK_ID: "vibeX.task.id",
	TASK_TYPE: "vibeX.task.type",
	TASK_MODE: "vibeX.task.mode",

	// VibeKit operations
	VIBEKIT_OPERATION: "vibeX.vibekit.operation",
	VIBEKIT_SANDBOX_TYPE: "vibeX.vibekit.sandbox_type",
	VIBEKIT_SANDBOX_ID: "vibeX.vibekit.sandbox_id",

	// GitHub operations
	GITHUB_OPERATION: "vibeX.github.operation",
	GITHUB_REPO: "vibeX.github.repository",
	GITHUB_PR_NUMBER: "vibeX.github.pr_number",

	// Database operations
	DB_OPERATION: "vibeX.db.operation",
	DB_TABLE: "vibeX.db.table",
	DB_QUERY_TYPE: "vibeX.db.query_type",

	// External API operations
	API_PROVIDER: "vibeX.api.provider",
	API_ENDPOINT: "vibeX.api.endpoint",
	API_METHOD: "vibeX.api.method",
} as const;

/**
 * Create a custom span with proper error handling
 */
export async function withSpan<T>(
	name: string,
	operation: (span: Span) => Promise<T>,
	attributes?: Record<string, string | number | boolean>,
): Promise<T> {
	return tracer.startActiveSpan(
		name,
		{ kind: SpanKind.INTERNAL },
		async (span: Span) => {
			try {
				// Add custom attributes
				if (attributes) {
					Object.entries(attributes).forEach(([key, value]) => {
						span.setAttributes({ [key]: value });
					});
				}

				const result = await operation(span);

				// Mark span as successful
				span.setStatus({ code: SpanStatusCode.OK });
				return result;
			} catch (error) {
				// Record the error
				span.recordException(error as Error);
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: error instanceof Error ? error.message : "Unknown error",
				});

				logger.error("Span operation failed", {
					spanName: name,
					error: error instanceof Error ? error.message : String(error),
					attributes,
				});

				throw error;
			} finally {
				span.end();
			}
		},
	);
}

/**
 * Instrument VibeKit code generation operations
 */
export async function instrumentVibeKitCodeGeneration<T>(
	taskId: string,
	taskType: string,
	operation: () => Promise<T>,
): Promise<T> {
	return withSpan(
		"vibeX.vibekit.generate_code",
		async (span) => {
			span.addEvent("code_generation_started", {
				timestamp: Date.now(),
				"vibeX.event_type": "start",
			});

			const result = await operation();

			span.addEvent("code_generation_completed", {
				timestamp: Date.now(),
				"vibeX.event_type": "complete",
			});

			return result;
		},
		{
			[SpanAttributes.TASK_ID]: taskId,
			[SpanAttributes.TASK_TYPE]: taskType,
			[SpanAttributes.VIBEKIT_OPERATION]: "generate_code",
		},
	);
}

/**
 * Instrument GitHub API operations
 */
export async function instrumentGitHubOperation<T>(
	operation: string,
	repository: string,
	apiCall: () => Promise<T>,
): Promise<T> {
	return withSpan(
		`vibeX.github.${operation}`,
		async (span) => {
			span.addEvent("github_api_call_started", {
				timestamp: Date.now(),
				"vibeX.event_type": "start",
			});

			const result = await apiCall();

			span.addEvent("github_api_call_completed", {
				timestamp: Date.now(),
				"vibeX.event_type": "complete",
			});

			return result;
		},
		{
			[SpanAttributes.GITHUB_OPERATION]: operation,
			[SpanAttributes.GITHUB_REPO]: repository,
			[SpanAttributes.API_PROVIDER]: "github",
		},
	);
}

/**
 * Instrument database operations
 */
export async function instrumentDatabaseOperation<T>(
	operation: string,
	table: string,
	queryType: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
	dbCall: () => Promise<T>,
): Promise<T> {
	return withSpan(
		`vibeX.db.${operation}`,
		async (span) => {
			const startTime = Date.now();

			const result = await dbCall();

			const duration = Date.now() - startTime;
			span.setAttributes({
				"vibeX.db.duration_ms": duration,
			});

			return result;
		},
		{
			[SpanAttributes.DB_OPERATION]: operation,
			[SpanAttributes.DB_TABLE]: table,
			[SpanAttributes.DB_QUERY_TYPE]: queryType,
		},
	);
}

/**
 * Instrument external API calls
 */
export async function instrumentExternalAPI<T>(
	provider: string,
	endpoint: string,
	method: string,
	apiCall: () => Promise<T>,
): Promise<T> {
	return withSpan(
		`vibeX.api.${provider}`,
		async (span) => {
			const startTime = Date.now();

			span.addEvent("external_api_call_started", {
				timestamp: startTime,
				"vibeX.event_type": "start",
			});

			const result = await apiCall();

			const duration = Date.now() - startTime;
			span.setAttributes({
				"vibeX.api.duration_ms": duration,
			});

			span.addEvent("external_api_call_completed", {
				timestamp: Date.now(),
				"vibeX.event_type": "complete",
			});

			return result;
		},
		{
			[SpanAttributes.API_PROVIDER]: provider,
			[SpanAttributes.API_ENDPOINT]: endpoint,
			[SpanAttributes.API_METHOD]: method,
		},
	);
}
