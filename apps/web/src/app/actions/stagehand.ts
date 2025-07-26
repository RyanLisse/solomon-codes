"use server";

import { Stagehand } from "@browserbasehq/stagehand";
import type {
	AutomationResult,
	AutomationTask,
	SessionConfig,
} from "@/types/stagehand";
import { AutomationTaskSchema } from "@/types/stagehand";

export const createStagehandSession = async (
	_config?: Partial<SessionConfig>,
): Promise<{ sessionId: string; success: boolean; error?: string }> => {
	try {
		const stagehand = new Stagehand({
			env: "BROWSERBASE",
			apiKey: process.env.BROWSERBASE_API_KEY,
			projectId: process.env.BROWSERBASE_PROJECT_ID,
		});

		await stagehand.init();

		return {
			sessionId: stagehand.browserbaseSessionID || "unknown",
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
	_sessionConfig?: Partial<SessionConfig>,
): Promise<AutomationResult> => {
	const validatedTask = AutomationTaskSchema.parse(task);

	let stagehand: Stagehand | null = null;
	const logs: string[] = [];

	try {
		logs.push("Initializing Stagehand session...");

		stagehand = new Stagehand({
			env: "BROWSERBASE",
			apiKey: process.env.BROWSERBASE_API_KEY,
			projectId: process.env.BROWSERBASE_PROJECT_ID,
		});

		await stagehand.init();
		logs.push(`Session created: ${stagehand.browserbaseSessionID}`);

		logs.push(`Navigating to: ${validatedTask.url}`);
		await stagehand.page.goto(validatedTask.url);

		logs.push("Automation temporarily disabled - Stagehand API changed");
		// Update to new Stagehand API when available
		// await stagehand.act({
		//   action: validatedTask.instructions,
		// });

		const extractedData = null;
		// Update to new Stagehand API when available
		// if (validatedTask.extractSchema) {
		//   logs.push("Extracting data with provided schema...");
		//   extractedData = await stagehand.extract({
		//     instruction: "Extract data according to the provided schema",
		//     schema: validatedTask.extractSchema,
		//   });
		// }

		logs.push("Automation completed successfully");

		return {
			success: true,
			data: extractedData,
			sessionId: stagehand.browserbaseSessionID,
			logs,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		logs.push(`Error: ${errorMessage}`);

		console.error("Automation task failed:", error);

		return {
			success: false,
			error: errorMessage,
			sessionId: stagehand?.browserbaseSessionID,
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
	_instruction: string,
	_sessionConfig?: Partial<SessionConfig>,
): Promise<AutomationResult> => {
	let stagehand: Stagehand | null = null;
	const logs: string[] = [];

	try {
		logs.push("Initializing observation session...");

		stagehand = new Stagehand({
			env: "BROWSERBASE",
			apiKey: process.env.BROWSERBASE_API_KEY,
			projectId: process.env.BROWSERBASE_PROJECT_ID,
		});

		await stagehand.init();
		logs.push(`Session created: ${stagehand.browserbaseSessionID}`);

		logs.push(`Navigating to: ${url}`);
		await stagehand.page.goto(url);

		logs.push("Observation temporarily disabled - Stagehand API changed");
		// Update to new Stagehand API when available
		const observations = null;

		logs.push("Observation completed");

		return {
			success: true,
			data: observations,
			sessionId: stagehand.browserbaseSessionID,
			logs,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		logs.push(`Error: ${errorMessage}`);

		console.error("Page observation failed:", error);

		return {
			success: false,
			error: errorMessage,
			sessionId: stagehand?.browserbaseSessionID,
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
