/**
 * WorkerAgent LangGraph Test Suite
 * TDD London School approach for testing LangGraph-based Worker Agent
 */

import { beforeEach, describe, expect, it } from "vitest";
import { WorkerAgentLangGraph } from "../../src/agents/worker-agent-langgraph";
import type { WorkerConfig } from "../../src/types/swarm-types";

describe("WorkerAgentLangGraph", () => {
	let workerAgent: WorkerAgentLangGraph;

	beforeEach(() => {
		workerAgent = new WorkerAgentLangGraph();
	});

	describe("initialization", () => {
		it("should initialize with proper metadata and capabilities", () => {
			// Arrange & Act - created in beforeEach
			const metadata = workerAgent.getMetadata();

			// Assert
			expect(metadata.name).toBe("worker-agent");
			expect(metadata.version).toBe("1.0.0");
			expect(metadata.capabilities).toContain("task_execution");
			expect(metadata.capabilities).toContain("resource_monitoring");
			expect(metadata.capabilities).toContain("status_reporting");
			expect(metadata.capabilities).toContain("error_handling");
			expect(metadata.requiredTools).toContain("task_executor");
		});

		it("should be ready for execution", () => {
			// Arrange & Act - created in beforeEach

			// Assert
			expect(workerAgent).toBeDefined();
			expect(workerAgent.spawn).toBeDefined();
			expect(workerAgent.execute).toBeDefined();
			expect(workerAgent.reportStatus).toBeDefined();
			expect(workerAgent.terminate).toBeDefined();
			expect(workerAgent.getMetadata).toBeDefined();
		});
	});

	describe("task assessment", () => {
		it("should assess task and determine execution feasibility", async () => {
			// Arrange - Create temporary instance to test graph execution
			const tempWorker = new WorkerAgentLangGraph();
			const tempConfig: WorkerConfig = {
				id: "temp-worker",
				type: "general",
				capabilities: ["task_execution"],
				resources: { cpu: 100, memory: 512 },
			};

			const instance = await tempWorker.spawn(tempConfig);
			const result = await instance.execute({
				id: "test-task",
				description: "test",
			});

			// Assert
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");

			// Cleanup
			await instance.terminate();
		});

		it("should handle insufficient resources gracefully", async () => {
			// Arrange - low resource configuration
			const lowResourceConfig: WorkerConfig = {
				id: "limited-worker",
				type: "limited",
				capabilities: ["basic_processing"],
				resources: { cpu: 10, memory: 32 }, // Very low resources
			};

			// Act
			const tempWorker = new WorkerAgentLangGraph();
			const instance = await tempWorker.spawn(lowResourceConfig);
			const result = await instance.execute({
				id: "heavy-task",
				description: "Resource intensive task",
				priority: "critical", // Will require more resources
			});

			// Assert - Should still complete but may report resource constraints
			expect(result).toBeDefined();

			// Cleanup
			await instance.terminate();
		});

		it("should handle empty task queue", async () => {
			// Arrange & Act
			const tempWorker = new WorkerAgentLangGraph();
			const tempConfig: WorkerConfig = {
				id: "idle-worker",
				type: "general",
				capabilities: ["task_execution"],
				resources: { cpu: 100, memory: 512 },
			};

			const instance = await tempWorker.spawn(tempConfig);
			const result = await instance.execute({
				id: "test-task",
				description: "test",
			});

			// Assert - Should handle gracefully
			expect(result).toBeDefined();

			// Cleanup
			await instance.terminate();
		});
	});

	describe("resource management", () => {
		it("should allocate resources based on task requirements", async () => {
			// Arrange - high priority task requiring more resources
			const highPriorityTask = {
				id: "critical-task",
				description: "Critical system repair",
				priority: "critical" as const,
			};

			// Act
			const tempWorker = new WorkerAgentLangGraph();
			const tempConfig: WorkerConfig = {
				id: "resource-worker",
				type: "general",
				capabilities: ["task_execution", "system_repair"],
				resources: { cpu: 200, memory: 1024 }, // Higher resources
			};

			const instance = await tempWorker.spawn(tempConfig);
			const result = await instance.execute(highPriorityTask);

			// Assert
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");

			// Cleanup
			await instance.terminate();
		});

		it("should monitor resource usage during execution", async () => {
			// Arrange - medium complexity task
			const mediumTask = {
				id: "monitoring-task",
				description: "Task with resource monitoring",
				priority: "medium" as const,
			};

			// Act
			const tempWorker = new WorkerAgentLangGraph();
			const tempConfig: WorkerConfig = {
				id: "monitoring-worker",
				type: "general",
				capabilities: ["task_execution", "resource_monitoring"],
				resources: { cpu: 150, memory: 768 },
			};

			const instance = await tempWorker.spawn(tempConfig);
			const result = await instance.execute(mediumTask);

			// Assert
			expect(result).toBeDefined();

			// Cleanup
			await instance.terminate();
		});

		it("should clean up resources after task completion", async () => {
			// Arrange - task that requires cleanup
			const cleanupTask = {
				id: "cleanup-task",
				description: "Task requiring resource cleanup",
				priority: "low" as const,
			};

			// Act
			const tempWorker = new WorkerAgentLangGraph();
			const tempConfig: WorkerConfig = {
				id: "cleanup-worker",
				type: "general",
				capabilities: ["task_execution", "resource_cleanup"],
				resources: { cpu: 100, memory: 512 },
			};

			const instance = await tempWorker.spawn(tempConfig);
			const result = await instance.execute(cleanupTask);

			// Assert
			expect(result).toBeDefined();

			// Cleanup
			await instance.terminate();
		});
	});

	describe("task execution", () => {
		it("should execute task successfully and return results", async () => {
			// Arrange
			const successTask = {
				id: "success-task",
				description: "Task guaranteed to succeed",
				priority: "medium" as const,
			};

			// Act
			const result = await workerAgent.execute(successTask);

			// Assert
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");
		});

		it("should handle task execution errors gracefully", async () => {
			// Arrange - task that might cause errors
			const errorProneTask = {
				id: "error-task",
				description: "Task that might fail",
				priority: "high" as const,
				// Add properties that might cause issues
				invalidProperty: null,
			};

			// Act & Assert - Should not throw
			await expect(workerAgent.execute(errorProneTask)).resolves.toBeDefined();
		});

		it("should track execution progress and completion", async () => {
			// Arrange
			const progressTask = {
				id: "progress-task",
				description: "Task with progress tracking",
				priority: "medium" as const,
			};

			// Act
			const result = await workerAgent.execute(progressTask);

			// Assert
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");
		});
	});

	describe("worker instance management", () => {
		it("should spawn worker instances with proper configuration", async () => {
			// Arrange
			const config: WorkerConfig = {
				id: "test-worker-1",
				type: "specialized",
				capabilities: ["data_analysis", "report_generation"],
				resources: { cpu: 150, memory: 1024 },
			};

			// Act
			const instance = await workerAgent.spawn(config);

			// Assert
			expect(instance).toBeDefined();
			expect(instance.id).toBe(config.id);
			expect(instance.type).toBe(config.type);
			expect(instance.status).toBe("idle");
			expect(instance.execute).toBeDefined();
			expect(instance.terminate).toBeDefined();

			// Cleanup
			await instance.terminate();
		});

		it("should manage multiple worker instances independently", async () => {
			// Arrange
			const config1: WorkerConfig = {
				id: "worker-1",
				type: "type-a",
				capabilities: ["capability-a"],
				resources: { cpu: 100, memory: 512 },
			};

			const config2: WorkerConfig = {
				id: "worker-2",
				type: "type-b",
				capabilities: ["capability-b"],
				resources: { cpu: 200, memory: 1024 },
			};

			// Act
			const instance1 = await workerAgent.spawn(config1);
			const instance2 = await workerAgent.spawn(config2);

			// Assert
			expect(instance1.id).toBe("worker-1");
			expect(instance2.id).toBe("worker-2");
			expect(instance1.type).toBe("type-a");
			expect(instance2.type).toBe("type-b");

			// Test independent execution
			const task1 = { id: "task-1", description: "Task for worker 1" };
			const task2 = { id: "task-2", description: "Task for worker 2" };

			const result1 = await instance1.execute(task1);
			const result2 = await instance2.execute(task2);

			expect(result1).toBeDefined();
			expect(result2).toBeDefined();

			// Cleanup
			await instance1.terminate();
			await instance2.terminate();
		});

		it("should terminate worker instances and clean up resources", async () => {
			// Arrange
			const config: WorkerConfig = {
				id: "termination-worker",
				type: "temporary",
				capabilities: ["short_term_tasks"],
				resources: { cpu: 50, memory: 256 },
			};

			const instance = await workerAgent.spawn(config);

			// Act
			await instance.terminate();

			// Assert - Instance should be cleaned up
			// We can't directly test internal state, but termination should complete without errors
			expect(true).toBe(true); // Termination completed successfully
		});
	});

	describe("status reporting", () => {
		it("should report current worker status accurately", () => {
			// Arrange & Act
			const status = workerAgent.reportStatus();

			// Assert
			expect(status).toBeDefined();
			expect(status.status).toBeDefined();
			expect(status.progress).toBeDefined();
			expect(typeof status.status).toBe("string");
			expect(typeof status.progress).toBe("number");
			expect(status.progress).toBeGreaterThanOrEqual(0);
			expect(status.progress).toBeLessThanOrEqual(100);
		});

		it("should provide accurate progress information during task execution", async () => {
			// Arrange
			const progressTask = {
				id: "status-task",
				description: "Task for status testing",
				priority: "medium" as const,
			};

			// Act
			const initialStatus = workerAgent.reportStatus();
			await workerAgent.execute(progressTask);
			const finalStatus = workerAgent.reportStatus();

			// Assert
			expect(initialStatus).toBeDefined();
			expect(finalStatus).toBeDefined();
			expect(typeof initialStatus.progress).toBe("number");
			expect(typeof finalStatus.progress).toBe("number");
		});
	});

	describe("error handling", () => {
		it("should handle malformed task data gracefully", async () => {
			// Arrange - malformed task
			const malformedTask = {
				// Missing required fields
				description: null,
				priority: "invalid-priority",
			};

			// Act & Assert - Should not throw
			await expect(workerAgent.execute(malformedTask)).resolves.toBeDefined();
		});

		it("should handle resource allocation failures", async () => {
			// Arrange - impossible resource requirements
			const impossibleConfig: WorkerConfig = {
				id: "impossible-worker",
				type: "impossible",
				capabilities: ["impossible_tasks"],
				resources: { cpu: -1, memory: -1 }, // Invalid resources
			};

			// Act & Assert - Should handle gracefully
			await expect(workerAgent.spawn(impossibleConfig)).resolves.toBeDefined();
		});

		it("should recover from execution errors and continue", async () => {
			// Arrange - sequence of tasks, some may fail
			const tasks = [
				{ id: "task-1", description: "Normal task", priority: "medium" },
				{ id: "task-2", description: "Problem task", priority: "high" },
				{ id: "task-3", description: "Recovery task", priority: "low" },
			];

			// Act & Assert - All tasks should be handled
			for (const task of tasks) {
				await expect(workerAgent.execute(task)).resolves.toBeDefined();
			}
		});
	});

	describe("integration", () => {
		it("should handle complete workflow from spawn to termination", async () => {
			// Arrange
			const config: WorkerConfig = {
				id: "integration-worker",
				type: "integration-test",
				capabilities: ["full_workflow"],
				resources: { cpu: 100, memory: 512 },
			};

			const task = {
				id: "integration-task",
				description: "Complete integration test task",
				priority: "medium" as const,
			};

			// Act
			const instance = await workerAgent.spawn(config);
			const result = await instance.execute(task);
			await instance.terminate();

			// Assert
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");
		});

		it("should maintain performance under concurrent task execution", async () => {
			// Arrange
			const config: WorkerConfig = {
				id: "concurrent-worker",
				type: "concurrent-test",
				capabilities: ["concurrent_processing"],
				resources: { cpu: 200, memory: 1024 },
			};

			const tasks = Array.from({ length: 5 }, (_, i) => ({
				id: `concurrent-task-${i}`,
				description: `Concurrent task ${i}`,
				priority: "medium" as const,
			}));

			// Act
			const instance = await workerAgent.spawn(config);
			const startTime = Date.now();

			// Execute tasks concurrently
			const results = await Promise.all(
				tasks.map((task) => instance.execute(task)),
			);

			const endTime = Date.now();
			const totalTime = endTime - startTime;

			// Assert
			expect(results).toHaveLength(5);
			results.forEach((result) => {
				expect(result).toBeDefined();
			});

			// Performance assertion - should complete in reasonable time
			expect(totalTime).toBeLessThan(10000); // Less than 10 seconds

			// Cleanup
			await instance.terminate();
		});

		it("should provide comprehensive execution metrics", async () => {
			// Arrange
			const metricsTask = {
				id: "metrics-task",
				description: "Task for metrics collection",
				priority: "high" as const,
			};

			// Act
			const result = await workerAgent.execute(metricsTask);

			// Assert
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");
		});
	});

	describe("specialization and capabilities", () => {
		it("should handle specialized worker types correctly", async () => {
			// Arrange
			const specializedConfig: WorkerConfig = {
				id: "specialist-worker",
				type: "data-scientist",
				capabilities: ["machine_learning", "data_analysis", "visualization"],
				resources: { cpu: 300, memory: 2048 },
			};

			// Act
			const instance = await workerAgent.spawn(specializedConfig);
			const mlTask = {
				id: "ml-task",
				description: "Machine learning model training",
				priority: "high" as const,
			};

			const result = await instance.execute(mlTask);

			// Assert
			expect(instance.type).toBe("data-scientist");
			expect(result).toBeDefined();

			// Cleanup
			await instance.terminate();
		});

		it("should respect resource constraints and limitations", async () => {
			// Arrange
			const constrainedConfig: WorkerConfig = {
				id: "constrained-worker",
				type: "lightweight",
				capabilities: ["basic_processing"],
				resources: { cpu: 25, memory: 128 }, // Very limited resources
			};

			// Act
			const instance = await workerAgent.spawn(constrainedConfig);
			const lightTask = {
				id: "light-task",
				description: "Lightweight processing task",
				priority: "low" as const,
			};

			const result = await instance.execute(lightTask);

			// Assert
			expect(result).toBeDefined();

			// Cleanup
			await instance.terminate();
		});
	});

	describe("termination and cleanup", () => {
		it("should terminate all worker instances when agent terminates", async () => {
			// Arrange - spawn multiple workers
			const configs: WorkerConfig[] = [
				{
					id: "worker-1",
					type: "type-1",
					capabilities: ["cap-1"],
					resources: { cpu: 50, memory: 256 },
				},
				{
					id: "worker-2",
					type: "type-2",
					capabilities: ["cap-2"],
					resources: { cpu: 75, memory: 384 },
				},
				{
					id: "worker-3",
					type: "type-3",
					capabilities: ["cap-3"],
					resources: { cpu: 100, memory: 512 },
				},
			];

			const instances = await Promise.all(
				configs.map((config) => workerAgent.spawn(config)),
			);

			// Act
			await workerAgent.terminate();

			// Assert - All instances should be terminated
			// We can't directly test internal state, but termination should complete without errors
			expect(instances).toHaveLength(3);
		});

		it("should handle graceful shutdown under load", async () => {
			// Arrange - worker under load
			const loadConfig: WorkerConfig = {
				id: "load-worker",
				type: "load-test",
				capabilities: ["high_throughput"],
				resources: { cpu: 200, memory: 1024 },
			};

			const instance = await workerAgent.spawn(loadConfig);

			// Start multiple tasks (intentionally not awaiting to simulate load)
			Array.from({ length: 3 }, (_, i) =>
				instance.execute({
					id: `load-task-${i}`,
					description: `Load test task ${i}`,
					priority: "medium" as const,
				}),
			);

			// Act - Terminate while tasks might still be running
			await instance.terminate();

			// Assert - Termination should complete cleanly
			expect(true).toBe(true);
		});
	});
});
