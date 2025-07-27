// Stagehand Client
export {
	StagehandClient,
	getStagehandClient,
	resetStagehandClient,
	type StagehandClientConfig,
	type StagehandSession,
} from "./client";

// Re-export types from the types directory
export type {
	AutomationResult,
	AutomationTask,
	SessionConfig,
	ExtractedData,
	ObservationData,
	ExtractSchema,
} from "../../types/stagehand";

// Convenience utilities
export const StagehandUtils = {
	// Client management
	getClient: getStagehandClient,
	resetClient: resetStagehandClient,
	
	// Health checking
	checkHealth: async () => {
		const client = getStagehandClient();
		return client.healthCheck();
	},
	
	// Session management
	createSession: async (config?: any) => {
		const client = getStagehandClient();
		return client.createSession(config);
	},
	
	closeSession: async (sessionId: string) => {
		const client = getStagehandClient();
		return client.closeSession(sessionId);
	},
	
	getActiveSessions: () => {
		const client = getStagehandClient();
		return client.getActiveSessions();
	},
	
	// Automation
	runTask: async (task: any, sessionId?: string) => {
		const client = getStagehandClient();
		return client.runAutomationTask(task, sessionId);
	},
	
	observePage: async (url: string, instruction: string, sessionId?: string) => {
		const client = getStagehandClient();
		return client.observePageElements(url, instruction, sessionId);
	},
} as const;