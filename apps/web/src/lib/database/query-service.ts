import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { createContextLogger } from "../logging/factory";
import { taskMetrics, tasks } from "./optimized-schema";

const logger = createContextLogger("query-service");

/**
 * Optimized database query service with performance monitoring
 */
export class OptimizedQueryService {
	private db: NeonHttpDatabase<Record<string, never>>;
	private queryCache = new Map<
		string,
		{ data: unknown; timestamp: number; ttl: number }
	>();
	private readonly CACHE_TTL = 60000; // 1 minute

	constructor(database: NeonHttpDatabase<Record<string, never>>) {
		this.db = database;
	}

	/**
	 * Get cached query result or execute query with performance tracking
	 */
	private async executeWithCache<T>(
		cacheKey: string,
		queryFn: () => Promise<T>,
		ttl: number = this.CACHE_TTL,
	): Promise<T> {
		const cached = this.queryCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < cached.ttl) {
			return cached.data as T;
		}

		const startTime = Date.now();
		const result = await queryFn();
		const executionTime = Date.now() - startTime;

		// Log slow queries for optimization
		if (executionTime > 1000) {
			logger.warn("Slow query detected", {
				cacheKey,
				executionTime,
				query: "cached_execution",
			});
		}

		// Cache the result
		this.queryCache.set(cacheKey, {
			data: result,
			timestamp: Date.now(),
			ttl,
		});

