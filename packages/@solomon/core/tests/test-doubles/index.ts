/**
 * Test Doubles Index
 * Centralized export for all test doubles used in TDD London School testing
 */

import { createQueenAgentDouble } from "./agents/queen-agent.double";
import { createWorkerAgentDouble } from "./agents/worker-agent.double";
import { createConsensusEngineDouble } from "./consensus/consensus-engine.double";
import { createTopologyManagerDouble } from "./topology/topology-manager.double";
import { createLangGraphTestDoubles } from "./langgraph";

export {
  createQueenAgentDouble,
  type QueenAgentCapabilities,
} from "./agents/queen-agent.double";
export {
  createWorkerAgentDouble,
  type WorkerAgentCapabilities,
  type WorkerConfig,
  type WorkerInstance,
} from "./agents/worker-agent.double";
export {
  type ConsensusEngineCapabilities,
  type ConsensusResult,
  type ConsensusVote,
  createConsensusEngineDouble,
} from "./consensus/consensus-engine.double";
export {
  createTopologyManagerDouble,
  type SwarmTopology,
  type TopologyConfig,
  type TopologyManagerCapabilities,
  type TopologyMetrics,
} from "./topology/topology-manager.double";
export {
  createLangGraphTestDoubles,
  createStateGraphDouble,
  createGraphConfigDouble,
  createGraphExecutionDouble,
  type StateGraphCapabilities,
  type GraphConfigCapabilities,
  type GraphExecutionCapabilities,
  type GraphExecutionResult,
  type ExecutionResult,
  type ExecutionStep,
  LangGraphTestDataFactory,
} from "./langgraph";

// Utility function to create all test doubles with consistent configuration
export function createSwarmTestDoubles() {
  return {
    queenAgent: createQueenAgentDouble(),
    workerAgent: createWorkerAgentDouble(),
    consensusEngine: createConsensusEngineDouble(),
    topologyManager: createTopologyManagerDouble(),
  };
}

// Separate factory for LangGraph test doubles when needed
export function createSwarmTestDoublesWithLangGraph() {
  return {
    ...createSwarmTestDoubles(),
    langGraph: createLangGraphTestDoubles(),
  };
}

// Test data factories
export const TestDataFactory = {
  createTask: (overrides?: Partial<any>) => ({
    id: `task-${Math.random().toString(36).substring(2, 11)}`,
    description: "Test task",
    priority: "medium",
    requiredCapabilities: ["coding"],
    ...overrides,
  }),

  createAgent: (overrides?: Partial<any>) => ({
    id: `agent-${Math.random().toString(36).substring(2, 11)}`,
    type: "worker",
    status: "idle",
    capabilities: ["coding", "testing"],
    ...overrides,
  }),

  createDecision: (overrides?: Partial<any>) => ({
    id: `decision-${Math.random().toString(36).substring(2, 11)}`,
    type: "technical",
    proposal: "Test proposal",
    severity: "medium",
    timestamp: new Date().toISOString(),
    ...overrides,
  }),

  createVote: (
    agentId: string,
    vote: "approve" | "reject" | "abstain",
    confidence = 0.8,
  ) => ({
    agentId,
    vote,
    confidence,
    timestamp: new Date().toISOString(),
  }),
};
