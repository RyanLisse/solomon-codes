import { NextResponse } from "next/server";
import { createApiLogger } from "@/lib/logging/factory";

export interface LivenessStatus {
	alive: boolean;
	timestamp: string;
	uptime: number;
	pid: number;
	memory: {
		rss: number;
		heapTotal: number;
		heapUsed: number;
		external: number;
		arrayBuffers: number;
	};
	cpu?: {
		user: number;
		system: number;
	};
	message: string;
	details?: {
		errors: string[];
		warnings: string[];
	};
}

function checkMemoryWarnings(
	memoryUsage: NodeJS.MemoryUsage,
	warnings: string[],
) {
	const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
	if (heapUsagePercent > 90) {
		warnings.push(`High heap usage: ${heapUsagePercent.toFixed(1)}%`);
	}

	const totalMemoryMB = memoryUsage.rss / 1024 / 1024;
	if (totalMemoryMB > 1024) {
		warnings.push(`High memory usage: ${totalMemoryMB.toFixed(1)}MB`);
	}
}

function checkUptimeWarnings(uptime: number, warnings: string[]) {
	if (uptime < 60) {
		warnings.push(`Low uptime: ${uptime.toFixed(1)}s - potential restart loop`);
	}
}

async function performRuntimeTests(liveness: LivenessStatus) {
	try {
		// Test basic JavaScript execution
		const testArray = [1, 2, 3];
		const testResult = testArray.map((x) => x * 2);
		if (testResult.length !== 3) {
			liveness.alive = false;
			liveness.details?.errors.push("Basic JavaScript execution test failed");
		}

		// Test async execution
		await new Promise((resolve) => setImmediate(resolve));
	} catch (error) {
		liveness.alive = false;
		liveness.details?.errors.push(
			`Runtime execution test failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function updateStatusMessage(liveness: LivenessStatus) {
	if (!liveness.alive) {
		liveness.message = "Application is not responding properly";
	} else if ((liveness.details?.warnings.length ?? 0) > 0) {
		liveness.message = "Application is alive but with warnings";
	}
}

/**
 * GET /api/health/liveness
 * Kubernetes-style liveness probe endpoint
 *
 * Indicates whether the application is alive and should continue running.
 * This endpoint should return 200 as long as the application process
 * is functioning and not deadlocked or in an unrecoverable state.
 */
export async function GET() {
	const logger = createApiLogger("health/liveness");

	try {
		logger.debug("Liveness probe requested");

		// Get process information
		const memoryUsage = process.memoryUsage();
		const cpuUsage = process.cpuUsage();

		const liveness: LivenessStatus = {
			alive: true,
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			pid: process.pid,
			memory: {
				rss: memoryUsage.rss,
				heapTotal: memoryUsage.heapTotal,
				heapUsed: memoryUsage.heapUsed,
				external: memoryUsage.external,
				arrayBuffers: memoryUsage.arrayBuffers,
			},
			cpu: {
				user: cpuUsage.user,
				system: cpuUsage.system,
			},
			message: "Application is alive",
			details: {
				errors: [],
				warnings: [],
			},
		};

		// Perform health checks
		checkMemoryWarnings(memoryUsage, liveness.details?.warnings || []);
		checkUptimeWarnings(liveness.uptime, liveness.details?.warnings || []);
		await performRuntimeTests(liveness);
		updateStatusMessage(liveness);

		// Determine HTTP status code
		const statusCode = liveness.alive ? 200 : 500;

		logger.debug("Liveness probe completed", {
			alive: liveness.alive,
			uptime: liveness.uptime,
			memoryUsageMB: (liveness.memory.rss / 1024 / 1024).toFixed(1),
			heapUsagePercent: (
				(liveness.memory.heapUsed / liveness.memory.heapTotal) *
				100
			).toFixed(1),
			errors: liveness.details?.errors.length ?? 0,
			warnings: liveness.details?.warnings.length ?? 0,
		});

		return NextResponse.json(liveness, { status: statusCode });
	} catch (error) {
		logger.error("Liveness probe error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});

		// Even if there's an error in the probe itself, we can still respond
		// which indicates the process is at least partially alive
		const errorLiveness: LivenessStatus = {
			alive: false,
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			pid: process.pid,
			memory: process.memoryUsage(),
			message: "Liveness probe error",
			details: {
				errors: [error instanceof Error ? error.message : String(error)],
				warnings: [],
			},
		};

		return NextResponse.json(errorLiveness, { status: 500 });
	}
}