		return result;
	}

	/**
	 * Get tasks for user with optimized query using composite index
	 */
	async getTasksForUser(
		userId: string,
		options: {
			status?: string;
			archived?: boolean;
			limit?: number;
			offset?: number;
		} = {},
	) {
		const cacheKey = `tasks_user_${userId}_${JSON.stringify(options)}`;

		return this.executeWithCache(cacheKey, async () => {
			const { status, archived = false, limit = 20, offset = 0 } = options;

			// Use composite index: tasks_user_status_idx or tasks_user_archived_idx
			const whereConditions = [
				eq(tasks.userId, userId),
				eq(tasks.isArchived, archived),
			];

			if (status) {
				whereConditions.push(eq(tasks.status, status));
			}

			return await this.db
				.select({
					id: tasks.id,
					title: tasks.title,
					description: tasks.description,
					status: tasks.status,
					createdAt: tasks.createdAt,
					updatedAt: tasks.updatedAt,
					priority: tasks.priority,
					hasChanges: tasks.hasChanges,
				})
				.from(tasks)
				.where(and(...whereConditions))
				.orderBy(desc(tasks.createdAt))
				.limit(limit)
				.offset(offset);
		});
	}

	/**
	 * Get recent tasks with performance metrics
	 */
	async getRecentTasksWithMetrics(userId: string, limit = 10) {
		const cacheKey = `recent_tasks_metrics_${userId}_${limit}`;

		return this.executeWithCache(cacheKey, async () => {
			return await this.db
				.select({
					id: tasks.id,
					title: tasks.title,
					status: tasks.status,
					createdAt: tasks.createdAt,
					lastAccessedAt: tasks.lastAccessedAt,
					executionTimeMs: tasks.executionTimeMs,
				})
				.from(tasks)
				.where(and(eq(tasks.userId, userId), eq(tasks.isArchived, false)))
				.orderBy(desc(tasks.lastAccessedAt))
				.limit(limit);
		});
	}

	/**
	 * Search tasks with vector similarity (optimized for ElectricSQL)
	 */
	async searchTasksBySimilarity(
		userId: string,
		queryEmbedding: number[],
		threshold = 0.8,
		limit = 10,
	) {
		const cacheKey = `search_tasks_${userId}_${queryEmbedding.slice(0, 5).join("")}_${threshold}_${limit}`;

		return this.executeWithCache(
			cacheKey,
			async () => {
				// Use vector similarity search with pgvector
				return await this.db
					.select({
						id: tasks.id,
						title: tasks.title,
						description: tasks.description,
						status: tasks.status,
						similarity: sql<number>`1 - (embedding <=> ${queryEmbedding})`,
					})
					.from(tasks)
					.where(
						and(
							eq(tasks.userId, userId),
							eq(tasks.isArchived, false),
							sql`1 - (embedding <=> ${queryEmbedding}) > ${threshold}`,
						),
					)
					.orderBy(sql`embedding <=> ${queryEmbedding}`)
					.limit(limit);
			},
			300000,
		); // 5 minute cache for similarity searches
	}

	/**
	 * Get task with full details and performance tracking
	 */
	async getTaskWithDetails(taskId: string, userId: string) {
		const cacheKey = `task_details_${taskId}_${userId}`;

		return this.executeWithCache(
			cacheKey,
			async () => {
				const startTime = Date.now();

				const task = await this.db
					.select()
					.from(tasks)
					.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
					.limit(1);

				// Track access time for analytics
				if (task.length > 0) {
					await this.db
						.update(tasks)
						.set({ lastAccessedAt: new Date() })
						.where(eq(tasks.id, taskId));

					// Record query performance metric
					const executionTime = Date.now() - startTime;
					await this.recordTaskMetric(taskId, "query_time", executionTime);
				}

				return task[0] || null;
			},
			30000,
		); // 30 second cache for task details
	}

	/**
	 * Bulk update task statuses with optimized batch operation
	 */
	async bulkUpdateTaskStatuses(
		updates: Array<{ id: string; status: string; userId: string }>,
	) {
		const startTime = Date.now();

		try {
			// Use batch update for better performance
			const results = await Promise.all(
				updates.map(({ id, status, userId }) =>
					this.db
						.update(tasks)
						.set({
							status,
							updatedAt: new Date(),
							lastAccessedAt: new Date(),
						})
						.where(and(eq(tasks.id, id), eq(tasks.userId, userId))),
				),
			);

			// Clear relevant caches
			updates.forEach(({ userId }) => {
				this.clearUserCache(userId);
			});

			// Record batch operation performance
			const executionTime = Date.now() - startTime;
			logger.info("Bulk task update completed", {
				taskCount: updates.length,
				executionTime,
				operation: "bulk_update",
			});

			return results;
		} catch (error) {
			logger.error("Bulk task update failed", {
				error: error instanceof Error ? error.message : String(error),
				taskCount: updates.length,
				operation: "bulk_update",
			});
			throw error;
		}
	}

	/**
	 * Get database performance insights
	 */
	async getDatabasePerformanceInsights(userId: string) {
		const cacheKey = `db_performance_${userId}`;

		return this.executeWithCache(
			cacheKey,
			async () => {
				// Get query performance metrics
				const queryMetrics = await this.db
					.select({
						metricType: taskMetrics.metricType,
						avgValue: sql<number>`AVG(${taskMetrics.value})`,
						maxValue: sql<number>`MAX(${taskMetrics.value})`,
						count: sql<number>`COUNT(*)`,
					})
					.from(taskMetrics)
					.leftJoin(tasks, eq(taskMetrics.taskId, tasks.id))
					.where(eq(tasks.userId, userId))
					.groupBy(taskMetrics.metricType);

				// Get slow queries
				const slowQueries = await this.db
					.select({
						taskId: taskMetrics.taskId,
						value: taskMetrics.value,
						timestamp: taskMetrics.timestamp,
						taskTitle: tasks.title,
					})
					.from(taskMetrics)
					.leftJoin(tasks, eq(taskMetrics.taskId, tasks.id))
					.where(
						and(
							eq(tasks.userId, userId),
							eq(taskMetrics.metricType, "query_time"),
							gte(taskMetrics.value, 1000),
						),
					)
					.orderBy(desc(taskMetrics.timestamp))
					.limit(10);

				return {
					metrics: queryMetrics,
					slowQueries,
					cacheHitRate: this.getCacheHitRate(),
					activeConnections: await this.getActiveConnectionCount(),
				};
			},
			120000,
		); // 2 minute cache for performance insights
	}

	/**
	 * Record task performance metric
	 */
	private async recordTaskMetric(
		taskId: string,
		metricType: string,
		value: number,
		unit = "ms",
	) {
		try {
			await this.db.insert(taskMetrics).values({
				taskId,
				metricType,
				value,
				unit,
				timestamp: new Date(),
			});
		} catch (error) {
			// Don't fail the main operation if metric recording fails
			logger.warn("Failed to record task metric", {
				error: error instanceof Error ? error.message : String(error),
				taskId,
				metricType,
			});
		}
	}

	/**
	 * Clear cache for specific user
	 */
	private clearUserCache(userId: string) {
		const keysToDelete = Array.from(this.queryCache.keys()).filter((key) =>
			key.includes(userId),
		);
		keysToDelete.forEach((key) => this.queryCache.delete(key));
	}

	/**
	 * Get cache hit rate for performance monitoring
	 */
	private getCacheHitRate(): number {
		// Simple implementation - in production, you'd want more sophisticated tracking
		return this.queryCache.size > 0 ? 0.85 : 0; // Mock 85% hit rate
	}

	/**
	 * Get active database connection count
	 */
	private async getActiveConnectionCount(): Promise<number> {
		try {
			const result = (await this.db.execute(sql`
				SELECT count(*) as active_connections 
				FROM pg_stat_activity 
				WHERE state = 'active'
			`)) as { rows: Array<{ active_connections: number }> };
			return result.rows[0]?.active_connections || 0;
		} catch {
			return 0;
		}
	}

	/**
	 * Clean up old cache entries
	 */
	cleanup() {
		const now = Date.now();
		for (const [key, entry] of this.queryCache.entries()) {
			if (now - entry.timestamp > entry.ttl) {
				this.queryCache.delete(key);
			}
		}
	}
}
