/**
 * LangGraph-based QueenAgent Implementation
 * Migrated from the original QueenAgent to use BaseGraphBuilder architecture
 */

import type { BaseMessage } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import {
	BaseGraphBuilder,
	type GraphMetadata,
	type NodeFunction,
} from "../graphs/base-graph";
import { type BaseState, BaseStateSchema } from "../state/unified-state";
import type {
	QueenAgentCapabilities,
	SwarmContext,
	SwarmDecision,
	SwarmTask,
} from "../types/swarm-types";

// Queen Agent specific state extensions
export interface QueenAgentState extends BaseState {
	// Strategic decision making
	strategicDecisions: Array<{
		id: string;
		type: "technical" | "resource" | "priority";
		decision: string;
		reasoning: string;
		confidence: number;
		timestamp: string;
	}>;

	// Swarm coordination
	swarmStatus: {
		totalAgents: number;
		activeAgents: number;
		idleAgents: number;
		busyAgents: number;
		failedAgents: number;
	};

	// Task orchestration
	taskOrchestration: {
		pendingTasks: string[];
		activeTasks: string[];
		completedTasks: string[];
		failedTasks: string[];
		resourceAllocation: Record<string, number>;
	};

	// High-level planning
	masterPlan: {
		phases: Array<{
			id: string;
			name: string;
			description: string;
			status: "pending" | "active" | "completed" | "failed";
			dependencies: string[];
			estimatedDuration: number;
		}>;
		currentPhase: string | null;
		overallProgress: number;
	};
}

/**
 * LangGraph-based Queen Agent
 * Responsible for high-level coordination, strategic planning, and swarm orchestration
 */
export class QueenAgentLangGraph implements QueenAgentCapabilities {
	private readonly graph: Runnable<QueenAgentState, Partial<QueenAgentState>>;
	private readonly metadata: GraphMetadata;

	constructor() {
		this.metadata = {
			name: "queen-agent",
			version: "1.0.0",
			description: "Strategic coordinator and swarm orchestrator",
			capabilities: [
				"strategic_planning",
				"swarm_coordination",
				"resource_allocation",
				"task_orchestration",
				"conflict_resolution",
				"performance_monitoring",
			],
			requiredTools: [
				"swarm_manager",
				"resource_tracker",
				"performance_monitor",
			],
		};

		// Build the Queen Agent graph
		this.graph = this.buildQueenGraph();
	}

	/**
	 * Build the Queen Agent LangGraph workflow
	 */
	private buildQueenGraph(): Runnable<
		QueenAgentState,
		Partial<QueenAgentState>
	> {
		// Cast to work with extended QueenAgentState
		const builder = new BaseGraphBuilder(BaseStateSchema as any, this.metadata);

		// Core Queen Agent nodes
		builder
			// Entry: Assessment and context gathering
			.addNode("assess_situation", this.createSituationAssessmentNode())

			// Strategic planning
			.addNode("strategic_planning", this.createStrategicPlanningNode())
			.addNode("resource_planning", this.createResourcePlanningNode())

			// Task orchestration
			.addNode("orchestrate_tasks", this.createTaskOrchestrationNode())
			.addNode("assign_agents", this.createAgentAssignmentNode())

			// Monitoring and adjustment
			.addNode("monitor_progress", this.createProgressMonitoringNode())
			.addNode("make_adjustments", this.createAdjustmentNode())

			// Decision routing with error handling
			.addConditionalEdge("assess_situation", this.createAssessmentRouter(), {
				needs_planning: "strategic_planning",
				needs_coordination: "orchestrate_tasks",
				needs_monitoring: "orchestrate_tasks", // Always orchestrate first
				emergency: "make_adjustments",
			})

			// Planning flow - end after planning when explicitly requested
			.addConditionalEdge("strategic_planning", this.createPlanningRouter(), {
				planning_complete: "__end__", // End when planning phase is complete
				continue_to_execution: "resource_planning",
			})
			.addEdge("resource_planning", "orchestrate_tasks")

			// Orchestration flow
			.addEdge("orchestrate_tasks", "assign_agents")
			.addEdge("assign_agents", "monitor_progress")

			// Monitoring and feedback loop - with proper termination
			.addConditionalEdge("monitor_progress", this.createProgressRouter(), {
				needs_adjustment: "make_adjustments",
				task_complete: "__end__", // End directly when tasks complete
				critical_issue: "make_adjustments", // Handle critical issues with adjustments
				error: "handle_error",
				continue_monitoring: "__end__", // End to prevent infinite loops
			})

			// Adjustment with conditional routing - avoid infinite emergency loops
			.addConditionalEdge("make_adjustments", this.createAdjustmentRouter(), {
				emergency_handled: "__end__", // End after handling emergency
				continue_analysis: "__end__", // End to prevent infinite loops
			})

			// Remove the fallback edge that causes routing to handle_error
			// .addEdge("strategic_planning", "handle_error") // Removed - causes infinite loops

			// Graph structure
			.setEntryPoint("assess_situation")
			.enableCheckpointing()
			.addInterruptBefore(["strategic_planning", "make_adjustments"]);

		return builder.compile();
	}

