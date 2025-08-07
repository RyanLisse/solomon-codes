/**
 * LangGraph Test Doubles Index
 * Centralized export for all LangGraph-related test doubles
 * Following TDD London School (mockist) approach
 */

import { vi } from "vitest";
import type { HiveMindState } from "../../../src/state/unified-state";
import {
	createGraphConfigDouble,
	type GraphEdge,
	type GraphNode,
} from "./graph-config.double";
import {
	createGraphExecutionDouble,
	type ExecutionContext,
	type ExecutionResult,
	type ExecutionStep,
} from "./graph-execution.double";
import { createStateGraphDouble } from "./state-graph.double";

export {
	createGraphConfigDouble,
	type GraphConfigCapabilities,
	type GraphEdge,
	type GraphNode,
} from "./graph-config.double";
export {
	createGraphExecutionDouble,
	type ExecutionContext,
	type ExecutionMetrics,
	type ExecutionOptions,
	type ExecutionResult,
	type ExecutionStep,
	type GraphExecutionCapabilities,
} from "./graph-execution.double";
export {
	createStateGraphDouble,
	type GraphExecutionResult,
	type StateGraphCapabilities,
} from "./state-graph.double";

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
	createHiveMindState: (overrides?: Partial<HiveMindState>) => ({
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

	createGraphNode: (name: string, overrides?: Partial<GraphNode>) => ({
		name,
		action: vi.fn().mockResolvedValue({ processed: true }),
		inputSchema: null,
		outputSchema: null,
		...overrides,
	}),

	createGraphEdge: (
		from: string,
		to: string,
		overrides?: Partial<GraphEdge>,
	) => ({
		from,
		to,
		condition: null,
		...overrides,
	}),

	createExecutionStep: (
		nodeId: string,
		overrides?: Partial<ExecutionStep>,
	) => ({
		nodeId,
		input: { data: "test" },
		output: { data: "test", processed: true },
		executionTime: Math.floor(Math.random() * 100) + 10,
		success: true,
		...overrides,
	}),

	createExecutionResult: (overrides?: Partial<ExecutionResult>) => ({
		success: true,
		finalState: {
			swarmMetrics: {
				totalAgents: 1,
				activeAgents: 1,
				taskCompletionRate: 1.0,
				averageResponseTime: 100,
			},
		},
		executionPath: ["start", "process", "end"],
		steps: [],
		totalExecutionTime: 65,
		errors: [],
		metadata: {},
		...overrides,
	}),

	createExecutionContext: (
		executionId: string,
		overrides?: Partial<ExecutionContext>,
	) => ({
		executionId,
		startTime: Date.now(),
		currentNode: "start",
		visitedNodes: [],
		state: {},
		metadata: {},
		...overrides,
	}),
};
