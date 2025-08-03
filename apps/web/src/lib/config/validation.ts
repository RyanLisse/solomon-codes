/**
 * Validation result interface
 */
export interface ValidationResult {
	success: boolean;
	errors: string[];
	warnings: string[];
	timestamp: Date;
	environment: string;
}

/**
 * Environment variable requirement definition
 */
export interface EnvVarRequirement {
	name: string;
	required: boolean;
	description: string;
	example?: string;
	validator?: (value: string) => boolean;
}

/**
 * Required environment variables by environment
 */
export const REQUIRED_ENV_VARS: Record<string, EnvVarRequirement[]> = {
	production: [
		{
			name: "OPENAI_API_KEY",
			required: true,
			description: "OpenAI API key for AI functionality",
			example: "sk-...",
		},
		{
			name: "BROWSERBASE_API_KEY",
			required: true,
			description: "BrowserBase API key for browser automation",
		},
		{
			name: "BROWSERBASE_PROJECT_ID",
			required: true,
			description: "BrowserBase project ID",
		},
		{
			name: "OTEL_EXPORTER_OTLP_ENDPOINT",
			required: true,
			description: "OpenTelemetry endpoint for production monitoring",
			example: "https://your-jaeger-endpoint.com/v1/traces",
			validator: (value) => value.startsWith("https://"),
		},
	],
	staging: [
		{
			name: "OPENAI_API_KEY",
			required: true,
			description: "OpenAI API key for AI functionality",
		},
		{
			name: "BROWSERBASE_API_KEY",
			required: false,
			description: "BrowserBase API key for browser automation testing",
		},
	],
	development: [
		{
			name: "OPENAI_API_KEY",
			required: false,
			description: "OpenAI API key (optional in development)",
		},
	],
	test: [
		// No required environment variables for test environment
		// All variables are optional and have defaults in .env.test
	],
};

/**
 * Optional environment variables with defaults
 */
export const OPTIONAL_ENV_VARS: EnvVarRequirement[] = [
	{
		name: "LOG_LEVEL",
		required: false,
		description: "Logging level (debug, info, warn, error)",
		example: "info",
	},
	{
		name: "LOG_FILE_PATH",
		required: false,
		description: "Path for log file output",
		example: "/var/log/solomon-codes.log",
	},
	{
		name: "OTEL_SAMPLING_RATIO",
		required: false,
		description: "OpenTelemetry sampling ratio (0.0 to 1.0)",
		example: "1.0",
		validator: (value) => {
			const num = Number.parseFloat(value);
			return !Number.isNaN(num) && num >= 0 && num <= 1;
		},
	},
	{
		name: "SERVICE_NAME",
		required: false,
		description: "Service name for telemetry and logging",
		example: "solomon-codes-web",
	},
];

/**
 * Validate environment variables for the current environment
 */
export function validateEnvironment(): ValidationResult {
	const environment = process.env.NODE_ENV || "development";
	const errors: string[] = [];
	const warnings: string[] = [];

	const requiredVars = REQUIRED_ENV_VARS[environment] || [];

	// Check required variables
	for (const envVar of requiredVars) {
		const value = process.env[envVar.name];

		if (envVar.required && !value) {
			errors.push(`Missing required environment variable: ${envVar.name}`);
			if (envVar.description) {
				errors.push(`  Description: ${envVar.description}`);
			}
			if (envVar.example) {
				errors.push(`  Example: ${envVar.name}=${envVar.example}`);
			}
		} else if (value && envVar.validator && !envVar.validator(value)) {
			errors.push(`Invalid value for environment variable: ${envVar.name}`);
			if (envVar.description) {
				errors.push(`  Description: ${envVar.description}`);
			}
		}
	}

	// Check optional variables and provide warnings for missing ones
	for (const envVar of OPTIONAL_ENV_VARS) {
		const value = process.env[envVar.name];

		if (!value) {
			warnings.push(`Optional environment variable not set: ${envVar.name}`);
			if (envVar.description) {
				warnings.push(`  Description: ${envVar.description}`);
			}
			if (envVar.example) {
				warnings.push(`  Default/Example: ${envVar.example}`);
			}
		} else if (envVar.validator && !envVar.validator(value)) {
			warnings.push(
				`Invalid value for optional environment variable: ${envVar.name}`,
			);
		}
	}

	return {
		success: errors.length === 0,
		errors,
		warnings,
		timestamp: new Date(),
		environment,
	};
}

/**
 * Validate specific required environment variables
 */
export function validateRequiredEnvVars(vars: string[]): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	for (const varName of vars) {
		const value = process.env[varName];
		if (!value) {
			errors.push(`Missing required environment variable: ${varName}`);
		}
	}

	return {
		success: errors.length === 0,
		errors,
		warnings,
		timestamp: new Date(),
		environment: process.env.NODE_ENV || "development",
	};
}

/**
 * Validate optional environment variables with defaults
 */
export function validateOptionalEnvVars(
	vars: Record<string, string>,
): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	for (const [varName, defaultValue] of Object.entries(vars)) {
		const value = process.env[varName];
		if (!value) {
			warnings.push(
				`Optional environment variable not set: ${varName} (using default: ${defaultValue})`,
			);
		}
	}

	return {
		success: true, // Optional vars don't cause failures
		errors,
		warnings,
		timestamp: new Date(),
		environment: process.env.NODE_ENV || "development",
	};
}

/**
 * Get environment-specific configuration requirements
 */
export function getEnvironmentRequirements(
	env: string = process.env.NODE_ENV || "development",
): EnvVarRequirement[] {
	return REQUIRED_ENV_VARS[env] || [];
}

/**
 * Check if all required environment variables are present for the current environment
 */
export function hasRequiredEnvironmentVariables(): boolean {
	const result = validateEnvironment();
	return result.success;
}

/**
 * Print environment validation results to console
 */
export function printValidationResults(result: ValidationResult): void {
	console.log(`\n🔍 Environment Validation (${result.environment}):`);

	if (result.success) {
		console.log("✅ All required environment variables are present");
	} else {
		console.log("❌ Environment validation failed:");
		for (const error of result.errors) {
			console.log(`  ${error}`);
		}
	}

	if (result.warnings.length > 0) {
		console.log("\n⚠️  Warnings:");
		for (const warning of result.warnings) {
			console.log(`  ${warning}`);
		}
	}

	console.log(`\nValidation completed at: ${result.timestamp.toISOString()}\n`);
}
