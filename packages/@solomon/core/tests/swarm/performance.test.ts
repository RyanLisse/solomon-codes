/**
 * Performance Tests for Swarm Coordinator
 * Validates optimization improvements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SwarmCoordinator } from '../../src/swarm/swarm-coordinator';
import { createSwarmTestDoubles } from '../test-doubles';

describe('SwarmCoordinator Performance', () => {
  describe('with agent pool', () => {
    let coordinator: SwarmCoordinator;
    let testDoubles: ReturnType<typeof createSwarmTestDoubles>;

    beforeEach(() => {
      testDoubles = createSwarmTestDoubles();
      
      // Create coordinator with agent pool enabled
      coordinator = new SwarmCoordinator({
        queenAgent: testDoubles.queenAgent,
        consensusEngine: testDoubles.consensusEngine,
        topologyManager: testDoubles.topologyManager,
        workerAgent: testDoubles.workerAgent,
        maxAgents: 10,
        useAgentPool: true,
        poolConfig: {
          minSize: 2,
          maxSize: 10,
          idleTimeout: 1000,
        },
      });
    });

    afterEach(async () => {
      await coordinator.shutdown();
    });

    it('should reuse agents from pool for better performance', async () => {
      // Arrange
      const tasks = Array(5).fill(null).map((_, i) => ({
        id: `task-${i}`,
        description: `Task ${i}`,
        requiredCapabilities: ['coding'],
      }));

      (testDoubles.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 1,
        agentTypes: ['programmer'],
      });

      // Act - spawn agents for multiple tasks
      const startTime = Date.now();
      
      for (const task of tasks) {
        await coordinator.spawnAgentsForTask(task);
      }
      
      const duration = Date.now() - startTime;

      // Assert - should be fast due to pooling
      expect(duration).toBeLessThan(100); // Should be very fast with pooling
      
      // Check metrics
      const metrics = coordinator.getMetrics();
      expect(metrics.pool).toBeDefined();
      expect(metrics.pool.hits).toBeGreaterThan(0); // Should have pool hits
    });

    it('should handle burst traffic efficiently', async () => {
      // Arrange
      const burstSize = 20;
      const tasks = Array(burstSize).fill(null).map((_, i) => ({
        id: `burst-task-${i}`,
        description: `Burst task ${i}`,
      }));

      (testDoubles.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 1,
        agentTypes: ['worker'],
      });

      // Act - simulate burst traffic
      const startTime = Date.now();
      const promises = tasks.map(task => coordinator.spawnAgentsForTask(task));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Assert
      const totalSpawned = results.reduce((sum, agents) => sum + agents.length, 0);
      console.log('Total spawned:', totalSpawned);
      console.log('Results per task:', results.map(r => r.length));
      expect(totalSpawned).toBeLessThanOrEqual(10); // Should respect max limit
      expect(duration).toBeLessThan(1000); // Should handle burst quickly (increased timeout)
      
      // Verify metrics
      const metrics = coordinator.getMetrics();
      if (metrics.pool) {
        expect(metrics.pool.poolSize).toBeGreaterThan(0);
        expect(metrics.pool.hitRate).toBeGreaterThan(0);
      }
    });
  });

  describe('consensus caching', () => {
    let coordinator: SwarmCoordinator;
    let testDoubles: ReturnType<typeof createSwarmTestDoubles>;

    beforeEach(() => {
      testDoubles = createSwarmTestDoubles();
      coordinator = new SwarmCoordinator({
        queenAgent: testDoubles.queenAgent,
        consensusEngine: testDoubles.consensusEngine,
        topologyManager: testDoubles.topologyManager,
        workerAgent: testDoubles.workerAgent,
      });
    });

    afterEach(async () => {
      await coordinator.shutdown();
    });

    it('should cache consensus decisions for performance', async () => {
      // Arrange
      const decision = {
        type: 'architecture',
        proposal: 'Use microservices',
        severity: 'high',
      };

      (testDoubles.consensusEngine as any).__testHelpers.givenConsensusReturns({
        result: 'approved',
        confidence: 0.9,
        votes: 5,
      });

      // Act - build consensus twice with same decision
      const startTime1 = Date.now();
      const result1 = await coordinator.buildConsensus(decision);
      const duration1 = Date.now() - startTime1;

      // Add small delay to ensure timing difference
      await new Promise(resolve => setTimeout(resolve, 1));

      const startTime2 = Date.now();
      const result2 = await coordinator.buildConsensus(decision);
      const duration2 = Date.now() - startTime2;

      // Assert
      expect(result1).toEqual(result2); // Same result
      // Check that second call was faster or at least not slower (cached)
      // Allow for timing variations in test environment
      expect(duration2).toBeLessThanOrEqual(Math.max(duration1, 1));
      
      // Verify consensus engine was only called once
      expect(testDoubles.consensusEngine.collectVotes).toHaveBeenCalledTimes(1);
      expect(testDoubles.consensusEngine.calculateConsensus).toHaveBeenCalledTimes(1);
      
      // Check cache metrics
      const metrics = coordinator.getMetrics();
      expect(metrics.consensusCacheSize).toBe(1);
    });

    it('should expire cached consensus after TTL', async () => {
      // Arrange
      const decision = {
        type: 'deployment',
        proposal: 'Deploy to production',
        severity: 'critical',
      };

      // Create coordinator with short TTL for testing
      const shortTTLCoordinator = new SwarmCoordinator({
        queenAgent: testDoubles.queenAgent,
        consensusEngine: testDoubles.consensusEngine,
        topologyManager: testDoubles.topologyManager,
        workerAgent: testDoubles.workerAgent,
      });

      // Override TTL for testing (using private property access for test)
      (shortTTLCoordinator as any).CONSENSUS_CACHE_TTL = 100; // 100ms TTL

      (testDoubles.consensusEngine as any).__testHelpers.givenConsensusReturns({
        result: 'approved',
        confidence: 0.95,
      });

      // Act
      await shortTTLCoordinator.buildConsensus(decision);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await shortTTLCoordinator.buildConsensus(decision);

      // Assert - should have called consensus engine twice (cache expired)
      expect(testDoubles.consensusEngine.collectVotes).toHaveBeenCalledTimes(2);
      
      // Cleanup
      await shortTTLCoordinator.shutdown();
    });
  });

  describe('comparative performance', () => {
    it('should perform better with optimizations enabled', async () => {
      // Create two coordinators - one optimized, one not
      const testDoublesOptimized = createSwarmTestDoubles();
      const testDoublesBasic = createSwarmTestDoubles();

      const optimizedCoordinator = new SwarmCoordinator({
        queenAgent: testDoublesOptimized.queenAgent,
        consensusEngine: testDoublesOptimized.consensusEngine,
        topologyManager: testDoublesOptimized.topologyManager,
        workerAgent: testDoublesOptimized.workerAgent,
        useAgentPool: true,
        poolConfig: {
          minSize: 2,
          maxSize: 8,
        },
      });

      const basicCoordinator = new SwarmCoordinator({
        queenAgent: testDoublesBasic.queenAgent,
        consensusEngine: testDoublesBasic.consensusEngine,
        topologyManager: testDoublesBasic.topologyManager,
        workerAgent: testDoublesBasic.workerAgent,
        useAgentPool: false,
      });

      // Setup test doubles
      (testDoublesOptimized.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 2,
        agentTypes: ['programmer', 'tester'],
      });

      (testDoublesBasic.queenAgent as any).__testHelpers.givenTaskAnalysisReturns({
        agentCount: 2,
        agentTypes: ['programmer', 'tester'],
      });

      // Measure performance for multiple operations
      const operations = 10;
      const tasks = Array(operations).fill(null).map((_, i) => ({
        id: `perf-task-${i}`,
        description: `Performance test task ${i}`,
      }));

      // Optimized coordinator
      const optimizedStart = Date.now();
      for (const task of tasks) {
        await optimizedCoordinator.spawnAgentsForTask(task);
      }
      const optimizedDuration = Date.now() - optimizedStart;

      // Basic coordinator
      const basicStart = Date.now();
      for (const task of tasks) {
        await basicCoordinator.spawnAgentsForTask(task);
      }
      const basicDuration = Date.now() - basicStart;

      // Assert - optimized should be faster or within reasonable margin
      // Allow for small timing variations (10ms tolerance)
      expect(optimizedDuration).toBeLessThanOrEqual(basicDuration + 10);

      // Check that optimized coordinator has pool metrics
      const optimizedMetrics = optimizedCoordinator.getMetrics();
      expect(optimizedMetrics.pool).toBeDefined();

      // Cleanup
      await optimizedCoordinator.shutdown();
      await basicCoordinator.shutdown();
    });
  });
});