/**
 * Agent Pool Manager
 * Optimized resource management for swarm agents
 */

import { v4 as uuid } from 'uuid';
import type { WorkerInstance } from '../types/swarm-types';

export interface PooledAgent extends WorkerInstance {
  inUse: boolean;
  lastUsed: number;
  taskCount: number;
  poolId: string;
}

export interface AgentPoolConfig {
  minSize: number;
  maxSize: number;
  idleTimeout: number;
  preWarmTypes: string[];
  reuseStrategy: 'fifo' | 'lifo' | 'lru';
}

/**
 * Agent Pool for efficient resource management
 */
export class AgentPool {
  private pool: Map<string, PooledAgent> = new Map();
  private typeQueues: Map<string, PooledAgent[]> = new Map();
  private config: AgentPoolConfig;
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    spawns: 0,
  };

  constructor(config: Partial<AgentPoolConfig> = {}) {
    this.config = {
      minSize: config.minSize || 2,
      maxSize: config.maxSize || 10,
      idleTimeout: config.idleTimeout || 60000, // 1 minute
      preWarmTypes: config.preWarmTypes || ['programmer', 'tester'],
      reuseStrategy: config.reuseStrategy || 'lru',
    };

    // Pre-warm the pool
    this.preWarmPool();
  }

  /**
   * Pre-warm the pool with commonly used agent types
   */
  private async preWarmPool(): Promise<void> {
    for (const type of this.config.preWarmTypes) {
      const queue = this.getTypeQueue(type);
      for (let i = 0; i < Math.min(2, this.config.minSize); i++) {
        const agent = await this.createPooledAgent(type);
        agent.inUse = false; // Mark as available after creation
        queue.push(agent);
        this.pool.set(agent.poolId, agent);
      }
    }
  }

  /**
   * Get or create an agent from the pool
   */
  async acquire(type: string, capabilities: string[]): Promise<PooledAgent> {
    const queue = this.getTypeQueue(type);
    
    // Try to find an available agent
    let agent = this.findAvailableAgent(queue);
    
    if (agent) {
      this.metrics.hits++;
      agent.inUse = true;
      agent.lastUsed = Date.now();
      agent.taskCount++;
      return agent;
    }

    // No available agent, create new if under limit
    this.metrics.misses++;
    
    if (this.pool.size < this.config.maxSize) {
      agent = await this.createPooledAgent(type, capabilities);
      this.pool.set(agent.poolId, agent);
      queue.push(agent);
      this.metrics.spawns++;
      return agent;
    }

    // At max capacity, try to evict idle agents
    const evicted = this.evictIdleAgents();
    if (evicted > 0) {
      this.metrics.evictions += evicted;
      agent = await this.createPooledAgent(type, capabilities);
      this.pool.set(agent.poolId, agent);
      queue.push(agent);
      this.metrics.spawns++;
      return agent;
    }

    // No room, wait for an agent to become available
    return this.waitForAvailableAgent(type, capabilities);
  }

  /**
   * Release an agent back to the pool
   */
  release(agentId: string): void {
    const agent = this.pool.get(agentId);
    if (agent) {
      agent.inUse = false;
      agent.lastUsed = Date.now();
    }
  }

  /**
   * Find an available agent in the queue
   */
  private findAvailableAgent(queue: PooledAgent[]): PooledAgent | null {
    // Apply reuse strategy
    switch (this.config.reuseStrategy) {
      case 'fifo':
        return queue.find(a => !a.inUse) || null;
      case 'lifo':
        return [...queue].reverse().find(a => !a.inUse) || null;
      case 'lru':
      default:
        return queue
          .filter(a => !a.inUse)
          .sort((a, b) => a.lastUsed - b.lastUsed)[0] || null;
    }
  }

  /**
   * Create a new pooled agent
   */
  private async createPooledAgent(
    type: string,
    capabilities: string[] = []
  ): Promise<PooledAgent> {
    const poolId = `pool-${uuid()}`;
    const agent: PooledAgent = {
      id: `agent-${uuid()}`,
      poolId,
      type,
      capabilities,
      status: 'idle',
      inUse: true,
      lastUsed: Date.now(),
      taskCount: 0,
      execute: async (task: any) => {
        // Placeholder - would be implemented by actual agent
        return { success: true, result: 'completed' };
      },
      terminate: async () => {
        this.pool.delete(poolId);
        const queue = this.getTypeQueue(type);
        const index = queue.findIndex(a => a.poolId === poolId);
        if (index !== -1) {
          queue.splice(index, 1);
        }
      },
    };
    
    return agent;
  }

  /**
   * Evict idle agents that have exceeded timeout
   */
  private evictIdleAgents(): number {
    const now = Date.now();
    let evicted = 0;
    
    for (const [id, agent] of this.pool) {
      if (!agent.inUse && (now - agent.lastUsed) > this.config.idleTimeout) {
        agent.terminate();
        this.pool.delete(id);
        evicted++;
      }
    }
    
    return evicted;
  }

  /**
   * Wait for an agent to become available
   */
  private async waitForAvailableAgent(
    type: string,
    capabilities: string[]
  ): Promise<PooledAgent> {
    // Simple polling strategy with timeout
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkInterval = setInterval(() => {
        const queue = this.getTypeQueue(type);
        const agent = this.findAvailableAgent(queue);
        
        if (agent) {
          clearInterval(checkInterval);
          agent.inUse = true;
          agent.lastUsed = Date.now();
          agent.taskCount++;
          resolve(agent);
        } else if (++attempts >= maxAttempts) {
          clearInterval(checkInterval);
          // Create emergency agent if waiting too long
          this.createPooledAgent(type, capabilities).then(resolve);
        }
      }, 100);
    });
  }

  /**
   * Get or create type queue
   */
  private getTypeQueue(type: string): PooledAgent[] {
    if (!this.typeQueues.has(type)) {
      this.typeQueues.set(type, []);
    }
    return this.typeQueues.get(type)!;
  }

  /**
   * Get pool metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      poolSize: this.pool.size,
      activeAgents: Array.from(this.pool.values()).filter(a => a.inUse).length,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0,
    };
  }

  /**
   * Clear the pool
   */
  async clear(): Promise<void> {
    for (const agent of this.pool.values()) {
      await agent.terminate();
    }
    this.pool.clear();
    this.typeQueues.clear();
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      spawns: 0,
    };
  }
}