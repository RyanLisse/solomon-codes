import { getDatabase } from "./connection";
import { environments, tasks } from "./schema";
import type {
	MigrationStatus,
	NewEnvironment,
	NewTask,
	TaskMessage,
} from "./types";

/**
 * Migration configuration options
 */
export interface MigrationOptions {
	cleanupAfterMigration?: boolean;
	validateData?: boolean;
	batchSize?: number;
}

/**
 * Migration result structure
 */
export interface MigrationResult {
	success: boolean;
	migratedCount: number;
	errors: string[];
	totalMigrated?: number;
}

/**
 * Data validation result
 */
export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

// Global migration status
let migrationStatus: MigrationStatus = {
	isComplete: false,
	progress: 0,
	currentStep: "Not started",
	totalSteps: 4, // Tasks, Environments, Validation, Cleanup
	errors: [],
	startedAt: new Date(),
};

/**
 * Check if migration is needed by looking for localStorage data
 */
export async function isMigrationNeeded(): Promise<boolean> {
	if (typeof window === "undefined") {
		return false; // Server-side, no localStorage
	}

	try {
		const tasksData = localStorage.getItem("tasks");
		const environmentsData = localStorage.getItem("environments");

		return !!(tasksData || environmentsData);
	} catch (error) {
		console.warn("Error checking localStorage:", error);
		return false;
	}
}

/**
 * Get current migration status
 */
export function getMigrationStatus(): MigrationStatus {
	return { ...migrationStatus };
}

/**
 * Update migration status
 */
function updateMigrationStatus(updates: Partial<MigrationStatus>): void {
	migrationStatus = { ...migrationStatus, ...updates };
}

/**
 * Validate task data structure
 */
