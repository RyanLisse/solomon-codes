import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createStagehandSession } from "@/app/actions/stagehand";
import { createApiLogger } from "@/lib/logging/factory";

const CreateSessionSchema = z.object({
	headless: z.boolean().default(true),
	viewport: z
		.object({
			width: z.number().default(1280),
			height: z.number().default(720),
		})
		.optional(),
	logger: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
	const logger = createApiLogger("stagehand/session");

	try {
		const body = await request.json();
		const config = CreateSessionSchema.parse(body);

		const result = await createStagehandSession(config);

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error || "Failed to create session" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			sessionId: result.sessionId,
			success: true,
		});
	} catch (error) {
		logger.error("Session creation API error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});

		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: "Invalid request parameters", details: error.issues },
				{ status: 400 },
			);
		}

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function GET() {
	return NextResponse.json({
		message: "Stagehand Session API",
		endpoints: {
			POST: "Create a new browser automation session",
		},
		parameters: {
			headless: "boolean (default: true)",
			viewport: "{ width: number, height: number } (optional)",
			logger: "boolean (default: false)",
		},
	});
}
export const runtime = "nodejs";
