/**
 * Manager Agent Migration
 * Migrates Solomon's Manager Agent to LangGraph Queen Agent architecture
 */

import { END, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import type { QueenAgentCapabilities, Task } from "../../types/swarm-types";

// Manager Agent State Schema
export const ManagerStateSchema = z.object({
	projectGoals: z.array(z.string()),
	currentPhase: z.enum(["planning", "implementation", "review", "deployment"]),
	taskQueue: z.array(
		z.object({
			id: z.string(),
			description: z.string(),
			priority: z.enum(["critical", "high", "medium", "low"]),
			assignedTo: z.string().optional(),
			status: z.enum(["pending", "in_progress", "completed", "blocked"]),
		}),
	),
	teamStatus: z.record(
		z.string(),
		z.object({
			agentId: z.string(),
			role: z.string(),
			currentTask: z.string().optional(),
			availability: z.number(), // 0-1 scale
		}),
	),
	decisions: z.array(
		z.object({
			id: z.string(),
			type: z.string(),
			decision: z.string(),
			rationale: z.string(),
			timestamp: z.string(),
		}),
	),
});

export type ManagerState = z.infer<typeof ManagerStateSchema>;

/**
 * Manager Agent implementation using LangGraph
 * Acts as the Queen Agent in the swarm hierarchy
 */
export class ManagerAgent implements QueenAgentCapabilities {
	private graph: StateGraph<ManagerState>;
	private state: ManagerState;

	constructor() {
		this.state = {
			projectGoals: [],
			currentPhase: "planning",
			taskQueue: [],
			teamStatus: {},
			decisions: [],
		};

		// Initialize the state graph
		this.graph = new StateGraph<ManagerState>({
			channels: ManagerStateSchema.shape,
		});

		this.setupGraph();
	}

	/**
	 * Setup the LangGraph workflow
	 */
	private setupGraph(): void {
		// Add nodes for different management phases
		this.graph.addNode("analyze", this.analyzeProject.bind(this));
		this.graph.addNode("plan", this.planTasks.bind(this));
		this.graph.addNode("delegate", this.delegateTasks.bind(this));
		this.graph.addNode("monitor", this.monitorProgress.bind(this));
		this.graph.addNode("review", this.reviewWork.bind(this));

		// Define edges
		this.graph.addEdge("analyze", "plan");
		this.graph.addEdge("plan", "delegate");
		this.graph.addEdge("delegate", "monitor");

		// Conditional edges based on state
		this.graph.addConditionalEdges("monitor", (state) => {
			const completedTasks = state.taskQueue.filter(
				(t) => t.status === "completed",
			).length;
			const totalTasks = state.taskQueue.length;

			if (totalTasks > 0 && completedTasks === totalTasks) {
				return "review";
			}
			return "monitor";
		});

		this.graph.addEdge("review", END);

		// Set entry point
		this.graph.setEntryPoint("analyze");
	}

	/**
	 * Analyze project requirements
	 */
	private async analyzeProject(
		_state: ManagerState,
	): Promise<Partial<ManagerState>> {
		// Analyze project context and extract goals
		return {
			projectGoals: [
				"Implement requested features",
				"Ensure code quality",
				"Optimize performance",
				"Maintain test coverage",
			],
			currentPhase: "planning",
		};
	}

	/**
	 * Plan tasks based on project goals
	 */
	private async planTasks(state: ManagerState): Promise<Partial<ManagerState>> {
		const tasks = state.projectGoals.map((goal, index) => ({
			id: `task-${index + 1}`,
			description: goal,
			priority: index === 0 ? ("critical" as const) : ("high" as const),
			status: "pending" as const,
		}));

		return {
			taskQueue: tasks,
			currentPhase: "implementation",
		};
	}

	/**
	 * Delegate tasks to team members
	 */
	private async delegateTasks(
		state: ManagerState,
	): Promise<Partial<ManagerState>> {
		const updatedTasks = state.taskQueue.map((task) => {
			if (task.status === "pending") {
				// Assign based on task type
				const assignee = this.selectBestAgent(task, state.teamStatus);
				return {
					...task,
					assignedTo: assignee,
					status: "in_progress" as const,
				};
			}
			return task;
		});

		return {
			taskQueue: updatedTasks,
		};
	}

	/**
	 * Monitor task progress
	 */
	private async monitorProgress(
		state: ManagerState,
	): Promise<Partial<ManagerState>> {
		// Simulate progress monitoring
		const updatedTasks = state.taskQueue.map((task) => {
			if (task.status === "in_progress") {
				// Check if task is complete (simplified)
				return {
					...task,
					status: "completed" as const,
				};
			}
			return task;
		});

		return {
			taskQueue: updatedTasks,
		};
	}

	/**
	 * Review completed work
	 */
	private async reviewWork(
		state: ManagerState,
	): Promise<Partial<ManagerState>> {
		return {
			currentPhase: "deployment",
			decisions: [
				...state.decisions,
				{
					id: `decision-${Date.now()}`,
					type: "project_completion",
					decision: "approve",
					rationale: "All tasks completed successfully",
					timestamp: new Date().toISOString(),
				},
			],
		};
	}

	/**
	 * Select the best agent for a task
	 */
	private selectBestAgent(_task: any, teamStatus: any): string {
		// Simple selection logic - can be enhanced
		const availableAgents = Object.entries(teamStatus)
			.filter(([_, status]: any) => status.availability > 0.5)
			.sort(([_, a]: any, [__, b]: any) => b.availability - a.availability);

		if (availableAgents.length > 0) {
			return availableAgents[0][0];
		}

		return "default-worker";
	}

	// Implement QueenAgentCapabilities interface
	async register(info: any): Promise<void> {
		this.registrationInfo = info;
	}

	async analyzeTask(
		task: Task,
	): Promise<{ agentCount: number; agentTypes: string[] }> {
		// Analyze task complexity and requirements
		const complexity = task.complexity || "medium";
		const parallelizable = task.parallelizable !== false;

		let agentCount = 1;
		let agentTypes = ["worker"];

		if (complexity === "high") {
			agentCount = parallelizable ? 3 : 1;
			agentTypes = ["programmer", "tester", "reviewer"];
		} else if (complexity === "medium") {
			agentCount = parallelizable ? 2 : 1;
			agentTypes = ["programmer", "tester"];
		}

		// Consider required capabilities
		if (task.requiredCapabilities) {
			agentTypes = task.requiredCapabilities;
			agentCount = agentTypes.length;
		}

		return { agentCount, agentTypes };
	}

	async delegateTask(task: any, workerId: string): Promise<void> {
		// Update state to reflect delegation
		const taskIndex = this.state.taskQueue.findIndex((t) => t.id === task.id);
		if (taskIndex !== -1) {
			this.state.taskQueue[taskIndex].assignedTo = workerId;
			this.state.taskQueue[taskIndex].status = "in_progress";
		}
	}

	async recordDecision(decision: any): Promise<void> {
		this.state.decisions.push({
			id: decision.decision.id || `decision-${Date.now()}`,
			type: decision.decision.type,
			decision: decision.result.result,
			rationale: decision.result.rationale || "",
			timestamp: decision.timestamp,
		});
	}

	async getState(): Promise<ManagerState> {
		return this.state;
	}

	/**
	 * Execute the manager workflow
	 */
	async execute(input: any): Promise<ManagerState> {
		const compiledGraph = this.graph.compile();
		const result = await compiledGraph.invoke({
			...this.state,
			...input,
		});

		this.state = result;
		return result;
	}
}

/**
 * Factory function to create a Manager Agent
 */
export function createManagerAgent(): ManagerAgent {
	return new ManagerAgent();
}
