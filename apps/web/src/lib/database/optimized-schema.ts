import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
	vector,
} from "drizzle-orm/pg-core";

/**
 * Enhanced Tasks table with performance optimizations
 */
export const tasks = pgTable(
	"tasks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: varchar("title", { length: 255 }).notNull(),
		description: text("description").notNull(),
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
		pullRequest: jsonb("pull_request"),
		userId: varchar("user_id", { length: 255 }),
		priority: varchar("priority", { length: 20 }).default("medium"),
		embedding: vector("embedding", { dimensions: 1536 }),
		metadata: jsonb("metadata").default("{}"),
		// Performance tracking fields
		executionTimeMs: integer("execution_time_ms"),
		lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
	},
	(table) => ({
		// Single column indexes
		statusIdx: index("tasks_status_idx").on(table.status),
		sessionIdx: index("tasks_session_idx").on(table.sessionId),
		userIdx: index("tasks_user_idx").on(table.userId),
		archivedIdx: index("tasks_archived_idx").on(table.isArchived),
		createdAtIdx: index("tasks_created_at_idx").on(table.createdAt),

		// Composite indexes for common query patterns
		userStatusIdx: index("tasks_user_status_idx").on(
			table.userId,
			table.status,
		),
		userCreatedIdx: index("tasks_user_created_idx").on(
			table.userId,
			table.createdAt,
		),
		sessionStatusIdx: index("tasks_session_status_idx").on(
			table.sessionId,
			table.status,
		),
		statusCreatedIdx: index("tasks_status_created_idx").on(
			table.status,
			table.createdAt,
		),
		userArchivedIdx: index("tasks_user_archived_idx").on(
			table.userId,
			table.isArchived,
		),

		// Performance optimization indexes
		lastAccessedIdx: index("tasks_last_accessed_idx").on(table.lastAccessedAt),
		priorityIdx: index("tasks_priority_idx").on(table.priority),

		// Unique constraints
		sessionTaskUnique: unique("tasks_session_unique").on(
			table.sessionId,
			table.title,
		),
	}),
);

/**
 * Enhanced Environments table with performance optimizations
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
		schemaVersion: integer("schema_version").default(1).notNull(),
		config: jsonb("config").default("{}"),
		lastUsedAt: timestamp("last_used_at"),
	},
	(table) => ({
		// Single column indexes
		nameIdx: index("environments_name_idx").on(table.name),
		userIdx: index("environments_user_idx").on(table.userId),
		activeIdx: index("environments_active_idx").on(table.isActive),

		// Composite indexes for common query patterns
		userActiveIdx: index("environments_user_active_idx").on(
			table.userId,
			table.isActive,
		),
		userNameIdx: index("environments_user_name_idx").on(
			table.userId,
			table.name,
		),

		// Unique constraints
		userNameUnique: unique("environments_user_name_unique").on(
			table.userId,
			table.name,
		),
	}),
);

/**
 * New table for tracking task execution metrics
 */
export const taskMetrics = pgTable(
	"task_metrics",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		taskId: uuid("task_id")
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
		metricType: varchar("metric_type", { length: 50 }).notNull(),
		value: integer("value").notNull(),
		unit: varchar("unit", { length: 20 }).notNull().default("ms"),
		timestamp: timestamp("timestamp").defaultNow().notNull(),
		metadata: jsonb("metadata").default("{}"),
	},
	(table) => ({
		taskIdx: index("task_metrics_task_idx").on(table.taskId),
		typeIdx: index("task_metrics_type_idx").on(table.metricType),
		timestampIdx: index("task_metrics_timestamp_idx").on(table.timestamp),
		taskTypeIdx: index("task_metrics_task_type_idx").on(
			table.taskId,
			table.metricType,
		),
	}),
);

/**
 * Enhanced table relationships with performance considerations
 */
export const tasksRelations = relations(tasks, ({ many }) => ({
	metrics: many(taskMetrics),
}));

export const taskMetricsRelations = relations(taskMetrics, ({ one }) => ({
	task: one(tasks, {
		fields: [taskMetrics.taskId],
		references: [tasks.id],
	}),
}));

/**
 * Database connection configuration with optimizations
 */
export const dbConfig = {
	// Connection pool settings for better performance
	poolConfig: {
		max: 20,
		min: 2,
		acquireTimeoutMillis: 30000,
		createTimeoutMillis: 30000,
		destroyTimeoutMillis: 5000,
		idleTimeoutMillis: 30000,
		reapIntervalMillis: 1000,
		createRetryIntervalMillis: 200,
	},

	// Query optimization settings
	queryConfig: {
		// Enable prepared statements for better performance
		prepare: true,
		// Log slow queries for optimization
		logSlowQueries: true,
		slowQueryThreshold: 1000, // 1 second
	},

	// ElectricSQL specific optimizations
	electricConfig: {
		// Enable write-through caching
		enableWriteThroughCache: true,
		// Configure sync batch size for better performance
		syncBatchSize: 100,
		// Enable query result caching
		enableQueryCache: true,
		queryCacheTTL: 60000, // 1 minute
	},
};

/**
 * Performance monitoring queries
 */
export const performanceQueries = {
	// Get slow queries for a task
	getSlowQueriesForTask: `
		SELECT 
			tm.metric_type,
			tm.value,
			tm.timestamp,
			tm.metadata
		FROM task_metrics tm
		WHERE tm.task_id = $1 
		AND tm.metric_type = 'query_time'
		AND tm.value > 1000
		ORDER BY tm.timestamp DESC
		LIMIT 10
	`,

	// Get task performance summary
	getTaskPerformanceSummary: `
		SELECT 
			t.id,
			t.title,
			t.status,
			AVG(tm.value) as avg_execution_time,
			MAX(tm.value) as max_execution_time,
			COUNT(tm.id) as metric_count
		FROM tasks t
		LEFT JOIN task_metrics tm ON t.id = tm.task_id
		WHERE t.user_id = $1
		AND tm.metric_type = 'execution_time'
		GROUP BY t.id, t.title, t.status
		ORDER BY avg_execution_time DESC
	`,

	// Get database health metrics
	getDatabaseHealth: `
		SELECT 
			schemaname,
			tablename,
			attname,
			n_distinct,
			correlation
		FROM pg_stats 
		WHERE schemaname = 'public'
		AND tablename IN ('tasks', 'environments', 'task_metrics')
		ORDER BY tablename, attname
	`,
};
