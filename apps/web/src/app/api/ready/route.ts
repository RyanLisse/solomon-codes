/**
 * Kubernetes-style readiness probe endpoint
 * Stricter than health check - only returns 200 when application is fully ready to serve traffic
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Readiness probe endpoint
 * This endpoint is used by load balancers and orchestrators to determine
 * if the application is ready to receive traffic
 */
export async function GET(request: NextRequest) {
	try {
		// Import health check logic
		const healthModule = await import("../health/route");

		// Use the health check HEAD method for readiness
		const headRequest = new NextRequest(request.url, { method: "HEAD" });
		const response = await healthModule.HEAD(headRequest);

		if (response.status === 200) {
			return NextResponse.json(
				{
					status: "ready",
					timestamp: new Date().toISOString(),
					message: "Application is ready to serve traffic",
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
		return NextResponse.json(
			{
				status: "not_ready",
				timestamp: new Date().toISOString(),
				message: "Application is not ready to serve traffic",
			},
			{
				status: 503,
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					"Content-Type": "application/json",
				},
			},
		);
	} catch (error) {
		return NextResponse.json(
			{
				status: "not_ready",
				timestamp: new Date().toISOString(),
				message: "Readiness check failed",
				error: error instanceof Error ? error.message : "Unknown error",
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
 * HEAD method for simple readiness probe
 * Returns only status code without body for efficiency
 */
export async function HEAD(request: NextRequest) {
	try {
		// Import health check logic
		const healthModule = await import("../health/route");

		// Use the health check HEAD method
		return await healthModule.HEAD(request);
	} catch {
		return new NextResponse(null, { status: 503 });
	}
}
