import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	observePageElements,
	runAutomationTask,
} from "@/app/actions/stagehand";
import { createApiLogger } from "@/lib/logging/factory";

const AutomationRequestSchema = z.object({
	type: z.enum(["action", "observe"]),
	url: z.string().refine(
		(url) => {
			try {
				new URL(url);
				return true;
			} catch {
				return false;
			}
		},
		{ message: "Invalid URL format" },
	),
	instructions: z.string().min(1),
	extractSchema: z
		.record(
			z.string(),
			z.enum(["string", "number", "boolean", "array", "object"]),
		)
		.optional(),
	sessionId: z.string().optional(),
	sessionConfig: z
		.object({
			headless: z.boolean().default(true),
			viewport: z
				.object({
					width: z.number().default(1280),
					height: z.number().default(720),
				})
				.optional(),
			logger: z.boolean().default(false),
		})
		.optional(),
});

export async function POST(request: NextRequest) {
	const logger = createApiLogger("stagehand/automation");

	try {
		const body = await request.json();
		const validatedRequest = AutomationRequestSchema.parse(body);

		logger.info("Stagehand automation request", {
			type: validatedRequest.type,
			url: validatedRequest.url,
			hasInstructions: Boolean(validatedRequest.instructions),
			hasExtractSchema: Boolean(validatedRequest.extractSchema),
			sessionId: validatedRequest.sessionId,
		});

		let result: {
			success: boolean;
			data?: unknown;
			error?: string;
			sessionId?: string;
			logs?: string[];
		};

		if (validatedRequest.type === "action") {
			result = await runAutomationTask(
				{
					url: validatedRequest.url,
					instructions: validatedRequest.instructions,
					extractSchema: validatedRequest.extractSchema,
				},
				validatedRequest.sessionId,
			);
		} else {
			result = await observePageElements(
				validatedRequest.url,
				validatedRequest.instructions,
				validatedRequest.sessionId,
			);
		}

		if (!result.success) {
			logger.error("Stagehand automation failed", {
				type: validatedRequest.type,
				error: result.error,
				sessionId: result.sessionId,
			});

			return NextResponse.json(
				{
					success: false,
					error: result.error || "Automation failed",
					logs: result.logs,
					sessionId: result.sessionId,
					timestamp: new Date().toISOString(),
				},
				{ status: 500 },
			);
		}

		logger.info("Stagehand automation completed", {
			type: validatedRequest.type,
			success: result.success,
			hasData: Boolean(result.data),
			sessionId: result.sessionId,
		});

		return NextResponse.json({
			success: true,
			data: result.data,
			sessionId: result.sessionId,
			logs: result.logs,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		logger.error("Stagehand automation API error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});

		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid request parameters",
					details: error.issues,
					timestamp: new Date().toISOString(),
				},
				{ status: 400 },
			);
		}

		return NextResponse.json(
			{
				success: false,
				error: "Internal server error",
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
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
export const runtime = "nodejs";
