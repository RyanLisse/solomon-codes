/**
 * QueenAgent LangGraph Test Suite
 * TDD London School approach for testing LangGraph-based Queen Agent
 */

import type { BaseMessage } from "@langchain/core/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	QueenAgentLangGraph,
	type QueenAgentState,
} from "../../src/agents/queen-agent-langgraph";

describe("QueenAgentLangGraph", () => {
	let queenAgent: QueenAgentLangGraph;
	let mockQueenState: QueenAgentState;

	beforeEach(() => {
		queenAgent = new QueenAgentLangGraph();

		// Create comprehensive mock state for Queen Agent
		mockQueenState = {
			// Base state
			messages: [],
			activeAgents: ["agent1", "agent2", "agent3"],
			swarmTopology: "hierarchical",
			taskQueue: [
				{
					id: "task1",
					description: "Implement authentication system",
					priority: "high",
					status: "pending",
				},
				{
					id: "task2",
					description: "Write unit tests",
					priority: "medium",
					status: "pending",
				},
				{
					id: "task3",
					description: "Update documentation",
					priority: "low",
					status: "completed",
				},
			],
			memory: {},
			context: {},
			executionMode: "planning",
			iterations: 0,
			maxIterations: 10,
			errors: [],
			humanInteractionRequired: false,

			// Queen-specific extensions
			strategicDecisions: [],
			swarmStatus: {
				totalAgents: 3,
				activeAgents: 3,
				idleAgents: 3,
				busyAgents: 0,
				failedAgents: 0,
			},
			taskOrchestration: {
				pendingTasks: ["task1", "task2"],
				activeTasks: [],
				completedTasks: ["task3"],
				failedTasks: [],
				resourceAllocation: {},
			},
			masterPlan: {
				phases: [],
				currentPhase: null,
				overallProgress: 0,
			},
		};
	});

	describe("initialization", () => {
		it("should initialize with proper metadata and capabilities", () => {
			// Arrange & Act - created in beforeEach
			const metadata = queenAgent.getMetadata();

			// Assert
			expect(metadata.name).toBe("queen-agent");
			expect(metadata.version).toBe("1.0.0");
			expect(metadata.capabilities).toContain("strategic_planning");
			expect(metadata.capabilities).toContain("swarm_coordination");
			expect(metadata.capabilities).toContain("resource_allocation");
			expect(metadata.capabilities).toContain("task_orchestration");
			expect(metadata.requiredTools).toContain("swarm_manager");
		});

		it("should be ready for execution", () => {
			// Arrange & Act - created in beforeEach

			// Assert
			expect(queenAgent).toBeDefined();
			expect(queenAgent.execute).toBeDefined();
			expect(queenAgent.getMetadata).toBeDefined();
		});
	});

	describe("situation assessment", () => {
		it("should assess situation and determine planning is needed when many pending tasks", async () => {
			// Arrange - many pending tasks (> agents * 2)
			const stateWithManyTasks: QueenAgentState = {
				...mockQueenState,
				taskQueue: [
					...Array.from({ length: 8 }, (_, i) => ({
						id: `task${i + 1}`,
						description: `Task ${i + 1}`,
						priority: "medium" as const,
						status: "pending" as const,
					})),
				],
			};

			// Act
			const result = await queenAgent.execute(stateWithManyTasks);

			// Assert
			expect(result.context?.assessmentResult).toBe("needs_planning");
			expect(result.messages).toBeDefined();
			// Look for assessment message in the message history
			const assessmentMessage = result.messages!.find((msg) =>
				msg.content.includes("needs_planning"),
			);
			expect(assessmentMessage).toBeDefined();
			expect(assessmentMessage!.content).toContain("needs_planning");
		});

		it("should assess situation and determine coordination is needed when no active tasks but pending tasks exist", async () => {
			// Arrange - no active tasks but pending tasks exist
			const stateNeedingCoordination: QueenAgentState = {
				...mockQueenState,
				taskQueue: [
					{
						id: "task1",
						description: "Pending task",
						priority: "medium",
						status: "pending",
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stateNeedingCoordination);

			// Assert
			expect(result.context?.assessmentResult).toBe("needs_coordination");
			// Look for assessment message in the message history
			const assessmentMessage = result.messages!.find((msg) =>
				msg.content.includes("needs_coordination"),
			);
			expect(assessmentMessage).toBeDefined();
			expect(assessmentMessage!.content).toContain("needs_coordination");
		});

		it("should assess situation as emergency when errors are present", async () => {
			// Arrange - state with errors
			const stateWithErrors: QueenAgentState = {
				...mockQueenState,
				errors: [
					{
						timestamp: new Date().toISOString(),
						agent: "worker1",
						error: "Task execution failed",
						context: { taskId: "task1" },
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stateWithErrors);

			// Assert
			expect(result.context?.assessmentResult).toBe("emergency");
		});

		it("should default to monitoring when situation is stable", async () => {
			// Arrange - stable state with balanced load
			const stableState: QueenAgentState = {
				...mockQueenState,
				taskQueue: [
					{
						id: "task1",
						description: "Active task",
						priority: "medium",
						status: "in_progress",
						assignedAgent: "agent1",
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stableState);

			// Assert
			expect(result.context?.assessmentResult).toBe("needs_monitoring");
		});
	});

	describe("strategic planning", () => {
		it("should create strategic plan prioritizing high priority tasks", async () => {
			// Arrange - state requiring strategic planning
			const statePlanningNeeded: QueenAgentState = {
				...mockQueenState,
				taskQueue: [
					{
						id: "critical1",
						description: "Critical security fix",
						priority: "critical",
						status: "pending",
					},
					{
						id: "high1",
						description: "Important feature",
						priority: "high",
						status: "pending",
					},
					{
						id: "medium1",
						description: "Nice to have",
						priority: "medium",
						status: "pending",
					},
				],
				context: {
					assessmentResult: "needs_planning",
				},
			};

			// Act
			const result = await queenAgent.execute(statePlanningNeeded);

			// Assert
			expect(result.memory?.strategicPlan).toBeDefined();
			expect(result.memory?.strategicPlan.highPriorityTasks).toBe(2); // critical + high
			expect(result.memory?.strategicPlan.mediumPriorityTasks).toBe(1);
			expect(result.memory?.lastStrategicDecision).toBeDefined();
			expect(result.memory?.lastStrategicDecision.type).toBe("technical");
			expect(result.memory?.lastStrategicDecision.confidence).toBeGreaterThan(
				0.8,
			);
		});

		it("should allocate resources based on agent availability", async () => {
			// Arrange - explicitly trigger full planning flow
			const stateWithResourcePlan: QueenAgentState = {
				...mockQueenState,
				activeAgents: ["agent1", "agent2"],
				taskQueue: Array.from({ length: 5 }, (_, i) => ({
					id: `task${i}`,
					description: `Task ${i}`,
					priority: "medium" as const,
					status: "pending" as const,
				})),
				executionMode: "planning",
				context: {
					assessmentResult: "needs_planning", // Force full planning path which includes resource planning
				},
			};

			// Act
			const result = await queenAgent.execute(stateWithResourcePlan);

			// Assert
			expect(result.memory?.resourceAllocation).toBeDefined();
			expect(result.memory?.resourceAllocation.totalTasks).toBe(5);
			expect(result.memory?.resourceAllocation.availableAgents).toBe(2);
			expect(result.memory?.resourceAllocation.tasksPerAgent).toBe(3); // Math.ceil(5/2)
		});
	});

	describe("task orchestration", () => {
		it("should move pending tasks to active based on agent availability", async () => {
			// Arrange
			const stateForOrchestration: QueenAgentState = {
				...mockQueenState,
				activeAgents: ["agent1", "agent2"],
				taskQueue: [
					{
						id: "task1",
						description: "Task 1",
						priority: "high",
						status: "pending",
					},
					{
						id: "task2",
						description: "Task 2",
						priority: "medium",
						status: "pending",
					},
					{
						id: "task3",
						description: "Task 3",
						priority: "low",
						status: "pending",
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stateForOrchestration);

			// Assert
			const activeTasks = result.taskQueue?.filter(
				(task) => task.status === "in_progress",
			);
			expect(activeTasks).toBeDefined();
			expect(activeTasks!.length).toBe(2); // Limited by agent availability
			expect(result.executionMode).toBe("coding");
		});

		it("should assign agents to active tasks", async () => {
			// Arrange
			const stateForAssignment: QueenAgentState = {
				...mockQueenState,
				activeAgents: ["agent1", "agent2", "agent3"],
				taskQueue: [
					{
						id: "task1",
						description: "Task 1",
						priority: "high",
						status: "in_progress", // Already active but unassigned
					},
					{
						id: "task2",
						description: "Task 2",
						priority: "medium",
						status: "in_progress", // Already active but unassigned
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stateForAssignment);

			// Assert
			const assignedTasks = result.taskQueue?.filter(
				(task) => task.assignedAgent,
			);
			expect(assignedTasks).toBeDefined();
			expect(assignedTasks!.length).toBe(2);
			expect(assignedTasks![0].assignedAgent).toBe("agent1");
			expect(assignedTasks![1].assignedAgent).toBe("agent2");
		});
	});

	describe("progress monitoring", () => {
		it("should calculate progress and detect completion", async () => {
			// Arrange - mostly completed tasks
			const stateNearCompletion: QueenAgentState = {
				...mockQueenState,
				taskQueue: [
					{
						id: "task1",
						description: "Completed task 1",
						priority: "high",
						status: "completed",
						assignedAgent: "agent1",
					},
					{
						id: "task2",
						description: "Completed task 2",
						priority: "medium",
						status: "completed",
						assignedAgent: "agent2",
					},
					{
						id: "task3",
						description: "Final task",
						priority: "low",
						status: "completed",
						assignedAgent: "agent3",
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stateNearCompletion);

			// Assert
			expect(result.memory?.progressMonitoring).toBeDefined();
			expect(result.memory?.progressMonitoring.progress).toBe(100);
			expect(result.memory?.progressMonitoring.completedTasks).toBe(3);
			expect(result.memory?.progressMonitoring.monitoringResult).toBe(
				"task_complete",
			);
		});

		it("should detect critical issues when tasks fail", async () => {
			// Arrange - state with failed tasks
			const stateWithFailures: QueenAgentState = {
				...mockQueenState,
				taskQueue: [
					{
						id: "task1",
						description: "Failed task",
						priority: "high",
						status: "failed",
						assignedAgent: "agent1",
					},
					{
						id: "task2",
						description: "Active task",
						priority: "medium",
						status: "in_progress",
						assignedAgent: "agent2",
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stateWithFailures);

			// Assert
			expect(result.memory?.progressMonitoring?.monitoringResult).toBe(
				"critical_issue",
			);
			expect(result.memory?.progressMonitoring?.failedTasks).toBe(1);
		});
	});

	describe("strategic adjustments", () => {
		it("should reset failed tasks and escalate when too many failures", async () => {
			// Arrange - state needing adjustments with multiple failures
			const stateNeedingAdjustment: QueenAgentState = {
				...mockQueenState,
				taskQueue: [
					{
						id: "task1",
						description: "Failed task 1",
						priority: "high",
						status: "failed",
						assignedAgent: "agent1",
					},
					{
						id: "task2",
						description: "Failed task 2",
						priority: "medium",
						status: "failed",
						assignedAgent: "agent2",
					},
					{
						id: "task3",
						description: "Failed task 3",
						priority: "high",
						status: "failed",
						assignedAgent: "agent3",
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stateNeedingAdjustment);

			// Assert
			// Failed tasks should be reset to pending
			const resetTasks = result.taskQueue?.filter(
				(task) => task.status === "pending",
			);
			expect(resetTasks!.length).toBe(3);

			// Agents should be unassigned for reassignment
			const unassignedTasks = result.taskQueue?.filter(
				(task) => !task.assignedAgent,
			);
			expect(unassignedTasks!.length).toBe(3);

			// Should escalate to human when > 2 failures
			expect(result.humanInteractionRequired).toBe(true);

			// Should record adjustment decision
			expect(result.memory?.lastAdjustment).toBeDefined();
			expect(result.memory?.lastAdjustment.type).toBe("resource");
		});

		it("should handle adjustments without human escalation for minor failures", async () => {
			// Arrange - state with single failure
			const stateMinorAdjustment: QueenAgentState = {
				...mockQueenState,
				taskQueue: [
					{
						id: "task1",
						description: "Failed task",
						priority: "medium",
						status: "failed",
						assignedAgent: "agent1",
					},
					{
						id: "task2",
						description: "Completed task",
						priority: "low",
						status: "completed",
						assignedAgent: "agent2",
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stateMinorAdjustment);

			// Assert
			expect(result.humanInteractionRequired).toBe(false); // Only 1 failure, no escalation
			expect(
				result.taskQueue?.find((task) => task.id === "task1")?.status,
			).toBe("pending");
		});
	});

	describe("routing logic", () => {
		it("should route to strategic planning when assessment indicates planning needed", async () => {
			// Arrange - state with no pending tasks to terminate after planning
			const stateNeedingPlanning: QueenAgentState = {
				...mockQueenState,
				taskQueue: [], // No tasks to prevent continuation to execution
				activeAgents: [], // No agents to prevent resource allocation
				context: {
					assessmentResult: "needs_planning",
				},
			};

			// Act
			const result = await queenAgent.execute(stateNeedingPlanning);

			// Assert - Should have executed strategic planning
			expect(result.memory?.strategicPlan).toBeDefined();
			expect(result.executionMode).toBe("planning");
		});

		it("should route to monitoring when assessment indicates monitoring needed", async () => {
			// Arrange
			const stateNeedingMonitoring: QueenAgentState = {
				...mockQueenState,
				context: {
					assessmentResult: "needs_monitoring",
				},
				taskQueue: [
					{
						id: "task1",
						description: "Active task",
						priority: "medium",
						status: "in_progress",
						assignedAgent: "agent1",
					},
				],
			};

			// Act
			const result = await queenAgent.execute(stateNeedingMonitoring);

			// Assert - Should have executed monitoring
			expect(result.memory?.progressMonitoring).toBeDefined();
		});
	});

	describe("integration", () => {
		it("should handle complete workflow from assessment to task completion", async () => {
			// Arrange - realistic scenario
			const initialState: QueenAgentState = {
				...mockQueenState,
				taskQueue: [
					{
						id: "feature1",
						description: "Implement user authentication",
						priority: "high",
						status: "pending",
					},
					{
						id: "test1",
						description: "Write authentication tests",
						priority: "medium",
						status: "pending",
					},
				],
				activeAgents: ["senior-dev", "junior-dev"],
			};

			// Act
			const result = await queenAgent.execute(initialState);

			// Assert - Should have comprehensive state updates
			expect(result.context?.assessmentResult).toBeDefined();
			expect(result.messages).toBeDefined();
			expect(result.messages!.length).toBeGreaterThan(0);

			// Should have either orchestrated tasks or planned strategically
			expect(
				result.taskQueue ||
					result.memory?.strategicPlan ||
					result.memory?.progressMonitoring,
			).toBeDefined();
		});

		it("should maintain message history throughout execution", async () => {
			// Arrange
			const stateWithHistory: QueenAgentState = {
				...mockQueenState,
				messages: [
					{
						role: "user",
						content: "Previous context message",
					} as BaseMessage,
				],
			};

			// Act
			const result = await queenAgent.execute(stateWithHistory);

			// Assert
			expect(result.messages).toBeDefined();
			expect(result.messages!.length).toBeGreaterThan(1);
			expect(result.messages![0].content).toBe("Previous context message");
		});
	});
});
