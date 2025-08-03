/**
 * TODO and FIXME tracking system for production readiness
 */

import { createContextLogger } from "../logging/factory";
import { disabledTracker } from "../types/cleanup";

/**
 * TODO item interface
 */
export interface TodoItem {
	id: string;
	type: "TODO" | "FIXME" | "HACK" | "NOTE";
	description: string;
	file: string;
	line: number;
	priority: "low" | "medium" | "high" | "critical";
	assignee?: string;
	dueDate?: Date;
	issueUrl?: string;
	tags: string[];
	createdAt: Date;
	resolvedAt?: Date;
	resolution?: string;
}

/**
 * TODO tracker service
 */
export class TodoTracker {
	private logger = createContextLogger("todo-tracker");
	private todos = new Map<string, TodoItem>();

	/**
	 * Register a TODO item
	 */
	registerTodo(todo: Omit<TodoItem, "id" | "createdAt">): string {
		const id = this.generateId(todo);
		const todoItem: TodoItem = {
			...todo,
			id,
			createdAt: new Date(),
		};

		this.todos.set(id, todoItem);

		this.logger.info("TODO registered", {
			id,
			type: todo.type,
			description: todo.description,
			file: todo.file,
			priority: todo.priority,
		});

		return id;
	}

	/**
	 * Mark TODO as resolved
	 */
	resolveTodo(id: string, resolution: string): void {
		const todo = this.todos.get(id);
		if (!todo) {
			this.logger.warn("Attempted to resolve non-existent TODO", { id });
			return;
		}

		todo.resolvedAt = new Date();
		todo.resolution = resolution;

		this.logger.info("TODO resolved", {
			id,
			resolution,
			duration: todo.resolvedAt.getTime() - todo.createdAt.getTime(),
		});
	}

	/**
	 * Get all TODOs
	 */
	getAllTodos(): TodoItem[] {
		return Array.from(this.todos.values());
	}

	/**
	 * Get unresolved TODOs
	 */
	getUnresolvedTodos(): TodoItem[] {
		return this.getAllTodos().filter((todo) => !todo.resolvedAt);
	}

	/**
	 * Get TODOs by priority
	 */
	getTodosByPriority(priority: TodoItem["priority"]): TodoItem[] {
		return this.getAllTodos().filter((todo) => todo.priority === priority);
	}

	/**
	 * Get overdue TODOs
	 */
	getOverdueTodos(): TodoItem[] {
		const now = new Date();
		return this.getUnresolvedTodos().filter(
			(todo) => todo.dueDate && todo.dueDate < now,
		);
	}

	/**
	 * Get TODOs by file
	 */
	getTodosByFile(file: string): TodoItem[] {
		return this.getAllTodos().filter((todo) => todo.file === file);
	}

	/**
	 * Get TODOs by assignee
	 */
	getTodosByAssignee(assignee: string): TodoItem[] {
		return this.getAllTodos().filter((todo) => todo.assignee === assignee);
	}

	/**
	 * Get TODO statistics
	 */
	getStatistics() {
		const all = this.getAllTodos();
		const unresolved = this.getUnresolvedTodos();
		const overdue = this.getOverdueTodos();

		return {
			total: all.length,
			unresolved: unresolved.length,
			resolved: all.length - unresolved.length,
			overdue: overdue.length,
			byPriority: {
				critical: this.getTodosByPriority("critical").length,
				high: this.getTodosByPriority("high").length,
				medium: this.getTodosByPriority("medium").length,
				low: this.getTodosByPriority("low").length,
			},
			byType: {
				TODO: all.filter((t) => t.type === "TODO").length,
				FIXME: all.filter((t) => t.type === "FIXME").length,
				HACK: all.filter((t) => t.type === "HACK").length,
				NOTE: all.filter((t) => t.type === "NOTE").length,
			},
		};
	}

	/**
	 * Generate unique ID for TODO item
	 */
	private generateId(todo: Omit<TodoItem, "id" | "createdAt">): string {
		const hash = this.simpleHash(
			`${todo.file}:${todo.line}:${todo.description}`,
		);
		return `todo-${hash}`;
	}

	/**
	 * Simple hash function for generating IDs
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}

	/**
	 * Export TODOs to JSON
	 */
	exportToJson(): string {
		return JSON.stringify(
			{
				exportedAt: new Date().toISOString(),
				statistics: this.getStatistics(),
				todos: this.getAllTodos(),
			},
			null,
			2,
		);
	}

