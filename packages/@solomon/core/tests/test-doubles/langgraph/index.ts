/**
 * LangGraph Test Doubles Index
 * Centralized export for all LangGraph-related test doubles
 * Following TDD London School (mockist) approach
 */

import { vi } from "vitest";
import { createStateGraphDouble } from "./state-graph.double";
import { createGraphConfigDouble } from "./graph-config.double";
import { createGraphExecutionDouble } from "./graph-execution.double";

export {
	createStateGraphDouble,
	type StateGraphCapabilities,
	type GraphExecutionResult,
} from "./state-graph.double";

export {
	createGraphConfigDouble,
	type GraphConfigCapabilities,
	type GraphNode,
	type GraphEdge,
} from "./graph-config.double";

export {
	createGraphExecutionDouble,
	type GraphExecutionCapabilities,
	type ExecutionContext,
	type ExecutionStep,
	type ExecutionResult,
	type ExecutionOptions,
	type ExecutionMetrics,
} from "./graph-execution.double";

// Utility function to create all LangGraph test doubles with consistent configuration
export function createLangGraphTestDoubles() {
	return {
		stateGraph: createStateGraphDouble(),
		graphConfig: createGraphConfigDouble(),
		graphExecution: createGraphExecutionDouble(),
	};
}

// LangGraph-specific test data factories
export const LangGraphTestDataFactory = {
	createHiveMindState: (overrides?: Partial<any>) => ({
		swarmMetrics: {
			totalAgents: 1,
			activeAgents: 1,
			taskCompletionRate: 0.85,
			averageResponseTime: 150,
		},
		currentTask: null,
		agentStates: [],
		consensusResults: [],
		...overrides,
	}),

	createGraphNode: (name: string, overrides?: Partial<any>) => ({
		name,
		action: vi.fn().mockResolvedValue({ processed: true }),
		inputSchema: null,
		outputSchema: null,
		...overrides,
	}),

	createGraphEdge: (from: string, to: string, overrides?: Partial<any>) => ({
		from,
		to,
		condition: null,
		...overrides,
	}),

	createExecutionStep: (nodeId: string, overrides?: Partial<any>) => ({
		nodeId,
		input: { data: "test" },
		output: { data: "test", processed: true },
		executionTime: Math.floor(Math.random() * 100) + 10,
		success: true,
		...overrides,
	}),

	createExecutionResult: (overrides?: Partial<any>) => ({
		success: true,
		finalState: {
			swarmMetrics: {
				totalAgents: 1,
				activeAgents: 1,
				taskCompletionRate: 1.0,
				averageResponseTime: 100,
			},
		},
		executionPath: ['start', 'process', 'end'],
		steps: [],
		totalExecutionTime: 65,
		errors: [],
		metadata: {},
		...overrides,
	}),

	createExecutionContext: (executionId: string, overrides?: Partial<any>) => ({
		executionId,
		startTime: Date.now(),
		currentNode: 'start',
		visitedNodes: [],
		state: {},
		metadata: {},
		...overrides,
	}),
};