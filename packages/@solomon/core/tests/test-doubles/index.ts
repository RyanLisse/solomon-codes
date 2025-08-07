/**
 * Test Doubles Index
 * Centralized export for all test doubles used in TDD London School testing
 */

import { createQueenAgentDouble } from "./agents/queen-agent.double";
import { createWorkerAgentDouble } from "./agents/worker-agent.double";
import { createConsensusEngineDouble } from "./consensus/consensus-engine.double";
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

// Define proper types for test data
interface TestTask {
	id: string;
	description: string;
	priority: string;
	requiredCapabilities: string[];
	[key: string]: unknown;
}

interface TestAgent {
	id: string;
	type: string;
	status: string;
	capabilities: string[];
	[key: string]: unknown;
}

interface TestDecision {
	id: string;
	type: string;
	proposal: string;
	severity: string;
	timestamp: string;
	[key: string]: unknown;
}

// Test data factories
export const TestDataFactory = {
	createTask: (overrides?: Partial<TestTask>): TestTask => ({
		id: `task-${Math.random().toString(36).substr(2, 9)}`,
		description: "Test task",
		priority: "medium",
		requiredCapabilities: ["coding"],
		...overrides,
	}),

	createAgent: (overrides?: Partial<TestAgent>): TestAgent => ({
		id: `agent-${Math.random().toString(36).substr(2, 9)}`,
		type: "worker",
		status: "idle",
		capabilities: ["coding", "testing"],
		...overrides,
	}),

	createDecision: (overrides?: Partial<TestDecision>): TestDecision => ({
		id: `decision-${Math.random().toString(36).substr(2, 9)}`,
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
