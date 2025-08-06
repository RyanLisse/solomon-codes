/**
 * Secure Configuration Service
 * Handles validation and secure access to environment variables
 */

import { z } from "zod";

// Security error for configuration issues
export class SecurityConfigError extends Error {
	constructor(
		message: string,
		public details?: unknown,
	) {
		super(message);
		this.name = "SecurityConfigError";
	}
}

// API key validation patterns
const API_KEY_PATTERNS = {
	openai: /^sk-[a-zA-Z0-9]{48}$/,
	e2b: /^e2b_[a-zA-Z0-9]{40}$/, // E2B keys are 44 chars total (e2b_ + 40 chars)
	github: /^gh[ops]_[a-zA-Z0-9]{36}$/,
	browserbase: /^bb_live_[a-zA-Z0-9_]+$/, // Browserbase uses bb_live_ prefix with underscores
} as const;

// Secure configuration schema
const SecureConfigSchema = z.object({
	openai: z.object({
		apiKey: z.string().min(1, "OpenAI API key is required"),
	}),
	e2b: z.object({
		apiKey: z.string().min(1, "E2B API key is required"),
	}),
	github: z.object({
		clientId: z.string().min(1, "GitHub client ID is required"),
		clientSecret: z.string().min(1, "GitHub client secret is required"),
	}),
	browserbase: z.object({
		apiKey: z.string().min(1, "Browserbase API key is required"),
		projectId: z.string().min(1, "Browserbase project ID is required"),
	}),
	app: z.object({
		url: z.string().url("App URL must be valid"),
		environment: z.enum(["development", "staging", "production"]),
		version: z.string().min(1, "App version is required"),
		serviceName: z.string().min(1, "Service name is required"),
		logLevel: z.enum(["error", "warn", "info", "debug"]),
	}),
	telemetry: z.object({
		endpoint: z.string().url().optional(),
		headers: z.string().optional(),
		samplingRatio: z.number().min(0).max(1).optional(),
		timeout: z.number().positive().optional(),
	}),
});

export type SecureConfig = z.infer<typeof SecureConfigSchema>;

export class SecureConfigService {
	private static instance: SecureConfigService;
	private config: SecureConfig | null = null;

	private constructor() {}

	static getInstance(): SecureConfigService {
		if (!SecureConfigService.instance) {
			SecureConfigService.instance = new SecureConfigService();
		}
		return SecureConfigService.instance;
	}

	/**
	 * Validate API key format for security
	 */
	private validateApiKeyFormat(
		key: string,
		service: keyof typeof API_KEY_PATTERNS,
	): boolean {
		const pattern = API_KEY_PATTERNS[service];
		return pattern ? pattern.test(key) : false;
	}

	/**
	 * Load and validate configuration from environment
	 */
	private loadConfig(): SecureConfig {
		try {
			const rawConfig = {
				openai: {
					apiKey: process.env.OPENAI_API_KEY,
				},
				e2b: {
					apiKey: process.env.E2B_API_KEY,
				},
				github: {
					clientId: process.env.GITHUB_CLIENT_ID,
					clientSecret: process.env.GITHUB_CLIENT_SECRET,
				},
				browserbase: {
					apiKey: process.env.BROWSERBASE_API_KEY,
					projectId: process.env.BROWSERBASE_PROJECT_ID,
				},
				app: {
					url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
					environment:
						(process.env.NODE_ENV as
							| "development"
							| "staging"
							| "production") || "development",
					version: process.env.APP_VERSION || "unknown",
					serviceName: process.env.SERVICE_NAME || "solomon-codes-web",
					logLevel:
						(process.env.LOG_LEVEL?.toLowerCase() as
							| "error"
							| "warn"
							| "info"
							| "debug") || "info",
				},
				telemetry: {
					endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
					headers: process.env.OTEL_EXPORTER_OTLP_HEADERS,
					samplingRatio: process.env.OTEL_SAMPLING_RATIO
						? Number.parseFloat(process.env.OTEL_SAMPLING_RATIO)
						: undefined,
					timeout: process.env.OTEL_TIMEOUT
						? Number.parseInt(process.env.OTEL_TIMEOUT, 10)
						: undefined,
				},
			};

			// Validate schema
			const validatedConfig = SecureConfigSchema.parse(rawConfig);

			// Additional security validations
			this.performSecurityValidations(validatedConfig);

			return validatedConfig;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const issues = error.issues
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join(", ");
				throw new SecurityConfigError(
					`Configuration validation failed: ${issues}`,
				);
			}
			throw new SecurityConfigError(
				"Failed to load secure configuration",
				error,
			);
		}
	}

	/**
	 * Perform additional security validations
	 */
	private performSecurityValidations(config: SecureConfig): void {
		const validations = [
			{
				condition: !this.validateApiKeyFormat(config.openai.apiKey, "openai"),
				error: "OpenAI API key format is invalid",
			},
			{
				condition: !this.validateApiKeyFormat(config.e2b.apiKey, "e2b"),
				error: "E2B API key format is invalid",
			},
			{
				condition: !this.validateApiKeyFormat(
					config.browserbase.apiKey,
					"browserbase",
				),
				error: "Browserbase API key format is invalid",
			},
			{
				condition:
					config.app.environment === "production" &&
					config.app.url.includes("localhost"),
				error: "Production environment cannot use localhost URL",
			},
			{
				condition:
					config.app.environment === "production" && !config.telemetry.endpoint,
				error: "Production environment requires telemetry endpoint",
			},
		];

		const failures = validations.filter((v) => v.condition);
		if (failures.length > 0) {
			throw new SecurityConfigError(
				`Security validation failed: ${failures.map((f) => f.error).join(", ")}`,
			);
		}
	}

	/**
	 * Get secure configuration with validation
	 */
	getConfig(): SecureConfig {
		if (!this.config) {
			this.config = this.loadConfig();

			// Log configuration loaded (with masked sensitive values)
			console.info("Secure configuration loaded", {
				environment: this.config.app.environment,
				serviceName: this.config.app.serviceName,
				version: this.config.app.version,
				hasOpenAI: !!this.config.openai.apiKey,
				hasE2B: !!this.config.e2b.apiKey,
				hasTelemetry: !!this.config.telemetry.endpoint,
			});
		}

		return this.config;
	}

	/**
	 * Get specific service configuration
	 */
	getOpenAIConfig(): { apiKey: string } {
		return this.getConfig().openai;
	}

	getE2BConfig(): { apiKey: string } {
		return this.getConfig().e2b;
	}

	getGitHubConfig(): { clientId: string; clientSecret: string } {
		return this.getConfig().github;
	}

	getBrowserbaseConfig(): { apiKey: string; projectId: string } {
		return this.getConfig().browserbase;
	}

	getAppConfig() {
		return this.getConfig().app;
	}

	getTelemetryConfig() {
		return this.getConfig().telemetry;
	}

	/**
	 * Health check for configuration
	 */
	healthCheck(): { status: "healthy" | "unhealthy"; issues: string[] } {
		try {
			this.getConfig();
			return { status: "healthy", issues: [] };
		} catch (error) {
			const issues =
				error instanceof SecurityConfigError
					? [error.message]
					: ["Unknown configuration error"];

			return { status: "unhealthy", issues };
		}
	}

	/**
	 * Reset configuration (for testing)
	 */
	reset(): void {
		this.config = null;
	}
}

// Export singleton instance
export const secureConfig = SecureConfigService.getInstance();
