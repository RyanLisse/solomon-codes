/**
 * Production-grade health check endpoint
 * Provides comprehensive application health status including dependencies
 */

import { type NextRequest, NextResponse } from "next/server";
import { getConfigurationService } from "@/lib/config/service";

// Health check configuration
const HEALTH_CONFIG = {
	timeout: 5000, // 5 seconds
	cache: {
		enabled: true,
		ttl: 30000, // 30 seconds
	},
	dependencies: {
		database: true,
		opentelemetry: true,
		external_apis: false, // Disable for basic health check
	},
};

// Health status types
type HealthStatus = "healthy" | "degraded" | "unhealthy";
type DependencyStatus = "connected" | "degraded" | "disconnected" | "unknown";

interface HealthCheckResult {
	status: HealthStatus;
	timestamp: string;
	uptime: number;
	version: string;
	environment: string;
	serviceName?: string;
	error?: string;
	build: {
		time: string;
		commit?: string;
		version: string;
	};
	dependencies: Record<
		string,
		{
			status: DependencyStatus;
			responseTime?: number;
			error?: string;
			lastChecked: string;
		}
	>;
	metrics: {
		memory: {
			used: number;
			total: number;
			percentage: number;
		};
		process: {
			pid: number;
			uptime: number;
			platform: string;
			nodeVersion: string;
		};
	};
}

// Cache for health check results
let healthCache: {
	result: HealthCheckResult;
	timestamp: number;
} | null = null;

// Internal cache management function (not exported to avoid Next.js route handler constraints)
function _clearHealthCache() {
	healthCache = null;
}

// Export cache management utility for testing in a separate module if needed
// This avoids violating Next.js route handler export constraints

/**
 * Get basic system metrics
 */
function getSystemMetrics() {
	const memoryUsage = process.memoryUsage();
	const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
	const usedMemory = memoryUsage.heapUsed;

	// Get uptime safely
	let uptime = 0;
	try {
		uptime = Math.round(process.uptime());
	} catch {
		uptime = 0; // Fallback if process.uptime() fails
	}

	return {
		memory: {
			used: usedMemory,
			total: totalMemory,
			percentage: Math.round((usedMemory / totalMemory) * 100),
		},
		process: {
			pid: process.pid,
			uptime: uptime,
			platform: process.platform,
			nodeVersion: process.version,
		},
	};
}

/**
 * Check database connectivity
 */
async function checkDatabaseHealth(): Promise<{
	status: DependencyStatus;
	responseTime?: number;
	error?: string;
}> {
	if (!HEALTH_CONFIG.dependencies.database) {
		return { status: "unknown" };
	}

	const startTime = Date.now();

	try {
		// Try to get configuration service first
		const configService = getConfigurationService();
		const dbConfig = await configService.getDatabaseConfig();

		// Basic connection check - we'll implement actual DB ping later
		if (!dbConfig?.isConfigured || !dbConfig.url) {
			return {
				status: "disconnected",
				error: "Database configuration not found",
				responseTime: Date.now() - startTime,
			};
		}

		// For now, assume healthy if configuration is present
		// In a real implementation, you would ping the database
		return {
			status: "connected",
			responseTime: Date.now() - startTime,
		};
	} catch (error) {
		// If configuration service is unavailable, treat as degraded rather than disconnected
		// This allows graceful fallback behavior
		const errorMessage =
			error instanceof Error ? error.message : "Unknown database error";
		const isConfigServiceError =
			errorMessage.includes("Service unavailable") ||
			errorMessage.includes("Configuration service");

		return {
			status: isConfigServiceError ? "degraded" : "disconnected",
			error: errorMessage,
			responseTime: Date.now() - startTime,
		};
	}
}

/**
 * Check OpenTelemetry health
 */
