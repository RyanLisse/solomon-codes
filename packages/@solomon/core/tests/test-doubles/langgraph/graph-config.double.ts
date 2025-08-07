/**
 * Graph Configuration Test Double
 * TDD London School mockist approach for LangGraph configuration management
 */

import { expect, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { HiveMindState } from "../../../src/state/unified-state";

// Define proper action and schema types
export type GraphNodeAction = (
	input: Record<string, unknown>,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export type GraphEdgeCondition = (state: Record<string, unknown>) => boolean;

export interface SchemaDefinition {
	type: string;
	properties?: Record<string, unknown>;
	required?: string[];
}

export interface CompiledGraph {
	nodes: string[];
	edges: Array<{ from: string; to: string }>;
	entryPoint: string | null;
	exitPoints: string[];
}

export interface GraphNode {
	name: string;
	action: GraphNodeAction;
	inputSchema?: SchemaDefinition;
	outputSchema?: SchemaDefinition;
}

export interface GraphEdge {
	from: string;
	to: string;
	condition?: GraphEdgeCondition;
}

export interface GraphConfigCapabilities {
	// Node management
	defineNode(node: GraphNode): void;
	removeNode(name: string): void;
	getNode(name: string): GraphNode | null;
	listNodes(): GraphNode[];

	// Edge management
	defineEdge(edge: GraphEdge): void;
	removeEdge(from: string, to: string): void;
	getEdges(fromNode?: string): GraphEdge[];

	// Graph structure
	setEntryPoint(nodeName: string): void;
	setExitPoints(nodeNames: string[]): void;
	getEntryPoint(): string | null;
	getExitPoints(): string[];

	// Configuration validation
	validateGraph(): { valid: boolean; errors: string[] };
	isNodeReachable(nodeName: string): boolean;
	hasCircularDependencies(): boolean;

	// State schema management
	defineStateSchema(schema: SchemaDefinition): void;
	getStateSchema(): SchemaDefinition | null;
	validateState(state: Partial<HiveMindState>): {
		valid: boolean;
		errors: string[];
	};

	// Graph compilation
	compile(): CompiledGraph;
	reset(): void;
	clone(): GraphConfigCapabilities;
}

export interface MockGraphConfigHelpers {
	// Setup behaviors
	givenNodeExists(name: string, action?: GraphNodeAction): void;
	givenEdgeExists(from: string, to: string): void;
	givenValidationReturns(valid: boolean, errors?: string[]): void;
	givenCompilationReturns(result: CompiledGraph): void;
	givenCompilationFails(error: Error): void;

	// Verification helpers
	assertNodeDefined(name: string): void;
	assertEdgeDefined(from: string, to: string): void;
	assertEntryPointSet(nodeName: string): void;
	assertExitPointsSet(nodeNames: string[]): void;
	assertValidationCalled(): void;
	assertCompilationCalled(): void;

	// State inspection
	getDefinedNodes(): string[];
	getDefinedEdges(): Array<{ from: string; to: string }>;
	getValidationHistory(): Array<{ valid: boolean; errors: string[] }>;
}

export function createGraphConfigDouble(): GraphConfigCapabilities & {
	__testHelpers: MockGraphConfigHelpers;
} {
	const mock = mockDeep<GraphConfigCapabilities>();
	const nodes = new Map<string, GraphNode>();
	const edges: GraphEdge[] = [];
	let entryPoint: string | null = null;
	let exitPoints: string[] = [];
	let stateSchema: SchemaDefinition | null = null;
	let mockValidationResult = { valid: true, errors: [] };
	let mockCompilationResult: CompiledGraph | null = null;
	let mockCompilationError: Error | null = null;
	const validationHistory: Array<{ valid: boolean; errors: string[] }> = [];

	// Configure node management
	mock.defineNode.mockImplementation((node: GraphNode) => {
		nodes.set(node.name, node);
	});

	mock.removeNode.mockImplementation((name: string) => {
		nodes.delete(name);
		// Also remove any edges involving this node
		const edgeIndicesToRemove = edges
			.map((edge, index) =>
				edge.from === name || edge.to === name ? index : -1,
			)
			.filter((index) => index !== -1);
		const reversedIndices = edgeIndicesToRemove.toReversed();
		reversedIndices.forEach((index) => edges.splice(index, 1));
	});

	mock.getNode.mockImplementation((name: string) => {
		return nodes.get(name) || null;
	});

	mock.listNodes.mockImplementation(() => {
		return Array.from(nodes.values());
	});

	// Configure edge management
	mock.defineEdge.mockImplementation((edge: GraphEdge) => {
		edges.push(edge);
	});

	mock.removeEdge.mockImplementation((from: string, to: string) => {
		const index = edges.findIndex(
			(edge) => edge.from === from && edge.to === to,
		);
		if (index !== -1) {
			edges.splice(index, 1);
		}
	});

	mock.getEdges.mockImplementation((fromNode?: string) => {
		if (fromNode) {
			return edges.filter((edge) => edge.from === fromNode);
		}
		return [...edges];
	});

	// Configure graph structure
	mock.setEntryPoint.mockImplementation((nodeName: string) => {
		entryPoint = nodeName;
	});

	mock.setExitPoints.mockImplementation((nodeNames: string[]) => {
		exitPoints = [...nodeNames];
	});

	mock.getEntryPoint.mockImplementation(() => entryPoint);

	mock.getExitPoints.mockImplementation(() => [...exitPoints]);

	// Configure validation
	mock.validateGraph.mockImplementation(() => {
		const result = { ...mockValidationResult };
		validationHistory.push(result);
		return result;
	});

	mock.isNodeReachable.mockImplementation((nodeName: string) => {
		return (
			nodes.has(nodeName) &&
			(entryPoint === nodeName || edges.some((edge) => edge.to === nodeName))
		);
	});

	mock.hasCircularDependencies.mockReturnValue(false);

	// Configure state schema
	mock.defineStateSchema.mockImplementation((schema: SchemaDefinition) => {
		stateSchema = schema;
	});

	mock.getStateSchema.mockImplementation(() => stateSchema);

	mock.validateState.mockImplementation((_state: Partial<HiveMindState>) => {
		return { valid: true, errors: [] };
	});

	// Configure compilation
	mock.compile.mockImplementation(() => {
		if (mockCompilationError) {
			throw mockCompilationError;
		}
		return (
			mockCompilationResult || {
				nodes: Array.from(nodes.keys()),
				edges: edges.map((e) => ({ from: e.from, to: e.to })),
				entryPoint,
				exitPoints,
			}
		);
	});

	mock.reset.mockImplementation(() => {
		nodes.clear();
		edges.length = 0;
		entryPoint = null;
		exitPoints = [];
		stateSchema = null;
	});

	mock.clone.mockImplementation(() => {
		const clone = createGraphConfigDouble();
		// Copy all configuration to the clone
		for (const [_name, node] of nodes) {
			clone.defineNode({ ...node });
		}
		edges.forEach((edge) => clone.defineEdge({ ...edge }));
		if (entryPoint) clone.setEntryPoint(entryPoint);
		if (exitPoints.length > 0) clone.setExitPoints([...exitPoints]);
		if (stateSchema) clone.defineStateSchema(stateSchema);
		return clone;
	});

	const testHelpers: MockGraphConfigHelpers = {
		givenNodeExists: (name: string, action?: GraphNodeAction) => {
			const node: GraphNode = {
				name,
				action: action || (vi.fn() as GraphNodeAction),
			};
			nodes.set(name, node);
		},

		givenEdgeExists: (from: string, to: string) => {
			edges.push({ from, to });
		},

		givenValidationReturns: (valid: boolean, errors: string[] = []) => {
			mockValidationResult = { valid, errors };
		},

		givenCompilationReturns: (result: CompiledGraph) => {
			mockCompilationResult = result;
			mockCompilationError = null;
		},

		givenCompilationFails: (error: Error) => {
			mockCompilationError = error;
			mockCompilationResult = null;
		},

		assertNodeDefined: (name: string) => {
			expect(mock.defineNode).toHaveBeenCalledWith(
				expect.objectContaining({ name }),
			);
		},

		assertEdgeDefined: (from: string, to: string) => {
			expect(mock.defineEdge).toHaveBeenCalledWith(
				expect.objectContaining({ from, to }),
			);
		},

		assertEntryPointSet: (nodeName: string) => {
			expect(mock.setEntryPoint).toHaveBeenCalledWith(nodeName);
		},

		assertExitPointsSet: (nodeNames: string[]) => {
			expect(mock.setExitPoints).toHaveBeenCalledWith(nodeNames);
		},

		assertValidationCalled: () => {
			expect(mock.validateGraph).toHaveBeenCalled();
		},

		assertCompilationCalled: () => {
			expect(mock.compile).toHaveBeenCalled();
		},

		getDefinedNodes: () => Array.from(nodes.keys()),

		getDefinedEdges: () => edges.map((e) => ({ from: e.from, to: e.to })),

		getValidationHistory: () => [...validationHistory],
	};

	return Object.assign(mock, {
		__testHelpers: testHelpers,
	});
}

// Type exports for external use
export type { GraphConfigCapabilities, GraphNode, GraphEdge };
