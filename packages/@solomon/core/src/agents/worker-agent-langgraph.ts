/**
 * LangGraph-based WorkerAgent Implementation
 * Specialized agent for task execution and resource management
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
	WorkerAgentCapabilities,
	WorkerConfig,
	WorkerInstance,
} from "../types/swarm-types";

// Worker Agent specific state extensions
export interface WorkerAgentState extends BaseState {
	// Task execution details
	currentTask: {
		id: string;
		type: string;
		description: string;
		priority: "low" | "medium" | "high" | "critical";
		startTime?: string;
		estimatedDuration?: number;
		actualDuration?: number;
		progress: number;
		resources?: {
			cpu: number;
			memory: number;
			network?: number;
		};
	} | null;

	// Worker capabilities and configuration
	workerConfig: {
		id: string;
		type: string;
		capabilities: string[];
		resources: {
			cpu: number;
			memory: number;
			maxConcurrentTasks?: number;
		};
		specialization?: string[];
	};

	// Task execution results
	executionResults: Array<{
		taskId: string;
		status: "success" | "failed" | "partial";
		result: Record<string, unknown>;
		duration: number;
		timestamp: string;
		errorDetails?: string;
	}>;

	// Resource monitoring
	resourceMetrics: {
		cpuUsage: number;
		memoryUsage: number;
		networkUsage?: number;
		diskIO?: number;
		lastUpdated: string;
	};

	// Worker instance state
	workerStatus: "idle" | "working" | "completed" | "failed" | "terminating";
	workload: number; // 0-100% capacity
}

/**
 * LangGraph-based Worker Agent
 * Responsible for task execution, resource management, and status reporting
 */
export class WorkerAgentLangGraph implements WorkerAgentCapabilities {
	private readonly graph: Runnable<WorkerAgentState, Partial<WorkerAgentState>>;
	private readonly metadata: GraphMetadata;
	private workerInstances = new Map<string, WorkerInstance>();

	constructor(config?: Partial<WorkerAgentState["workerConfig"]>) {
		this.metadata = {
			name: "worker-agent",
			version: "1.0.0",
			description: "Specialized task executor and resource manager",
			capabilities: [
				"task_execution",
				"resource_monitoring",
				"status_reporting",
				"error_handling",
				"resource_optimization",
				"concurrent_processing",
			],
			requiredTools: ["task_executor", "resource_monitor", "status_reporter"],
		};

		// Build the Worker Agent graph
		this.graph = this.buildWorkerGraph(config);
	}

	/**
	 * Build the Worker Agent LangGraph workflow
	 */
	private buildWorkerGraph(
		config?: Partial<WorkerAgentState["workerConfig"]>,
	): Runnable<WorkerAgentState, Partial<WorkerAgentState>> {
		// Cast to work with extended WorkerAgentState
		const builder = new BaseGraphBuilder(BaseStateSchema as any, this.metadata);

		// Core Worker Agent nodes
		builder
			// Entry: Task and resource assessment
			.addNode("assess_task", this.createTaskAssessmentNode())
			.addNode("allocate_resources", this.createResourceAllocationNode())

			// Task execution
			.addNode("prepare_execution", this.createExecutionPreparationNode())
			.addNode("execute_task", this.createTaskExecutionNode())
			.addNode("monitor_execution", this.createExecutionMonitoringNode())

			// Completion and cleanup
			.addNode("finalize_task", this.createTaskFinalizationNode())
			.addNode("cleanup_resources", this.createResourceCleanupNode())
			.addNode("report_status", this.createStatusReportingNode())

			// Decision routing
			.addConditionalEdge("assess_task", this.createTaskRouter(), {
				execute_task: "allocate_resources",
				insufficient_resources: "report_status",
				invalid_task: "report_status",
				error: "handle_error",
			})

			// Resource allocation flow
			.addConditionalEdge("allocate_resources", this.createResourceRouter(), {
				resources_allocated: "prepare_execution",
				insufficient_resources: "report_status",
				error: "handle_error",
			})

			// Execution flow
			.addEdge("prepare_execution", "execute_task")
			.addEdge("execute_task", "monitor_execution")

			// Monitoring and completion
			.addConditionalEdge("monitor_execution", this.createMonitoringRouter(), {
				task_complete: "finalize_task",
				task_failed: "finalize_task",
				continue_monitoring: "monitor_execution", // Loop for ongoing tasks
				error: "handle_error",
			})

			// Finalization flow
			.addEdge("finalize_task", "cleanup_resources")
			.addEdge("cleanup_resources", "report_status")
			.addEdge("report_status", "__end__")

			// Graph structure
			.setEntryPoint("assess_task")
			.enableCheckpointing()
			.addInterruptBefore(["execute_task", "finalize_task"]);

		return builder.compile();
	}