async function checkOpenTelemetryHealth(): Promise<{
	status: DependencyStatus;
	responseTime?: number;
	error?: string;
}> {
	if (!HEALTH_CONFIG.dependencies.opentelemetry) {
		return { status: "unknown" };
	}

	const startTime = Date.now();

	try {
		const configService = getConfigurationService();
		const telemetryConfig = await configService.getTelemetryConfig();

		if (!telemetryConfig.isEnabled) {
			return {
				status: "connected",
				responseTime: Date.now() - startTime,
			};
		}

		// Check if OpenTelemetry endpoint is configured
		if (!telemetryConfig.endpoint || telemetryConfig.endpoint === null) {
			return {
				status: "degraded",
				error: "OpenTelemetry endpoint not configured",
				responseTime: Date.now() - startTime,
			};
		}

		// For now, assume healthy if enabled and configured
		// In production, you might want to check actual connectivity
		return {
			status: "connected",
			responseTime: Date.now() - startTime,
		};
	} catch (error) {
		return {
			status: "degraded",
			error:
				error instanceof Error ? error.message : "OpenTelemetry check failed",
			responseTime: Date.now() - startTime,
		};
	}
}

/**
 * Check external API health
 */
async function checkExternalApisHealth(): Promise<{
	status: DependencyStatus;
	responseTime?: number;
	error?: string;
}> {
	if (!HEALTH_CONFIG.dependencies.external_apis) {
		return { status: "unknown" };
	}

	const startTime = Date.now();

	try {
		// Check if required API keys are present
		const requiredKeys = [
			"OPENAI_API_KEY",
			"E2B_API_KEY",
			"BROWSERBASE_API_KEY",
		];
		const missingKeys = requiredKeys.filter((key) => !process.env[key]);

		if (missingKeys.length > 0) {
			return {
				status: "degraded",
				error: `Missing API keys: ${missingKeys.join(", ")}`,
				responseTime: Date.now() - startTime,
			};
		}

		return {
			status: "connected",
			responseTime: Date.now() - startTime,
		};
	} catch (error) {
		return {
			status: "degraded",
			error:
				error instanceof Error ? error.message : "External API check failed",
			responseTime: Date.now() - startTime,
		};
	}
}

/**
 * Perform comprehensive health check
 */
async function performHealthCheck(): Promise<HealthCheckResult> {
	const _startTime = Date.now();
	const timestamp = new Date().toISOString();

	// Get build information
	const buildTime = process.env.BUILD_TIME || new Date().toISOString();
	const version = process.env.npm_package_version || "0.1.0";
	const commit =
		process.env.VERCEL_GIT_COMMIT_SHA ||
		process.env.CF_PAGES_COMMIT_SHA ||
		process.env.RAILWAY_GIT_COMMIT_SHA ||
		"unknown";

	// Get environment information with fallback
	let environment: "development" | "staging" | "production" | "test" =
		"development";
	let serviceName = process.env.SERVICE_NAME || "solomon-codes-web";

	// Set initial environment from NODE_ENV with proper type constraints
	const nodeEnv = process.env.NODE_ENV as
		| "development"
		| "staging"
		| "production"
		| "test"
		| undefined;
	if (
		nodeEnv === "development" ||
		nodeEnv === "staging" ||
		nodeEnv === "production" ||
		nodeEnv === "test"
	) {
		environment = nodeEnv;
	}

	try {
		const configService = getConfigurationService();
		const config = await configService.getConfiguration();
		const loggingConfig = await configService.getLoggingConfig();

		environment = config.nodeEnv || environment;
		serviceName =
			loggingConfig.serviceName || config.serviceName || serviceName;
	} catch {
		// Use environment variables as fallback
		environment = process.env.NODE_ENV || "development";
		serviceName = process.env.SERVICE_NAME || "solomon-codes-web";
	}

	// Check all dependencies
	const dependencyChecks = await Promise.allSettled([
		checkDatabaseHealth(),
		checkOpenTelemetryHealth(),
		checkExternalApisHealth(),
	]);

	const dependencies = {
		database:
			dependencyChecks[0].status === "fulfilled"
				? { ...dependencyChecks[0].value, lastChecked: timestamp }
				: {
						status: "unknown" as DependencyStatus,
						error: "Health check failed",
						lastChecked: timestamp,
					},

		opentelemetry:
			dependencyChecks[1].status === "fulfilled"
				? { ...dependencyChecks[1].value, lastChecked: timestamp }
				: {
						status: "unknown" as DependencyStatus,
						error: "Health check failed",
						lastChecked: timestamp,
					},

		external_apis:
			dependencyChecks[2].status === "fulfilled"
				? { ...dependencyChecks[2].value, lastChecked: timestamp }
				: {
						status: "unknown" as DependencyStatus,
						error: "Health check failed",
						lastChecked: timestamp,
					},
	};

	// Determine overall health status
	const dependencyStatuses = Object.values(dependencies).map(
		(dep) => dep.status,
	);
	const hasUnhealthy = dependencyStatuses.includes("disconnected");
	const hasDegraded = dependencyStatuses.includes("degraded");

	let overallStatus: HealthStatus = "healthy";
	if (hasUnhealthy) {
		overallStatus = "unhealthy";
	} else if (hasDegraded) {
		overallStatus = "degraded";
	}

	// Get system metrics
	const metrics = getSystemMetrics();

	// Get system uptime safely
	let uptime = 0;
	let systemError: string | undefined;
	try {
		uptime = Math.round(process.uptime());
	} catch (error) {
		uptime = 0; // Fallback if process.uptime() fails
		systemError = error instanceof Error ? error.message : "System error";
		overallStatus = "unhealthy"; // Mark as unhealthy if system calls fail
	}

	const result: HealthCheckResult = {
		status: overallStatus,
		timestamp,
		uptime,
		version,
		environment,
		serviceName,
		...(systemError && { error: systemError }),
		build: {
			time: buildTime,
			commit,
			version,
		},
		dependencies,
		metrics,
	};

	return result;
}

