import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
	agentExecutions,
	agentMemory,
	environments,
	executionSnapshots,
	observabilityEvents,
	tasks,
	workflowExecutions,
	workflows,
} from "./schema";

// Task types
export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;
export type TaskUpdate = Partial<Omit<NewTask, "id" | "createdAt">>;

// Environment types
export type Environment = InferSelectModel<typeof environments>;
export type NewEnvironment = InferInsertModel<typeof environments>;
export type EnvironmentUpdate = Partial<
	Omit<NewEnvironment, "id" | "createdAt">
>;

// Agent execution types
export type AgentExecution = InferSelectModel<typeof agentExecutions>;
export type NewAgentExecution = InferInsertModel<typeof agentExecutions>;
export type AgentExecutionUpdate = Partial<
	Omit<NewAgentExecution, "id" | "startedAt">
>;

// Observability event types
export type ObservabilityEvent = InferSelectModel<typeof observabilityEvents>;
export type NewObservabilityEvent = InferInsertModel<
	typeof observabilityEvents
>;

// Agent memory types
export type AgentMemory = InferSelectModel<typeof agentMemory>;
export type NewAgentMemory = InferInsertModel<typeof agentMemory>;
export type AgentMemoryUpdate = Partial<
	Omit<NewAgentMemory, "id" | "createdAt">
>;

// Workflow types
export type Workflow = InferSelectModel<typeof workflows>;
export type NewWorkflow = InferInsertModel<typeof workflows>;
export type WorkflowUpdate = Partial<Omit<NewWorkflow, "id" | "createdAt">>;

// Workflow execution types
export type WorkflowExecution = InferSelectModel<typeof workflowExecutions>;
export type NewWorkflowExecution = InferInsertModel<typeof workflowExecutions>;
export type WorkflowExecutionUpdate = Partial<
	Omit<NewWorkflowExecution, "id" | "startedAt">
>;

// Execution snapshot types
export type ExecutionSnapshot = InferSelectModel<typeof executionSnapshots>;
export type NewExecutionSnapshot = InferInsertModel<typeof executionSnapshots>;

// Task status enum (matching existing localStorage implementation)
export type TaskStatus = "IN_PROGRESS" | "DONE" | "MERGED";

// Task mode enum (matching existing localStorage implementation)
export type TaskMode = "code" | "ask";

// Message type (matching existing localStorage implementation)
export interface TaskMessage {
	role: "user" | "assistant";
	type: string;
	data: Record<string, unknown>;
}

// Pull request response type (matching existing localStorage implementation)
export interface PullRequestResponse {
	id: number;
	number: number;
	title: string;
	body: string;
	state: string;
	html_url: string;
	created_at: string;
	updated_at: string;
	merged_at?: string;
	user: {
		login: string;
		avatar_url: string;
	};
}

// Agent execution status enum
export type AgentExecutionStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "cancelled"
	| "timeout";

// Workflow execution status enum
export type WorkflowExecutionStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "cancelled"
	| "paused";

// Observability event severity enum
export type EventSeverity = "debug" | "info" | "warn" | "error" | "critical";

// Agent memory type enum
export type MemoryType =
	| "conversation"
	| "knowledge"
	| "context"
	| "preference"
	| "skill"
	| "experience";

// Token usage structure for AI operations
export interface TokenUsage {
	prompt: number;
	completion: number;
	total: number;
}

// Cost structure for AI operations
export interface Cost {
	amount: number;
	currency: string;
	provider: string;
	model: string;
}

// Performance metrics structure
export interface PerformanceMetrics {
	duration: number;
	memoryUsage?: {
		rss: number;
		heapTotal: number;
		heapUsed: number;
		external: number;
		arrayBuffers: number;
	};
	cpuUsage?: {
		user: number;
		system: number;
	};
}

// Workflow definition structure
export interface WorkflowDefinition {
	steps: WorkflowStep[];
	variables?: Record<string, unknown>;
	config?: WorkflowConfig;
}

export interface WorkflowStep {
	id: string;
	name: string;
	type: string;
	config: Record<string, unknown>;
	dependencies?: string[];
	conditions?: WorkflowCondition[];
}

export interface WorkflowCondition {
	field: string;
	operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "in" | "nin";
	value: unknown;
}

export interface WorkflowConfig {
	timeout?: number;
	retries?: number;
	parallel?: boolean;
	errorHandling?: "stop" | "continue" | "retry";
}

// Database query options
export interface QueryOptions {
	limit?: number;
	offset?: number;
	orderBy?: string;
	orderDirection?: "asc" | "desc";
	filters?: Record<string, unknown>;
}

// Pagination result
export interface PaginatedResult<T> {
	data: T[];
	total: number;
	page: number;
	pageSize: number;
	hasNext: boolean;
	hasPrev: boolean;
}

// Database connection configuration
export interface DatabaseConfig {
	connectionString: string;
	ssl?: boolean;
	maxConnections?: number;
	idleTimeout?: number;
	connectionTimeout?: number;
}

// Migration status
export interface MigrationStatus {
	isComplete: boolean;
	progress: number;
	currentStep: string;
	totalSteps: number;
	errors: string[];
	startedAt: Date;
	completedAt?: Date;
}

// Search result for vector similarity
export interface SearchResult<T> {
	item: T;
	similarity: number;
	distance: number;
}

// Bulk operation result
export interface BulkOperationResult {
	success: number;
	failed: number;
	errors: Array<{
		index: number;
		error: string;
	}>;
}

// Database health status
export interface DatabaseHealth {
	isHealthy: boolean;
	connectionCount: number;
	responseTime: number;
	lastCheck: Date;
	errors: string[];
}
