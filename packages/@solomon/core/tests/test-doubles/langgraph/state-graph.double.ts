/**
 * StateGraph Test Double
 * TDD London School mockist approach for LangGraph StateGraph
 */

import type { StateGraph } from "@langchain/langgraph";
import { expect } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { HiveMindState } from "../../../src/state/unified-state";

type NodeAction = (state: HiveMindState) => Promise<Partial<HiveMindState>>;
type ConditionFunction = (state: HiveMindState) => string;

export interface StateGraphCapabilities {
	// Core graph operations
	addNode(name: string, action: NodeAction): StateGraph<HiveMindState>;
	addEdge(fromNode: string, toNode: string): StateGraph<HiveMindState>;
	addConditionalEdges(
		source: string,
		condition: ConditionFunction,
		edges: Record<string, string>,
	): StateGraph<HiveMindState>;
	setEntryPoint(node: string): StateGraph<HiveMindState>;
	setFinishPoint(node: string): StateGraph<HiveMindState>;

	// State management
	invoke(input: Partial<HiveMindState>): Promise<HiveMindState>;
	stream(input: Partial<HiveMindState>): AsyncIterator<HiveMindState>;
	astream(input: Partial<HiveMindState>): AsyncIterator<HiveMindState>;

	// Graph introspection
	getGraph(): Record<string, unknown>;
	getState(): Partial<HiveMindState>;
	updateState(newState: Partial<HiveMindState>): void;
}

export interface GraphExecutionResult {
	finalState: HiveMindState;
	executionPath: string[];
	nodeOutputs: Record<string, unknown>;
	executionTime: number;
	success: boolean;
	errors?: Error[];
}

export interface MockStateGraphHelpers {
	// Setup behaviors
	givenInvokeReturns(result: Partial<HiveMindState>): void;
	givenInvokeFails(error: Error): void;
	givenStreamReturns(states: Partial<HiveMindState>[]): void;
	givenExecutionPath(path: string[]): void;

	// Verification helpers
	assertInvokedWith(input: Partial<HiveMindState>): void;
	assertStreamInvokedWith(input: Partial<HiveMindState>): void;
	assertNodeAdded(name: string): void;
	assertEdgeAdded(fromNode: string, toNode: string): void;
	assertEntryPointSet(node: string): void;

	// State inspection
	getLastInvocation(): Partial<HiveMindState> | null;
	getInvocationCount(): number;
	getExecutionHistory(): Partial<HiveMindState>[];
}

export function createStateGraphDouble(): StateGraphCapabilities & {
	__testHelpers: MockStateGraphHelpers;
} {
	const mock = mockDeep<StateGraphCapabilities>();
	let lastInvocation: Partial<HiveMindState> | null = null;
	let invocationCount = 0;
	const executionHistory: Partial<HiveMindState>[] = [];
	let mockInvokeResult: Partial<HiveMindState> | null = null;
	let mockInvokeError: Error | null = null;
	let mockStreamResults: Partial<HiveMindState>[] = [];
	let mockExecutionPath: string[] = [];
	const addedNodes: string[] = [];
	const addedEdges: Array<{ from: string; to: string }> = [];
	let entryPoint: string | null = null;

	// Configure default behaviors
	mock.addNode.mockImplementation((name: string, _action: NodeAction) => {
		addedNodes.push(name);
		return mock;
	});

	mock.addEdge.mockImplementation((fromNode: string, toNode: string) => {
		addedEdges.push({ from: fromNode, to: toNode });
		return mock;
	});

	mock.addConditionalEdges.mockImplementation(
		(
			_source: string,
			_condition: ConditionFunction,
			_edges: Record<string, string>,
		) => {
			return mock;
		},
	);

	mock.setEntryPoint.mockImplementation((node: string) => {
		entryPoint = node;
		return mock;
	});

	mock.setFinishPoint.mockImplementation((_node: string) => {
		return mock;
	});

	mock.invoke.mockImplementation(async (input: Partial<HiveMindState>) => {
		lastInvocation = input;
		invocationCount++;
		executionHistory.push(input);

		if (mockInvokeError) {
			throw mockInvokeError;
		}

		if (mockInvokeResult) {
			return mockInvokeResult as HiveMindState;
		}

		// Default behavior: return input with some processing
		return {
			...input,
			swarmMetrics: {
				totalAgents: 1,
				activeAgents: 1,
				taskCompletionRate: 0.85,
				averageResponseTime: 150,
			},
			executionPath: mockExecutionPath,
		} as HiveMindState;
	});

	mock.stream.mockImplementation(async function* (
		input: Partial<HiveMindState>,
	) {
		lastInvocation = input;
		invocationCount++;

		for (const state of mockStreamResults.length > 0
			? mockStreamResults
			: [input]) {
			yield state as HiveMindState;
		}
	});

	mock.astream.mockImplementation(mock.stream);

	mock.getGraph.mockReturnValue({
		nodes: addedNodes,
		edges: addedEdges,
		entryPoint,
	});

	mock.getState.mockReturnValue(lastInvocation || {});

	mock.updateState.mockImplementation((newState: Partial<HiveMindState>) => {
		lastInvocation = { ...lastInvocation, ...newState };
	});

	const testHelpers: MockStateGraphHelpers = {
		givenInvokeReturns: (result: Partial<HiveMindState>) => {
			mockInvokeResult = result;
			mockInvokeError = null;
		},

		givenInvokeFails: (error: Error) => {
			mockInvokeError = error;
			mockInvokeResult = null;
		},

		givenStreamReturns: (states: Partial<HiveMindState>[]) => {
			mockStreamResults = states;
		},

		givenExecutionPath: (path: string[]) => {
			mockExecutionPath = path;
		},

		assertInvokedWith: (input: Partial<HiveMindState>) => {
			expect(mock.invoke).toHaveBeenCalledWith(input);
		},

		assertStreamInvokedWith: (input: Partial<HiveMindState>) => {
			expect(mock.stream).toHaveBeenCalledWith(input);
		},

		assertNodeAdded: (name: string) => {
			expect(addedNodes).toContain(name);
		},

		assertEdgeAdded: (fromNode: string, toNode: string) => {
			const edge = addedEdges.find(
				(e) => e.from === fromNode && e.to === toNode,
			);
			expect(edge).toBeDefined();
		},

		assertEntryPointSet: (node: string) => {
			expect(entryPoint).toBe(node);
		},

		getLastInvocation: () => lastInvocation,

		getInvocationCount: () => invocationCount,

		getExecutionHistory: () => [...executionHistory],
	};

	return Object.assign(mock, {
		__testHelpers: testHelpers,
	});
}

// Type exports for external use
export type { StateGraphCapabilities, GraphExecutionResult };
