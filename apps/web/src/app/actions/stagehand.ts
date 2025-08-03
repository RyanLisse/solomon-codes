"use server";

import { createServiceLogger } from "@/lib/logging/factory";
import { getStagehandClient } from "@/lib/stagehand/client";
import type {
	AutomationResult,
	AutomationTask,
	SessionConfig,
} from "@/types/stagehand";
import { AutomationTaskSchema } from "@/types/stagehand";

export const createStagehandSession = async (
	config?: Partial<SessionConfig>,
): Promise<{ sessionId: string; success: boolean; error?: string }> => {
	const logger = createServiceLogger("stagehand-action");

	try {
		const client = getStagehandClient();

		// Check if Stagehand is configured
		if (!client.isConfigured()) {
			logger.warn("Stagehand not configured - missing API key or project ID");
			return {
				sessionId: "",
				success: false,
				error: "Stagehand not configured - missing API key or project ID",
			};
		}

		// Perform health check
		const healthCheck = await client.healthCheck();
		if (!healthCheck.healthy) {
			logger.error("Stagehand health check failed", {
				details: healthCheck.details,
			});
			return {
				sessionId: "",
				success: false,
				error: healthCheck.message,
			};
		}

		// Create session with defaults
		const sessionConfig: SessionConfig = {
			headless: true,
			logger: false,
			viewport: { width: 1280, height: 720 },
			...config,
		};
		const result = await client.createSession(sessionConfig);

		logger.info("Stagehand session created via action", {
			sessionId: result.sessionId,
			success: result.success,
		});

		return result;
	} catch (error) {
		logger.error("Failed to create Stagehand session", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		return {
			sessionId: "",
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

export const runAutomationTask = async (
	task: AutomationTask,
	sessionId?: string,
): Promise<AutomationResult> => {
	const logger = createServiceLogger("stagehand-automation");

	try {
		const validatedTask = AutomationTaskSchema.parse(task);
		const client = getStagehandClient();

		logger.info("Running automation task", {
			url: validatedTask.url,
			hasInstructions: Boolean(validatedTask.instructions),
			hasExtractSchema: Boolean(validatedTask.extractSchema),
			sessionId,
		});

		// Check if Stagehand is configured
		if (!client.isConfigured()) {
			logger.warn("Stagehand not configured for automation task");
			return {
				success: false,
				error: "Stagehand not configured - missing API key or project ID",
				logs: ["Stagehand not configured"],
			};
		}

		// Run the automation task
		const result = await client.runAutomationTask(validatedTask, sessionId);

		logger.info("Automation task completed", {
			success: result.success,
			hasData: Boolean(result.data),
			sessionId: result.sessionId,
		});

		return result;
	} catch (error) {
		logger.error("Automation task failed", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			task,
		});

		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			logs: [
				`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			],
		};
	}
};

export const observePageElements = async (
	url: string,
	instruction: string,
	sessionId?: string,
): Promise<AutomationResult> => {
	const logger = createServiceLogger("stagehand-observation");

	try {
		const client = getStagehandClient();

		logger.info("Observing page elements", {
			url,
			instruction,
			sessionId,
		});

		// Check if Stagehand is configured
		if (!client.isConfigured()) {
			logger.warn("Stagehand not configured for page observation");
			return {
				success: false,
				error: "Stagehand not configured - missing API key or project ID",
				logs: ["Stagehand not configured"],
			};
		}

		// Observe page elements
		const result = await client.observePageElements(
			url,
			instruction,
			sessionId,
		);

		logger.info("Page observation completed", {
			success: result.success,
			hasData: Boolean(result.data),
			sessionId: result.sessionId,
		});

		return result;
	} catch (error) {
		logger.error("Page observation failed", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			url,
			instruction,
		});

		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			logs: [
				`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			],
		};
	}
};

/**
 * Get Stagehand health status
 */
export const getStagehandHealth = async (): Promise<{
	healthy: boolean;
	message: string;
	details?: Record<string, unknown>;
}> => {
	const logger = createServiceLogger("stagehand-health");

	try {
		const client = getStagehandClient();
		const health = await client.healthCheck();

		logger.info("Stagehand health check completed", {
			healthy: health.healthy,
			message: health.message,
		});

		return health;
	} catch (error) {
		logger.error("Stagehand health check failed", {
			error: error instanceof Error ? error.message : String(error),
		});

		return {
			healthy: false,
			message: "Health check failed",
			details: {
				error: error instanceof Error ? error.message : String(error),
			},
		};
	}
};

/**
 * Close a Stagehand session
 */
export const closeStagehandSession = async (
	sessionId: string,
): Promise<{
	success: boolean;
	error?: string;
}> => {
	const logger = createServiceLogger("stagehand-session-close");

	try {
		const client = getStagehandClient();
		await client.closeSession(sessionId);

		logger.info("Stagehand session closed", { sessionId });

		return { success: true };
	} catch (error) {
		logger.error("Failed to close Stagehand session", {
			sessionId,
			error: error instanceof Error ? error.message : String(error),
		});

		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

/**
 * Get active Stagehand sessions
 */
export const getActiveStagehandSessions = async (): Promise<
	Array<{
		id: string;
		createdAt: Date;
		lastUsed: Date;
		isActive: boolean;
	}>
> => {
	const logger = createServiceLogger("stagehand-sessions");

	try {
		const client = getStagehandClient();
		const sessions = client.getActiveSessions();

		logger.info("Retrieved active Stagehand sessions", {
			count: sessions.length,
		});

		return sessions;
	} catch (error) {
		logger.error("Failed to get active Stagehand sessions", {
			error: error instanceof Error ? error.message : String(error),
		});

		return [];
	}
};
