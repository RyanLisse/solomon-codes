// Stagehand Client

// Re-export types from the types directory
export type {
	AutomationResult,
	AutomationTask,
	ExtractedData,
	ExtractSchema,
	ObservationData,
	SessionConfig,
} from "../../types/stagehand";
export {
	getStagehandClient,
	resetStagehandClient,
	StagehandClient,
	type StagehandClientConfig,
	type StagehandSession,
} from "./client";

// Convenience utilities
export const StagehandUtils = {
	// Client management
	getClient() {
		return getStagehandClient();
	},
	resetClient() {
		return resetStagehandClient();
	},

	// Health checking
	async checkHealth() {
		const client = getStagehandClient();
		return client.healthCheck();
	},

	// Session management
	async createSession(config?: any) {
		const client = getStagehandClient();
		return client.createSession(config);
	},

	async closeSession(sessionId: string) {
		const client = getStagehandClient();
		return client.closeSession(sessionId);
	},

	getActiveSessions() {
		const client = getStagehandClient();
		return client.getActiveSessions();
	},

	// Automation
	async runTask(task: any, sessionId?: string) {
		const client = getStagehandClient();
		return client.runAutomationTask(task, sessionId);
	},

	async observePage(url: string, instruction: string, sessionId?: string) {
		const client = getStagehandClient();
		return client.observePageElements(url, instruction, sessionId);
	},
} as const;
