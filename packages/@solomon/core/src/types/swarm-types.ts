/**
 * Type definitions for the swarm system
 * These interfaces define the contracts that implementations must follow
 */

export type SwarmTopology = "hierarchical" | "mesh" | "ring" | "star";

// Base types for tasks and decisions
export interface SwarmTask {
	id: string;
	type: string;
	description: string;
	priority: number;
	metadata?: Record<string, unknown>;
}

export interface SwarmDecision {
	id: string;
	type: string;
	decision: string;
	confidence: number;
	timestamp: string;
	metadata?: Record<string, unknown>;
}

export interface SwarmContext {
	taskId: string;
	agentIds: string[];
	metadata?: Record<string, unknown>;
}

// Queen Agent Types
export interface QueenAgentCapabilities {
	analyzeTask: (
		task: SwarmTask,
	) => Promise<{ agentCount: number; agentTypes: string[] }>;
	makeDecision: (
		context: SwarmContext,
	) => Promise<{ decision: string; confidence: number }>;
	coordinateAgents: (agents: string[]) => Promise<void>;
	recordDecision: (decision: SwarmDecision) => void;
	recordFailure: (agentId: string, error: Error) => void;
	register: (config: { id: string; role: string }) => void;
	getState: () => Record<string, unknown>;
}

// Worker Agent Types
export interface WorkerConfig {
	id: string;
	type: string;
	capabilities: string[];
	resources?: {
		cpu: number;
		memory: number;
	};
}

export interface WorkerInstance {
	id: string;
	type: string;
	status: "idle" | "working" | "completed" | "failed";
	execute: (task: SwarmTask) => Promise<Record<string, unknown>>;
	terminate: () => Promise<void>;
}

export interface WorkerAgentCapabilities {
	spawn: (config: WorkerConfig) => Promise<WorkerInstance>;
	execute: (task: SwarmTask) => Promise<Record<string, unknown>>;
	reportStatus: () => { status: string; progress: number };
	terminate: () => Promise<void>;
}

// Consensus Engine Types
export interface ConsensusVote {
	agentId: string;
	vote: "approve" | "reject" | "abstain";
	confidence: number;
	timestamp?: string;
}

export interface ConsensusResult {
	result: "approved" | "rejected" | "pending";
	confidence: number;
	voteSummary: {
		approve: number;
		reject: number;
		abstain: number;
	};
	quorumReached: boolean;
}

export interface ConsensusEngineCapabilities {
	collectVotes: (decision: SwarmDecision) => Promise<ConsensusVote[]>;
	calculateConsensus: (votes: ConsensusVote[]) => ConsensusResult;
	setQuorumThreshold: (threshold: number) => void;
	detectMaliciousAgents: (votes: ConsensusVote[]) => string[];
	recordConsensus: (decision: SwarmDecision, result: ConsensusResult) => void;
}

// Topology Manager Types
export interface TopologyConfig {
	topology: SwarmTopology;
	maxConnections: number;
	latencyThreshold: number;
	redundancy: number;
}

export interface TopologyMetrics {
	averageLatency: number;
	throughput: number;
	reliability: number;
	loadBalance: number;
}

export interface TopologyManagerCapabilities {
	setTopology: (topology: SwarmTopology) => void;
	switchTopology: (newTopology: SwarmTopology) => Promise<void>;
	recommendTopology: (context: SwarmContext) => SwarmTopology;
	getTopologyMetrics: () => TopologyMetrics;
	optimizeConnections: () => Promise<void>;
	handleNodeFailure: (nodeId: string) => Promise<void>;
	getActiveNodes: () => string[];
	getCurrentTopology: () => SwarmTopology;
}
