import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
	vector,
} from "drizzle-orm/pg-core";

/**
 * Tasks table - migrated from localStorage task store
 * Supports the existing Task interface with additional database features
 */
export const tasks = pgTable(
	"tasks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: varchar("title", { length: 255 }).notNull(),
		description: text("description").notNull(),
		// JSON field to store messages array from existing Task interface
		messages: jsonb("messages").notNull().default("[]"),
		status: varchar("status", { length: 50 }).notNull().default("IN_PROGRESS"),
		branch: varchar("branch", { length: 255 }).notNull(),
		sessionId: varchar("session_id", { length: 255 }).notNull(),
		repository: varchar("repository", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		statusMessage: text("status_message"),
		isArchived: boolean("is_archived").default(false).notNull(),
		mode: varchar("mode", { length: 10 }).notNull().default("code"),
		hasChanges: boolean("has_changes").default(false).notNull(),
		// Additional fields for enhanced functionality
		pullRequest: jsonb("pull_request"),
		userId: varchar("user_id", { length: 255 }),
		priority: varchar("priority", { length: 20 }).default("medium"),
		// Vector embedding for semantic search
		embedding: vector("embedding", { dimensions: 1536 }),
		// Metadata for extensibility
		metadata: jsonb("metadata").default("{}"),
	},
	(table) => ({
		statusIdx: index("tasks_status_idx").on(table.status),
		sessionIdx: index("tasks_session_idx").on(table.sessionId),
		userIdx: index("tasks_user_idx").on(table.userId),
		archivedIdx: index("tasks_archived_idx").on(table.isArchived),
		createdAtIdx: index("tasks_created_at_idx").on(table.createdAt),
	}),
);

/**
 * Environments table - migrated from localStorage environment store
 */
export const environments = pgTable(
	"environments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description").notNull(),
		githubOrganization: varchar("github_organization", {
			length: 255,
		}).notNull(),
		githubToken: text("github_token").notNull(),
		githubRepository: varchar("github_repository", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		isActive: boolean("is_active").default(false).notNull(),
		userId: varchar("user_id", { length: 255 }),
		// Configuration validation schema version
		schemaVersion: integer("schema_version").default(1).notNull(),
		// Additional configuration data
		config: jsonb("config").default("{}"),
	},
	(table) => ({
		nameIdx: index("environments_name_idx").on(table.name),
		userIdx: index("environments_user_idx").on(table.userId),
		activeIdx: index("environments_active_idx").on(table.isActive),
	}),
);

/**
 * Agent executions table - for tracking AI agent operations
 */
export const agentExecutions = pgTable(
	"agent_executions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
		agentType: varchar("agent_type", { length: 100 }).notNull(),
		status: varchar("status", { length: 50 }).notNull(),
		startedAt: timestamp("started_at").defaultNow().notNull(),
		completedAt: timestamp("completed_at"),
		input: jsonb("input"),
		output: jsonb("output"),
		error: text("error"),
		metadata: jsonb("metadata").default("{}"),
		traceId: varchar("trace_id", { length: 255 }),
		spanId: varchar("span_id", { length: 255 }),
		correlationId: varchar("correlation_id", { length: 255 }),
		// Performance metrics
		executionTimeMs: integer("execution_time_ms"),
		tokenUsage: jsonb("token_usage"),
		cost: jsonb("cost"),
		// Agent-specific data
		provider: varchar("provider", { length: 100 }),
		model: varchar("model", { length: 100 }),
		confidence: integer("confidence"), // 0-100
		reasoning: text("reasoning"),
	},
	(table) => ({
		taskIdx: index("agent_executions_task_idx").on(table.taskId),
		statusIdx: index("agent_executions_status_idx").on(table.status),
		traceIdx: index("agent_executions_trace_idx").on(table.traceId),
		correlationIdx: index("agent_executions_correlation_idx").on(
			table.correlationId,
		),
		startedAtIdx: index("agent_executions_started_at_idx").on(table.startedAt),
	}),
);

/**
 * Observability events table - for comprehensive system monitoring
 */
export const observabilityEvents = pgTable(
	"observability_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		eventType: varchar("event_type", { length: 100 }).notNull(),
		timestamp: timestamp("timestamp").defaultNow().notNull(),
		data: jsonb("data").notNull(),
		traceId: varchar("trace_id", { length: 255 }),
		spanId: varchar("span_id", { length: 255 }),
		correlationId: varchar("correlation_id", { length: 255 }),
		userId: varchar("user_id", { length: 255 }),
		sessionId: varchar("session_id", { length: 255 }),
		// Event categorization
		severity: varchar("severity", { length: 20 }).default("info"),
		component: varchar("component", { length: 100 }),
		operation: varchar("operation", { length: 100 }),
		// Performance data
		duration: integer("duration"),
		// Error information
		errorCode: varchar("error_code", { length: 50 }),
		errorMessage: text("error_message"),
		stackTrace: text("stack_trace"),
	},
	(table) => ({
		eventTypeIdx: index("observability_events_type_idx").on(table.eventType),
		timestampIdx: index("observability_events_timestamp_idx").on(
			table.timestamp,
		),
		traceIdx: index("observability_events_trace_idx").on(table.traceId),
		correlationIdx: index("observability_events_correlation_idx").on(
			table.correlationId,
		),
		severityIdx: index("observability_events_severity_idx").on(table.severity),
		componentIdx: index("observability_events_component_idx").on(
			table.component,
		),
	}),
);

/**
 * Agent memory table - for persistent agent knowledge and context
 */
