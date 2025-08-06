/**
 * Swarm Graph Configuration
 * Main LangGraph implementation for swarm coordination
 */

import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { UnifiedStateSchema, HiveMindStateSchema, type HiveMindState } from "../state/unified-state";
import { BaseGraphBuilder, GraphMetadata, NodeFunction, EdgeFunction } from "./base-graph";
import type { SwarmCoordinator } from "../swarm/swarm-coordinator";

/**
 * Swarm Graph State with LangGraph annotations
 */
const SwarmGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  currentTask: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  activeAgents: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  consensusRequired: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  topology: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "hierarchical",
  }),
  executionMode: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "planning",
  }),
  swarmMetrics: Annotation<{
    totalAgents: number;
    activeAgents: number;
    taskCompletionRate: number;
    averageResponseTime: number;
  }>({
    reducer: (_, next) => next,
    default: () => ({
      totalAgents: 0,
      activeAgents: 0,
      taskCompletionRate: 0,
      averageResponseTime: 0,
    }),
  }),
  decisions: Annotation<Array<{
    id: string;
    decision: any;
    consensus: any;
    timestamp: string;
  }>>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  errors: Annotation<Array<{
    timestamp: string;
    component: string;
    error: string;
    context?: any;
  }>>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
});

export type SwarmGraphStateType = typeof SwarmGraphState.State;

/**
 * Swarm Graph Builder
 * Implements the main swarm coordination graph
 */
export class SwarmGraphBuilder {
  private graph: StateGraph<SwarmGraphStateType>;
  private coordinator?: SwarmCoordinator;
  private metadata: GraphMetadata;

  constructor(coordinator?: SwarmCoordinator) {
    this.coordinator = coordinator;
    this.metadata = {
      name: "SwarmGraph",
      version: "1.0.0",
      description: "Main swarm coordination graph with LangGraph",
      capabilities: ["task-analysis", "agent-spawning", "consensus-building", "topology-management"],
      requiredTools: ["queenAgent", "workerAgent", "consensusEngine", "topologyManager"],
    };

    // Initialize the state graph
    this.graph = new StateGraph(SwarmGraphState);

    // Build the graph structure
    this.buildGraph();
  }

  /**
   * Build the swarm coordination graph
   */
  private buildGraph(): void {
    // Add nodes
    this.graph.addNode("analyze_task", this.analyzeTask.bind(this));
    this.graph.addNode("spawn_agents", this.spawnAgents.bind(this));
    this.graph.addNode("coordinate_work", this.coordinateWork.bind(this));
    this.graph.addNode("build_consensus", this.buildConsensus.bind(this));
    this.graph.addNode("optimize_topology", this.optimizeTopology.bind(this));
    this.graph.addNode("synthesize_results", this.synthesizeResults.bind(this));
    this.graph.addNode("handle_error", this.handleError.bind(this));

    // Set entry point
    this.graph.setEntryPoint("analyze_task");

    // Add edges
    this.graph.addEdge("analyze_task", "spawn_agents");
    this.graph.addEdge("spawn_agents", "coordinate_work");
    
    // Add conditional edges
    this.graph.addConditionalEdges(
      "coordinate_work",
      this.routeFromCoordination.bind(this),
      {
        consensus: "build_consensus",
        optimize: "optimize_topology",
        complete: "synthesize_results",
        error: "handle_error",
      }
    );

    this.graph.addEdge("build_consensus", "coordinate_work");
    this.graph.addEdge("optimize_topology", "coordinate_work");
    this.graph.addEdge("synthesize_results", END);
    this.graph.addEdge("handle_error", "coordinate_work");
  }

  /**
   * Analyze incoming task
   */
  private async analyzeTask(state: SwarmGraphStateType): Promise<Partial<SwarmGraphStateType>> {
    console.log("[SwarmGraph] Analyzing task...");
    
    const lastMessage = state.messages[state.messages.length - 1];
    const taskDescription = lastMessage?.content || "";

    // Extract task from message
    const task = {
      id: `task-${Date.now()}`,
      description: typeof taskDescription === 'string' ? taskDescription : JSON.stringify(taskDescription),
      priority: "normal",
      requiredCapabilities: this.extractRequiredCapabilities(taskDescription),
    };

    return {
      currentTask: task.id,
      messages: [
        new AIMessage({
          content: `Task analyzed: ${task.description}. Required capabilities: ${task.requiredCapabilities.join(", ")}`,
        }),
      ],
    };
  }

  /**
   * Spawn agents for the task
   */
  private async spawnAgents(state: SwarmGraphStateType): Promise<Partial<SwarmGraphStateType>> {
    console.log("[SwarmGraph] Spawning agents...");

    if (!this.coordinator) {
      return {
        messages: [
          new AIMessage({
            content: "No coordinator available for agent spawning.",
          }),
        ],
      };
    }

    // Use coordinator to spawn agents
    const task = {
      id: state.currentTask || "unknown",
      description: state.messages[state.messages.length - 1]?.content || "",
      requiredCapabilities: [],
    };

    const agents = await this.coordinator.spawnAgentsForTask(task);
    const agentIds = agents.map(a => a.id);

    return {
      activeAgents: agentIds,
      messages: [
        new AIMessage({
          content: `Spawned ${agents.length} agents: ${agentIds.join(", ")}`,
        }),
      ],
      swarmMetrics: {
        totalAgents: agentIds.length + 1, // +1 for queen
        activeAgents: agentIds.length,
        taskCompletionRate: 0,
        averageResponseTime: 0,
      },
    };
  }

