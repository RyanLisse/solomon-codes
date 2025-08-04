#!/usr/bin/env node

/**
 * Build-time environment variable validation script
 * Validates all required environment variables before build starts
 * Supports different deployment targets with specific validation rules
 */

const fs = require("node:fs");
const path = require("node:path");

// Environment variable definitions with validation rules
const ENV_DEFINITIONS = {
	// Core application variables
	NEXT_PUBLIC_SERVER_URL: {
		required: ["production", "staging"],
		optional: ["development"],
		validate: (value) => {
			if (!value) return true; // Allow empty for optional
			try {
				new URL(value);
				return true;
			} catch {
				return "Must be a valid URL";
			}
		},
		description: "Public server URL for the application",
	},

	NODE_ENV: {
		required: ["production", "staging", "development"],
		validate: (value) => {
			const valid = ["development", "staging", "production", "test"];
			return valid.includes(value) || `Must be one of: ${valid.join(", ")}`;
		},
		description: "Node.js environment",
	},

	// API Keys (required for production)
	OPENAI_API_KEY: {
		required: ["production", "staging"],
		optional: ["development"],
		validate: (value) => {
			if (!value) return true;
			// Allow placeholder values during build/CI - only enforce in runtime
			if (value.includes("placeholder") || value.includes("your_")) return true;
			return value.startsWith("sk-") || "Must start with sk-";
		},
		description: "OpenAI API key for AI features",
	},

	E2B_API_KEY: {
		required: ["production", "staging"],
		optional: ["development"],
		validate: (value) => {
			if (!value) return true;
			// Allow placeholder values during build/CI - only enforce in runtime
			if (value.includes("placeholder") || value.includes("your_")) return true;
			return value.length >= 32 || "Must be at least 32 characters";
		},
		description: "E2B API key for code execution",
	},

	BROWSERBASE_API_KEY: {
		required: ["production", "staging"],
		optional: ["development"],
		validate: (value) => {
			if (!value) return true;
			// Allow placeholder values during build/CI - only enforce in runtime
			if (value.includes("placeholder") || value.includes("your_")) return true;
			return true;
		},
		description: "Browserbase API key for browser automation",
	},

	BROWSERBASE_PROJECT_ID: {
		required: ["production", "staging"],
		optional: ["development"],
		description: "Browserbase project ID",
	},

	// Database configuration
	DATABASE_URL: {
		required: ["production", "staging"],
		optional: ["development"],
		validate: (value) => {
			if (!value) return true;
			return (
				value.startsWith("postgres://") ||
				value.startsWith("postgresql://") ||
				"Must be a valid PostgreSQL connection string"
			);
		},
		description: "PostgreSQL database connection string",
	},

	// Telemetry and monitoring
	OTEL_EXPORTER_OTLP_ENDPOINT: {
		required: ["production"],
		optional: ["staging", "development"],
		validate: (value) => {
			if (!value) return true;
			try {
				new URL(value);
				return true;
			} catch {
				return "Must be a valid URL";
			}
		},
		description: "OpenTelemetry OTLP endpoint",
	},

	OTEL_SAMPLING_RATIO: {
		optional: ["production", "staging", "development"],
		validate: (value) => {
			if (!value) return true;
			const num = Number.parseFloat(value);
			return (num >= 0 && num <= 1) || "Must be between 0 and 1";
		},
		description: "OpenTelemetry sampling ratio",
	},

	// Security
	JWT_SECRET: {
		required: ["production", "staging"],
		optional: ["development"],
		validate: (value) => {
			if (!value) return true;
			// Allow placeholder values during build/CI - only enforce in runtime
			if (value.includes("placeholder") || value.includes("your_")) return true;
			return value.length >= 32 || "Must be at least 32 characters";
		},
		description: "JWT signing secret",
	},

	// Logging
	LOG_LEVEL: {
		optional: ["production", "staging", "development"],
		validate: (value) => {
			if (!value) return true;
			const valid = ["error", "warn", "info", "debug", "trace"];
			return valid.includes(value) || `Must be one of: ${valid.join(", ")}`;
		},
		description: "Application log level",
	},

	SERVICE_NAME: {
		optional: ["production", "staging", "development"],
		description: "Service name for telemetry",
	},

	SERVICE_VERSION: {
		optional: ["production", "staging", "development"],
		description: "Service version for telemetry",
	},
};