export const agentMemory = pgTable(
	"agent_memory",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		agentId: varchar("agent_id", { length: 255 }).notNull(),
		memoryType: varchar("memory_type", { length: 50 }).notNull(),
		content: text("content").notNull(),
		// Vector embedding for semantic search
		embedding: vector("embedding", { dimensions: 1536 }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		accessedAt: timestamp("accessed_at").defaultNow().notNull(),
		// Memory metadata
		importance: integer("importance").default(5), // 1-10 scale
		tags: jsonb("tags").default("[]"),
		context: jsonb("context").default("{}"),
		// Expiration and cleanup
		expiresAt: timestamp("expires_at"),
		isActive: boolean("is_active").default(true).notNull(),
	},
	(table) => ({
		agentIdx: index("agent_memory_agent_idx").on(table.agentId),
		typeIdx: index("agent_memory_type_idx").on(table.memoryType),
		createdAtIdx: index("agent_memory_created_at_idx").on(table.createdAt),
		accessedAtIdx: index("agent_memory_accessed_at_idx").on(table.accessedAt),
		importanceIdx: index("agent_memory_importance_idx").on(table.importance),
		activeIdx: index("agent_memory_active_idx").on(table.isActive),
	}),
);

/**
 * Workflows table - for workflow orchestration
 */
export const workflows = pgTable(
	"workflows",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 255 }).notNull(),
		definition: jsonb("definition").notNull(),
		version: integer("version").default(1).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		createdBy: varchar("created_by", { length: 255 }),
		// Workflow metadata
		tags: jsonb("tags").default("[]"),
		description: text("description"),
		// Configuration
		config: jsonb("config").default("{}"),
		// Scheduling
		schedule: varchar("schedule", { length: 255 }), // cron expression
		isScheduled: boolean("is_scheduled").default(false).notNull(),
	},
	(table) => ({
		nameIdx: index("workflows_name_idx").on(table.name),
		activeIdx: index("workflows_active_idx").on(table.isActive),
		createdByIdx: index("workflows_created_by_idx").on(table.createdBy),
		scheduledIdx: index("workflows_scheduled_idx").on(table.isScheduled),
	}),
);

/**
 * Workflow executions table - for tracking workflow runs
 */
export const workflowExecutions = pgTable(
	"workflow_executions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workflowId: uuid("workflow_id")
			.references(() => workflows.id, { onDelete: "cascade" })
			.notNull(),
		status: varchar("status", { length: 50 }).notNull().default("running"),
		startedAt: timestamp("started_at").defaultNow().notNull(),
		completedAt: timestamp("completed_at"),
		input: jsonb("input"),
		output: jsonb("output"),
		error: text("error"),
		currentStep: integer("current_step").default(0),
		totalSteps: integer("total_steps"),
		// Execution context
		triggeredBy: varchar("triggered_by", { length: 255 }),
		traceId: varchar("trace_id", { length: 255 }),
		correlationId: varchar("correlation_id", { length: 255 }),
		// Performance metrics
		executionTimeMs: integer("execution_time_ms"),
		// Retry information
		retryCount: integer("retry_count").default(0),
		maxRetries: integer("max_retries").default(3),
	},
	(table) => ({
		workflowIdx: index("workflow_executions_workflow_idx").on(table.workflowId),
		statusIdx: index("workflow_executions_status_idx").on(table.status),
		startedAtIdx: index("workflow_executions_started_at_idx").on(
			table.startedAt,
		),
		traceIdx: index("workflow_executions_trace_idx").on(table.traceId),
	}),
);

/**
 * Execution snapshots table - for time-travel debugging
 */
export const executionSnapshots = pgTable(
	"execution_snapshots",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		executionId: uuid("execution_id")
			.references(() => workflowExecutions.id, { onDelete: "cascade" })
			.notNull(),
		stepNumber: integer("step_number").notNull(),
		timestamp: timestamp("timestamp").defaultNow().notNull(),
		state: jsonb("state").notNull(),
		variables: jsonb("variables").default("{}"),
		stackTrace: jsonb("stack_trace"),
		// Snapshot metadata
		snapshotType: varchar("snapshot_type", { length: 50 }).default("step"),
		description: text("description"),
		// Performance data at snapshot time
		memoryUsage: jsonb("memory_usage"),
		cpuUsage: jsonb("cpu_usage"),
	},
	(table) => ({
		executionIdx: index("execution_snapshots_execution_idx").on(
			table.executionId,
		),
		stepIdx: index("execution_snapshots_step_idx").on(table.stepNumber),
		timestampIdx: index("execution_snapshots_timestamp_idx").on(
			table.timestamp,
		),
		typeIdx: index("execution_snapshots_type_idx").on(table.snapshotType),
	}),
);

// Define table relations
export const tasksRelations = relations(tasks, ({ many }) => ({
	agentExecutions: many(agentExecutions),
}));

export const agentExecutionsRelations = relations(
	agentExecutions,
	({ one }) => ({
		task: one(tasks, {
			fields: [agentExecutions.taskId],
			references: [tasks.id],
		}),
	}),
);

export const workflowsRelations = relations(workflows, ({ many }) => ({
	executions: many(workflowExecutions),
}));

export const workflowExecutionsRelations = relations(
	workflowExecutions,
	({ one, many }) => ({
		workflow: one(workflows, {
			fields: [workflowExecutions.workflowId],
			references: [workflows.id],
		}),
		snapshots: many(executionSnapshots),
	}),
);

export const executionSnapshotsRelations = relations(
	executionSnapshots,
	({ one }) => ({
		execution: one(workflowExecutions, {
			fields: [executionSnapshots.executionId],
			references: [workflowExecutions.id],
		}),
	}),
);
