/**
 * Topology Manager Test Double
 * TDD London School - Mock implementation for swarm topology management
 */

import { expect, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

export type SwarmTopology = "hierarchical" | "mesh" | "ring" | "star";

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

// Define proper types for topology context
export interface TopologyContext {
	agentCount: number;
	parallelizable?: boolean;
	complexity?: "low" | "medium" | "high";
	currentLoad?: number;
	[key: string]: unknown;
}

export interface TopologyManagerCapabilities {
	setTopology: (topology: SwarmTopology) => void;
	switchTopology: (newTopology: SwarmTopology) => Promise<void>;
	recommendTopology: (context: TopologyContext) => SwarmTopology;
	getTopologyMetrics: () => TopologyMetrics;
	optimizeConnections: () => Promise<void>;
	handleNodeFailure: (nodeId: string) => Promise<void>;
	getActiveNodes: () => string[];
	getCurrentTopology: () => SwarmTopology;
}

export const createTopologyManagerDouble = (
	overrides?: Partial<TopologyManagerCapabilities>,
) => {
	let currentTopology: SwarmTopology = "hierarchical";
	const activeNodes = new Set<string>(["queen-001"]);

	const double = mockDeep<TopologyManagerCapabilities>({
		setTopology: vi.fn().mockImplementation((topology: SwarmTopology) => {
			currentTopology = topology;
		}),
		switchTopology: vi
			.fn()
			.mockImplementation(async (newTopology: SwarmTopology) => {
				currentTopology = newTopology;
			}),
		recommendTopology: vi.fn().mockImplementation((context: TopologyContext) => {
			// Simple recommendation logic for testing
			if (context.agentCount > 10) return "mesh";
			if (context.parallelizable) return "star";
			if (context.complexity === "high") return "mesh";
			return "hierarchical";
		}),
		getTopologyMetrics: vi.fn().mockReturnValue({
			averageLatency: 50,
			throughput: 1000,
			reliability: 0.99,
			loadBalance: 0.85,
		}),
		optimizeConnections: vi.fn().mockResolvedValue(undefined),
		handleNodeFailure: vi.fn().mockImplementation(async (nodeId: string) => {
			activeNodes.delete(nodeId);
		}),
		getActiveNodes: vi.fn().mockImplementation(() => Array.from(activeNodes)),
		getCurrentTopology: vi.fn().mockImplementation(() => currentTopology),
		...overrides,
	});

	// Define interface for double with test helpers
	interface TopologyManagerDoubleWithHelpers extends TopologyManagerCapabilities {
		__testHelpers: {
			givenCurrentTopology: (topology: SwarmTopology) => void;
			givenRecommendationReturns: (topology: SwarmTopology) => void;
			givenMetricsReturn: (metrics: TopologyMetrics) => void;
			givenSwitchTopologyFails: (error: Error) => void;
			addActiveNode: (nodeId: string) => void;
			removeActiveNode: (nodeId: string) => void;
			assertTopologySet: (topology: SwarmTopology) => void;
			assertTopologySwitched: (topology: SwarmTopology) => void;
			assertNodeFailureHandled: (nodeId: string) => void;
			getActiveNodeCount: () => number;
		};
	}

	// Add test helper methods with proper typing
	const enhancedDouble = double as TopologyManagerDoubleWithHelpers;
	
	enhancedDouble.__testHelpers = {
		givenCurrentTopology: (topology: SwarmTopology) => {
			currentTopology = topology;
			double.getCurrentTopology.mockReturnValue(topology);
		},
		givenRecommendationReturns: (topology: SwarmTopology) => {
			double.recommendTopology.mockReturnValue(topology);
		},
		givenMetricsReturn: (metrics: TopologyMetrics) => {
			double.getTopologyMetrics.mockReturnValue(metrics);
		},
		givenSwitchTopologyFails: (error: Error) => {
			double.switchTopology.mockRejectedValue(error);
		},
		addActiveNode: (nodeId: string) => {
			activeNodes.add(nodeId);
		},
		removeActiveNode: (nodeId: string) => {
			activeNodes.delete(nodeId);
		},
		assertTopologySet: (topology: SwarmTopology) => {
			expect(double.setTopology).toHaveBeenCalledWith(topology);
		},
		assertTopologySwitched: (topology: SwarmTopology) => {
			expect(double.switchTopology).toHaveBeenCalledWith(topology);
		},
		assertNodeFailureHandled: (nodeId: string) => {
			expect(double.handleNodeFailure).toHaveBeenCalledWith(nodeId);
		},
		getActiveNodeCount: () => activeNodes.size,
	};

	return enhancedDouble;
};
