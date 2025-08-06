import { NextResponse } from "next/server";
import { getStagehandHealth } from "@/app/actions/stagehand";
import {
	type ConfigurationService,
	getConfigurationService,
} from "@/lib/config/service";
import { createApiLogger } from "@/lib/logging/factory";

interface BrowserbaseConfig {
	isConfigured: boolean;
}

interface ApiConfig {
	browserbase: BrowserbaseConfig;
}

export interface StagehandHealthStatus {
	healthy: boolean;
	timestamp: string;
	service: string;
	version?: string;
	message: string;
	details: {
		configuration: {
			status: "healthy" | "unhealthy";
			browserbaseConfigured: boolean;
			message?: string;
		};
		connectivity: {
			status: "healthy" | "unhealthy";
			responseTime?: number;
			message?: string;
		};
		dependencies: {
			status: "healthy" | "unhealthy";
			message?: string;
		};
		errors?: string[];
		warnings?: string[];
	};
}

function createHealthStatus(): StagehandHealthStatus {
	return {
		healthy: true,
		timestamp: new Date().toISOString(),
		service: "stagehand",
		version: process.env.npm_package_version || "unknown",
		message: "Stagehand service is healthy",
		details: {
			configuration: {
				status: "healthy",
				browserbaseConfigured: false,
			},
			connectivity: {
				status: "healthy",
			},
			dependencies: {
				status: "healthy",
			},
			errors: [],
			warnings: [],
		},
	};
}

async function checkBrowserBaseConfiguration(
	healthStatus: StagehandHealthStatus,
	apiConfig: ApiConfig,
	configService: ConfigurationService,
) {
	healthStatus.details.configuration.browserbaseConfigured =
		apiConfig.browserbase.isConfigured;

	if (!apiConfig.browserbase.isConfigured) {
		healthStatus.details.configuration.status = "unhealthy";
		healthStatus.details.configuration.message = "BrowserBase not configured";

		if (await configService.isProduction()) {
			healthStatus.healthy = false;
			healthStatus.details.errors?.push(
				"BrowserBase configuration required in production",
			);
		} else {
			healthStatus.details.warnings?.push(
				"BrowserBase not configured - automation features disabled",
			);
		}
	} else {
		healthStatus.details.configuration.message =
			"BrowserBase configured successfully";
	}
}

async function checkStagehandConnectivity(
	healthStatus: StagehandHealthStatus,
	startTime: number,
) {
	try {
		const stagehandHealth = await getStagehandHealth();
		const responseTime = Date.now() - startTime;

		if (!stagehandHealth.healthy) {
			healthStatus.healthy = false;
			healthStatus.details.connectivity.status = "unhealthy";
			healthStatus.details.connectivity.message = stagehandHealth.message;
			healthStatus.details.errors?.push(
				`Stagehand connectivity failed: ${stagehandHealth.message}`,
			);
		} else {
			healthStatus.details.connectivity.status = "healthy";
			healthStatus.details.connectivity.responseTime = responseTime;
			healthStatus.details.connectivity.message =
				"Stagehand service responding";
		}

		// Include original Stagehand details if available
		if (stagehandHealth.details) {
			healthStatus.details = {
				...healthStatus.details,
				...stagehandHealth.details,
			};
		}
	} catch (error) {
		healthStatus.healthy = false;
		healthStatus.details.connectivity.status = "unhealthy";
		const errorMessage = error instanceof Error ? error.message : String(error);
		healthStatus.details.connectivity.message = `Stagehand check failed: ${errorMessage}`;
		healthStatus.details.errors?.push(
			`Stagehand health check error: ${errorMessage}`,
		);
	}
}

async function checkStagehandDependencies(
	healthStatus: StagehandHealthStatus,
	configService: ConfigurationService,
) {
	try {
		const requiredEnvVars = ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"];
		const missingVars = requiredEnvVars.filter(
			(varName) => !process.env[varName],
		);

		if (missingVars.length > 0) {
			if (await configService.isProduction()) {
				healthStatus.healthy = false;
				healthStatus.details.dependencies.status = "unhealthy";
				healthStatus.details.dependencies.message = `Missing required variables: ${missingVars.join(", ")}`;
				healthStatus.details.errors?.push(
					`Missing Stagehand dependencies: ${missingVars.join(", ")}`,
				);
			} else {
				healthStatus.details.warnings?.push(
					`Missing optional Stagehand variables: ${missingVars.join(", ")}`,
				);
			}
		} else {
			healthStatus.details.dependencies.message =
				"All Stagehand dependencies available";
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		healthStatus.details.dependencies.status = "unhealthy";
		healthStatus.details.dependencies.message = `Dependency check failed: ${errorMessage}`;
		healthStatus.details.warnings?.push(
			`Stagehand dependency check error: ${errorMessage}`,
		);
	}
}

function updateHealthMessage(healthStatus: StagehandHealthStatus) {
	if (!healthStatus.healthy) {
		healthStatus.message = "Stagehand service is unhealthy";
	} else if ((healthStatus.details.warnings?.length ?? 0) > 0) {
		healthStatus.message = "Stagehand service is healthy with warnings";
	}
}

function createErrorHealthStatus(error: unknown): StagehandHealthStatus {
	return {
		healthy: false,
		timestamp: new Date().toISOString(),
		service: "stagehand",
		message: "Health check endpoint error",
		details: {
			configuration: {
				status: "unhealthy",
				browserbaseConfigured: false,
				message: "Unable to check configuration",
			},
			connectivity: {
				status: "unhealthy",
				message: "Unable to check connectivity",
			},
			dependencies: {
				status: "unhealthy",
				message: "Unable to check dependencies",
			},
			errors: [error instanceof Error ? error.message : String(error)],
		},
	};
}

/**
 * GET /api/stagehand/health
 * Check Stagehand service health with comprehensive validation
 */
export async function GET() {
	const logger = createApiLogger("stagehand/health");
	const startTime = Date.now();

	try {
		logger.info("Stagehand health check requested");

		const configService = getConfigurationService();
		const apiConfig = await configService.getApiConfig();
		const healthStatus = createHealthStatus();

		// Run all health checks
		await checkBrowserBaseConfiguration(healthStatus, apiConfig, configService);
		await checkStagehandConnectivity(healthStatus, startTime);
		await checkStagehandDependencies(healthStatus, configService);
		updateHealthMessage(healthStatus);

		const statusCode = healthStatus.healthy ? 200 : 503;

		logger.info("Stagehand health check completed", {
			healthy: healthStatus.healthy,
			statusCode,
			responseTime: Date.now() - startTime,
			errors: healthStatus.details.errors?.length ?? 0,
			warnings: healthStatus.details.warnings?.length ?? 0,
		});

		return NextResponse.json(healthStatus, { status: statusCode });
	} catch (error) {
		logger.error("Stagehand health check endpoint error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});

		const errorHealth = createErrorHealthStatus(error);
		return NextResponse.json(errorHealth, { status: 500 });
	}
}
