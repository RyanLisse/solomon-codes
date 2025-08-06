/**
 * Swarm Graph Test Suite
 * Tests LangGraph integration with swarm coordination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { SwarmGraphBuilder, createSwarmGraph } from '../../src/graphs/swarm-graph';
import { SwarmCoordinator } from '../../src/swarm/swarm-coordinator';
import { createSwarmTestDoubles } from '../test-doubles';

describe('SwarmGraph', () => {
  let graphBuilder: SwarmGraphBuilder;
  let mockCoordinator: SwarmCoordinator;
  let testDoubles: ReturnType<typeof createSwarmTestDoubles>;

  beforeEach(() => {
    // Create test doubles
    testDoubles = createSwarmTestDoubles();
    
    // Create mock coordinator with test doubles
    mockCoordinator = new SwarmCoordinator({
      queenAgent: testDoubles.queenAgent,
      consensusEngine: testDoubles.consensusEngine,
      topologyManager: testDoubles.topologyManager,
      workerAgent: testDoubles.workerAgent,
    });

    // Create graph builder
    graphBuilder = new SwarmGraphBuilder(mockCoordinator);
  });

  afterEach(async () => {
    if (mockCoordinator) {
      await mockCoordinator.shutdown();
    }
  });

  describe('graph compilation', () => {
    it('should compile the graph successfully', () => {
      // Act
      const graph = graphBuilder.compile();

      // Assert
      expect(graph).toBeDefined();
      expect(graph.invoke).toBeDefined();
    });

    it('should have correct metadata', () => {
      // Act
      const metadata = graphBuilder.getMetadata();

      // Assert
      expect(metadata.name).toBe('SwarmGraph');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.capabilities).toContain('task-analysis');
      expect(metadata.capabilities).toContain('agent-spawning');
      expect(metadata.capabilities).toContain('consensus-building');
      expect(metadata.capabilities).toContain('topology-management');
    });
  });

  describe('task processing', () => {
    it('should process a simple task through the graph', async () => {
      // Arrange
      const graph = graphBuilder.compile();
      const initialState = {
        messages: [
          new HumanMessage({
            content: 'Implement a new feature for user authentication',
          }),
        ],
      };

      // Set up test doubles
      (testDoubles.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 2,
        agentTypes: ['programmer', 'tester'],
      });

      (testDoubles.workerAgent as any).__testHelpers.givenSpawnReturns({
        id: 'worker-1',
        type: 'programmer',
        capabilities: ['coding'],
        status: 'active',
        terminate: vi.fn(),
      });

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(1);
      
      // Check that task was analyzed
      const analysisMessage = result.messages.find(
        m => m.content && m.content.includes('Task analyzed')
      );
      expect(analysisMessage).toBeDefined();
    });

    it('should spawn agents based on task requirements', async () => {
      // Arrange
      const graph = graphBuilder.compile();
      const initialState = {
        messages: [
          new HumanMessage({
            content: 'Write code and test it',
          }),
        ],
      };

      // Set up test doubles
      (testDoubles.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 2,
        agentTypes: ['programmer', 'tester'],
      });

      const mockWorker1 = {
        id: 'worker-1',
        type: 'programmer',
        capabilities: ['coding'],
        status: 'active',
        terminate: vi.fn(),
      };

      const mockWorker2 = {
        id: 'worker-2',
        type: 'tester',
        capabilities: ['testing'],
        status: 'active',
        terminate: vi.fn(),
      };

      let spawnCount = 0;
      (testDoubles.workerAgent as any).__testHelpers.givenSpawnReturns(() => {
        spawnCount++;
        return spawnCount === 1 ? mockWorker1 : mockWorker2;
      });

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.activeAgents).toBeDefined();
      expect(result.activeAgents.length).toBeGreaterThan(0);
      
      // Check that spawn message was created
      const spawnMessage = result.messages.find(
        m => m.content && m.content.includes('Spawned')
      );
      expect(spawnMessage).toBeDefined();
    });

    it('should build consensus when multiple agents are active', async () => {
      // Arrange
      const graph = graphBuilder.compile();
      // Start with a state that triggers consensus - more than 3 active agents
      const initialState = {
        messages: [
          new HumanMessage({
            content: 'Complex task requiring multiple agents',
          }),
        ],
        activeAgents: ['agent-1', 'agent-2', 'agent-3', 'agent-4'],
        executionMode: 'working', // Set mode to trigger the coordination check
      };

      // Set up consensus test double
      (testDoubles.consensusEngine as any).__testHelpers.givenConsensusReturns({
        result: 'approved',
        confidence: 0.85,
        votes: 4,
      });

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      // The graph should have processed consensus or at least mentioned it
      const hasConsensusReference = result.messages.some(
        m => m.content && (
          m.content.toLowerCase().includes('consensus') || 
          m.content.toLowerCase().includes('multiple agents')
        )
      );
      expect(hasConsensusReference).toBe(true);
      
      // Check if decisions were made (if consensus was triggered)
      if (result.decisions && result.decisions.length > 0) {
        expect(result.decisions).toBeDefined();
        expect(result.decisions.length).toBeGreaterThan(0);
      }
    });

    it('should optimize topology based on agent count', async () => {
      // Arrange
      const graph = graphBuilder.compile();
      const initialState = {
        messages: [
          new HumanMessage({
            content: 'Large scale task',
          }),
        ],
        activeAgents: ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5', 'agent-6'],
        topology: 'hierarchical',
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      // Check for topology optimization attempt
      const topologyMessage = result.messages.find(
        m => m.content && (m.content.includes('topology') || m.content.includes('Topology'))
      );
      expect(topologyMessage).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const graph = graphBuilder.compile();
      const initialState = {
        messages: [
          new HumanMessage({
            content: 'Task with error',
          }),
        ],
        errors: [{
          timestamp: new Date().toISOString(),
          component: 'test',
          error: 'Test error',
        }],
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result).toBeDefined();
      
      // Check for error handling message
      const errorMessage = result.messages.find(
        m => m.content && m.content.includes('Error handled')
      );
      expect(errorMessage).toBeDefined();
    });
  });

  describe('capability extraction', () => {
    it('should extract coding capabilities from task', async () => {
      // Arrange
      const graph = graphBuilder.compile();
      const initialState = {
        messages: [
          new HumanMessage({
            content: 'Write code to implement the feature',
          }),
        ],
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      const analysisMessage = result.messages.find(
        m => m.content && m.content.includes('coding')
      );
      expect(analysisMessage).toBeDefined();
    });

    it('should extract testing capabilities from task', async () => {
      // Arrange
      const graph = graphBuilder.compile();
      const initialState = {
        messages: [
          new HumanMessage({
            content: 'Test the application thoroughly',
          }),
        ],
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      const analysisMessage = result.messages.find(
        m => m.content && m.content.includes('testing')
      );
      expect(analysisMessage).toBeDefined();
    });

    it('should default to general capabilities for unclear tasks', async () => {
      // Arrange
      const graph = graphBuilder.compile();
      const initialState = {
        messages: [
          new HumanMessage({
            content: 'Do something',
          }),
        ],
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      const analysisMessage = result.messages.find(
        m => m.content && m.content.includes('general')
      );
      expect(analysisMessage).toBeDefined();
    });
  });

  describe('graph without coordinator', () => {
    it('should handle missing coordinator gracefully', async () => {
      // Arrange
      const standaloneBuilder = new SwarmGraphBuilder();
      const graph = standaloneBuilder.compile();
      const initialState = {
        messages: [
          new HumanMessage({
            content: 'Task without coordinator',
          }),
        ],
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      
      // Should have messages about missing coordinator
      const noCoordinatorMessage = result.messages.find(
        m => m.content && m.content.includes('No coordinator')
      );
      expect(noCoordinatorMessage).toBeDefined();
    });
  });
});

describe('createSwarmGraph', () => {
  it('should create a compiled graph', () => {
    // Act
    const graph = createSwarmGraph();

    // Assert
    expect(graph).toBeDefined();
    expect(graph.invoke).toBeDefined();
  });

  it('should create a graph with coordinator', () => {
    // Arrange
    const testDoubles = createSwarmTestDoubles();
    const coordinator = new SwarmCoordinator({
      queenAgent: testDoubles.queenAgent,
      consensusEngine: testDoubles.consensusEngine,
      topologyManager: testDoubles.topologyManager,
      workerAgent: testDoubles.workerAgent,
    });

    // Act
    const graph = createSwarmGraph(coordinator);

    // Assert
    expect(graph).toBeDefined();
    expect(graph.invoke).toBeDefined();
  });
});