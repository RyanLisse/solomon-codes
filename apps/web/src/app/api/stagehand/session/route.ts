import { NextRequest, NextResponse } from "next/server";
import { createStagehandSession } from "@/app/actions/stagehand";
import { z } from "zod";

const CreateSessionSchema = z.object({
	headless: z.boolean().default(true),
	viewport: z.object({
		width: z.number().default(1280),
		height: z.number().default(720),
	}).optional(),
	logger: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const config = CreateSessionSchema.parse(body);

		const result = await createStagehandSession(config);

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error || "Failed to create session" },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			sessionId: result.sessionId,
			success: true,
		});
	} catch (error) {
		console.error("Session creation API error:", error);
		
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: "Invalid request parameters", details: error.errors },
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
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