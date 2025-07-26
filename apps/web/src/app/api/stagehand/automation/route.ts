import { NextRequest, NextResponse } from "next/server";
import { runAutomationTask, observePageElements } from "@/app/actions/stagehand";
import { z } from "zod";

const AutomationRequestSchema = z.object({
	type: z.enum(["action", "observe"]),
	url: z.string().url(),
	instructions: z.string().min(1),
	extractSchema: z.record(z.any()).optional(),
	sessionConfig: z.object({
		headless: z.boolean().default(true),
		viewport: z.object({
			width: z.number().default(1280),
			height: z.number().default(720),
		}).optional(),
		logger: z.boolean().default(false),
	}).optional(),
});

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const validatedRequest = AutomationRequestSchema.parse(body);

		let result;

		if (validatedRequest.type === "action") {
			result = await runAutomationTask(
				{
					url: validatedRequest.url,
					instructions: validatedRequest.instructions,
					extractSchema: validatedRequest.extractSchema,
				},
				validatedRequest.sessionConfig
			);
		} else {
			result = await observePageElements(
				validatedRequest.url,
				validatedRequest.instructions,
				validatedRequest.sessionConfig
			);
		}

		if (!result.success) {
			return NextResponse.json(
				{ 
					error: result.error || "Automation failed",
					logs: result.logs,
					sessionId: result.sessionId,
				},
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			data: result.data,
			sessionId: result.sessionId,
			logs: result.logs,
		});
	} catch (error) {
		console.error("Automation API error:", error);
		
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
		message: "Stagehand Automation API",
		endpoints: {
			POST: "Execute browser automation tasks",
		},
		parameters: {
			type: "action | observe",
			url: "string (URL to navigate to)",
			instructions: "string (automation instructions)",
			extractSchema: "object (optional - schema for data extraction)",
			sessionConfig: "object (optional - browser configuration)",
		},
		examples: {
			action: {
				type: "action",
				url: "https://example.com",
				instructions: "Click the login button and fill in the form",
				extractSchema: {
					title: "string",
					description: "string",
				},
			},
			observe: {
				type: "observe",
				url: "https://example.com",
				instructions: "Find all clickable buttons on the page",
			},
		},
	});
}