/**
 * Agent Migration Adapter
 * Bridges legacy Solomon Codes agents with new LangGraph architecture
 */

import { StateGraph } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import type { UnifiedState } from '../state/unified-state';
import type { WorkerInstance } from '../types/swarm-types';

/**
 * Legacy agent interface (Solomon Codes)
 */
export interface LegacyAgent {
  id: string;
  type: 'manager' | 'planner' | 'programmer' | 'reviewer';
  execute(task: any): Promise<any>;
  getState(): any;
  reset(): void;
}

/**
 * Modern agent interface (LangGraph)
 */
export interface ModernAgent extends WorkerInstance {
  graph?: StateGraph<any>;
  invoke(input: any): Promise<any>;
}

/**
 * Agent Adapter - converts legacy agents to modern LangGraph agents
 */
export class AgentAdapter {
  private legacyAgent: LegacyAgent;
  private modernAgent: ModernAgent;
  private graph?: StateGraph<any>;

  constructor(legacyAgent: LegacyAgent) {
    this.legacyAgent = legacyAgent;
    this.modernAgent = this.createModernAgent();
  }

  /**
   * Create modern agent from legacy agent
   */
  private createModernAgent(): ModernAgent {
    return {
      id: this.legacyAgent.id,
      type: this.mapLegacyType(this.legacyAgent.type),
      status: 'idle',
      capabilities: this.extractCapabilities(this.legacyAgent.type),
      
      execute: async (task: any) => {
        // Delegate to legacy agent
        return this.legacyAgent.execute(task);
      },
      
      terminate: async () => {
        // Clean up legacy agent
        this.legacyAgent.reset();
      },
      
      invoke: async (input: any) => {
        // Convert to legacy format and execute
        const legacyTask = this.convertToLegacyTask(input);
        const result = await this.legacyAgent.execute(legacyTask);
        return this.convertToModernResult(result);
      },
    };
  }

  /**
   * Map legacy agent type to modern worker type
   */
  private mapLegacyType(legacyType: string): string {
    const typeMap: Record<string, string> = {
      'manager': 'queen',
      'planner': 'strategic',
      'programmer': 'implementation',
      'reviewer': 'quality',
    };
    return typeMap[legacyType] || 'worker';
  }

  /**
   * Extract capabilities from legacy agent type
   */
  private extractCapabilities(type: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      'manager': ['coordination', 'decision-making', 'delegation'],
      'planner': ['planning', 'architecture', 'design', 'strategy'],
      'programmer': ['coding', 'debugging', 'implementation', 'refactoring'],
      'reviewer': ['code-review', 'quality-assurance', 'testing', 'validation'],
    };
    return capabilityMap[type] || ['general'];
  }

  /**
   * Convert modern input to legacy task format
   */
  private convertToLegacyTask(input: any): any {
    if (input.messages) {
      // Extract task from messages
      const lastMessage = input.messages[input.messages.length - 1];
      return {
        description: lastMessage?.content || '',
        context: input.context || {},
        parameters: input.parameters || {},
      };
    }
    return input;
  }

  /**
   * Convert legacy result to modern format
   */
  private convertToModernResult(result: any): any {
    return {
      messages: [
        new AIMessage({
          content: typeof result === 'string' ? result : JSON.stringify(result),
        }),
      ],
      metadata: {
        source: 'legacy-agent',
        agentId: this.legacyAgent.id,
        agentType: this.legacyAgent.type,
      },
      result,
    };
  }

  /**
   * Get the adapted modern agent
   */
  getModernAgent(): ModernAgent {
    return this.modernAgent;
  }

  /**
   * Get the original legacy agent
   */
  getLegacyAgent(): LegacyAgent {
    return this.legacyAgent;
  }
}

/**
 * Agent Migration Manager
 * Manages the migration of all legacy agents
 */
export class AgentMigrationManager {
  private adapters: Map<string, AgentAdapter> = new Map();
  private migrationStatus: Map<string, 'pending' | 'migrating' | 'completed'> = new Map();

  /**
   * Register a legacy agent for migration
   */
  registerLegacyAgent(agent: LegacyAgent): void {
    const adapter = new AgentAdapter(agent);
    this.adapters.set(agent.id, adapter);
    this.migrationStatus.set(agent.id, 'pending');
  }

  /**
   * Migrate a specific agent
   */
  async migrateAgent(agentId: string): Promise<ModernAgent> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new Error(`No adapter found for agent ${agentId}`);
    }

    this.migrationStatus.set(agentId, 'migrating');
    
    try {
      // Get modern agent from adapter
      const modernAgent = adapter.getModernAgent();
      
      // Mark as completed
      this.migrationStatus.set(agentId, 'completed');
      
      return modernAgent;
    } catch (error) {
      this.migrationStatus.set(agentId, 'pending');
      throw error;
    }
  }

  /**
   * Migrate all registered agents
   */
  async migrateAll(): Promise<ModernAgent[]> {
    const modernAgents: ModernAgent[] = [];
    
    for (const [agentId] of this.adapters) {
      const modernAgent = await this.migrateAgent(agentId);
      modernAgents.push(modernAgent);
    }
    
    return modernAgents;
  }

  /**
   * Get migration status
   */
  getMigrationStatus(): Record<string, any> {
    const status: Record<string, any> = {
      total: this.adapters.size,
      pending: 0,
      migrating: 0,
      completed: 0,
      agents: {},
    };

    for (const [agentId, agentStatus] of this.migrationStatus) {
      status[agentStatus]++;
      status.agents[agentId] = agentStatus;
    }

    return status;
  }

  /**
   * Get modern agent by ID
   */
  getModernAgent(agentId: string): ModernAgent | undefined {
    return this.adapters.get(agentId)?.getModernAgent();
  }

  /**
   * Clear all adapters
   */
  clear(): void {
    this.adapters.clear();
    this.migrationStatus.clear();
  }
}

/**
 * Create a migration bridge for gradual transition
 */
export function createMigrationBridge(legacyAgents: LegacyAgent[]): AgentMigrationManager {
  const manager = new AgentMigrationManager();
  
  for (const agent of legacyAgents) {
    manager.registerLegacyAgent(agent);
  }
  
  return manager;
}