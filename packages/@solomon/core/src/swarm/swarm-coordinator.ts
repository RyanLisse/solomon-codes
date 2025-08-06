/**
 * Swarm Coordinator
 * Implements Claude Flow's hive-mind coordination with LangGraph
 */

import { StateGraph } from '@langchain/langgraph';
import { v4 as uuid } from 'uuid';
import type { HiveMindState } from '../state/unified-state';
import type { 
  QueenAgentCapabilities,
  WorkerAgentCapabilities,
  ConsensusEngineCapabilities,
  TopologyManagerCapabilities,
  SwarmTopology,
  WorkerInstance,
  ConsensusResult,
} from '../types/swarm-types';
import { AgentPool, type PooledAgent } from './agent-pool';

export interface SwarmCoordinatorConfig {
  stateGraph?: StateGraph<HiveMindState>;
  queenAgent: QueenAgentCapabilities;
  workerAgent: WorkerAgentCapabilities;
  consensusEngine: ConsensusEngineCapabilities;
  topologyManager: TopologyManagerCapabilities;
  maxAgents?: number;
  useAgentPool?: boolean;
  poolConfig?: {
    minSize?: number;
    maxSize?: number;
    idleTimeout?: number;
  };
}

export interface Task {
  id: string;
  description: string;
  priority?: string;
  requiredCapabilities?: string[];
  complexity?: string;
  parallelizable?: boolean;
}

export interface Decision {
  id?: string;
  type: string;
  proposal: string;
  severity: string;
}

export class SwarmCoordinator {
  private queenAgent: QueenAgentCapabilities;
  private workerAgent: WorkerAgentCapabilities;
  private consensusEngine: ConsensusEngineCapabilities;
  private topologyManager: TopologyManagerCapabilities;
  private stateGraph?: StateGraph<HiveMindState>;
  private maxAgents: number;
  private activeWorkers: Map<string, WorkerInstance> = new Map();
  private initialized = false;
  private spawnLock = false;
  private spawnQueue: Array<() => Promise<void>> = [];
  private agentPool?: AgentPool;
  private useAgentPool: boolean;
  private consensusCache: Map<string, { result: ConsensusResult; timestamp: number }> = new Map();
  private readonly CONSENSUS_CACHE_TTL = 30000; // 30 seconds

  constructor(config: SwarmCoordinatorConfig) {
    this.queenAgent = config.queenAgent;
    this.workerAgent = config.workerAgent;
    this.consensusEngine = config.consensusEngine;
    this.topologyManager = config.topologyManager;
    this.stateGraph = config.stateGraph;
    this.maxAgents = config.maxAgents || 8;
    this.useAgentPool = config.useAgentPool || false;

    // Initialize agent pool if enabled
    if (this.useAgentPool) {
      this.agentPool = new AgentPool({
        minSize: config.poolConfig?.minSize || 2,
        maxSize: config.poolConfig?.maxSize || this.maxAgents,
        idleTimeout: config.poolConfig?.idleTimeout || 60000,
      });
    }

    // Initialize with default topology
    this.topologyManager.setTopology('hierarchical');
  }

  /**
   * Initialize the swarm coordinator
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register queen agent as primary coordinator
    this.queenAgent.register({
      id: 'queen-001',
      role: 'coordinator',
    });

    this.initialized = true;
  }

  /**
   * Get current topology
   */
  getTopology(): SwarmTopology {
    return this.topologyManager.getCurrentTopology();
  }

  /**
   * Set swarm topology
   */
  async setTopology(topology: SwarmTopology): Promise<void> {
    try {
      await this.topologyManager.switchTopology(topology);
    } catch (error) {
      // Handle topology switching failures gracefully
      console.error('Failed to switch topology:', error);
      // Keep current topology
    }
  }

  /**
   * Spawn agents for a specific task
   */
  async spawnAgentsForTask(task: Task): Promise<WorkerInstance[]> {
    // Use a simple locking mechanism to ensure thread-safe spawning
    return new Promise<WorkerInstance[]>(async (resolve) => {
      const executeSpawn = async () => {
        // Queen analyzes the task
        const analysis = await this.queenAgent.analyzeTask(task);
        const { agentCount, agentTypes } = analysis;

        // Check agent limits with current state
        const currentAgentCount = this.activeWorkers.size;
        const availableSlots = this.maxAgents - currentAgentCount;
        
        // If no slots available, return empty array
        if (availableSlots <= 0) {
          resolve([]);
          return;
        }
        
        const agentsToSpawn = Math.min(agentCount, availableSlots);

        const spawnedAgents: WorkerInstance[] = [];

        // Spawn workers based on analysis
        for (let i = 0; i < agentsToSpawn; i++) {
          const agentType = agentTypes[i % agentTypes.length];
          const capabilities = this.getCapabilitiesForType(agentType);
          
          let worker: WorkerInstance;
          
          if (this.useAgentPool && this.agentPool) {
            // Use agent pool for better performance
            worker = await this.agentPool.acquire(agentType, capabilities);
          } else {
            // Traditional spawning
            const agentId = `worker-${uuid()}`;
            worker = await this.workerAgent.spawn({
              id: agentId,
              type: agentType,
              capabilities,
            });
          }

          this.activeWorkers.set(worker.id, worker);
          spawnedAgents.push(worker);
        }

        resolve(spawnedAgents);
      };

      // Queue the spawn request
      if (this.spawnLock) {
        this.spawnQueue.push(executeSpawn);
      } else {
        this.spawnLock = true;
        await executeSpawn();
        this.spawnLock = false;
        
        // Process queued spawns
        while (this.spawnQueue.length > 0) {
          const nextSpawn = this.spawnQueue.shift();
          if (nextSpawn) {
            await nextSpawn();
          }
        }
      }
    });
  }

