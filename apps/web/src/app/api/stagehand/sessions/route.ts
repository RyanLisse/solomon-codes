import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	closeStagehandSession,
	getActiveStagehandSessions,
} from "@/app/actions/stagehand";
import { createApiLogger } from "@/lib/logging/factory";

const CloseSessionSchema = z.object({
	sessionId: z.string().min(1, "Session ID is required"),
});

/**
 * GET /api/stagehand/sessions
 * Get all active Stagehand sessions
 */
export async function GET() {
	const logger = createApiLogger("stagehand/sessions");

	try {
		logger.info("Active Stagehand sessions requested");

		const sessions = await getActiveStagehandSessions();

		logger.info("Active Stagehand sessions retrieved", {
			count: sessions.length,
		});

		return NextResponse.json({
			success: true,
			data: sessions,
			count: sessions.length,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		logger.error("Failed to get active Stagehand sessions", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});

		return NextResponse.json(
			{
				success: false,
				error: "Failed to get active sessions",
				details: {
					error: error instanceof Error ? error.message : String(error),
				},
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/stagehand/sessions
 * Close a specific Stagehand session
 */
export async function DELETE(request: NextRequest) {
	const logger = createApiLogger("stagehand/sessions");

	try {
		const body = await request.json();
		const { sessionId } = CloseSessionSchema.parse(body);

		logger.info("Closing Stagehand session", { sessionId });

		const result = await closeStagehandSession(sessionId);

		if (result.success) {
			logger.info("Stagehand session closed successfully", { sessionId });

			return NextResponse.json({
				success: true,
				message: "Session closed successfully",
				sessionId,
				timestamp: new Date().toISOString(),
			});
		}
		logger.error("Failed to close Stagehand session", {
			sessionId,
			error: result.error,
		});

		return NextResponse.json(
			{
				success: false,
				error: result.error || "Failed to close session",
				sessionId,
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	} catch (error) {
		logger.error("Stagehand session close endpoint error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});

		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid request data",
					details: error.issues,
					timestamp: new Date().toISOString(),
				},
				{ status: 400 },
			);
		}

		return NextResponse.json(
			{
				success: false,
				error: "Session close endpoint error",
				details: {
					error: error instanceof Error ? error.message : String(error),
				},
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}
