/**
 * Queen Agent Test Double
 * TDD London School - Mock implementation for testing
 */

import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

// Define proper types for Queen Agent
export interface Task {
	id: string;
	type: string;
	description: string;
	priority?: string;
	[key: string]: unknown;
}

export interface DecisionContext {
	task?: Task;
	agents?: string[];
	history?: unknown[];
	[key: string]: unknown;
}

export interface Decision {
	id: string;
	type: string;
	context: DecisionContext;
	timestamp: string;
	[key: string]: unknown;
}

export interface QueenAgentState {
	id: string;
	role: string;
	activeAgents: string[];
	decisions: Decision[];
	[key: string]: unknown;
}

export interface QueenAgentCapabilities {
	analyzeTask: (
		task: Task,
	) => Promise<{ agentCount: number; agentTypes: string[] }>;
	makeDecision: (
		context: DecisionContext,
	) => Promise<{ decision: string; confidence: number }>;
	coordinateAgents: (agents: string[]) => Promise<void>;
	recordDecision: (decision: Decision) => void;
	recordFailure: (agentId: string, error: Error) => void;
	register: (config: { id: string; role: string }) => void;
	getState: () => QueenAgentState;
}

interface QueenAgentDoubleWithHelpers extends QueenAgentCapabilities {
	__testHelpers: {
		givenTaskAnalysisReturns: (result: {
			agentCount: number;
			agentTypes: string[];
		}) => void;
		givenDecisionReturns: (result: {
			decision: string;
			confidence: number;
		}) => void;
		assertRegisteredWithRole: (role: string) => void;
		assertAnalyzedTask: (task: Task) => void;
	};
}

export const createQueenAgentDouble = (
	overrides?: Partial<QueenAgentCapabilities>,
): QueenAgentDoubleWithHelpers => {
	const double = mockDeep<QueenAgentCapabilities>({
		analyzeTask: vi.fn().mockResolvedValue({
			agentCount: 2,
			agentTypes: ["programmer", "tester"],
		}),
		makeDecision: vi.fn().mockResolvedValue({
			decision: "proceed",
			confidence: 0.95,
		}),
		coordinateAgents: vi.fn().mockResolvedValue(undefined),
		recordDecision: vi.fn(),
		recordFailure: vi.fn(),
		register: vi.fn(),
		getState: vi.fn().mockReturnValue({
			id: "queen-001",
			role: "coordinator",
			activeAgents: [],
			decisions: [],
		}),
		...overrides,
	});

	// Add test helper methods with proper typing
	const enhancedDouble = double as QueenAgentDoubleWithHelpers;
	
	enhancedDouble.__testHelpers = {
		givenTaskAnalysisReturns: (result: {
			agentCount: number;
			agentTypes: string[];
		}) => {
			double.analyzeTask.mockResolvedValue(result);
		},
		givenDecisionReturns: (result: {
			decision: string;
			confidence: number;
		}) => {
			double.makeDecision.mockResolvedValue(result);
		},
		assertRegisteredWithRole: (role: string) => {
			expect(double.register).toHaveBeenCalledWith(
				expect.objectContaining({ role }),
			);
		},
		assertAnalyzedTask: (task: Task) => {
			expect(double.analyzeTask).toHaveBeenCalledWith(task);
		},
	};

	return enhancedDouble;
};