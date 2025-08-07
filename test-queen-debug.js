// Quick debug test for QueenAgent
import { QueenAgentLangGraph } from "./packages/@solomon/core/src/agents/queen-agent-langgraph.ts";

async function testQueenAgent() {
	console.log("Creating QueenAgent...");
	const queenAgent = new QueenAgentLangGraph();

	console.log("Setting up test state...");
	const mockState = {
		// Base state
		messages: [],
		activeAgents: ["agent1", "agent2"],
		swarmTopology: "hierarchical",
		taskQueue: [
			{
				id: "task1",
				description: "Test task",
				priority: "medium",
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
			totalAgents: 2,
			activeAgents: 2,
			idleAgents: 2,
			busyAgents: 0,
			failedAgents: 0,
		},
		taskOrchestration: {
			pendingTasks: [],
			activeTasks: [],
			completedTasks: ["task1"],
			failedTasks: [],
			resourceAllocation: {},
		},
		masterPlan: {
			phases: [],
			currentPhase: null,
			overallProgress: 0,
		},
	};

	try {
		console.log("Executing QueenAgent...");
		console.log("Graph type:", typeof queenAgent.graph);
		console.log("Graph invoke type:", typeof queenAgent.graph.invoke);

		const result = await queenAgent.execute(mockState);
		console.log("Execution completed!");
		console.log("Result:", result ? "has result" : "undefined result");
		console.log("Result type:", typeof result);
		console.log("Result keys:", result ? Object.keys(result) : "none");

		if (result) {
			console.log(
				"Result content preview:",
				JSON.stringify(result, null, 2).substring(0, 500),
			);
		}
	} catch (error) {
		console.error("Execution failed:", error.message);
		console.error("Error stack:", error.stack);
	}
}

testQueenAgent().catch(console.error);
