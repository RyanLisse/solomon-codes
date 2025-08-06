/**
 * Base graph configuration for all LangGraph agents
 * Provides common functionality and patterns
 */

import { StateGraph, StateGraphArgs } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { z } from "zod";
import { BaseState, addError } from "../state/unified-state";

// Graph metadata for tracking
export interface GraphMetadata {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  requiredTools: string[];
}

// Node function type
export type NodeFunction<TState> = (
  state: TState,
  config?: any,
) => Promise<Partial<TState>>;

// Edge function type
export type EdgeFunction<TState> = (
  state: TState,
) => string | string[] | undefined;

// Base graph builder
export class BaseGraphBuilder<TState extends BaseState> {
  protected graph: StateGraph<TState>;
  protected metadata: GraphMetadata;
  protected nodes: Map<string, NodeFunction<TState>> = new Map();
  protected edges: Map<string, EdgeFunction<TState>> = new Map();

  constructor(stateSchema: z.ZodType<TState>, metadata: GraphMetadata) {
    // Create state graph with schema validation
    const graphArgs: StateGraphArgs<TState> = {
      channels: stateSchema as any,
    };

    this.graph = new StateGraph<TState>(graphArgs);
    this.metadata = metadata;

    // Add default error handling node
    this.addNode("handle_error", this.handleError.bind(this));
  }

  /**
   * Add a node to the graph
   */
  addNode(name: string, fn: NodeFunction<TState>): this {
    // Wrap node function with error handling
    const wrappedFn = async (
      state: TState,
      config?: any,
    ): Promise<Partial<TState>> => {
      try {
        console.log(`[${this.metadata.name}] Executing node: ${name}`);
        const result = await fn(state, config);
        return result;
      } catch (error) {
        console.error(`[${this.metadata.name}] Error in node ${name}:`, error);
        // Add error to state and route to error handler
        const errorState = addError(
          state,
          this.metadata.name,
          error instanceof Error ? error.message : String(error),
          { node: name },
        ) as TState;
        return { ...errorState, _nextNode: "handle_error" } as Partial<TState>;
      }
    };

    this.nodes.set(name, wrappedFn);
    this.graph.addNode(name, wrappedFn);
    return this;
  }

  /**
   * Add an edge between nodes
   */
  addEdge(from: string, to: string): this {
    this.graph.addEdge(from, to);
    return this;
  }

  /**
   * Add a conditional edge
   */
  addConditionalEdge(
    from: string,
    condition: EdgeFunction<TState>,
    edges: Record<string, string>,
  ): this {
    this.edges.set(from, condition);
    this.graph.addConditionalEdges(from, condition, edges);
    return this;
  }

  /**
   * Set the entry point
   */
  setEntryPoint(node: string): this {
    this.graph.setEntryPoint(node);
    return this;
  }

  /**
   * Set the finish point
   */
  setFinishPoint(node: string): this {
    this.graph.setFinishPoint(node);
    return this;
  }

  /**
   * Default error handler
   */
  protected async handleError(state: TState): Promise<Partial<TState>> {
    const lastError = state.errors[state.errors.length - 1];
    console.error(
      `[${this.metadata.name}] Handling error:`,
      lastError?.error || "Unknown error",
    );

    // Check if we should retry or fail
    if (state.iterations < state.maxIterations) {
      return {
        iterations: state.iterations + 1,
        humanInteractionRequired: true,
        humanFeedback: `Error occurred: ${lastError?.error}. Please provide guidance.`,
      } as Partial<TState>;
    }

    // Max iterations reached, fail gracefully
    return {
      executionMode: "reviewing" as any,
      humanInteractionRequired: true,
    } as Partial<TState>;
  }

  /**
   * Add interrupt capabilities for human-in-the-loop
   */
  addInterruptBefore(nodes: string[]): this {
    // This will be used with Agent Inbox
    nodes.forEach((node) => {
      console.log(`[${this.metadata.name}] Adding interrupt before: ${node}`);
    });
    return this;
  }

  /**
   * Add checkpointing for state persistence
   */
  enableCheckpointing(): this {
    console.log(`[${this.metadata.name}] Checkpointing enabled`);
    return this;
  }

  /**
   * Compile the graph
   */
  compile(): Runnable<TState, Partial<TState>> {
    console.log(`[${this.metadata.name}] Compiling graph...`);

    // Log graph structure for debugging
    console.log(`Nodes: ${Array.from(this.nodes.keys()).join(", ")}`);
    console.log(
      `Conditional edges: ${Array.from(this.edges.keys()).join(", ")}`,
    );

    return this.graph.compile();
  }

  /**
   * Get graph metadata
   */
  getMetadata(): GraphMetadata {
    return this.metadata;
  }

  /**
   * Export graph configuration
   */
  exportConfig(): object {
    return {
      metadata: this.metadata,
      nodes: Array.from(this.nodes.keys()),
      edges: Array.from(this.edges.keys()),
    };
  }
}

// Common node factories
export class CommonNodes {
  /**
   * Create a planning node
   */
  static createPlanningNode<TState extends BaseState>(): NodeFunction<TState> {
    return async (state: TState): Promise<Partial<TState>> => {
      console.log("Executing planning logic...");

      // Planning logic will be implemented by specific graphs
      return {
        executionMode: "coding" as any,
        messages: [
          ...state.messages,
          {
            role: "assistant",
            content: "Planning phase completed. Moving to implementation.",
          } as BaseMessage,
        ],
      } as Partial<TState>;
    };
  }

  /**
   * Create a validation node
   */
  static createValidationNode<
    TState extends BaseState,
  >(): NodeFunction<TState> {
    return async (state: TState): Promise<Partial<TState>> => {
      console.log("Executing validation logic...");

      // Check if human approval is needed
      if (state.humanInteractionRequired) {
        return {
          approvalStatus: "pending" as any,
        } as Partial<TState>;
      }

      return {
        approvalStatus: "approved" as any,
        executionMode: "testing" as any,
      } as Partial<TState>;
    };
  }

  /**
   * Create a routing node
   */
  static createRoutingNode<TState extends BaseState>(
    routingMap: Record<string, string>,
  ): EdgeFunction<TState> {
    return (state: TState): string => {
      // Route based on execution mode
      const mode = state.executionMode || "planning";
      return routingMap[mode] || "handle_error";
    };
  }
}

// Graph utilities
export class GraphUtils {
  /**
   * Merge multiple graphs into a unified graph
   */
  static mergeGraphs<TState extends BaseState>(
    graphs: BaseGraphBuilder<TState>[],
  ): BaseGraphBuilder<TState> {
    // This will be implemented to support multi-agent coordination
    throw new Error("Graph merging not yet implemented");
  }

  /**
   * Create a subgraph for spawning
   */
  static createSubgraph<TState extends BaseState>(
    parent: BaseGraphBuilder<TState>,
    name: string,
  ): BaseGraphBuilder<TState> {
    // This will support DeepAgents-style sub-agent spawning
    throw new Error("Subgraph creation not yet implemented");
  }
}