	/**
	 * Generate TODO report
	 */
	generateReport(): string {
		const stats = this.getStatistics();
		const _unresolved = this.getUnresolvedTodos();
		const overdue = this.getOverdueTodos();

		let report = "# TODO Report\n\n";
		report += `Generated: ${new Date().toISOString()}\n\n`;

		report += "## Statistics\n";
		report += `- Total TODOs: ${stats.total}\n`;
		report += `- Unresolved: ${stats.unresolved}\n`;
		report += `- Resolved: ${stats.resolved}\n`;
		report += `- Overdue: ${stats.overdue}\n\n`;

		report += "### By Priority\n";
		report += `- Critical: ${stats.byPriority.critical}\n`;
		report += `- High: ${stats.byPriority.high}\n`;
		report += `- Medium: ${stats.byPriority.medium}\n`;
		report += `- Low: ${stats.byPriority.low}\n\n`;

		if (overdue.length > 0) {
			report += "## Overdue TODOs\n";
			for (const todo of overdue) {
				report += `- **${todo.type}** (${todo.priority}): ${todo.description}\n`;
				report += `  - File: ${todo.file}:${todo.line}\n`;
				report += `  - Due: ${todo.dueDate?.toISOString()}\n`;
				if (todo.assignee) report += `  - Assignee: ${todo.assignee}\n`;
				report += "\n";
			}
		}

		if (stats.byPriority.critical > 0) {
			const critical = this.getTodosByPriority("critical");
			report += "## Critical TODOs\n";
			for (const todo of critical) {
				if (!todo.resolvedAt) {
					report += `- **${todo.type}**: ${todo.description}\n`;
					report += `  - File: ${todo.file}:${todo.line}\n`;
					if (todo.assignee) report += `  - Assignee: ${todo.assignee}\n`;
					if (todo.issueUrl) report += `  - Issue: ${todo.issueUrl}\n`;
					report += "\n";
				}
			}
		}

		return report;
	}
}

/**
 * Global TODO tracker instance
 */
export const todoTracker = new TodoTracker();

/**
 * Register known TODOs from the codebase
 */
export function registerKnownTodos(): void {
	// VibeKit integration TODO
	todoTracker.registerTodo({
		type: "TODO",
		description:
			"Re-enable VibeKit once OpenTelemetry compatibility is resolved",
		file: "apps/web/src/lib/inngest.ts",
		line: 110,
		priority: "high",
		tags: ["integration", "vibekit", "opentelemetry"],
		issueUrl: "https://github.com/your-org/solomon_codes/issues/123", // Example
	});

	// Add more known TODOs here as they are discovered
}

/**
 * Decorator for marking functions with TODO items
 */
export function withTodo(
	description: string,
	options: {
		priority?: TodoItem["priority"];
		assignee?: string;
		dueDate?: Date;
		issueUrl?: string;
		tags?: string[];
	} = {},
) {
	return (
		_target: unknown,
		_propertyKey: string,
		descriptor: PropertyDescriptor,
	) => {
		const fileName = "unknown"; // Would need to be determined at build time
		const lineNumber = 0; // Would need to be determined at build time

		todoTracker.registerTodo({
			type: "TODO",
			description,
			file: fileName,
			line: lineNumber,
			priority: options.priority || "medium",
			assignee: options.assignee,
			dueDate: options.dueDate,
			issueUrl: options.issueUrl,
			tags: options.tags || [],
		});

		return descriptor;
	};
}

/**
 * Create a production readiness report
 */
export function generateProductionReadinessReport(): string {
	const todoStats = todoTracker.getStatistics();
	const disabledFeatures = disabledTracker.getAllDisabled();
	const readyForReenabling = disabledTracker.getFeaturesReadyForReenabling();

	let report = "# Production Readiness Report\n\n";
	report += `Generated: ${new Date().toISOString()}\n\n`;

	report += "## TODO Items\n";
	report += `- Total: ${todoStats.total}\n`;
	report += `- Unresolved: ${todoStats.unresolved}\n`;
	report += `- Critical: ${todoStats.byPriority.critical}\n`;
	report += `- High Priority: ${todoStats.byPriority.high}\n\n`;

	report += "## Disabled Features\n";
	const disabledCount = Object.keys(disabledFeatures).length;
	report += `- Total Disabled: ${disabledCount}\n`;

	if (disabledCount > 0) {
		report += "\n### Disabled Features List\n";
		for (const [feature, info] of Object.entries(disabledFeatures)) {
			report += `- **${feature}**: ${info.reason}\n`;
			if (info.plannedReenabling) {
				report += `  - Planned re-enabling: ${info.plannedReenabling.toISOString()}\n`;
			}
			if (info.issueUrl) {
				report += `  - Issue: ${info.issueUrl}\n`;
			}
		}
	}

	if (readyForReenabling.length > 0) {
		report += "\n### Features Ready for Re-enabling\n";
		for (const feature of readyForReenabling) {
			report += `- ${feature}\n`;
		}
	}

	report += "\n## Recommendations\n";

	if (todoStats.byPriority.critical > 0) {
		report +=
			"- ⚠️  **Critical TODOs must be resolved before production deployment**\n";
	}

	if (todoStats.byPriority.high > 0) {
		report += "- ⚠️  High priority TODOs should be resolved before production\n";
	}

	if (disabledCount > 0) {
		report += "- 🔧 Review disabled features and re-enable where appropriate\n";
	}

	if (readyForReenabling.length > 0) {
		report += "- ✅ Some features are ready to be re-enabled\n";
	}

	return report;
}

/**
 * Initialize the TODO tracking system
 */
export function initializeTodoTracking(): void {
	registerKnownTodos();

	const logger = createContextLogger("todo-tracker-init");
	const stats = todoTracker.getStatistics();

	logger.info("TODO tracking initialized", {
		totalTodos: stats.total,
		unresolvedTodos: stats.unresolved,
		criticalTodos: stats.byPriority.critical,
	});
}
