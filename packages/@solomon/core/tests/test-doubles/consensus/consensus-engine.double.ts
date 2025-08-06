/**
 * Consensus Engine Test Double
 * TDD London School - Mock implementation for Byzantine fault-tolerant consensus
 */

import { vi, expect } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

export interface ConsensusVote {
  agentId: string;
  vote: 'approve' | 'reject' | 'abstain';
  confidence: number;
  timestamp?: string;
}

export interface ConsensusResult {
  result: 'approved' | 'rejected' | 'pending';
  confidence: number;
  voteSummary: {
    approve: number;
    reject: number;
    abstain: number;
  };
  quorumReached: boolean;
}

export interface ConsensusEngineCapabilities {
  collectVotes: (decision: any) => Promise<ConsensusVote[]>;
  calculateConsensus: (votes: ConsensusVote[]) => ConsensusResult;
  setQuorumThreshold: (threshold: number) => void;
  detectMaliciousAgents: (votes: ConsensusVote[]) => string[];
  recordConsensus: (decision: any, result: ConsensusResult) => void;
}

export const createConsensusEngineDouble = (overrides?: Partial<ConsensusEngineCapabilities>) => {
  let quorumThreshold = 0.66; // 2/3 majority by default
  
  const double = mockDeep<ConsensusEngineCapabilities>({
    collectVotes: vi.fn().mockResolvedValue([
      { agentId: 'agent-1', vote: 'approve', confidence: 0.9 },
      { agentId: 'agent-2', vote: 'approve', confidence: 0.85 },
      { agentId: 'agent-3', vote: 'reject', confidence: 0.7 },
    ]),
    calculateConsensus: vi.fn().mockImplementation((votes: ConsensusVote[]) => {
      const voteSummary = votes.reduce(
        (acc, vote) => {
          acc[vote.vote]++;
          return acc;
        },
        { approve: 0, reject: 0, abstain: 0 }
      );
      
      const totalVotes = votes.length;
      const approvalRatio = voteSummary.approve / totalVotes;
      const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / totalVotes;
      
      return {
        result: approvalRatio >= quorumThreshold ? 'approved' : 'rejected',
        confidence: avgConfidence,
        voteSummary,
        quorumReached: totalVotes >= 3, // Minimum 3 votes for quorum
      };
    }),
    setQuorumThreshold: vi.fn().mockImplementation((threshold: number) => {
      quorumThreshold = threshold;
    }),
    detectMaliciousAgents: vi.fn().mockReturnValue([]),
    recordConsensus: vi.fn(),
    ...overrides,
  });

  // Add test helper methods
  (double as any).__testHelpers = {
    givenVotesReturn: (votes: ConsensusVote[]) => {
      double.collectVotes.mockResolvedValue(votes);
    },
    givenConsensusResult: (result: ConsensusResult) => {
      double.calculateConsensus.mockReturnValue(result);
    },
    givenConsensusReturns: (result: Partial<ConsensusResult>) => {
      double.calculateConsensus.mockReturnValue({
        result: result.result || 'approved',
        confidence: result.confidence || 0.85,
        voteSummary: result.voteSummary || { approve: result.votes || 3, reject: 1, abstain: 0 },
        quorumReached: result.quorumReached !== undefined ? result.quorumReached : true,
      } as ConsensusResult);
    },
    givenMaliciousAgents: (agentIds: string[]) => {
      double.detectMaliciousAgents.mockReturnValue(agentIds);
    },
    assertVotesCollectedFor: (decision: any) => {
      expect(double.collectVotes).toHaveBeenCalledWith(decision);
    },
    assertConsensusCalculated: () => {
      expect(double.calculateConsensus).toHaveBeenCalled();
    },
    assertQuorumThresholdSet: (threshold: number) => {
      expect(double.setQuorumThreshold).toHaveBeenCalledWith(threshold);
    },
    getCurrentQuorumThreshold: () => quorumThreshold,
  };

  return double;
};