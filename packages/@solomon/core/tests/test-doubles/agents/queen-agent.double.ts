/**
 * Queen Agent Test Double
 * TDD London School - Mock implementation for testing
 */

import { vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { BaseMessage } from '@langchain/core/messages';

export interface QueenAgentCapabilities {
  analyzeTask: (task: any) => Promise<{ agentCount: number; agentTypes: string[] }>;
  makeDecision: (context: any) => Promise<{ decision: string; confidence: number }>;
  coordinateAgents: (agents: string[]) => Promise<void>;
  recordDecision: (decision: any) => void;
  recordFailure: (agentId: string, error: Error) => void;
  register: (config: { id: string; role: string }) => void;
  getState: () => any;
}

export const createQueenAgentDouble = (overrides?: Partial<QueenAgentCapabilities>) => {
  const double = mockDeep<QueenAgentCapabilities>({
    analyzeTask: vi.fn().mockResolvedValue({
      agentCount: 2,
      agentTypes: ['programmer', 'tester'],
    }),
    makeDecision: vi.fn().mockResolvedValue({
      decision: 'proceed',
      confidence: 0.95,
    }),
    coordinateAgents: vi.fn().mockResolvedValue(undefined),
    recordDecision: vi.fn(),
    recordFailure: vi.fn(),
    register: vi.fn(),
    getState: vi.fn().mockReturnValue({
      id: 'queen-001',
      role: 'coordinator',
      activeAgents: [],
      decisions: [],
    }),
    ...overrides,
  });

  // Add test helper methods
  (double as any).__testHelpers = {
    givenTaskAnalysisReturns: (result: { agentCount: number; agentTypes: string[] }) => {
      double.analyzeTask.mockResolvedValue(result);
    },
    givenDecisionReturns: (result: { decision: string; confidence: number }) => {
      double.makeDecision.mockResolvedValue(result);
    },
    assertRegisteredWithRole: (role: string) => {
      expect(double.register).toHaveBeenCalledWith(
        expect.objectContaining({ role })
      );
    },
    assertAnalyzedTask: (task: any) => {
      expect(double.analyzeTask).toHaveBeenCalledWith(task);
    },
  };

  return double;
};