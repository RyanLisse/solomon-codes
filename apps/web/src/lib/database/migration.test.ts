import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock localStorage
const mockLocalStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
};

Object.defineProperty(global, "localStorage", {
	value: mockLocalStorage,
});

// Mock database client
const mockDbClient = {
	insert: vi.fn(),
	select: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
};

vi.mock("./connection", () => ({
	getDatabase: () => mockDbClient,
}));

describe("localStorage to Database Migration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Migration Status", () => {
		it("should check if migration is needed", async () => {
			mockLocalStorage.getItem.mockReturnValue(
				JSON.stringify([
					{ id: "1", title: "Test Task", status: "IN_PROGRESS" },
				]),
			);

			const { isMigrationNeeded } = await import("./migration");

			const needed = await isMigrationNeeded();

			expect(needed).toBe(true);
			expect(mockLocalStorage.getItem).toHaveBeenCalledWith("tasks");
		});

		it("should return false when no localStorage data exists", async () => {
			mockLocalStorage.getItem.mockReturnValue(null);

			const { isMigrationNeeded } = await import("./migration");

			const needed = await isMigrationNeeded();

			expect(needed).toBe(false);
		});

		it("should get migration status", async () => {
			const { getMigrationStatus } = await import("./migration");

			const status = getMigrationStatus();

			expect(status).toBeDefined();
			expect(status.isComplete).toBe(false);
			expect(status.progress).toBe(0);
			expect(status.currentStep).toBe("Not started");
		});
	});

	describe("Task Migration", () => {
		it("should migrate tasks from localStorage to database", async () => {
			const mockTasks = [
				{
					id: "1",
					title: "Test Task 1",
					description: "Description 1",
					status: "IN_PROGRESS",
					messages: [],
					branch: "main",
					sessionId: "session-1",
					repository: "test-repo",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				{
					id: "2",
					title: "Test Task 2",
					description: "Description 2",
					status: "DONE",
					messages: [],
					branch: "feature",
					sessionId: "session-2",
					repository: "test-repo",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			];

			mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockTasks));
			mockDbClient.insert.mockResolvedValue({ success: true });

			const { migrateTasks } = await import("./migration");

			const result = await migrateTasks();

			expect(result.success).toBe(true);
			expect(result.migratedCount).toBe(2);
			expect(mockDbClient.insert).toHaveBeenCalledTimes(2);
		});

		it("should handle task migration errors", async () => {
			const mockTasks = [{ id: "1", title: "Test Task" }];

			mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockTasks));
			mockDbClient.insert.mockRejectedValue(new Error("Database error"));

			const { migrateTasks } = await import("./migration");

			const result = await migrateTasks();

			expect(result.success).toBe(false);
			expect(result.errors).toContain("Database error");
		});

		it("should validate task data before migration", async () => {
			const invalidTasks = [
				{ id: "1" }, // Missing required fields
				{ title: "Task without ID" }, // Missing ID
			];

			mockLocalStorage.getItem.mockReturnValue(JSON.stringify(invalidTasks));

			const { migrateTasks } = await import("./migration");

			const result = await migrateTasks();

			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe("Environment Migration", () => {
		it("should migrate environments from localStorage to database", async () => {
			const mockEnvironments = [
				{
					id: "1",
					name: "Test Environment",
					description: "Test Description",
					githubOrganization: "test-org",
					githubToken: "token-123",
					githubRepository: "test-repo",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					isActive: true,
				},
			];

			mockLocalStorage.getItem.mockReturnValue(
				JSON.stringify(mockEnvironments),
			);
			mockDbClient.insert.mockResolvedValue({ success: true });

			const { migrateEnvironments } = await import("./migration");

			const result = await migrateEnvironments();

			expect(result.success).toBe(true);
			expect(result.migratedCount).toBe(1);
			expect(mockDbClient.insert).toHaveBeenCalledTimes(1);
		});

		it("should handle environment migration errors", async () => {
			const mockEnvironments = [{ id: "1", name: "Test Env" }];

			mockLocalStorage.getItem.mockReturnValue(
				JSON.stringify(mockEnvironments),
			);
			mockDbClient.insert.mockRejectedValue(new Error("Database error"));

			const { migrateEnvironments } = await import("./migration");

			const result = await migrateEnvironments();

			expect(result.success).toBe(false);
			expect(result.errors).toContain("Database error");
		});
	});

	describe("Full Migration", () => {
		it("should perform complete migration", async () => {
			mockLocalStorage.getItem
				.mockReturnValueOnce(JSON.stringify([{ id: "1", title: "Task" }]))
				.mockReturnValueOnce(JSON.stringify([{ id: "1", name: "Env" }]));

			mockDbClient.insert.mockResolvedValue({ success: true });

			const { performFullMigration } = await import("./migration");

			const result = await performFullMigration();

			expect(result.success).toBe(true);
			expect(result.totalMigrated).toBeGreaterThan(0);
		});

		it("should handle partial migration failures", async () => {
			mockLocalStorage.getItem
				.mockReturnValueOnce(JSON.stringify([{ id: "1", title: "Task" }]))
				.mockReturnValueOnce(JSON.stringify([{ id: "1", name: "Env" }]));

			mockDbClient.insert
				.mockResolvedValueOnce({ success: true })
				.mockRejectedValueOnce(new Error("Environment migration failed"));

			const { performFullMigration } = await import("./migration");

			const result = await performFullMigration();

			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it("should update migration progress during execution", async () => {
			mockLocalStorage.getItem
				.mockReturnValueOnce(JSON.stringify([{ id: "1", title: "Task" }]))
				.mockReturnValueOnce(JSON.stringify([{ id: "1", name: "Env" }]));

			mockDbClient.insert.mockResolvedValue({ success: true });

			const { performFullMigration, getMigrationStatus } = await import(
				"./migration"
			);

			const migrationPromise = performFullMigration();

			// Check progress during migration
			const statusDuringMigration = getMigrationStatus();
			expect(statusDuringMigration.progress).toBeGreaterThanOrEqual(0);

			await migrationPromise;

			const finalStatus = getMigrationStatus();
			expect(finalStatus.isComplete).toBe(true);
			expect(finalStatus.progress).toBe(100);
		});
	});

	describe("Data Validation", () => {
		it("should validate task data structure", async () => {
			const { validateTaskData } = await import("./migration");

			const validTask = {
				id: "1",
				title: "Valid Task",
				description: "Valid Description",
				status: "IN_PROGRESS",
				messages: [],
				branch: "main",
				sessionId: "session-1",
				repository: "test-repo",
			};

			const validation = validateTaskData(validTask);

			expect(validation.isValid).toBe(true);
			expect(validation.errors).toHaveLength(0);
		});

		it("should detect invalid task data", async () => {
			const { validateTaskData } = await import("./migration");

			const invalidTask = {
				id: "",
				title: "",
				// Missing required fields
			};

			const validation = validateTaskData(invalidTask);

			expect(validation.isValid).toBe(false);
			expect(validation.errors.length).toBeGreaterThan(0);
		});

		it("should validate environment data structure", async () => {
			const { validateEnvironmentData } = await import("./migration");

			const validEnvironment = {
				id: "1",
				name: "Valid Environment",
				description: "Valid Description",
				githubOrganization: "test-org",
				githubToken: "token-123",
				githubRepository: "test-repo",
			};

			const validation = validateEnvironmentData(validEnvironment);

			expect(validation.isValid).toBe(true);
			expect(validation.errors).toHaveLength(0);
		});
	});

	describe("Cleanup", () => {
		it("should clean up localStorage after successful migration", async () => {
			mockLocalStorage.getItem.mockReturnValue(
				JSON.stringify([{ id: "1", title: "Task" }]),
			);
			mockDbClient.insert.mockResolvedValue({ success: true });

			const { performFullMigration } = await import("./migration");

			const result = await performFullMigration({
				cleanupAfterMigration: true,
			});

			expect(result.success).toBe(true);
			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("tasks");
			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("environments");
		});

		it("should not clean up localStorage if migration fails", async () => {
			mockLocalStorage.getItem.mockReturnValue(
				JSON.stringify([{ id: "1", title: "Task" }]),
			);
			mockDbClient.insert.mockRejectedValue(new Error("Migration failed"));

			const { performFullMigration } = await import("./migration");

			const result = await performFullMigration({
				cleanupAfterMigration: true,
			});

			expect(result.success).toBe(false);
			expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
		});
	});
});