  /**
   * Coordinate work among agents
   */
  private async coordinateWork(state: SwarmGraphStateType): Promise<Partial<SwarmGraphStateType>> {
    console.log("[SwarmGraph] Coordinating work...");

    // Simulate work coordination
    const workComplete = state.messages.length > 3; // Simple completion check

    if (workComplete) {
      return {
        executionMode: "complete",
        messages: [
          new AIMessage({
            content: "Work coordination completed successfully.",
          }),
        ],
      };
    }

    // Check if consensus is needed
    if (state.activeAgents.length > 3) {
      return {
        consensusRequired: true,
        executionMode: "consensus",
        messages: [
          new AIMessage({
            content: "Multiple agents active. Building consensus...",
          }),
        ],
      };
    }

    return {
      executionMode: "working",
      messages: [
        new AIMessage({
          content: "Continuing work coordination...",
        }),
      ],
    };
  }

  /**
   * Build consensus among agents
   */
  private async buildConsensus(state: SwarmGraphStateType): Promise<Partial<SwarmGraphStateType>> {
    console.log("[SwarmGraph] Building consensus...");

    if (!this.coordinator) {
      return {
        consensusRequired: false,
        messages: [
          new AIMessage({
            content: "No coordinator available for consensus building.",
          }),
        ],
      };
    }

    const decision = {
      type: "task-approach",
      proposal: "Continue with current strategy",
      severity: "medium",
    };

    const consensus = await this.coordinator.buildConsensus(decision);

    return {
      consensusRequired: false,
      decisions: [{
        id: `decision-${Date.now()}`,
        decision,
        consensus,
        timestamp: new Date().toISOString(),
      }],
      messages: [
        new AIMessage({
          content: `Consensus reached: ${consensus.result}`,
        }),
      ],
    };
  }

  /**
   * Optimize swarm topology
   */
  private async optimizeTopology(state: SwarmGraphStateType): Promise<Partial<SwarmGraphStateType>> {
    console.log("[SwarmGraph] Optimizing topology...");

    if (!this.coordinator) {
      return {
        messages: [
          new AIMessage({
            content: "No coordinator available for topology optimization.",
          }),
        ],
      };
    }

    // Determine optimal topology based on task
    const currentTopology = state.topology;
    const optimalTopology = state.activeAgents.length > 5 ? "mesh" : "hierarchical";

    if (currentTopology !== optimalTopology) {
      await this.coordinator.setTopology(optimalTopology as any);
      
      return {
        topology: optimalTopology,
        messages: [
          new AIMessage({
            content: `Topology optimized from ${currentTopology} to ${optimalTopology}`,
          }),
        ],
      };
    }

    return {
      messages: [
        new AIMessage({
          content: "Current topology is already optimal.",
        }),
      ],
    };
  }

  /**
   * Synthesize results from all agents
   */
  private async synthesizeResults(state: SwarmGraphStateType): Promise<Partial<SwarmGraphStateType>> {
    console.log("[SwarmGraph] Synthesizing results...");

    const summary = `
Task completed successfully.
- Active agents: ${state.activeAgents.length}
- Topology: ${state.topology}
- Decisions made: ${state.decisions.length}
- Errors encountered: ${state.errors.length}
    `.trim();

    return {
      messages: [
        new AIMessage({
          content: summary,
        }),
      ],
      swarmMetrics: {
        ...state.swarmMetrics,
        taskCompletionRate: 1.0,
      },
    };
  }

  /**
   * Handle errors in the graph
   */
  private async handleError(state: SwarmGraphStateType): Promise<Partial<SwarmGraphStateType>> {
    console.log("[SwarmGraph] Handling error...");
    
    const lastError = state.errors[state.errors.length - 1];
    
    return {
      messages: [
        new AIMessage({
          content: `Error handled: ${lastError?.error || "Unknown error"}. Resuming coordination...`,
        }),
      ],
    };
  }

  /**
   * Route from coordination node
   */
  private routeFromCoordination(state: SwarmGraphStateType): string {
    if (state.executionMode === "complete") {
      return "complete";
    }
    
    if (state.consensusRequired) {
      return "consensus";
    }
    
    if (state.errors.length > 0) {
      return "error";
    }
    
    // Check if topology optimization is needed
    const agentCount = state.activeAgents.length;
    if (agentCount > 5 && state.topology === "hierarchical") {
      return "optimize";
    }
    
    return "complete";
  }

  /**
   * Extract required capabilities from task description
   */
  private extractRequiredCapabilities(description: any): string[] {
    const text = typeof description === 'string' ? description : JSON.stringify(description);
    const capabilities: string[] = [];
    
    // Simple keyword-based extraction
    if (text.toLowerCase().includes("code") || text.toLowerCase().includes("implement")) {
      capabilities.push("coding");
    }
    if (text.toLowerCase().includes("test")) {
      capabilities.push("testing");
    }
    if (text.toLowerCase().includes("review")) {
      capabilities.push("reviewing");
    }
    if (text.toLowerCase().includes("plan") || text.toLowerCase().includes("design")) {
      capabilities.push("planning");
    }
    
    return capabilities.length > 0 ? capabilities : ["general"];
  }

  /**
   * Compile the graph
   */
  compile() {
    console.log("[SwarmGraph] Compiling graph...");
    return this.graph.compile();
  }

  /**
   * Get metadata
   */
  getMetadata(): GraphMetadata {
    return this.metadata;
  }
}

/**
 * Create and configure the main swarm graph
 */
export function createSwarmGraph(coordinator?: SwarmCoordinator) {
  const builder = new SwarmGraphBuilder(coordinator);
  return builder.compile();
}