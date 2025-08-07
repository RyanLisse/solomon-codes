/**
 * Queen Agent Test Double
 * TDD London School - Mock implementation for testing
 */

import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

export interface QueenAgentCapabilities {
	analyzeTask: (
		task: unknown,
	) => Promise<{ agentCount: number; agentTypes: string[] }>;
	makeDecision: (
		context: unknown,
	) => Promise<{ decision: string; confidence: number }>;
	coordinateAgents: (agents: string[]) => Promise<void>;
	recordDecision: (decision: unknown) => void;
	recordFailure: (agentId: string, error: Error) => void;
	register: (config: { id: string; role: string }) => void;
	getState: () => unknown;
}

export interface QueenAgentTestHelpers {
	givenTaskAnalysisReturns: (result: {
		agentCount: number;
		agentTypes: string[];
	}) => void;
	givenDecisionReturns: (result: {
		decision: string;
		confidence: number;
	}) => void;
	assertRegisteredWithRole: (role: string) => void;
	assertAnalyzedTask: (task: unknown) => void;
}

export const createQueenAgentDouble = (
	overrides?: Partial<QueenAgentCapabilities>,
): QueenAgentCapabilities & { __testHelpers: QueenAgentTestHelpers } => {
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

	// Add test helper methods
	(
		double as QueenAgentCapabilities & { __testHelpers: QueenAgentTestHelpers }
	).__testHelpers = {
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
		assertAnalyzedTask: (task: unknown) => {
			expect(double.analyzeTask).toHaveBeenCalledWith(task);
		},
	};

	return double;
};