export function validateTaskData(task: unknown): ValidationResult {
	const errors: string[] = [];

	if (!task || typeof task !== "object") {
		errors.push("Task must be an object");
		return { isValid: false, errors };
	}

	const taskObj = task as Record<string, unknown>;

	if (!taskObj.id || typeof taskObj.id !== "string") {
		errors.push("Task ID is required and must be a string");
	}

	if (!taskObj.title || typeof taskObj.title !== "string") {
		errors.push("Task title is required and must be a string");
	}

	if (!taskObj.description || typeof taskObj.description !== "string") {
		errors.push("Task description is required and must be a string");
	}

	if (
		!taskObj.status ||
		!["IN_PROGRESS", "DONE", "MERGED"].includes(taskObj.status as string)
	) {
		errors.push("Task status must be one of: IN_PROGRESS, DONE, MERGED");
	}

	if (!Array.isArray(taskObj.messages)) {
		errors.push("Task messages must be an array");
	}

	if (!taskObj.branch || typeof taskObj.branch !== "string") {
		errors.push("Task branch is required and must be a string");
	}

	if (!taskObj.sessionId || typeof taskObj.sessionId !== "string") {
		errors.push("Task sessionId is required and must be a string");
	}

	if (!taskObj.repository || typeof taskObj.repository !== "string") {
		errors.push("Task repository is required and must be a string");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Validate environment data structure
 */
export function validateEnvironmentData(
	environment: unknown,
): ValidationResult {
	const errors: string[] = [];

	if (!environment || typeof environment !== "object") {
		errors.push("Environment must be an object");
		return { isValid: false, errors };
	}

	const envObj = environment as Record<string, unknown>;

	if (!envObj.id || typeof envObj.id !== "string") {
		errors.push("Environment ID is required and must be a string");
	}

	if (!envObj.name || typeof envObj.name !== "string") {
		errors.push("Environment name is required and must be a string");
	}

	if (!envObj.description || typeof envObj.description !== "string") {
		errors.push("Environment description is required and must be a string");
	}

	if (
		!envObj.githubOrganization ||
		typeof envObj.githubOrganization !== "string"
	) {
		errors.push(
			"Environment githubOrganization is required and must be a string",
		);
	}

	if (!envObj.githubToken || typeof envObj.githubToken !== "string") {
		errors.push("Environment githubToken is required and must be a string");
	}

	if (!envObj.githubRepository || typeof envObj.githubRepository !== "string") {
		errors.push(
			"Environment githubRepository is required and must be a string",
		);
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Transform localStorage task data to database format
 */
function transformTaskForDatabase(task: Record<string, unknown>): NewTask {
	return {
		id: task.id as string,
		title: task.title as string,
		description: task.description as string,
		messages: (task.messages as TaskMessage[]) || [],
		status: task.status as string,
		branch: task.branch as string,
		sessionId: task.sessionId as string,
		repository: task.repository as string,
		createdAt: task.createdAt
			? new Date(task.createdAt as string | number | Date)
			: new Date(),
		updatedAt: task.updatedAt
			? new Date(task.updatedAt as string | number | Date)
			: new Date(),
		statusMessage: (task.statusMessage as string) || null,
		isArchived: Boolean(task.isArchived),
		mode: (task.mode as string) || "code",
		hasChanges: Boolean(task.hasChanges),
		pullRequest: (task.pullRequest as string) || null,
		userId: (task.userId as string) || null,
		priority: (task.priority as string) || "medium",
		metadata: (task.metadata as Record<string, unknown>) || {},
	};
}

/**
 * Transform localStorage environment data to database format
 */
function transformEnvironmentForDatabase(
	environment: Record<string, unknown>,
): NewEnvironment {
	return {
		id: environment.id as string,
		name: environment.name as string,
		description: environment.description as string,
		githubOrganization: environment.githubOrganization as string,
		githubToken: environment.githubToken as string,
		githubRepository: environment.githubRepository as string,
		createdAt: environment.createdAt
			? new Date(environment.createdAt as string | number | Date)
			: new Date(),
		updatedAt: environment.updatedAt
			? new Date(environment.updatedAt as string | number | Date)
			: new Date(),
		isActive: Boolean(environment.isActive),
		userId: (environment.userId as string) || null,
		schemaVersion: 1,
		config: (environment.config as Record<string, unknown>) || {},
	};
}

/**
 * Migrate tasks from localStorage to database
 */
export async function migrateTasks(
	options: MigrationOptions = {},
): Promise<MigrationResult> {
	const { validateData = true } = options;
	const result: MigrationResult = {
		success: false,
		migratedCount: 0,
		errors: [],
	};

	try {
		updateMigrationStatus({ currentStep: "Migrating tasks" });

		if (typeof window === "undefined") {
			result.errors.push("localStorage not available on server side");
			return result;
		}

		const tasksData = localStorage.getItem("tasks");
		if (!tasksData) {
			result.success = true;
			return result;
		}

		const localTasks = JSON.parse(tasksData);
		if (!Array.isArray(localTasks)) {
			result.errors.push("Invalid tasks data format in localStorage");
			return result;
		}

		const db = getDatabase();
		let migratedCount = 0;

		for (const task of localTasks) {
			try {
				// Validate data if requested
				if (validateData) {
					const validation = validateTaskData(task);
					if (!validation.isValid) {
						result.errors.push(
							`Task ${task.id}: ${validation.errors.join(", ")}`,
						);
						continue;
					}
				}

				// Transform and insert task
				const dbTask = transformTaskForDatabase(task);
				await db.insert(tasks).values(dbTask);
				migratedCount++;
			} catch (error) {
				result.errors.push(
					`Task ${task.id}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		result.success = result.errors.length === 0;
		result.migratedCount = migratedCount;

		return result;
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : String(error));
		return result;
	}
}

/**
 * Migrate environments from localStorage to database
 */
export async function migrateEnvironments(
	options: MigrationOptions = {},
): Promise<MigrationResult> {
	const { validateData = true } = options;
	const result: MigrationResult = {
		success: false,
		migratedCount: 0,
		errors: [],
	};

	try {
		updateMigrationStatus({ currentStep: "Migrating environments" });

		if (typeof window === "undefined") {
			result.errors.push("localStorage not available on server side");
			return result;
		}

		const environmentsData = localStorage.getItem("environments");
		if (!environmentsData) {
			result.success = true;
			return result;
		}

		const localEnvironments = JSON.parse(environmentsData);
		if (!Array.isArray(localEnvironments)) {
			result.errors.push("Invalid environments data format in localStorage");
			return result;
		}

		const db = getDatabase();
		let migratedCount = 0;

		for (const environment of localEnvironments) {
			try {
				// Validate data if requested
				if (validateData) {
					const validation = validateEnvironmentData(environment);
					if (!validation.isValid) {
						result.errors.push(
							`Environment ${environment.id}: ${validation.errors.join(", ")}`,
						);
						continue;
					}
				}

				// Transform and insert environment
				const dbEnvironment = transformEnvironmentForDatabase(environment);
				await db.insert(environments).values(dbEnvironment);
				migratedCount++;
			} catch (error) {
				result.errors.push(
					`Environment ${environment.id}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		result.success = result.errors.length === 0;
		result.migratedCount = migratedCount;

		return result;
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : String(error));
		return result;
	}
}

/**
 * Perform complete migration from localStorage to database
 */
export async function performFullMigration(
	options: MigrationOptions = {},
): Promise<MigrationResult> {
	const { cleanupAfterMigration = false } = options;

	// Initialize migration status
	updateMigrationStatus({
		isComplete: false,
		progress: 0,
		currentStep: "Starting migration",
		errors: [],
		startedAt: new Date(),
	});

	const result: MigrationResult = {
		success: false,
		migratedCount: 0,
		errors: [],
		totalMigrated: 0,
	};

	try {
		// Step 1: Migrate tasks
		updateMigrationStatus({ progress: 25, currentStep: "Migrating tasks" });
		const taskResult = await migrateTasks(options);
		result.errors.push(...taskResult.errors);
		result.totalMigrated =
			(result.totalMigrated || 0) + taskResult.migratedCount;

		// Step 2: Migrate environments
		updateMigrationStatus({
			progress: 50,
			currentStep: "Migrating environments",
		});
		const environmentResult = await migrateEnvironments(options);
		result.errors.push(...environmentResult.errors);
		result.totalMigrated =
			(result.totalMigrated || 0) + environmentResult.migratedCount;

		// Step 3: Validation
		updateMigrationStatus({
			progress: 75,
			currentStep: "Validating migration",
		});
		// Additional validation could be performed here

		// Step 4: Cleanup
		if (cleanupAfterMigration && result.errors.length === 0) {
			updateMigrationStatus({
				progress: 90,
				currentStep: "Cleaning up localStorage",
			});

			if (typeof window !== "undefined") {
				localStorage.removeItem("tasks");
				localStorage.removeItem("environments");
			}
		}

		// Complete migration
		result.success = result.errors.length === 0;
		result.migratedCount = result.totalMigrated || 0;

		updateMigrationStatus({
			isComplete: true,
			progress: 100,
			currentStep: result.success
				? "Migration completed successfully"
				: "Migration completed with errors",
			completedAt: new Date(),
		});

		return result;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		result.errors.push(errorMessage);

		updateMigrationStatus({
			isComplete: true,
			progress: 100,
			currentStep: "Migration failed",
			errors: [...migrationStatus.errors, errorMessage],
			completedAt: new Date(),
		});

		return result;
	}
}

/**
 * Reset migration status (useful for testing)
 */
export function resetMigrationStatus(): void {
	migrationStatus = {
		isComplete: false,
		progress: 0,
		currentStep: "Not started",
		totalSteps: 4,
		errors: [],
		startedAt: new Date(),
	};
}
