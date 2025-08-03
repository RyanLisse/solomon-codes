/**
 * Simple health endpoint for E2E test environment
 * Does not use configuration service to avoid validation issues
 */

import { NextResponse } from "next/server";

export async function GET() {
	// Simple health check for test environment only
	if (process.env.NODE_ENV !== "test") {
		return NextResponse.json(
			{ error: "Test endpoint only available in test environment" },
			{ status: 404 },
		);
	}

	return NextResponse.json(
		{
			status: "healthy",
			timestamp: new Date().toISOString(),
			environment: "test",
			uptime: Math.round(process.uptime()),
			version: "test",
		},
		{
			status: 200,
			headers: {
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"Content-Type": "application/json",
			},
		},
	);
}