// Deployment target specific configurations
const DEPLOYMENT_TARGETS = {
	cloudflare: {
		name: "Cloudflare Pages",
		requiredEnvVars: ["NEXT_PUBLIC_SERVER_URL"],
		optionalEnvVars: ["CF_PAGES_URL", "CF_PAGES_BRANCH"],
		validate: (env) => {
			const errors = [];

			// Cloudflare-specific validations
			if (
				env.NEXT_PUBLIC_SERVER_URL &&
				!env.NEXT_PUBLIC_SERVER_URL.includes("pages.dev") &&
				env.NODE_ENV === "production"
			) {
				console.warn(
					"⚠️  Consider using Cloudflare Pages URL for production deployment",
				);
			}

			return errors;
		},
	},

	railway: {
		name: "Railway",
		requiredEnvVars: ["DATABASE_URL"],
		optionalEnvVars: [
			"RAILWAY_PROJECT_ID",
			"RAILWAY_SERVICE_ID",
			"RAILWAY_ENVIRONMENT",
		],
		validate: (env) => {
			const errors = [];

			// Railway-specific validations
			if (env.DATABASE_URL && !env.DATABASE_URL.includes("railway.app")) {
				console.warn("⚠️  Consider using Railway PostgreSQL for database");
			}

			// RAILWAY_ENVIRONMENT is set automatically by Railway platform during deployment
			// Don't require it during build/CI phase
			if (!env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV === "production") {
				console.warn(
					"⚠️  RAILWAY_ENVIRONMENT not set - this should be automatically provided by Railway platform",
				);
			}

			return errors;
		},
	},

	vercel: {
		name: "Vercel",
		requiredEnvVars: [], // VERCEL_ENV is automatically set by Vercel during deployment
		optionalEnvVars: [
			"VERCEL_ENV",
			"VERCEL_URL",
			"VERCEL_PROJECT_PRODUCTION_URL",
		],
		validate: (env) => {
			const errors = [];

			// Vercel-specific validations
			if (env.VERCEL_ENV === "production" && !env.NEXT_PUBLIC_SERVER_URL) {
				errors.push(
					"NEXT_PUBLIC_SERVER_URL is required for Vercel production deployment",
				);
			}

			return errors;
		},
	},
};

/**
 * Get current environment
 */
function getCurrentEnvironment() {
	return process.env.NODE_ENV || "development";
}

/**
 * Get deployment target from environment variables
 */
function getDeploymentTarget() {
	if (process.env.CF_PAGES) return "cloudflare";
	if (process.env.RAILWAY_ENVIRONMENT) return "railway";
	if (process.env.VERCEL_ENV || process.env.VERCEL || process.env.VERCEL_URL)
		return "vercel";
	return null;
}

/**
 * Load environment variables from .env files
 */
function loadEnvFiles() {
	const envFiles = [".env.local", ".env", ".env.example"];
	const envVars = {};

	for (const file of envFiles) {
		processEnvFile(file, envVars);
	}

	return envVars;
}

/**
 * Process a single environment file and extract variables
 */
function processEnvFile(file, envVars) {
	const filePath = path.join(process.cwd(), file);

	if (!fs.existsSync(filePath)) {
		return;
	}

	const content = fs.readFileSync(filePath, "utf8");
	const lines = content.split("\n");

	for (const line of lines) {
		processEnvLine(line, envVars);
	}
}

/**
 * Process a single line from an environment file
 */
