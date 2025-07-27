// Database schema exports
export * from "./schema";

// Database types exports
export * from "./types";

// Database connection exports
export * from "./connection";

// Re-export commonly used functions for convenience
export {
	getDatabase,
	createDatabaseClient,
	checkDatabaseHealth,
	initializeDatabase,
	getDatabaseConfig,
} from "./connection";

export {
	tasks,
	environments,
	agentExecutions,
	observabilityEvents,
	agentMemory,
	workflows,
	workflowExecutions,
	executionSnapshots,
} from "./schema";

export type {
	Task,
	NewTask,
	TaskUpdate,
	Environment,
	NewEnvironment,
	EnvironmentUpdate,
	AgentExecution,
	NewAgentExecution,
	DatabaseConfig,
	DatabaseHealth,
} from "./types";
