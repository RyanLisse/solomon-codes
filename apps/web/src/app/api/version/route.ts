import { NextResponse } from "next/server";
import { getConfigurationService } from "@/lib/config/service";
import { createApiLogger } from "@/lib/logging/factory";

/**
 * GET /api/version
 * Application version information endpoint for health checking and monitoring
 */
export async function GET() {
	const logger = createApiLogger("version");

	try {
		logger.info("Version information requested");

		const configService = getConfigurationService();
		const config = await configService.getConfiguration();
		const envInfo = await configService.getEnvironmentInfo();

		const versionInfo = {
			version: config.appVersion,
			serviceName: config.serviceName,
			environment: envInfo.environment,
			profile: envInfo.profile,
			description: envInfo.description,
			buildTimestamp: new Date().toISOString(),
			features: envInfo.features,
			uptime: process.uptime(),
			nodeVersion: process.version,
			platform: process.platform,
			timestamp: new Date().toISOString(),
		};

		logger.info("Version information retrieved", {
			version: versionInfo.version,
			environment: versionInfo.environment,
		});

		return NextResponse.json(versionInfo, {
			status: 200,
			headers: {
				"Cache-Control": "public, max-age=300", // Cache for 5 minutes
			},
		});
	} catch (error) {
		logger.error("Version endpoint error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});

		return NextResponse.json(
			{
				error: "Failed to retrieve version information",
				details: {
					error: error instanceof Error ? error.message : String(error),
				},
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}
