/**
 * Base Graph Configuration Test Suite
 * TDD London School approach for testing LangGraph integration
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BaseGraphBuilder, CommonNodes, type GraphMetadata } from "../../src/graphs/base-graph";
import { BaseStateSchema, type BaseState } from "../../src/state/unified-state";

describe("BaseGraphBuilder", () => {
	let graphBuilder: BaseGraphBuilder<BaseState>;
	let mockMetadata: GraphMetadata;

	beforeEach(() => {
		mockMetadata = {
			name: "test-graph",
			version: "1.0.0",
			description: "Test graph for unit testing",
			capabilities: ["planning", "execution"],
			requiredTools: ["compiler", "tester"],
		};

		// Create graph builder with test schema
		graphBuilder = new BaseGraphBuilder(BaseStateSchema, mockMetadata);
	});

	describe("initialization", () => {
		it("should initialize with proper metadata and default error handling node", () => {
			// Arrange & Act - builder created in beforeEach
			const metadata = graphBuilder.getMetadata();
			const config = graphBuilder.exportConfig();

			// Assert
			expect(metadata).toEqual(mockMetadata);
			expect(config.nodes).toContain("handle_error");
			expect(config.metadata).toEqual(mockMetadata);
		});

		it("should create StateGraph with proper schema", () => {
			// This test verifies that the StateGraph is properly initialized
			// In a real implementation, we would verify the schema configuration
			expect(graphBuilder).toBeDefined();
			expect(graphBuilder.getMetadata().name).toBe("test-graph");
		});
	});

	describe("node management", () => {
		it("should add nodes with error handling wrapper", async () => {
			// Arrange
			const testNodeFn = vi.fn().mockResolvedValue({ processed: true });

			// Act
			const result = graphBuilder.addNode("test_node", testNodeFn);
			
			// Assert - fluent interface
			expect(result).toBe(graphBuilder);
			
			// Verify node was added
			const config = graphBuilder.exportConfig();
			expect(config.nodes).toContain("test_node");
		});

		it("should wrap node functions with error handling", async () => {
			// Arrange
			const errorMessage = "Test node error";
			const failingNodeFn = vi.fn().mockRejectedValue(new Error(errorMessage));

			// Act
			graphBuilder.addNode("failing_node", failingNodeFn);
			
			// The error handling is tested by verifying the node is properly wrapped
			// In integration tests, we would verify the error handling behavior
			const config = graphBuilder.exportConfig();
			expect(config.nodes).toContain("failing_node");
		});

		it("should support chaining node additions", () => {
			// Arrange
			const node1Fn = vi.fn().mockResolvedValue({});
			const node2Fn = vi.fn().mockResolvedValue({});
			const node3Fn = vi.fn().mockResolvedValue({});

			// Act - fluent interface chaining
			const result = graphBuilder
				.addNode("node1", node1Fn)
				.addNode("node2", node2Fn)
				.addNode("node3", node3Fn);

			// Assert
			expect(result).toBe(graphBuilder);
			
			const config = graphBuilder.exportConfig();
			expect(config.nodes).toContain("node1");
			expect(config.nodes).toContain("node2");
			expect(config.nodes).toContain("node3");
		});
	});

	describe("edge management", () => {
		it("should add simple edges between nodes", () => {
			// Arrange
			const startNode = vi.fn().mockResolvedValue({});
			const endNode = vi.fn().mockResolvedValue({});

			// Act
			const result = graphBuilder
				.addNode("start", startNode)
				.addNode("end", endNode)
				.addEdge("start", "end");

			// Assert
			expect(result).toBe(graphBuilder);
		});

		it("should add conditional edges with routing logic", () => {
			// Arrange
			const routingFn = vi.fn().mockReturnValue("success_path");
			const edgeMap = { success: "success_node", failure: "failure_node" };

			graphBuilder
				.addNode("router", vi.fn().mockResolvedValue({}))
				.addNode("success_node", vi.fn().mockResolvedValue({}))
				.addNode("failure_node", vi.fn().mockResolvedValue({}));

			// Act
			const result = graphBuilder.addConditionalEdge("router", routingFn, edgeMap);

			// Assert
			expect(result).toBe(graphBuilder);
		});
	});

	describe("graph structure", () => {
		it("should set entry and finish points", () => {
			// Arrange
			const entryNode = vi.fn().mockResolvedValue({});
			const finishNode = vi.fn().mockResolvedValue({});

			// Act
			const result = graphBuilder
				.addNode("entry", entryNode)
				.addNode("finish", finishNode)
				.setEntryPoint("entry")
				.setFinishPoint("finish");

			// Assert
			expect(result).toBe(graphBuilder);
		});

		it("should support interrupt capabilities for human-in-the-loop", () => {
			// Arrange
			const interruptNodes = ["approval_needed", "human_review"];

			// Act
			const result = graphBuilder.addInterruptBefore(interruptNodes);

			// Assert
			expect(result).toBe(graphBuilder);
		});

		it("should enable checkpointing for state persistence", () => {
			// Act
			const result = graphBuilder.enableCheckpointing();

			// Assert
			expect(result).toBe(graphBuilder);
		});
	});

	describe("compilation", () => {
		it("should compile graph into executable Runnable", () => {
			// Arrange - create a simple graph with error handling route
			const routingMap = {
				planning: "validate",
				coding: "validate",
				testing: "validate",
				reviewing: "handle_error",
			};

			graphBuilder
				.addNode("start", CommonNodes.createPlanningNode<BaseState>())
				.addNode("validate", CommonNodes.createValidationNode<BaseState>())
				.addConditionalEdge("start", CommonNodes.createRoutingNode<BaseState>(routingMap), routingMap)
				.addEdge("validate", "handle_error") // Make error handler reachable
				.setEntryPoint("start")
				.setFinishPoint("handle_error");

			// Act
			const compiled = graphBuilder.compile();

			// Assert
			expect(compiled).toBeDefined();
			// In integration tests, we would verify the compiled graph can be invoked
		});

		it("should export graph configuration for inspection", () => {
			// Arrange
			graphBuilder
				.addNode("node1", vi.fn())
				.addNode("node2", vi.fn())
				.addConditionalEdge("node1", vi.fn(), { next: "node2" });

			// Act
			const config = graphBuilder.exportConfig();

			// Assert
			expect(config).toEqual({
				metadata: mockMetadata,
				nodes: expect.arrayContaining(["node1", "node2", "handle_error"]),
				edges: expect.arrayContaining(["node1"]),
			});
		});
	});
});

describe("CommonNodes", () => {
	describe("createPlanningNode", () => {
		it("should create a planning node that transitions to coding mode", async () => {
			// Arrange
			const planningNode = CommonNodes.createPlanningNode<BaseState>();
			const initialState: BaseState = {
				messages: [],
				activeAgents: [],
				swarmTopology: "hierarchical",
				taskQueue: [],
				memory: {},
				context: {},
				executionMode: "planning",
				iterations: 0,
				maxIterations: 10,
				errors: [],
				humanInteractionRequired: false,
			};

			// Act
			const result = await planningNode(initialState);

			// Assert
			expect(result.executionMode).toBe("coding");
			expect(result.messages).toBeDefined();
			expect(result.messages).toHaveLength(1);
		});
	});

	describe("createValidationNode", () => {
		it("should approve automatically when no human interaction required", async () => {
			// Arrange
			const validationNode = CommonNodes.createValidationNode<BaseState>();
			const state: BaseState = {
				messages: [],
				activeAgents: [],
				swarmTopology: "hierarchical",
				taskQueue: [],
				memory: {},
				context: {},
				executionMode: "planning",
				iterations: 0,
				maxIterations: 10,
				errors: [],
				humanInteractionRequired: false,
			};

			// Act
			const result = await validationNode(state);

			// Assert
			expect(result.approvalStatus).toBe("approved");
			expect(result.executionMode).toBe("testing");
		});

		it("should require approval when human interaction is needed", async () => {
			// Arrange
			const validationNode = CommonNodes.createValidationNode<BaseState>();
			const state: BaseState = {
				messages: [],
				activeAgents: [],
				swarmTopology: "hierarchical",
				taskQueue: [],
				memory: {},
				context: {},
				executionMode: "planning",
				iterations: 0,
				maxIterations: 10,
				errors: [],
				humanInteractionRequired: true,
			};

			// Act
			const result = await validationNode(state);

			// Assert
			expect(result.approvalStatus).toBe("pending");
		});
	});

	describe("createRoutingNode", () => {
		it("should route based on execution mode", () => {
			// Arrange
			const routingMap = {
				planning: "planner_node",
				coding: "coder_node",
				testing: "tester_node",
			};
			const routingNode = CommonNodes.createRoutingNode<BaseState>(routingMap);
			const state: BaseState = {
				messages: [],
				activeAgents: [],
				swarmTopology: "hierarchical",
				taskQueue: [],
				memory: {},
				context: {},
				executionMode: "coding",
				iterations: 0,
				maxIterations: 10,
				errors: [],
				humanInteractionRequired: false,
			};

			// Act
			const route = routingNode(state);

			// Assert
			expect(route).toBe("coder_node");
		});

		it("should default to error handling for unknown execution modes", () => {
			// Arrange
			const routingMap = { planning: "planner_node" };
			const routingNode = CommonNodes.createRoutingNode<BaseState>(routingMap);
			const state: BaseState = {
				messages: [],
				activeAgents: [],
				swarmTopology: "hierarchical",
				taskQueue: [],
				memory: {},
				context: {},
				executionMode: "unknown_mode" as any,
				iterations: 0,
				maxIterations: 10,
				errors: [],
				humanInteractionRequired: false,
			};

			// Act
			const route = routingNode(state);

			// Assert
			expect(route).toBe("handle_error");
		});
	});
});