  /**
   * Get active agent count
   */
  getActiveAgentCount(): number {
    return this.activeWorkers.size;
  }

  /**
   * Build consensus for a decision with caching
   */
  async buildConsensus(decision: Decision): Promise<ConsensusResult> {
    // Ensure decision has an ID
    if (!decision.id) {
      decision.id = `decision-${uuid()}`;
    }

    // Check cache for recent consensus on similar decisions
    const cacheKey = `${decision.type}-${decision.proposal}-${decision.severity}`;
    const cached = this.consensusCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CONSENSUS_CACHE_TTL) {
      // Return cached result if still valid
      return cached.result;
    }

    // Collect votes from agents
    const votes = await this.consensusEngine.collectVotes(decision);
    
    // Calculate consensus
    const result = this.consensusEngine.calculateConsensus(votes);
    
    // Cache the result
    this.consensusCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
    
    // Clean old cache entries periodically
    if (this.consensusCache.size > 100) {
      this.cleanConsensusCache();
    }
    
    // Record decision with queen
    this.queenAgent.recordDecision({
      decision,
      result,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Clean old entries from consensus cache
   */
  private cleanConsensusCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.consensusCache) {
      if (now - entry.timestamp > this.CONSENSUS_CACHE_TTL) {
        this.consensusCache.delete(key);
      }
    }
  }

  /**
   * Optimize topology for a specific task
   */
  async optimizeTopologyForTask(task: any): Promise<void> {
    const recommendedTopology = this.topologyManager.recommendTopology(task);
    await this.topologyManager.switchTopology(recommendedTopology);
  }

  /**
   * Handle agent failure with self-healing
   */
  async handleAgentFailure(agentId: string, error: Error): Promise<void> {
    // Record failure with queen
    this.queenAgent.recordFailure(agentId, error);

    // Remove failed agent
    const failedAgent = this.activeWorkers.get(agentId);
    if (failedAgent) {
      this.activeWorkers.delete(agentId);
      
      // Spawn replacement if under limit
      if (this.activeWorkers.size < this.maxAgents) {
        await this.workerAgent.spawn({
          id: `worker-${uuid()}`,
          type: failedAgent.type,
          capabilities: this.getCapabilitiesForType(failedAgent.type),
        });
      }
    }
  }

  /**
   * Get current state
   */
  getState(): Partial<HiveMindState> {
    return {
      swarmMetrics: {
        totalAgents: this.activeWorkers.size + 1, // +1 for queen
        activeAgents: this.activeWorkers.size,
        taskCompletionRate: 0, // Would be calculated from actual metrics
        averageResponseTime: 0, // Would be calculated from actual metrics
      },
    };
  }

  /**
   * Get capabilities for agent type
   */
  private getCapabilitiesForType(type: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      programmer: ['coding', 'debugging', 'refactoring'],
      tester: ['testing', 'test-design', 'test-automation'],
      reviewer: ['code-review', 'quality-assurance'],
      planner: ['planning', 'architecture', 'design'],
    };

    return capabilityMap[type] || ['general'];
  }

  /**
   * Shutdown the coordinator
   */
  async shutdown(): Promise<void> {
    // Clear agent pool if used
    if (this.agentPool) {
      await this.agentPool.clear();
    }
    
    // Terminate all workers
    for (const [id, worker] of this.activeWorkers) {
      // Release pooled agents back to pool
      if (this.useAgentPool && this.agentPool && 'poolId' in worker) {
        this.agentPool.release(worker.id);
      } else {
        await worker.terminate();
      }
    }
    
    this.activeWorkers.clear();
    this.consensusCache.clear();
    this.initialized = false;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const baseMetrics = {
      activeWorkers: this.activeWorkers.size,
      maxAgents: this.maxAgents,
      consensusCacheSize: this.consensusCache.size,
      topology: this.topologyManager.getCurrentTopology(),
    };

    if (this.agentPool) {
      return {
        ...baseMetrics,
        pool: this.agentPool.getMetrics(),
      };
    }

    return baseMetrics;
  }
}