import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock ElectricSQL client
const mockElectricClient = {
	connect: vi.fn(),
	disconnect: vi.fn(),
	sync: vi.fn(),
	subscribe: vi.fn(),
	unsubscribe: vi.fn(),
	isConnected: vi.fn(),
};

const mockElectric = vi.fn(() => mockElectricClient);

vi.mock("electric-sql", () => ({
	Electric: mockElectric,
}));

describe("ElectricSQL Real-time Synchronization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset environment variables
		delete process.env.ELECTRIC_URL;
		delete process.env.ELECTRIC_TOKEN;
	});

	describe("Electric Client Configuration", () => {
		it("should create Electric client configuration", async () => {
			const { getElectricConfig } = await import("./electric");

			const config = getElectricConfig();

			expect(config).toBeDefined();
			expect(config.url).toBeDefined();
			expect(config.debug).toBeDefined();
		});

		it("should use environment variables for configuration", async () => {
			process.env.ELECTRIC_URL = "ws://localhost:5133";
			process.env.ELECTRIC_DEBUG = "true";

			const { getElectricConfig } = await import("./electric");

			const config = getElectricConfig();

			expect(config.url).toBe("ws://localhost:5133");
			expect(config.debug).toBe(true);
		});

		it("should provide default configuration values", async () => {
			const { getElectricConfig } = await import("./electric");

			const config = getElectricConfig();

			expect(config.url).toBe("ws://localhost:5133");
			expect(config.debug).toBe(false);
			expect(config.retryAttempts).toBe(3);
		});
	});

	describe("Electric Client Creation", () => {
		it("should create Electric client", async () => {
			const { createElectricClient } = await import("./electric");

			const client = await createElectricClient();

			expect(mockElectric).toHaveBeenCalled();
			expect(client).toBeDefined();
		});

		it("should handle client creation errors", async () => {
			mockElectric.mockImplementation(() => {
				throw new Error("Connection failed");
			});

			const { createElectricClient } = await import("./electric");

			await expect(createElectricClient()).rejects.toThrow("Connection failed");
		});
	});

	describe("Real-time Synchronization", () => {
		it("should start synchronization for tasks", async () => {
			mockElectricClient.sync.mockResolvedValue(true);

			const { startTaskSync } = await import("./electric");

			const result = await startTaskSync();

			expect(result.success).toBe(true);
			expect(mockElectricClient.sync).toHaveBeenCalledWith("tasks");
		});

		it("should start synchronization for environments", async () => {
			mockElectricClient.sync.mockResolvedValue(true);

			const { startEnvironmentSync } = await import("./electric");

			const result = await startEnvironmentSync();

			expect(result.success).toBe(true);
			expect(mockElectricClient.sync).toHaveBeenCalledWith("environments");
		});

		it("should handle synchronization errors", async () => {
			mockElectricClient.sync.mockRejectedValue(new Error("Sync failed"));

			const { startTaskSync } = await import("./electric");

			const result = await startTaskSync();

			expect(result.success).toBe(false);
			expect(result.error).toBe("Sync failed");
		});
	});

	describe("Subscription Management", () => {
		it("should subscribe to table changes", async () => {
			const mockCallback = vi.fn();
			mockElectricClient.subscribe.mockResolvedValue("subscription-id");

			const { subscribeToTableChanges } = await import("./electric");

			const subscriptionId = await subscribeToTableChanges(
				"tasks",
				mockCallback,
			);

			expect(subscriptionId).toBe("subscription-id");
			expect(mockElectricClient.subscribe).toHaveBeenCalledWith(
				"tasks",
				mockCallback,
			);
		});

		it("should unsubscribe from table changes", async () => {
			mockElectricClient.unsubscribe.mockResolvedValue(true);

			const { unsubscribeFromTableChanges } = await import("./electric");

			const result = await unsubscribeFromTableChanges("subscription-id");

			expect(result).toBe(true);
			expect(mockElectricClient.unsubscribe).toHaveBeenCalledWith(
				"subscription-id",
			);
		});
	});

	describe("Connection Management", () => {
		it("should connect to Electric service", async () => {
			mockElectricClient.connect.mockResolvedValue(true);

			const { connectElectric } = await import("./electric");

			const result = await connectElectric();

			expect(result.success).toBe(true);
			expect(mockElectricClient.connect).toHaveBeenCalled();
		});

		it("should disconnect from Electric service", async () => {
			mockElectricClient.disconnect.mockResolvedValue(true);

			const { disconnectElectric } = await import("./electric");

			const result = await disconnectElectric();

			expect(result.success).toBe(true);
			expect(mockElectricClient.disconnect).toHaveBeenCalled();
		});

		it("should check connection status", async () => {
			mockElectricClient.isConnected.mockReturnValue(true);

			const { isElectricConnected } = await import("./electric");

			const isConnected = isElectricConnected();

			expect(isConnected).toBe(true);
			expect(mockElectricClient.isConnected).toHaveBeenCalled();
		});
	});

	describe("Conflict Resolution", () => {
		it("should handle conflict resolution for tasks", async () => {
			const conflictData = {
				local: {
					id: "1",
					title: "Local Task",
					description: "Local task description",
					messages: [],
					status: "IN_PROGRESS",
					branch: "main",
					sessionId: "session1",
					repository: "test/repo",
					mode: "code",
					createdAt: new Date("2023-01-01"),
					updatedAt: new Date("2023-01-01"),
					statusMessage: null,
					isArchived: false,
					hasChanges: false,
					pullRequest: null,
					userId: null,
					priority: "medium",
					embedding: null,
					metadata: {},
				},
				remote: {
					id: "1",
					title: "Remote Task",
					description: "Remote task description",
					messages: [],
					status: "IN_PROGRESS",
					branch: "main",
					sessionId: "session1",
					repository: "test/repo",
					mode: "code",
					createdAt: new Date("2023-01-01"),
					updatedAt: new Date("2023-01-02"),
					statusMessage: null,
					isArchived: false,
					hasChanges: false,
					pullRequest: null,
					userId: null,
					priority: "medium",
					embedding: null,
					metadata: {},
				},
			};

			const { resolveTaskConflict } = await import("./electric");

			const resolved = resolveTaskConflict(conflictData);

			// Should prefer the more recent update
			expect(resolved.title).toBe("Remote Task");
		});

		it("should handle conflict resolution for environments", async () => {
			const conflictData = {
				local: {
					isActive: true,
					id: "1",
					name: "Local Env",
					userId: null,
					config: {},
					description: "Local environment",
					createdAt: new Date("2023-01-01"),
					updatedAt: new Date("2023-01-02"),
					githubToken: "token1",
					githubOrganization: "org1",
					githubRepository: "repo1",
					schemaVersion: 1,
				},
				remote: {
					isActive: true,
					id: "1",
					name: "Remote Env",
					userId: null,
					config: {},
					description: "Remote environment",
					createdAt: new Date("2023-01-01"),
					updatedAt: new Date("2023-01-01"),
					githubToken: "token2",
					githubOrganization: "org2",
					githubRepository: "repo2",
					schemaVersion: 1,
				},
			};

			const { resolveEnvironmentConflict } = await import("./electric");

			const resolved = resolveEnvironmentConflict(conflictData);

			// Should prefer the more recent update
			expect(resolved.name).toBe("Local Env");
		});

		it("should use custom conflict resolution strategy", async () => {
			const conflictData = {
				local: { id: "1", title: "Local Task" },
				remote: { id: "1", title: "Remote Task" },
			};

			const customResolver = vi
				.fn()
				.mockReturnValue({ id: "1", title: "Merged Task" });

			const { resolveConflictWithStrategy } = await import("./electric");

			const resolved = resolveConflictWithStrategy(
				conflictData,
				customResolver,
			);

			expect(customResolver).toHaveBeenCalledWith(conflictData);
			expect(resolved.title).toBe("Merged Task");
		});
	});

	describe("Offline Support", () => {
		it("should handle offline mode", async () => {
			const { setOfflineMode, isOfflineMode } = await import("./electric");

			setOfflineMode(true);

			expect(isOfflineMode()).toBe(true);
		});

		it("should queue operations when offline", async () => {
			const { setOfflineMode, queueOperation, getQueuedOperations } =
				await import("./electric");

			setOfflineMode(true);

			const operation = {
				type: "insert" as const,
				table: "tasks",
				data: {
					id: "task1",
					title: "New Task",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			};

			queueOperation(operation);

			const queued = getQueuedOperations();
			expect(queued).toHaveLength(1);
			expect(queued[0]).toEqual(operation);
		});

		it("should sync queued operations when coming online", async () => {
			mockElectricClient.sync.mockResolvedValue(true);

			const { setOfflineMode, queueOperation, syncQueuedOperations } =
				await import("./electric");

			setOfflineMode(true);
			queueOperation({
				type: "insert" as const,
				table: "tasks",
				data: {
					id: "task1",
					title: "Task 1",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});
			queueOperation({
				type: "update" as const,
				table: "tasks",
				data: {
					id: "1",
					title: "Updated Task",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});

			setOfflineMode(false);

			const result = await syncQueuedOperations();

			expect(result.success).toBe(true);
			expect(result.syncedCount).toBe(2);
		});
	});
});
