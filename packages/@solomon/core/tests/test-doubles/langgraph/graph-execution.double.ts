/**
 * Graph Execution Engine Test Double
 * TDD London School mockist approach for LangGraph execution runtime
 */

import { expect, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { HiveMindState } from "../../../src/state/unified-state";

export interface ExecutionContext {
	executionId: string;
	startTime: number;
	currentNode: string;
	visitedNodes: string[];
	state: Partial<HiveMindState>;
	metadata: Record<string, any>;
}

export interface ExecutionStep {
	nodeId: string;
	input: any;
	output: any;
	executionTime: number;
	success: boolean;
	error?: Error;
}

export interface ExecutionResult {
	success: boolean;
	finalState: HiveMindState;
	executionPath: string[];
	steps: ExecutionStep[];
	totalExecutionTime: number;
	errors: Error[];
	metadata: Record<string, any>;
}

export interface GraphExecutionCapabilities {
	// Execution management
	execute(
		graphConfig: any,
		initialState: Partial<HiveMindState>,
		options?: ExecutionOptions
	): Promise<ExecutionResult>;
	executeNode(
		nodeId: string,
		input: any,
		context: ExecutionContext
	): Promise<any>;
	
	// Streaming execution
	stream(
		graphConfig: any,
		initialState: Partial<HiveMindState>
	): AsyncIterator<ExecutionStep>;
	
	// Execution control
	pause(executionId: string): Promise<void>;
	resume(executionId: string): Promise<void>;
	cancel(executionId: string): Promise<void>;
	
	// State management during execution
	getExecutionState(executionId: string): ExecutionContext | null;
	updateExecutionState(
		executionId: string,
		stateUpdate: Partial<HiveMindState>
	): Promise<void>;
	
	// Error handling
	handleNodeError(
		nodeId: string,
		error: Error,
		context: ExecutionContext
	): Promise<'retry' | 'skip' | 'abort'>;
	
	// Execution monitoring
	getActiveExecutions(): string[];
	getExecutionMetrics(executionId: string): ExecutionMetrics;
}

export interface ExecutionOptions {
	timeout?: number;
	maxRetries?: number;
	parallelism?: number;
	checkpoints?: boolean;
	streaming?: boolean;
}

export interface ExecutionMetrics {
	nodeExecutionTimes: Record<string, number>;
	memoryUsage: number;
	totalNodes: number;
	completedNodes: number;
	failedNodes: number;
	retryCount: number;
}

export interface MockGraphExecutionHelpers {
	// Setup behaviors
	givenExecutionReturns(result: ExecutionResult): void;
	givenExecutionFails(error: Error): void;
	givenNodeExecutionReturns(nodeId: string, output: any): void;
	givenNodeExecutionFails(nodeId: string, error: Error): void;
	givenStreamReturns(steps: ExecutionStep[]): void;
	givenErrorHandlingReturns(strategy: 'retry' | 'skip' | 'abort'): void;
	
	// Verification helpers
	assertExecutedWith(
		graphConfig: any,
		initialState: Partial<HiveMindState>
	): void;
	assertNodeExecuted(nodeId: string): void;
	assertNodeExecutedWith(nodeId: string, input: any): void;
	assertExecutionPaused(executionId: string): void;
	assertExecutionResumed(executionId: string): void;
	assertExecutionCancelled(executionId: string): void;
	assertStateUpdated(executionId: string): void;
	
	// State inspection
	getLastExecution(): {
		graphConfig: any;
		initialState: Partial<HiveMindState>;
		options?: ExecutionOptions;
	} | null;
	getExecutionHistory(): Array<{
		graphConfig: any;
		initialState: Partial<HiveMindState>;
		result: ExecutionResult;
	}>;
	getNodeExecutionHistory(nodeId: string): Array<{
		input: any;
		output: any;
		executionTime: number;
	}>;
}

export function createGraphExecutionDouble(): GraphExecutionCapabilities & {
	__testHelpers: MockGraphExecutionHelpers;
} {
	const mock = mockDeep<GraphExecutionCapabilities>();
	
	// State tracking
	let lastExecution: {
		graphConfig: any;
		initialState: Partial<HiveMindState>;
		options?: ExecutionOptions;
	} | null = null;
	
	const executionHistory: Array<{
		graphConfig: any;
		initialState: Partial<HiveMindState>;
		result: ExecutionResult;
	}> = [];
	
	const nodeExecutionHistory = new Map<string, Array<{
		input: any;
		output: any;
		executionTime: number;
	}>>();
	
	const activeExecutions = new Set<string>();
	const pausedExecutions = new Set<string>();
	
	// Mock configuration
	let mockExecutionResult: ExecutionResult | null = null;
	let mockExecutionError: Error | null = null;
	const mockNodeOutputs = new Map<string, any>();
	const mockNodeErrors = new Map<string, Error>();
	let mockStreamSteps: ExecutionStep[] = [];
	let mockErrorHandlingStrategy: 'retry' | 'skip' | 'abort' = 'retry';
	
	// Configure main execution
	mock.execute.mockImplementation(async (
		graphConfig: any,
		initialState: Partial<HiveMindState>,
		options?: ExecutionOptions
	) => {
		lastExecution = { graphConfig, initialState, options };
		
		const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
		activeExecutions.add(executionId);
		
		if (mockExecutionError) {
			activeExecutions.delete(executionId);
			throw mockExecutionError;
		}
		
		const result = mockExecutionResult || {
			success: true,
			finalState: {
				...initialState,
				swarmMetrics: {
					totalAgents: 1,
					activeAgents: 1,
					taskCompletionRate: 1.0,
					averageResponseTime: 100,
				},
			} as HiveMindState,
			executionPath: ['start', 'process', 'end'],
			steps: [
				{
					nodeId: 'start',
					input: initialState,
					output: initialState,
					executionTime: 10,
					success: true,
				},
				{
					nodeId: 'process',
					input: initialState,
					output: { ...initialState, processed: true },
					executionTime: 50,
					success: true,
				},
				{
					nodeId: 'end',
					input: { ...initialState, processed: true },
					output: { ...initialState, completed: true },
					executionTime: 5,
					success: true,
				},
			],
			totalExecutionTime: 65,
			errors: [],
			metadata: { executionId },
		};
		
		executionHistory.push({
			graphConfig,
			initialState,
			result,
		});
		
		activeExecutions.delete(executionId);
		return result;
	});
	
	// Configure node execution
	mock.executeNode.mockImplementation(async (
		nodeId: string,
		input: any,
		context: ExecutionContext
	) => {
		const history = nodeExecutionHistory.get(nodeId) || [];
		
		if (mockNodeErrors.has(nodeId)) {
			throw mockNodeErrors.get(nodeId);
		}
		
		const output = mockNodeOutputs.get(nodeId) || { ...input, processed: true };
		const executionTime = Math.floor(Math.random() * 100) + 10;
		
		history.push({ input, output, executionTime });
		nodeExecutionHistory.set(nodeId, history);
		
		return output;
	});
	
	// Configure streaming execution
	mock.stream.mockImplementation(async function* (
		graphConfig: any,
		initialState: Partial<HiveMindState>
	) {
		lastExecution = { graphConfig, initialState };
		
		for (const step of mockStreamSteps.length > 0 ? mockStreamSteps : [
			{
				nodeId: 'start',
				input: initialState,
				output: initialState,
				executionTime: 10,
				success: true,
			},
		]) {
			yield step;
		}
	});
	
	// Configure execution control
	mock.pause.mockImplementation(async (executionId: string) => {
		pausedExecutions.add(executionId);
	});
	
	mock.resume.mockImplementation(async (executionId: string) => {
		pausedExecutions.delete(executionId);
	});
	
	mock.cancel.mockImplementation(async (executionId: string) => {
		activeExecutions.delete(executionId);
		pausedExecutions.delete(executionId);
	});
	
	// Configure state management
	mock.getExecutionState.mockImplementation((executionId: string) => {
		if (!activeExecutions.has(executionId)) return null;
		
		return {
			executionId,
			startTime: Date.now() - 1000,
			currentNode: 'process',
			visitedNodes: ['start'],
			state: lastExecution?.initialState || {},
			metadata: {},
		};
	});
	
	mock.updateExecutionState.mockImplementation(async (
		executionId: string,
		stateUpdate: Partial<HiveMindState>
	) => {
		// Mock implementation - in real system would update execution state
	});
	
	// Configure error handling
	mock.handleNodeError.mockImplementation(async (
		nodeId: string,
		error: Error,
		context: ExecutionContext
	) => {
		return mockErrorHandlingStrategy;
	});
	
	// Configure monitoring
	mock.getActiveExecutions.mockImplementation(() => {
		return Array.from(activeExecutions);
	});
	
	mock.getExecutionMetrics.mockImplementation((executionId: string) => {
		return {
			nodeExecutionTimes: {
				start: 10,
				process: 50,
				end: 5,
			},
			memoryUsage: 1024,
			totalNodes: 3,
			completedNodes: 3,
			failedNodes: 0,
			retryCount: 0,
		};
	});
	
	const testHelpers: MockGraphExecutionHelpers = {
		givenExecutionReturns: (result: ExecutionResult) => {
			mockExecutionResult = result;
			mockExecutionError = null;
		},
		
		givenExecutionFails: (error: Error) => {
			mockExecutionError = error;
			mockExecutionResult = null;
		},
		
		givenNodeExecutionReturns: (nodeId: string, output: any) => {
			mockNodeOutputs.set(nodeId, output);
			mockNodeErrors.delete(nodeId);
		},
		
		givenNodeExecutionFails: (nodeId: string, error: Error) => {
			mockNodeErrors.set(nodeId, error);
			mockNodeOutputs.delete(nodeId);
		},
		
		givenStreamReturns: (steps: ExecutionStep[]) => {
			mockStreamSteps = steps;
		},
		
		givenErrorHandlingReturns: (strategy: 'retry' | 'skip' | 'abort') => {
			mockErrorHandlingStrategy = strategy;
		},
		
		assertExecutedWith: (
			graphConfig: any,
			initialState: Partial<HiveMindState>
		) => {
			expect(mock.execute).toHaveBeenCalledWith(
				graphConfig,
				initialState,
				expect.any(Object)
			);
		},
		
		assertNodeExecuted: (nodeId: string) => {
			expect(mock.executeNode).toHaveBeenCalledWith(
				nodeId,
				expect.anything(),
				expect.any(Object)
			);
		},
		
		assertNodeExecutedWith: (nodeId: string, input: any) => {
			expect(mock.executeNode).toHaveBeenCalledWith(
				nodeId,
				input,
				expect.any(Object)
			);
		},
		
		assertExecutionPaused: (executionId: string) => {
			expect(mock.pause).toHaveBeenCalledWith(executionId);
		},
		
		assertExecutionResumed: (executionId: string) => {
			expect(mock.resume).toHaveBeenCalledWith(executionId);
		},
		
		assertExecutionCancelled: (executionId: string) => {
			expect(mock.cancel).toHaveBeenCalledWith(executionId);
		},
		
		assertStateUpdated: (executionId: string) => {
			expect(mock.updateExecutionState).toHaveBeenCalledWith(
				executionId,
				expect.any(Object)
			);
		},
		
		getLastExecution: () => lastExecution,
		
		getExecutionHistory: () => [...executionHistory],
		
		getNodeExecutionHistory: (nodeId: string) => {
			return nodeExecutionHistory.get(nodeId) || [];
		},
	};
	
	return Object.assign(mock, {
		__testHelpers: testHelpers,
	});
}

// Type exports for external use
export type {
	GraphExecutionCapabilities,
	ExecutionContext,
	ExecutionStep,
	ExecutionResult,
	ExecutionOptions,
	ExecutionMetrics,
};