function processEnvLine(line, envVars) {
	const trimmed = line.trim();

	// Skip empty lines and comments
	if (!trimmed || trimmed.startsWith("#")) {
		return;
	}

	const [key, ...valueParts] = trimmed.split("=");

	// Skip malformed lines
	if (!key || valueParts.length === 0) {
		return;
	}

	const value = valueParts.join("=").replace(/^(["'])|(["'])$/g, "");
	const normalizedKey = key.trim();

	// Only set if not already defined (precedence: process.env > .env.local > .env > .env.example)
	if (!envVars[normalizedKey]) {
		envVars[normalizedKey] = process.env[normalizedKey] || value;
	}
}

/**
 * Validate a single environment variable
 */
function validateEnvVar(key, definition, value, environment) {
	const errors = [];
	const warnings = [];

	// Check if required
	const isRequired = definition.required?.includes(environment);

	if (isRequired && (!value || value.trim() === "")) {
		errors.push(`${key} is required for ${environment} environment`);
		return { errors, warnings };
	}

	// Skip validation if value is empty and variable is optional
	if ((!value || value.trim() === "") && !isRequired) {
		return { errors, warnings };
	}

	// Run custom validation if provided
	if (definition.validate && value) {
		const result = definition.validate(value);
		if (result !== true) {
			errors.push(`${key}: ${result}`);
		}
	}

	// Check for placeholder values
	const placeholderPatterns = [
		/your_.*_here/i,
		/replace.*with/i,
		/example/i,
		/test.*key/i,
		/dummy/i,
	];

	if (value && placeholderPatterns.some((pattern) => pattern.test(value))) {
		if (isRequired) {
			errors.push(`${key} appears to contain a placeholder value`);
		} else {
			warnings.push(`${key} appears to contain a placeholder value`);
		}
	}

	return { errors, warnings };
}

/**
 * Validate deployment target specific requirements
 */
function validateDeploymentTarget(envVars, target) {
	const errors = [];
	const warnings = [];

	if (!target || !DEPLOYMENT_TARGETS[target]) {
		return { errors, warnings };
	}

	const config = DEPLOYMENT_TARGETS[target];
	console.log(`🎯 Validating for deployment target: ${config.name}`);

	// Check target-specific required variables
	for (const envVar of config.requiredEnvVars || []) {
		if (!envVars[envVar]) {
			errors.push(`${envVar} is required for ${config.name} deployment`);
		}
	}

	// Run target-specific validation
	if (config.validate) {
		const targetErrors = config.validate(envVars);
		errors.push(...targetErrors);
	}

	return { errors, warnings };
}

/**
 * Generate environment validation report
 */
function generateValidationReport(results) {
	const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
	const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

	console.log("\n📊 Environment Validation Report");
	console.log("=".repeat(50));

	if (totalErrors === 0 && totalWarnings === 0) {
		console.log("✅ All environment variables are valid!");
		return true;
	}

	if (totalErrors > 0) {
		console.log(`❌ Found ${totalErrors} error(s):`);
		results.forEach((result) => {
			if (result.errors.length > 0) {
				result.errors.forEach((error) => console.log(`   • ${error}`));
			}
		});
	}

	if (totalWarnings > 0) {
		console.log(`⚠️  Found ${totalWarnings} warning(s):`);
		results.forEach((result) => {
			if (result.warnings.length > 0) {
				result.warnings.forEach((warning) => console.log(`   • ${warning}`));
			}
		});
	}

	return totalErrors === 0;
}

/**
 * Main validation function
 */
function validateEnvironment() {
	console.log("🔍 Starting build-time environment validation...\n");

	const environment = getCurrentEnvironment();
	const deploymentTarget = getDeploymentTarget();
	const envVars = loadEnvFiles();

	console.log(`📍 Environment: ${environment}`);
	if (deploymentTarget) {
		console.log(
			`🚀 Deployment target: ${DEPLOYMENT_TARGETS[deploymentTarget].name}`,
		);
	}
	console.log("");

	const results = [];

	// Validate each environment variable
	for (const [key, definition] of Object.entries(ENV_DEFINITIONS)) {
		const value = envVars[key];
		const result = validateEnvVar(key, definition, value, environment);

		if (result.errors.length > 0 || result.warnings.length > 0) {
			results.push({
				key,
				errors: result.errors,
				warnings: result.warnings,
			});
		}
	}

	// Validate deployment target specific requirements
	if (deploymentTarget) {
		const targetResult = validateDeploymentTarget(envVars, deploymentTarget);
		if (targetResult.errors.length > 0 || targetResult.warnings.length > 0) {
			results.push({
				key: `${deploymentTarget}-deployment`,
				errors: targetResult.errors,
				warnings: targetResult.warnings,
			});
		}
	}

	// Generate and display report
	const isValid = generateValidationReport(results);

	if (!isValid) {
		console.log("\n💡 Tips:");
		console.log("   • Copy .env.example to .env and fill in required values");
		console.log(
			"   • Check deployment platform documentation for required variables",
		);
		console.log(
			"   • Use secure random values for secrets (not placeholder text)",
		);
		console.log(
			"   • Verify URLs are accessible from your deployment environment",
		);

		process.exit(1);
	}

	console.log("\n🎉 Environment validation passed! Ready for build.");
}

// Run validation if this script is executed directly
if (require.main === module) {
	validateEnvironment();
}

module.exports = {
	validateEnvironment,
	ENV_DEFINITIONS,
	DEPLOYMENT_TARGETS,
};
