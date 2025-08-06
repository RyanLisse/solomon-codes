/**
 * Server-only configuration utilities
 * This file should only be imported in Node.js server contexts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCwd } from "../utils/runtime";
import { ConfigurationError } from "./index";
import { type AppConfig, configSchema, ENV_VAR_MAP } from "./schema";

/**
 * Load application version from package.json (server-only)
 */
export function loadAppVersionSync(): string {
	try {
		const rootPath = getCwd();
		const packageJsonPath = join(rootPath, "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
		return packageJson.version || "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Extract environment variables with server-side version loading
 */
export function extractEnvironmentVariablesSync(): Record<
	string,
	string | undefined
> {
	const envVars: Record<string, string | undefined> = {};

	for (const [configKey, envKey] of Object.entries(ENV_VAR_MAP)) {
		envVars[configKey] = process.env[envKey];
	}

	// Load app version from package.json if not set
	if (!envVars.appVersion) {
		envVars.appVersion = loadAppVersionSync();
	}

	return envVars;
}

/**
 * Validate configuration synchronously (server-only)
 */
export function validateConfigSync(): AppConfig {
	try {
		const envVars = extractEnvironmentVariablesSync();
		const result = configSchema.safeParse(envVars);

		if (!result.success) {
			console.error("❌ Configuration validation failed:", result.error.issues);
			throw new ConfigurationError(
				"Configuration validation failed - check environment variables",
			);
		}

		return result.data;
	} catch (error) {
		if (error instanceof ConfigurationError) {
			throw error;
		}

		console.error("❌ Unexpected configuration error:", error);
		throw new ConfigurationError(
			`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
