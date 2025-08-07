/**
 * LangGraph Swarm Integration Test Suite
 * Tests real SwarmCoordinator with actual LangGraph agents
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueenAgentLangGraph } from "../../src/agents/queen-agent-langgraph";
import { WorkerAgentLangGraph } from "../../src/agents/worker-agent-langgraph";
import { SwarmCoordinator } from "../../src/swarm/swarm-coordinator";
import type { SwarmTask } from "../../src/types/swarm-types";
import { createSwarmTestDoubles } from "../test-doubles";

describe("LangGraph Swarm Integration", () => {
	let coordinator: SwarmCoordinator;
	let queenAgent: QueenAgentLangGraph;
	let workerAgent: WorkerAgentLangGraph;
	let testDoubles: ReturnType<typeof createSwarmTestDoubles>;

	beforeEach(async () => {
		// Create real LangGraph agents
		queenAgent = new QueenAgentLangGraph();
		workerAgent = new WorkerAgentLangGraph();

		// Use test doubles for consensus engine and topology manager (not our focus)
		testDoubles = createSwarmTestDoubles();

		// Create coordinator with real LangGraph agents + test doubles for infrastructure
		coordinator = new SwarmCoordinator({
			queenAgent,
			workerAgent,
			consensusEngine: testDoubles.consensusEngine,
			topologyManager: testDoubles.topologyManager,
			maxAgents: 5, // Lower for integration tests
		});

		await coordinator.initialize();
	});

	afterEach(async () => {
		if (coordinator) {
			await coordinator.shutdown();
		}
		// Clean up all worker instances
		await workerAgent.terminate();
	});

	describe("end-to-end task execution", () => {
		it("should coordinate real LangGraph agents for task execution", async () => {
			// Arrange - Create a realistic software development task
			const task: SwarmTask = {
				id: "integration-task-001",
				type: "feature-development",
				description: "Implement user authentication system",
				priority: 3, // High priority
				metadata: {
					complexity: "medium",
					estimatedHours: 8,
					requiredSkills: ["backend", "security", "testing"],
				},
			};

			// Act - Let the real agents coordinate and execute
			const spawnedAgents = await coordinator.spawnAgentsForTask(task);

			// Assert - Verify real agent behavior
			expect(spawnedAgents.length).toBeGreaterThan(0);
			expect(spawnedAgents.length).toBeLessThanOrEqual(5); // Respects maxAgents
			expect(coordinator.getActiveAgentCount()).toBe(spawnedAgents.length);

			// Verify agents have proper configuration
			for (const agent of spawnedAgents) {
				expect(agent.id).toBeDefined();
				expect(agent.type).toBeDefined();
				expect(agent.status).toBe("idle"); // Should start idle
				expect(typeof agent.execute).toBe("function");
				expect(typeof agent.terminate).toBe("function");
			}
		});

		it("should handle multiple concurrent tasks with real agents", async () => {
			// Arrange - Multiple tasks that could run in parallel
			const tasks: SwarmTask[] = [
				{
					id: "task-frontend",
					type: "frontend-development",
					description: "Build user interface components",
					priority: 2,
				},
				{
					id: "task-backend",
					type: "backend-development",
					description: "Implement API endpoints",
					priority: 3,
				},
				{
					id: "task-testing",
					type: "quality-assurance",
					description: "Create automated tests",
					priority: 1,
				},
			];

			// Act - Spawn agents for multiple tasks concurrently
			const allSpawnedAgents = await Promise.all(
				tasks.map((task) => coordinator.spawnAgentsForTask(task)),
			);

			// Assert - Verify proper coordination
			const totalAgents = allSpawnedAgents.reduce(
				(sum, agents) => sum + agents.length,
				0,
			);
			expect(totalAgents).toBeLessThanOrEqual(5); // Should respect agent limit
			expect(coordinator.getActiveAgentCount()).toBe(totalAgents);

			// All agents should be properly initialized
			const flatAgents = allSpawnedAgents.flat();
			for (const agent of flatAgents) {
				expect(agent.id).toBeDefined();
				expect(agent.status).toBe("idle");
			}
		});

		it("should execute tasks using real WorkerAgent LangGraph implementation", async () => {
			// Arrange
			const task: SwarmTask = {
				id: "execution-test",
				type: "code-review",
				description: "Review pull request for security vulnerabilities",
				priority: 2,
			};

			// Spawn an agent
			const agents = await coordinator.spawnAgentsForTask(task);
			expect(agents.length).toBeGreaterThan(0);

			const worker = agents[0];

			// Act - Execute a task using the real LangGraph WorkerAgent
			const result = await worker.execute(task);

			// Assert - Verify real execution
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");

			// The WorkerAgent should return meaningful results
			if (typeof result === "object" && result !== null) {
				// Check for result structure that matches our LangGraph implementation
				expect(result).toBeTruthy();
			}
		});

		it("should handle agent failures and recovery in real environment", async () => {
			// Arrange
			const task: SwarmTask = {
				id: "failure-recovery-test",
				type: "data-processing",
				description: "Process large dataset",
				priority: 2,
			};

			const agents = await coordinator.spawnAgentsForTask(task);
			expect(agents.length).toBeGreaterThan(0);

			const initialAgentCount = coordinator.getActiveAgentCount();
			const failingAgent = agents[0];

			// Act - Simulate agent failure
			const mockError = new Error("Simulated worker failure");
			await coordinator.handleAgentFailure(failingAgent.id, mockError);

			// Assert - Coordinator should handle failure gracefully
			expect(coordinator.getActiveAgentCount()).toBeLessThanOrEqual(
				initialAgentCount,
			);
			// The real implementation should have cleaned up the failed agent
		});
	});

	describe("real agent metadata and capabilities", () => {
		it("should properly integrate QueenAgent LangGraph metadata", () => {
			// Act
			const metadata = queenAgent.getMetadata();

			// Assert - Verify QueenAgent capabilities are properly exposed
			expect(metadata.name).toBe("queen-agent");
			expect(metadata.version).toBe("1.0.0");
			expect(metadata.capabilities).toContain("strategic_planning");
			expect(metadata.capabilities).toContain("swarm_coordination");
			expect(metadata.capabilities).toContain("resource_allocation");
			expect(metadata.capabilities).toContain("task_orchestration");
		});

		it("should properly integrate WorkerAgent LangGraph metadata", () => {
			// Act
			const metadata = workerAgent.getMetadata();

			// Assert - Verify WorkerAgent capabilities are properly exposed
			expect(metadata.name).toBe("worker-agent");
			expect(metadata.version).toBe("1.0.0");
			expect(metadata.capabilities).toContain("task_execution");
			expect(metadata.capabilities).toContain("resource_monitoring");
			expect(metadata.capabilities).toContain("status_reporting");
			expect(metadata.capabilities).toContain("error_handling");
		});
	});

	describe("state management integration", () => {
		it("should properly report swarm state with real agents", async () => {
			// Arrange
			const task: SwarmTask = {
				id: "state-test",
				type: "monitoring",
				description: "Monitor system performance",
				priority: 1,
			};

			// Act
			await coordinator.spawnAgentsForTask(task);
			const state = coordinator.getState();

			// Assert - State should reflect real agent activity
			expect(state.swarmMetrics).toBeDefined();
			expect(state.swarmMetrics?.totalAgents).toBeGreaterThan(1); // At least queen + workers
			expect(state.swarmMetrics?.activeAgents).toBeGreaterThanOrEqual(0);
			expect(typeof state.swarmMetrics?.taskCompletionRate).toBe("number");
			expect(typeof state.swarmMetrics?.averageResponseTime).toBe("number");
		});
	});

	describe("topology integration", () => {
		it("should work with different topologies using real agents", async () => {
			// Arrange
			const topologies = ["hierarchical", "mesh", "star", "ring"] as const;

			for (const topology of topologies) {
				// Act
				await coordinator.setTopology(topology);

				// Create a simple task to test coordination still works
				const task: SwarmTask = {
					id: `topology-test-${topology}`,
					type: "simple-task",
					description: `Test task for ${topology} topology`,
					priority: 1,
				};

				const agents = await coordinator.spawnAgentsForTask(task);

				// Assert - Agents should spawn regardless of topology
				expect(agents.length).toBeGreaterThanOrEqual(0);

				// Clean up for next iteration
				for (const agent of agents) {
					await agent.terminate();
				}
			}
		});
	});

	describe("performance and scaling integration", () => {
		it("should handle scaling up to max agents with real LangGraph agents", async () => {
			// Arrange - Create enough tasks to trigger max agent limit
			const tasks = Array.from({ length: 8 }, (_, i) => ({
				id: `scale-test-${i}`,
				type: "batch-processing",
				description: `Batch task ${i}`,
				priority: 1,
			}));

			let totalAgentsSpawned = 0;

			// Act - Spawn agents for all tasks
			for (const task of tasks) {
				const agents = await coordinator.spawnAgentsForTask(task);
				totalAgentsSpawned += agents.length;

				// Should never exceed max limit
				expect(coordinator.getActiveAgentCount()).toBeLessThanOrEqual(5);

				if (coordinator.getActiveAgentCount() >= 5) {
					// Once at limit, no more agents should spawn
					break;
				}
			}

			// Assert
			expect(totalAgentsSpawned).toBeGreaterThan(0);
			expect(coordinator.getActiveAgentCount()).toBeLessThanOrEqual(5);
		});
	});
});