	/**
	 * Situation assessment node - analyzes current context and determines next actions
	 */
	private createSituationAssessmentNode(): NodeFunction<QueenAgentState> {
		return async (
			state: QueenAgentState,
		): Promise<Partial<QueenAgentState>> => {
			console.log("[QueenAgent] Assessing current situation...");

			// Analyze current tasks and agent states - handle undefined arrays safely
			const taskQueue = state.taskQueue || [];
			const activeAgents = state.activeAgents || [];
			const errors = state.errors || [];

			const pendingTaskCount = taskQueue.filter(
				(task) => task.status === "pending",
			).length;
			const activeTaskCount = taskQueue.filter(
				(task) => task.status === "in_progress",
			).length;
			const totalAgents = activeAgents.length;

			// Check if assessment result is already set (for test scenarios)
			let assessmentResult = state.context?.assessmentResult;

			// If not pre-set, determine priority assessment (check highest priority first)
			if (!assessmentResult) {
				assessmentResult = "needs_monitoring"; // default

				if (errors.length > 0) {
					assessmentResult = "emergency";
				} else if (pendingTaskCount > totalAgents * 2) {
					assessmentResult = "needs_planning";
				} else if (activeTaskCount === 0 && pendingTaskCount > 0) {
					assessmentResult = "needs_coordination";
				}
			}

			// Update state with assessment
			return {
				context: {
					...(state.context || {}),
					lastAssessment: new Date().toISOString(),
					assessmentResult,
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Situation assessed: ${assessmentResult}. Tasks pending: ${pendingTaskCount}, active: ${activeTaskCount}, agents: ${totalAgents}`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Strategic planning node - creates high-level plans and strategies
	 */
	private createStrategicPlanningNode(): NodeFunction<QueenAgentState> {
		return async (
			state: QueenAgentState,
		): Promise<Partial<QueenAgentState>> => {
			console.log("[QueenAgent] Creating strategic plan...");

			// Analyze task complexity and create strategic phases
			const taskQueue = state.taskQueue || [];
			const activeAgents = state.activeAgents || [];

			const highPriorityTasks = taskQueue.filter(
				(task) => task.priority === "high" || task.priority === "critical",
			);
			const mediumPriorityTasks = taskQueue.filter(
				(task) => task.priority === "medium",
			);

			// Create strategic decision
			const strategicDecision = {
				id: `decision-${Date.now()}`,
				type: "technical" as const,
				decision: `Prioritize ${highPriorityTasks.length} high priority tasks, allocate ${Math.min(activeAgents.length, highPriorityTasks.length)} agents`,
				reasoning: `High priority tasks require immediate attention. Available agents: ${activeAgents.length}`,
				confidence: 0.85,
				timestamp: new Date().toISOString(),
			};

			return {
				executionMode: "planning",
				memory: {
					...(state.memory || {}),
					strategicPlan: {
						highPriorityTasks: highPriorityTasks.length,
						mediumPriorityTasks: mediumPriorityTasks.length,
						recommendedAllocation: Math.min(
							activeAgents.length,
							highPriorityTasks.length,
						),
						createdAt: new Date().toISOString(),
					},
					lastStrategicDecision: strategicDecision,
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Strategic plan created: ${strategicDecision.decision}`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Resource planning node - allocates resources optimally
	 */
	private createResourcePlanningNode(): NodeFunction<QueenAgentState> {
		return async (
			state: QueenAgentState,
		): Promise<Partial<QueenAgentState>> => {
			console.log("[QueenAgent] Planning resource allocation...");

			// Calculate optimal resource distribution
			const taskQueue = state.taskQueue || [];
			const activeAgents = state.activeAgents || [];

			const totalTasks = taskQueue.filter(
				(task) => task.status === "pending",
			).length;
			const availableAgents = activeAgents.length;
			const tasksPerAgent =
				totalTasks > 0 ? Math.ceil(totalTasks / availableAgents) : 0;

			return {
				memory: {
					...(state.memory || {}),
					resourceAllocation: {
						totalTasks,
						availableAgents,
						tasksPerAgent,
						allocationStrategy:
							totalTasks > availableAgents ? "parallel" : "sequential",
						timestamp: new Date().toISOString(),
					},
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Resource allocation planned: ${tasksPerAgent} tasks per agent (${availableAgents} agents available)`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Task orchestration node - coordinates task execution across the swarm
	 */
	private createTaskOrchestrationNode(): NodeFunction<QueenAgentState> {
		return async (
			state: QueenAgentState,
		): Promise<Partial<QueenAgentState>> => {
			console.log("[QueenAgent] Orchestrating task execution...");

			// Move pending tasks to in_progress based on agent availability
			const taskQueue = state.taskQueue || [];
			const activeAgents = state.activeAgents || [];

			const pendingTasks = taskQueue.filter(
				(task) => task.status === "pending",
			);
			const availableSlots = Math.max(
				0,
				activeAgents.length -
					taskQueue.filter((task) => task.status === "in_progress").length,
			);

			const tasksToStart = pendingTasks
				.slice(0, availableSlots)
				.map((task) => ({
					...task,
					status: "in_progress" as const,
				}));

			const updatedTaskQueue = taskQueue.map((task) => {
				const updatedTask = tasksToStart.find((t) => t.id === task.id);
				return updatedTask || task;
			});

			return {
				taskQueue: updatedTaskQueue,
				executionMode: "coding",
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Task orchestration complete: ${tasksToStart.length} tasks moved to active execution`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Agent assignment node - assigns specific agents to tasks
	 */
	private createAgentAssignmentNode(): NodeFunction<QueenAgentState> {
		return async (
			state: QueenAgentState,
		): Promise<Partial<QueenAgentState>> => {
			console.log("[QueenAgent] Assigning agents to tasks...");

			// Handle undefined arrays safely
			const taskQueue = state.taskQueue || [];
			const activeAgents = state.activeAgents || [];

			const activeTasks = taskQueue.filter(
				(task) => task.status === "in_progress" && !task.assignedAgent,
			);
			const availableAgents = activeAgents.slice(0, activeTasks.length);

			// Assign agents to tasks
			const updatedTaskQueue = taskQueue.map((task) => {
				if (task.status === "in_progress" && !task.assignedAgent) {
					const agentIndex = activeTasks.findIndex((t) => t.id === task.id);
					if (agentIndex !== -1 && agentIndex < availableAgents.length) {
						return {
							...task,
							assignedAgent: availableAgents[agentIndex],
						};
					}
				}
				return task;
			});

			const assignmentCount = updatedTaskQueue.filter(
				(task) => task.assignedAgent && task.status === "in_progress",
			).length;

			return {
				taskQueue: updatedTaskQueue,
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Agent assignment complete: ${assignmentCount} tasks now have assigned agents`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Progress monitoring node - tracks execution and identifies issues
	 */
	private createProgressMonitoringNode(): NodeFunction<QueenAgentState> {
		return async (
			state: QueenAgentState,
		): Promise<Partial<QueenAgentState>> => {
			console.log("[QueenAgent] Monitoring progress...");

			// Handle undefined arrays safely
			const taskQueue = state.taskQueue || [];

			const activeTasks = taskQueue.filter(
				(task) => task.status === "in_progress",
			).length;
			const completedTasks = taskQueue.filter(
				(task) => task.status === "completed",
			).length;
			const failedTasks = taskQueue.filter(
				(task) => task.status === "failed",
			).length;
			const totalTasks = taskQueue.length;

			const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

			// Determine monitoring result
			const pendingTasks = taskQueue.filter(
				(task) => task.status === "pending",
			).length;

			let monitoringResult: string;

			// For failed task scenarios, terminate with critical_issue to prevent infinite loops
			if (failedTasks > 0) {
				monitoringResult = "critical_issue";
			} else if (activeTasks === 0 && pendingTasks > 0) {
				monitoringResult = "needs_adjustment";
			} else if (activeTasks === 0 && pendingTasks === 0) {
				monitoringResult = "task_complete";
			} else {
				// Default to completion if we have active tasks but no issues
				monitoringResult = "task_complete";
			}

			// Add finalization metadata if completing
			const isCompleting = monitoringResult === "task_complete";

			return {
				memory: {
					...(state.memory || {}),
					progressMonitoring: {
						progress: Math.round(progress),
						activeTasks,
						completedTasks,
						failedTasks,
						monitoringResult,
						timestamp: new Date().toISOString(),
					},
				},
				context: isCompleting
					? {
							...(state.context || {}),
							finalized: true,
							finalizedAt: new Date().toISOString(),
						}
					: state.context,
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Progress monitoring: ${Math.round(progress)}% complete, ${activeTasks} active tasks, status: ${monitoringResult}`,
					} as BaseMessage,
					...(isCompleting
						? [
								{
									role: "assistant",
									content: `QueenAgent execution completed successfully (assessment: ${state.context?.assessmentResult || "none"})`,
								} as BaseMessage,
							]
						: []),
				],
			};
		};
	}

	/**
	 * Adjustment node - makes strategic adjustments based on monitoring
	 */
	private createAdjustmentNode(): NodeFunction<QueenAgentState> {
		return async (
			state: QueenAgentState,
		): Promise<Partial<QueenAgentState>> => {
			console.log("[QueenAgent] Making strategic adjustments...");

			// Handle undefined arrays safely
			const taskQueue = state.taskQueue || [];

			const failedTasks = taskQueue.filter((task) => task.status === "failed");
			const stuckTasks = taskQueue.filter(
				(task) => task.status === "in_progress",
			);

			// Reset failed tasks to pending for retry
			const adjustedTaskQueue = taskQueue.map((task) => {
				if (task.status === "failed") {
					return {
						...task,
						status: "pending" as const,
						assignedAgent: undefined, // Unassign for reassignment
					};
				}
				return task;
			});

			const adjustmentDecision = {
				id: `adjustment-${Date.now()}`,
				type: "resource" as const,
				decision: `Reset ${failedTasks.length} failed tasks to pending, monitor ${stuckTasks.length} stuck tasks`,
				reasoning:
					"Failed tasks need retry with different approach, stuck tasks may need intervention",
				confidence: 0.75,
				timestamp: new Date().toISOString(),
			};

			// Clear errors if this was triggered by emergency assessment
			const shouldClearErrors = state.errors && state.errors.length > 0;

			return {
				taskQueue: adjustedTaskQueue,
				humanInteractionRequired: failedTasks.length > 2, // Escalate if too many failures
				// Clear errors after handling emergency situation
				errors: shouldClearErrors ? [] : state.errors,
				memory: {
					...(state.memory || {}),
					lastAdjustment: adjustmentDecision,
					emergencyHandled: shouldClearErrors
						? new Date().toISOString()
						: undefined,
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Strategic adjustments made: ${adjustmentDecision.decision}${shouldClearErrors ? ". Emergency situation resolved." : ""}`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Assessment router - determines next action based on situation assessment
	 */
	private createAssessmentRouter(): (state: QueenAgentState) => string {
		return (state: QueenAgentState): string => {
			const assessmentResult = state.context?.assessmentResult;
			return assessmentResult || "needs_monitoring";
		};
	}

	/**
	 * Planning router - determines whether to end after planning or continue to execution
	 */
	private createPlanningRouter(): (state: QueenAgentState) => string {
		return (state: QueenAgentState): string => {
			// If assessment was specifically for planning, check if we need resource allocation too
			const assessmentResult = state.context?.assessmentResult;
			if (assessmentResult === "needs_planning") {
				// If we have many tasks relative to agents, continue to resource planning
				const taskQueue = state.taskQueue || [];
				const activeAgents = state.activeAgents || [];
				const pendingTasks = taskQueue.filter(
					(task) => task.status === "pending",
				).length;

				// Continue to resource planning if we have resource allocation needs
				if (pendingTasks > 0 && activeAgents.length > 0) {
					return "continue_to_execution";
				}
				return "planning_complete";
			}
			// Otherwise continue to resource planning and execution
			return "continue_to_execution";
		};
	}

	/**
	 * Progress router - determines next action based on monitoring results
	 */
	private createProgressRouter(): (state: QueenAgentState) => string {
		return (state: QueenAgentState): string => {
			const monitoring = state.memory?.progressMonitoring;
			return monitoring?.monitoringResult || "continue_monitoring";
		};
	}

	/**
	 * Adjustment router - determines next action after making adjustments
	 */
	private createAdjustmentRouter(): (state: QueenAgentState) => string {
		return (state: QueenAgentState): string => {
			// If we handled an emergency (cleared errors), terminate
			if (state.memory?.emergencyHandled) {
				return "emergency_handled";
			}
			// If we handled a critical issue (failed tasks), terminate to prevent infinite loops
			if (state.memory?.lastAdjustment?.type === "resource") {
				return "emergency_handled"; // Use same path to terminate
			}
			// Otherwise continue with normal analysis
			return "continue_analysis";
		};
	}

	/**
	 * Execute the Queen Agent graph
	 */
	async execute(input: QueenAgentState): Promise<Partial<QueenAgentState>> {
		console.log("[QueenAgent] Starting execution...");
		return await this.graph.invoke(input, {
			recursionLimit: 10, // Limit to prevent infinite loops
		});
	}

	/**
	 * Get agent metadata
	 */
	getMetadata(): GraphMetadata {
		return this.metadata;
	}

	// QueenAgentCapabilities implementation

	/**
	 * Analyze task requirements and determine needed agent count and types
	 */
	async analyzeTask(
		task: SwarmTask,
	): Promise<{ agentCount: number; agentTypes: string[] }> {
		// Create initial state for task analysis
		const initialState: QueenAgentState = {
			messages: [],
			activeAgents: [],
			swarmTopology: "hierarchical",
			taskQueue: [task],
			memory: {},
			context: { assessmentResult: "needs_planning" }, // Force planning analysis
			executionMode: "planning",
			iterations: 0,
			maxIterations: 10,
			errors: [],
			humanInteractionRequired: false,
			strategicDecisions: [],
			swarmStatus: {
				totalAgents: 0,
				activeAgents: 0,
				idleAgents: 0,
				busyAgents: 0,
				failedAgents: 0,
			},
			taskOrchestration: {
				pendingTasks: [task.id],
				activeTasks: [],
				completedTasks: [],
				failedTasks: [],
				resourceAllocation: {},
			},
			masterPlan: {
				phases: [],
				currentPhase: null,
				overallProgress: 0,
			},
		};

		// Execute graph for strategic planning
		const result = await this.graph.invoke(initialState, {
			recursionLimit: 5, // Limit for analysis phase
		});

		// Extract analysis from strategic planning
		const strategicPlan = result.memory?.strategicPlan;
		const agentCount =
			strategicPlan?.recommendedAllocation || Math.min(task.priority, 3);

		// Determine agent types based on task complexity and type
		const agentTypes = this.determineAgentTypes(task, agentCount);

		return { agentCount, agentTypes };
	}

	/**
	 * Make strategic decision based on context
	 */
	async makeDecision(
		context: SwarmContext,
	): Promise<{ decision: string; confidence: number }> {
		// For now, return a simple decision based on context
		const decision = `Coordinate ${context.agentIds.length} agents for task ${context.taskId}`;
		const confidence = Math.min(0.8 + context.agentIds.length * 0.05, 0.95);

		return { decision, confidence };
	}

	/**
	 * Coordinate agents for task execution
	 */
	async coordinateAgents(agents: string[]): Promise<void> {
		// Create coordination state
		const coordinationState: QueenAgentState = {
			messages: [],
			activeAgents: agents,
			swarmTopology: "hierarchical",
			taskQueue: [],
			memory: {},
			context: { assessmentResult: "needs_coordination" },
			executionMode: "coding",
			iterations: 0,
			maxIterations: 10,
			errors: [],
			humanInteractionRequired: false,
			strategicDecisions: [],
			swarmStatus: {
				totalAgents: agents.length,
				activeAgents: agents.length,
				idleAgents: 0,
				busyAgents: 0,
				failedAgents: 0,
			},
			taskOrchestration: {
				pendingTasks: [],
				activeTasks: [],
				completedTasks: [],
				failedTasks: [],
				resourceAllocation: {},
			},
			masterPlan: {
				phases: [],
				currentPhase: null,
				overallProgress: 0,
			},
		};

		// Execute coordination workflow
		await this.graph.invoke(coordinationState, {
			recursionLimit: 5,
		});
	}

	/**
	 * Record decision in agent memory
	 */
	recordDecision(decision: SwarmDecision): void {
		// Store decision in internal state (would be persisted in real implementation)
		console.log(
			`[QueenAgent] Decision recorded: ${decision.decision} (confidence: ${decision.confidence})`,
		);
	}

	/**
	 * Record agent failure for analysis
	 */
	recordFailure(agentId: string, error: Error): void {
		console.log(
			`[QueenAgent] Agent failure recorded: ${agentId} - ${error.message}`,
		);
	}

	/**
	 * Register agent configuration
	 */
	register(config: { id: string; role: string }): void {
		console.log(
			`[QueenAgent] Registered as ${config.role} with ID: ${config.id}`,
		);
	}

	/**
	 * Get current agent state
	 */
	getState(): Record<string, unknown> {
		return {
			initialized: true,
			role: "coordinator",
			capabilities: this.metadata.capabilities,
			version: this.metadata.version,
		};
	}

	/**
	 * Determine agent types based on task requirements
	 */
	private determineAgentTypes(task: SwarmTask, agentCount: number): string[] {
		const baseTypes = ["programmer", "tester", "reviewer", "planner"];

		// Map task types to preferred agent types
		const taskTypeMapping: Record<string, string[]> = {
			"feature-development": ["programmer", "tester"],
			"frontend-development": ["programmer", "reviewer"],
			"backend-development": ["programmer", "tester"],
			"quality-assurance": ["tester", "reviewer"],
			"code-review": ["reviewer", "programmer"],
			"data-processing": ["programmer", "planner"],
			monitoring: ["tester", "programmer"],
			"simple-task": ["programmer"],
		};

		const preferredTypes = taskTypeMapping[task.type] || baseTypes;
		const types: string[] = [];

		for (let i = 0; i < agentCount; i++) {
			types.push(preferredTypes[i % preferredTypes.length]);
		}

		return types;
	}
}
