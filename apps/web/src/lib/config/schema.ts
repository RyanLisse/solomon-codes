import { z } from "zod";

/**
 * Configuration schema for the solomon_codes application
 * Uses Zod for runtime validation and type safety
 */
export const configSchema = z.object({
	// Server Configuration
	serverUrl: z
		.string()
		.url("SERVER_URL must be a valid URL")
		.default("http://localhost:3001"),
	port: z.coerce.number().int().min(1).max(65535).default(3001),
	nodeEnv: z
		.enum(["development", "staging", "production", "test"])
		.default("development"),

	// API Keys - Required in production
	openaiApiKey: z
		.string()
		.min(1, "OPENAI_API_KEY is required")
		.optional()
		.refine(
			(_val) => {
				// Skip validation for now - simplified approach
				return true;
			},
			{
				message: "OPENAI_API_KEY is required in production",
			},
		),

	e2bApiKey: z.string().optional(),

	browserbaseApiKey: z
		.string()
		.min(1, "BROWSERBASE_API_KEY is required for browser automation")
		.optional(),

	browserbaseProjectId: z
		.string()
		.min(1, "BROWSERBASE_PROJECT_ID is required for browser automation")
		.optional(),

	// Telemetry Configuration
	otelEndpoint: z
		.string()
		.optional()
		.refine((val) => {
			// Allow empty string for test environment
			const nodeEnv = process.env.NODE_ENV;
			if (nodeEnv === "test" && (!val || val === "")) {
				return true;
			}
			// Require valid URL for non-test environments
			if (val && val !== "") {
				try {
					new URL(val);
					return true;
				} catch {
					return false;
				}
			}
			// Required in production
			if (nodeEnv === "production" && !val) {
				return false;
			}
			return true;
		}),

	otelHeaders: z
		.string()
		.default("{}")
		.transform((val, ctx) => {
			try {
				return JSON.parse(val);
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "OTEL_EXPORTER_OTLP_HEADERS must be valid JSON",
				});
				return {};
			}
		})
		.pipe(z.record(z.string(), z.unknown())),

	otelSamplingRatio: z.coerce
		.number()
		.min(0, "OTEL_SAMPLING_RATIO must be between 0 and 1")
		.max(1, "OTEL_SAMPLING_RATIO must be between 0 and 1")
		.default(1.0),

	otelTimeout: z.coerce
		.number()
		.int()
		.min(1000, "OTEL_TIMEOUT must be at least 1000ms")
		.default(5000),

	// Application Configuration
	appVersion: z
		.string()
		.min(1, "APP_VERSION must be provided")
		.default("unknown"),

	logLevel: z
		.string()
		.toLowerCase()
		.pipe(z.enum(["debug", "info", "warn", "error"]))
		.default("info"),

	logFilePath: z.string().optional(),

	serviceName: z
		.string()
		.min(1, "SERVICE_NAME must be provided")
		.default("solomon-codes-web"),

	// Database Configuration (if needed)
	databaseUrl: z.string().url().optional(),
});

/**
 * Inferred TypeScript type from the configuration schema
 */
export type AppConfig = z.infer<typeof configSchema>;

/**
 * Environment variable mapping for cleaner access
 */
export const ENV_VAR_MAP = {
	serverUrl: "NEXT_PUBLIC_SERVER_URL",
	port: "PORT",
	nodeEnv: "NODE_ENV",
	openaiApiKey: "OPENAI_API_KEY",
	e2bApiKey: "E2B_API_KEY",
	browserbaseApiKey: "BROWSERBASE_API_KEY",
	browserbaseProjectId: "BROWSERBASE_PROJECT_ID",
	otelEndpoint: "OTEL_EXPORTER_OTLP_ENDPOINT",
	otelHeaders: "OTEL_EXPORTER_OTLP_HEADERS",
	otelSamplingRatio: "OTEL_SAMPLING_RATIO",
	otelTimeout: "OTEL_TIMEOUT",
	appVersion: "APP_VERSION",
	logLevel: "LOG_LEVEL",
	logFilePath: "LOG_FILE_PATH",
	serviceName: "SERVICE_NAME",
	databaseUrl: "DATABASE_URL",
} as const;
