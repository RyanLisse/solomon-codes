"use server";

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

const AutomationTaskSchema = z.object({
	url: z.string().url(),
	instructions: z.string().min(1),
	extractSchema: z.record(z.any()).optional(),
});

const SessionConfigSchema = z.object({
	headless: z.boolean().default(true),
	viewport: z.object({
		width: z.number().default(1280),
		height: z.number().default(720),
	}).optional(),
	logger: z.boolean().default(false),
});

export type AutomationTask = z.infer<typeof AutomationTaskSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;

export interface AutomationResult {
	success: boolean;
	data?: any;
	error?: string;
	sessionId?: string;
	logs?: string[];
}

export const createStagehandSession = async (
	config: SessionConfig = {}
): Promise<{ sessionId: string; success: boolean; error?: string }> => {
	try {
		const stagehand = new Stagehand({
			env: "BROWSERBASE",
			apiKey: process.env.BROWSERBASE_API_KEY!,
			projectId: process.env.BROWSERBASE_PROJECT_ID!,
			headless: config.headless,
			viewport: config.viewport,
			logger: config.logger,
		});

		await stagehand.init();
		
		return {
			sessionId: stagehand.browserbaseSessionId || "unknown",
			success: true,
		};
	} catch (error) {
		console.error("Failed to create Stagehand session:", error);
		return {
			sessionId: "",
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

export const runAutomationTask = async (
	task: AutomationTask,
	sessionConfig: SessionConfig = {}
): Promise<AutomationResult> => {
	const validatedTask = AutomationTaskSchema.parse(task);
	const validatedConfig = SessionConfigSchema.parse(sessionConfig);

	let stagehand: Stagehand | null = null;
	const logs: string[] = [];

	try {
		logs.push("Initializing Stagehand session...");
		
		stagehand = new Stagehand({
			env: "BROWSERBASE",
			apiKey: process.env.BROWSERBASE_API_KEY!,
			projectId: process.env.BROWSERBASE_PROJECT_ID!,
			headless: validatedConfig.headless,
			viewport: validatedConfig.viewport,
			logger: validatedConfig.logger,
		});

		await stagehand.init();
		logs.push(`Session created: ${stagehand.browserbaseSessionId}`);

		logs.push(`Navigating to: ${validatedTask.url}`);
		await stagehand.page.goto(validatedTask.url);

		logs.push("Executing automation instructions...");
		await stagehand.act({
			action: validatedTask.instructions,
		});

		let extractedData = null;
		if (validatedTask.extractSchema) {
			logs.push("Extracting data with provided schema...");
			extractedData = await stagehand.extract({
				instruction: "Extract data according to the provided schema",
				schema: validatedTask.extractSchema,
			});
		}

		logs.push("Automation completed successfully");

		return {
			success: true,
			data: extractedData,
			sessionId: stagehand.browserbaseSessionId,
			logs,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logs.push(`Error: ${errorMessage}`);
		
		console.error("Automation task failed:", error);
		
		return {
			success: false,
			error: errorMessage,
			sessionId: stagehand?.browserbaseSessionId,
			logs,
		};
	} finally {
		if (stagehand) {
			try {
				await stagehand.close();
				logs.push("Session closed");
			} catch (closeError) {
				logs.push(`Warning: Failed to close session: ${closeError}`);
			}
		}
	}
};

export const observePageElements = async (
	url: string,
	instruction: string,
	sessionConfig: SessionConfig = {}
): Promise<AutomationResult> => {
	const validatedConfig = SessionConfigSchema.parse(sessionConfig);
	let stagehand: Stagehand | null = null;
	const logs: string[] = [];

	try {
		logs.push("Initializing observation session...");
		
		stagehand = new Stagehand({
			env: "BROWSERBASE",
			apiKey: process.env.BROWSERBASE_API_KEY!,
			projectId: process.env.BROWSERBASE_PROJECT_ID!,
			headless: validatedConfig.headless,
			viewport: validatedConfig.viewport,
			logger: validatedConfig.logger,
		});

		await stagehand.init();
		logs.push(`Session created: ${stagehand.browserbaseSessionId}`);

		logs.push(`Navigating to: ${url}`);
		await stagehand.page.goto(url);

		logs.push("Observing page elements...");
		const observations = await stagehand.observe({
			instruction,
		});

		logs.push("Observation completed");

		return {
			success: true,
			data: observations,
			sessionId: stagehand.browserbaseSessionId,
			logs,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logs.push(`Error: ${errorMessage}`);
		
		console.error("Page observation failed:", error);
		
		return {
			success: false,
			error: errorMessage,
			sessionId: stagehand?.browserbaseSessionId,
			logs,
		};
	} finally {
		if (stagehand) {
			try {
				await stagehand.close();
				logs.push("Session closed");
			} catch (closeError) {
				logs.push(`Warning: Failed to close session: ${closeError}`);
			}
		}
	}
};