	/**
	 * Task assessment node - analyzes task requirements and feasibility
	 */
	private createTaskAssessmentNode(): NodeFunction<WorkerAgentState> {
		return async (
			state: WorkerAgentState,
		): Promise<Partial<WorkerAgentState>> => {
			console.log("[WorkerAgent] Assessing task requirements...");

			// Get current task from task queue
			const currentTask = state.taskQueue?.[0];
			if (!currentTask) {
				return {
					workerStatus: "idle",
					messages: [
						...(state.messages || []),
						{
							role: "assistant",
							content: "No task to execute - worker is idle",
						} as BaseMessage,
					],
				};
			}

			// Assess resource requirements
			const resourceRequirement =
				this.estimateResourceRequirements(currentTask);
			const canExecute = state.workerConfig
				? this.checkResourceAvailability(
						state.workerConfig,
						resourceRequirement,
					)
				: false; // Cannot execute without worker config

			return {
				currentTask: {
					id: currentTask.id,
					type: currentTask.description, // Using description as type for compatibility
					description: currentTask.description,
					priority: currentTask.priority,
					startTime: new Date().toISOString(),
					progress: 0,
					resources: resourceRequirement,
				},
				context: {
					...(state.context || {}),
					taskAssessment: {
						canExecute,
						resourceRequirement,
						assessmentTime: new Date().toISOString(),
					},
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Task assessed: ${currentTask.id} - ${canExecute ? "Can execute" : "Insufficient resources"}`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Resource allocation node - reserves resources for task execution
	 */
	private createResourceAllocationNode(): NodeFunction<WorkerAgentState> {
		return async (
			state: WorkerAgentState,
		): Promise<Partial<WorkerAgentState>> => {
			console.log("[WorkerAgent] Allocating resources...");

			const task = state.currentTask;
			if (!task) {
				return {
					workerStatus: "failed",
					errors: [
						...(state.errors || []),
						{
							timestamp: new Date().toISOString(),
							agent: "worker-agent",
							error: "No current task for resource allocation",
						},
					],
				};
			}

			// Simulate resource allocation with safe defaults
			const workerResources = state.workerConfig?.resources || {
				cpu: 100,
				memory: 512,
			};
			const allocatedResources = {
				cpu: Math.min(task.resources?.cpu || 50, workerResources.cpu),
				memory: Math.min(task.resources?.memory || 256, workerResources.memory),
			};

			return {
				resourceMetrics: {
					cpuUsage: (allocatedResources.cpu / workerResources.cpu) * 100,
					memoryUsage:
						(allocatedResources.memory / workerResources.memory) * 100,
					lastUpdated: new Date().toISOString(),
				},
				memory: {
					...(state.memory || {}),
					allocatedResources,
					allocationTime: new Date().toISOString(),
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Resources allocated: CPU ${allocatedResources.cpu}%, Memory ${allocatedResources.memory}MB`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Execution preparation node - sets up environment for task execution
	 */
	private createExecutionPreparationNode(): NodeFunction<WorkerAgentState> {
		return async (
			state: WorkerAgentState,
		): Promise<Partial<WorkerAgentState>> => {
			console.log("[WorkerAgent] Preparing for task execution...");

			return {
				workerStatus: "working",
				executionMode: "coding",
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Execution environment prepared for task: ${state.currentTask?.id}`,
					} as BaseMessage,
				],
				memory: {
					...(state.memory || {}),
					executionStartTime: new Date().toISOString(),
					executionPreparation: {
						environment: "ready",
						dependencies: "loaded",
						security: "validated",
					},
				},
			};
		};
	}

	/**
	 * Task execution node - performs the actual task work
	 */
	private createTaskExecutionNode(): NodeFunction<WorkerAgentState> {
		return async (
			state: WorkerAgentState,
		): Promise<Partial<WorkerAgentState>> => {
			console.log("[WorkerAgent] Executing task...");

			const task = state.currentTask;
			if (!task) {
				return {
					workerStatus: "failed",
					errors: [
						...(state.errors || []),
						{
							timestamp: new Date().toISOString(),
							agent: "worker-agent",
							error: "No current task to execute",
						},
					],
				};
			}

			// Simulate task execution
			const executionResult = {
				taskId: task.id,
				status: "success" as const,
				result: {
					output: `Task ${task.id} completed successfully`,
					metrics: {
						processing_time: 1500,
						memory_peak: state.resourceMetrics?.memoryUsage || 0,
						cpu_average: state.resourceMetrics?.cpuUsage || 0,
					},
				},
				duration: 1500, // 1.5 seconds
				timestamp: new Date().toISOString(),
			};

			return {
				currentTask: {
					...task,
					progress: 100,
					actualDuration: executionResult.duration,
				},
				executionResults: [...(state.executionResults || []), executionResult],
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Task execution completed: ${task.id}`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Execution monitoring node - monitors task progress and resource usage
	 */
	private createExecutionMonitoringNode(): NodeFunction<WorkerAgentState> {
		return async (
			state: WorkerAgentState,
		): Promise<Partial<WorkerAgentState>> => {
			console.log("[WorkerAgent] Monitoring execution...");

			const task = state.currentTask;
			if (!task) {
				return {
					workerStatus: "idle",
				};
			}

			// Check if task is complete
			const isComplete = task.progress >= 100;
			const hasFailed = state.executionResults?.some(
				(r) => r.taskId === task.id && r.status === "failed",
			);

			return {
				resourceMetrics: {
					...(state.resourceMetrics || {
						cpuUsage: 0,
						memoryUsage: 0,
						lastUpdated: new Date().toISOString(),
					}),
					lastUpdated: new Date().toISOString(),
				},
				memory: {
					...(state.memory || {}),
					monitoringResult: isComplete
						? "task_complete"
						: hasFailed
							? "task_failed"
							: "continue_monitoring",
					lastMonitoringCheck: new Date().toISOString(),
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Task monitoring: ${task.progress}% complete`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Task finalization node - handles completion and cleanup
	 */
	private createTaskFinalizationNode(): NodeFunction<WorkerAgentState> {
		return async (
			state: WorkerAgentState,
		): Promise<Partial<WorkerAgentState>> => {
			console.log("[WorkerAgent] Finalizing task...");

			const task = state.currentTask;
			const executionResult = state.executionResults?.find(
				(r) => r.taskId === task?.id,
			);

			// Update task queue to mark task as completed
			const updatedTaskQueue =
				state.taskQueue?.map((t) =>
					t.id === task?.id
						? {
								...t,
								status:
									executionResult?.status === "success"
										? ("completed" as const)
										: ("failed" as const),
							}
						: t,
				) || [];

			return {
				taskQueue: updatedTaskQueue,
				currentTask: null, // Clear current task
				workerStatus: "completed",
				memory: {
					...(state.memory || {}),
					taskFinalized: true,
					finalizationTime: new Date().toISOString(),
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `Task finalized: ${task?.id} - ${executionResult?.status}`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Resource cleanup node - releases allocated resources
	 */
	private createResourceCleanupNode(): NodeFunction<WorkerAgentState> {
		return async (
			state: WorkerAgentState,
		): Promise<Partial<WorkerAgentState>> => {
			console.log("[WorkerAgent] Cleaning up resources...");

			return {
				resourceMetrics: {
					cpuUsage: 0,
					memoryUsage: 0,
					lastUpdated: new Date().toISOString(),
				},
				workload: 0,
				memory: {
					...(state.memory || {}),
					allocatedResources: null,
					resourcesReleased: new Date().toISOString(),
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: "Resources cleaned up and released",
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Status reporting node - reports final status and metrics
	 */
	private createStatusReportingNode(): NodeFunction<WorkerAgentState> {
		return async (
			state: WorkerAgentState,
		): Promise<Partial<WorkerAgentState>> => {
			console.log("[WorkerAgent] Reporting final status...");

			const completedTasks = state.executionResults?.length || 0;
			const successfulTasks =
				state.executionResults?.filter((r) => r.status === "success").length ||
				0;
			const successRate =
				completedTasks > 0 ? (successfulTasks / completedTasks) * 100 : 0;

			return {
				workerStatus: "idle", // Ready for next task
				memory: {
					...(state.memory || {}),
					finalReport: {
						completedTasks,
						successfulTasks,
						successRate,
						reportTime: new Date().toISOString(),
					},
				},
				messages: [
					...(state.messages || []),
					{
						role: "assistant",
						content: `WorkerAgent execution completed - Success rate: ${successRate.toFixed(1)}%`,
					} as BaseMessage,
				],
			};
		};
	}

	/**
	 * Task router - determines execution path based on task assessment
	 */
	private createTaskRouter(): (state: WorkerAgentState) => string {
		return (state: WorkerAgentState): string => {
			const assessment = state.context?.taskAssessment;

			if (!state.currentTask) {
				return "insufficient_resources"; // Will report idle status
			}

			if (!assessment?.canExecute) {
				return "insufficient_resources";
			}

			return "execute_task";
		};
	}

	/**
	 * Resource router - determines if resources can be allocated
	 */
	private createResourceRouter(): (state: WorkerAgentState) => string {
		return (state: WorkerAgentState): string => {
			const allocatedResources = state.memory?.allocatedResources;

			if (!allocatedResources) {
				return "insufficient_resources";
			}

			return "resources_allocated";
		};
	}

	/**
	 * Monitoring router - determines next action based on execution status
	 */
	private createMonitoringRouter(): (state: WorkerAgentState) => string {
		return (state: WorkerAgentState): string => {
			const monitoringResult = state.memory?.monitoringResult;
			return monitoringResult || "continue_monitoring";
		};
	}

	// WorkerAgentCapabilities implementation

	/**
	 * Spawn a new worker instance
	 */
	async spawn(config: WorkerConfig): Promise<WorkerInstance> {
		const instance: WorkerInstance = {
			id: config.id,
			type: config.type,
			status: "idle",
			execute: async (task) => {
				// Create initial state for this worker
				const initialState: WorkerAgentState = {
					messages: [],
					activeAgents: [config.id],
					swarmTopology: "hierarchical",
					taskQueue: [task as any], // Convert generic task to our task format
					memory: {},
					context: {},
					executionMode: "planning",
					iterations: 0,
					maxIterations: 10,
					errors: [],
					humanInteractionRequired: false,
					currentTask: null,
					workerConfig: {
						id: config.id,
						type: config.type,
						capabilities: config.capabilities,
						resources: config.resources || { cpu: 100, memory: 512 },
					},
					executionResults: [],
					resourceMetrics: {
						cpuUsage: 0,
						memoryUsage: 0,
						lastUpdated: new Date().toISOString(),
					},
					workerStatus: "idle",
					workload: 0,
				};

				// Execute the graph
				const result = await this.graph.invoke(initialState, {
					recursionLimit: 10,
				});

				// Return the execution result
				const executionResult = result.executionResults?.[0];
				return executionResult?.result || { success: true };
			},
			terminate: async () => {
				// Clean up instance
				this.workerInstances.delete(config.id);
			},
		};

		this.workerInstances.set(config.id, instance);
		return instance;
	}

	/**
	 * Execute a task directly
	 */
	async execute(task: unknown): Promise<unknown> {
		// Create a temporary worker configuration
		const tempConfig: WorkerConfig = {
			id: `temp-worker-${Date.now()}`,
			type: "general",
			capabilities: ["task_execution"],
			resources: { cpu: 100, memory: 512 },
		};

		const instance = await this.spawn(tempConfig);
		try {
			const result = await instance.execute(task);
			return result;
		} finally {
			await instance.terminate();
		}
	}

	/**
	 * Report current status
	 */
	reportStatus(): { status: string; progress: number } {
		// For now, return static status - in real implementation,
		// this would track actual worker state
		return {
			status: "idle",
			progress: 0,
		};
	}

	/**
	 * Terminate all worker instances
	 */
	async terminate(): Promise<void> {
		const terminationPromises = Array.from(this.workerInstances.values()).map(
			(instance) => instance.terminate(),
		);

		await Promise.all(terminationPromises);
		this.workerInstances.clear();
	}

	/**
	 * Get agent metadata
	 */
	getMetadata(): GraphMetadata {
		return this.metadata;
	}

	// Helper methods

	private estimateResourceRequirements(task: any): {
		cpu: number;
		memory: number;
	} {
		// Basic resource estimation based on task priority
		const baseRequirements = {
			cpu: 25,
			memory: 128,
		};

		const multiplier =
			task.priority === "critical"
				? 2
				: task.priority === "high"
					? 1.5
					: task.priority === "medium"
						? 1
						: 0.5;

		return {
			cpu: Math.round(baseRequirements.cpu * multiplier),
			memory: Math.round(baseRequirements.memory * multiplier),
		};
	}

	private checkResourceAvailability(
		workerConfig: WorkerAgentState["workerConfig"],
		requirement: { cpu: number; memory: number },
	): boolean {
		return (
			requirement.cpu <= workerConfig.resources.cpu &&
			requirement.memory <= workerConfig.resources.memory
		);
	}
}