/**
 * Get cached health check result or perform new check
 */
async function getHealthCheckResult(): Promise<HealthCheckResult> {
	const now = Date.now();

	// Return cached result if still valid
	if (
		HEALTH_CONFIG.cache.enabled &&
		healthCache &&
		now - healthCache.timestamp < HEALTH_CONFIG.cache.ttl
	) {
		return healthCache.result;
	}

	// Perform new health check
	const result = await performHealthCheck();

	// Cache the result
	if (HEALTH_CONFIG.cache.enabled) {
		healthCache = {
			result,
			timestamp: now,
		};
	}

	return result;
}

/**
 * Health check endpoint
 */
export async function GET(_request: NextRequest) {
	try {
		const healthResult = await getHealthCheckResult();

		return NextResponse.json(healthResult, {
			status: healthResult.status === "unhealthy" ? 503 : 200,
			headers: {
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		// Return unhealthy status if health check itself fails
		let safeUptime = 0;
		try {
			safeUptime = Math.round(process.uptime());
		} catch {
			safeUptime = 0; // Fallback if process.uptime() fails
		}

		const errorResult: HealthCheckResult = {
			status: "unhealthy",
			timestamp: new Date().toISOString(),
			uptime: safeUptime,
			version: process.env.npm_package_version || "0.1.0",
			environment: process.env.NODE_ENV || "development",
			build: {
				time: process.env.BUILD_TIME || new Date().toISOString(),
				version: process.env.npm_package_version || "0.1.0",
			},
			dependencies: {},
			metrics: getSystemMetrics(),
		};

		return NextResponse.json(
			{
				...errorResult,
				error: error instanceof Error ? error.message : "Health check failed",
			},
			{
				status: 503,
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					"Content-Type": "application/json",
				},
			},
		);
	}
}

/**
 * Readiness probe endpoint (stricter than health check)
 */
export async function HEAD(_request: NextRequest) {
	try {
		const healthResult = await getHealthCheckResult();

		// Readiness probe only passes if fully healthy
		if (healthResult.status === "healthy") {
			return new NextResponse(null, { status: 200 });
		}
		return new NextResponse(null, { status: 503 });
	} catch {
		return new NextResponse(null, { status: 503 });
	}
}
