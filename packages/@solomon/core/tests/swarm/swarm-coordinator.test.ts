/**
 * Swarm Coordinator Test Suite
 * Using TDD London School (mockist) approach
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { when } from 'vitest-when';
import type { StateGraph } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { UnifiedState, HiveMindState } from '../../src/state/unified-state';
import { 
  createSwarmTestDoubles, 
  TestDataFactory,
  type QueenAgentCapabilities,
  type WorkerAgentCapabilities,
  type ConsensusEngineCapabilities,
  type TopologyManagerCapabilities,
} from '../test-doubles';

import { SwarmCoordinator } from '../../src/swarm/swarm-coordinator';

// Import global test helpers
const assertCalledWith = (mock: any, ...args: any[]) => {
  expect(mock).toHaveBeenCalledWith(...args);
};

const assertCalledOnce = (mock: any) => {
  expect(mock).toHaveBeenCalledTimes(1);
};

const assertNeverCalled = (mock: any) => {
  expect(mock).not.toHaveBeenCalled();
};

describe('SwarmCoordinator', () => {
  let coordinator: SwarmCoordinator;
  let testDoubles: ReturnType<typeof createSwarmTestDoubles>;
  let mockStateGraph: StateGraph<HiveMindState>;

  beforeEach(() => {
    // Create fresh test doubles for each test
    testDoubles = createSwarmTestDoubles();
    mockStateGraph = mockDeep<StateGraph<HiveMindState>>();
    
    // Create coordinator with test doubles
    coordinator = new SwarmCoordinator({
      stateGraph: mockStateGraph,
      queenAgent: testDoubles.queenAgent,
      consensusEngine: testDoubles.consensusEngine,
      topologyManager: testDoubles.topologyManager,
      workerAgent: testDoubles.workerAgent,
    });
  });

  afterEach(async () => {
    // Clean up coordinator after each test
    if (coordinator) {
      await coordinator.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize with hierarchical topology by default', () => {
      // Arrange - expectations for initialization
      const expectedTopology = 'hierarchical';
      
      // Act - coordinator is created in beforeEach
      
      // Assert
      expect(testDoubles.topologyManager.setTopology).toHaveBeenCalledWith(expectedTopology);
      expect(coordinator.getTopology()).toBe(expectedTopology);
    });

    it('should register queen agent as primary coordinator', async () => {
      // Arrange
      const queenId = 'queen-001';
      
      // Act
      await coordinator.initialize();
      
      // Assert
      assertCalledOnce(testDoubles.queenAgent.register);
      assertCalledWith(testDoubles.queenAgent.register, { id: queenId, role: 'coordinator' });
    });
  });

  describe('agent spawning', () => {
    it('should spawn worker agents based on task requirements', async () => {
      // Arrange
      const task = TestDataFactory.createTask({
        id: 'task-001',
        description: 'Implement user authentication',
        requiredCapabilities: ['coding', 'testing'],
      });
      
      // Set up test double behavior
      (testDoubles.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 2,
        agentTypes: ['programmer', 'tester'],
      });
      
      // Act
      const agents = await coordinator.spawnAgentsForTask(task);
      
      // Assert
      expect(agents).toHaveLength(2);
      expect(testDoubles.workerAgent.spawn).toHaveBeenCalledTimes(2);
      (testDoubles.workerAgent as any).__testHelpers.assertSpawnedWithType('programmer');
      (testDoubles.workerAgent as any).__testHelpers.assertSpawnedWithType('tester');
    });

    it('should respect maximum agent limits', async () => {
      // Arrange
      const maxAgents = 8;
      const tasks = Array(10).fill(null).map((_, i) => 
        TestDataFactory.createTask({
          id: `task-${i}`,
          description: `Task ${i}`,
        })
      );
      
      // Set up test double to always request 1 agent per task
      (testDoubles.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 1,
        agentTypes: ['worker'],
      });
      
      // Act
      await Promise.all(tasks.map(task => coordinator.spawnAgentsForTask(task)));
      
      // Assert
      expect(coordinator.getActiveAgentCount()).toBeLessThanOrEqual(maxAgents);
    });
  });

  describe('consensus building', () => {
    it('should coordinate consensus for critical decisions', async () => {
      // Arrange
      const decision = TestDataFactory.createDecision({
        type: 'architecture-change',
        proposal: 'Migrate to microservices',
        severity: 'high',
      });
      
      const mockVotes = [
        TestDataFactory.createVote('agent-1', 'approve', 0.9),
        TestDataFactory.createVote('agent-2', 'approve', 0.8),
        TestDataFactory.createVote('agent-3', 'reject', 0.7),
      ];
      
      // Set up test double behavior
      (testDoubles.consensusEngine as any).__testHelpers.givenVotesReturn(mockVotes);
      (testDoubles.consensusEngine as any).__testHelpers.givenConsensusResult({
        result: 'approved',
        confidence: 0.85,
        voteSummary: { approve: 2, reject: 1, abstain: 0 },
        quorumReached: true,
      });
      
      // Act
      const result = await coordinator.buildConsensus(decision);
      
      // Assert
      expect(result.result).toBe('approved');
      expect(result.confidence).toBeGreaterThan(0.8);
      assertCalledOnce(testDoubles.queenAgent.recordDecision);
      (testDoubles.consensusEngine as any).__testHelpers.assertVotesCollectedFor(decision);
    });
  });

  describe('topology management', () => {
    it('should switch topology based on task complexity', async () => {
      // Arrange
      const complexTask = {
        complexity: 'high',
        parallelizable: true,
        agentCount: 5,
      };
      
      // Set up test double behavior
      (testDoubles.topologyManager as any).__testHelpers.givenRecommendationReturns('mesh');
      
      // Act
      await coordinator.optimizeTopologyForTask(complexTask);
      
      // Assert
      assertCalledWith(testDoubles.topologyManager.switchTopology, 'mesh');
      (testDoubles.topologyManager as any).__testHelpers.assertTopologySwitched('mesh');
    });

    it('should handle topology switching failures gracefully', async () => {
      // Arrange
      const error = new Error('Topology switch failed');
      (testDoubles.topologyManager as any).__testHelpers.givenSwitchTopologyFails(error);
      (testDoubles.topologyManager as any).__testHelpers.givenCurrentTopology('hierarchical');
      
      // Act & Assert - should not throw
      await expect(coordinator.setTopology('star')).resolves.toBeUndefined();
      expect(coordinator.getTopology()).toBe('hierarchical'); // Should keep current
    });
  });

  describe('error handling', () => {
    it('should handle agent failures with self-healing', async () => {
      // Arrange
      const failedAgentId = 'worker-003';
      const error = new Error('Agent crashed');
      
      // First spawn an agent so we have one to fail
      const task = TestDataFactory.createTask({ id: 'task-1' });
      (testDoubles.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 1,
        agentTypes: ['worker'],
      });
      await coordinator.spawnAgentsForTask(task);
      
      // Get the spawned worker ID
      const spawnedWorkers = (testDoubles.workerAgent as any).__testHelpers.getSpawnedInstances();
      const workerToFail = spawnedWorkers[0];
      
      // Act
      await coordinator.handleAgentFailure(workerToFail.id, error);
      
      // Assert
      assertCalledWith(testDoubles.queenAgent.recordFailure, workerToFail.id, error);
      expect(testDoubles.workerAgent.spawn).toHaveBeenCalledTimes(2); // Initial + replacement
    });
  });

  describe('state management', () => {
    it('should update hive mind state with swarm metrics', async () => {
      // Arrange
      const task = TestDataFactory.createTask({ id: 'task-1' });
      (testDoubles.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 2,
        agentTypes: ['worker'],
      });
      
      // Act
      await coordinator.spawnAgentsForTask(task);
      const updatedState = coordinator.getState();
      
      // Assert
      expect(updatedState.swarmMetrics?.totalAgents).toBe(3); // 2 workers + 1 queen
      expect(updatedState.swarmMetrics?.activeAgents).toBe(2); // 2 workers
    });
  });
});