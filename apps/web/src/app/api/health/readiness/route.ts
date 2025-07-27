import { NextResponse } from "next/server";
import { getStartupValidationService } from "@/lib/config/startup";
import { checkDatabaseHealth } from "@/lib/database/connection";
import { createApiLogger } from "@/lib/logging/factory";

export interface ReadinessStatus {
	ready: boolean;
	timestamp: string;
	checks: {
		startup: boolean;
		database: boolean;
		configuration: boolean;
	};
	message: string;
	details?: {
		errors: string[];
		warnings: string[];
	};
}

/**
 * GET /api/health/readiness
 * Kubernetes-style readiness probe endpoint
 * 
 * Indicates whether the application is ready to accept traffic.
 * This endpoint should return 200 when the application is fully
 * initialized and ready to serve requests.
 */
export async function GET() {
	const logger = createApiLogger("health/readiness");
	
	try {
		logger.debug("Readiness probe requested");
		
		const startupService = getStartupValidationService();
		const validationSummary = startupService.getValidationSummary();
		
		const readiness: ReadinessStatus = {
			ready: true,
			timestamp: new Date().toISOString(),
			checks: {
				startup: true,
				database: true,
				configuration: true,
			},
			message: "Application is ready",
			details: {
				errors: [],
				warnings: [],
			},
		};
		
		// Check if startup validation completed successfully
		if (!validationSummary.configurationValid) {
			readiness.ready = false;
			readiness.checks.configuration = false;
			readiness.details?.errors.push("Configuration validation failed");
		}
		
		// Check database readiness (critical for serving requests)
		try {
			const dbHealth = await checkDatabaseHealth();
			if (!dbHealth.isHealthy) {
				// Database issues are critical for readiness
				readiness.ready = false;
				readiness.checks.database = false;
				readiness.details?.errors.push(`Database not ready: ${dbHealth.errors.join(", ")}`);
			}
		} catch (error) {
			// Database connectivity issues prevent readiness
			readiness.ready = false;
			readiness.checks.database = false;
			const errorMessage = error instanceof Error ? error.message : String(error);
			readiness.details?.errors.push(`Database readiness check failed: ${errorMessage}`);
		}
		
		// Check if critical startup validations passed
		const startupMetrics = startupService.getStartupMetrics();
		const criticalSteps = ["environment", "configuration"];
		const failedCriticalSteps = startupMetrics.validationSteps
			.filter(step => criticalSteps.includes(step.name) && !step.success)
			.map(step => step.name);
		
		if (failedCriticalSteps.length > 0) {
			readiness.ready = false;
			readiness.checks.startup = false;
			readiness.details?.errors.push(`Critical startup steps failed: ${failedCriticalSteps.join(", ")}`);
		}
		
		// Add non-critical warnings
		const nonCriticalSteps = ["telemetry", "api-connectivity"];
		const failedNonCriticalSteps = startupMetrics.validationSteps
			.filter(step => nonCriticalSteps.includes(step.name) && !step.success)
			.map(step => step.name);
		
		if (failedNonCriticalSteps.length > 0) {
			readiness.details?.warnings.push(`Non-critical startup steps failed: ${failedNonCriticalSteps.join(", ")}`);
		}
		
		// Update message based on readiness status
		if (!readiness.ready) {
			readiness.message = "Application is not ready to accept traffic";
		} else if (readiness.details?.warnings.length ?? 0 > 0) {
			readiness.message = "Application is ready but with warnings";
		}
		
		// Determine HTTP status code
		const statusCode = readiness.ready ? 200 : 503;
		
		logger.debug("Readiness probe completed", {
			ready: readiness.ready,
			errors: readiness.details?.errors.length ?? 0,
			warnings: readiness.details?.warnings.length ?? 0,
		});
		
		return NextResponse.json(readiness, { status: statusCode });
		
	} catch (error) {
		logger.error("Readiness probe error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		
		const errorReadiness: ReadinessStatus = {
			ready: false,
			timestamp: new Date().toISOString(),
			checks: {
				startup: false,
				database: false,
				configuration: false,
			},
			message: "Readiness probe error",
			details: {
				errors: [error instanceof Error ? error.message : String(error)],
				warnings: [],
			},
		};
		
		return NextResponse.json(errorReadiness, { status: 503 });
	}
}