/**
 * Test Doubles Index
 * Centralized export for all test doubles used in TDD London School testing
 */

import { createQueenAgentDouble } from "./agents/queen-agent.double";
import { createWorkerAgentDouble } from "./agents/worker-agent.double";
import { createConsensusEngineDouble } from "./consensus/consensus-engine.double";
import { createLangGraphTestDoubles } from "./langgraph";
import { createTopologyManagerDouble } from "./topology/topology-manager.double";

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
	createGraphConfigDouble,
	createGraphExecutionDouble,
	createLangGraphTestDoubles,
	createStateGraphDouble,
	type ExecutionResult,
	type ExecutionStep,
	type GraphConfigCapabilities,
	type GraphExecutionCapabilities,
	type GraphExecutionResult,
	LangGraphTestDataFactory,
	type StateGraphCapabilities,
} from "./langgraph";
export {
	createTopologyManagerDouble,
	type SwarmTopology,
	type TopologyConfig,
	type TopologyManagerCapabilities,
	type TopologyMetrics,
} from "./topology/topology-manager.double";

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

// Define proper interfaces for test data
export interface TestTask {
	id: string;
	description: string;
	priority: "low" | "medium" | "high";
	requiredCapabilities: string[];
}

export interface TestAgent {
	id: string;
	type: "worker" | "queen";
	status: "idle" | "busy" | "error";
	capabilities: string[];
}

export interface TestDecision {
	id: string;
	type: "technical" | "business" | "architectural";
	proposal: string;
	severity: "low" | "medium" | "high";
	timestamp: string;
}

// Test data factories
export const TestDataFactory = {
	createTask: (overrides?: Partial<TestTask>) => ({
		id: `task-${Math.random().toString(36).substring(2, 11)}`,
		description: "Test task",
		priority: "medium" as const,
		requiredCapabilities: ["coding"],
		...overrides,
	}),

	createAgent: (overrides?: Partial<TestAgent>) => ({
		id: `agent-${Math.random().toString(36).substring(2, 11)}`,
		type: "worker" as const,
		status: "idle" as const,
		capabilities: ["coding", "testing"],
		...overrides,
	}),

	createDecision: (overrides?: Partial<TestDecision>) => ({
		id: `decision-${Math.random().toString(36).substring(2, 11)}`,
		type: "technical" as const,
		proposal: "Test proposal",
		severity: "medium" as const,
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
