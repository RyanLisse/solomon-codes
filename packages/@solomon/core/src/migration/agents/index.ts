/**
 * Agent Migration Index
 * Exports all migrated Solomon agents for LangGraph integration
 */

export { ManagerAgent, createManagerAgent, ManagerStateSchema, type ManagerState } from './manager-agent';
export { PlannerAgent, createPlannerAgent, PlannerStateSchema, type PlannerState } from './planner-agent';
export { ProgrammerAgent, createProgrammerAgent, ProgrammerStateSchema, type ProgrammerState } from './programmer-agent';
export { ReviewerAgent, createReviewerAgent, ReviewerStateSchema, type ReviewerState } from './reviewer-agent';

/**
 * Agent Factory
 * Creates appropriate agent based on type
 */
export class AgentFactory {
  static createAgent(type: 'manager' | 'planner' | 'programmer' | 'reviewer') {
    switch (type) {
      case 'manager':
        return createManagerAgent();
      case 'planner':
        return createPlannerAgent();
      case 'programmer':
        return createProgrammerAgent();
      case 'reviewer':
        return createReviewerAgent();
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  /**
   * Create a swarm of agents for a specific task
   */
  static createSwarm(config: {
    manager?: boolean;
    planners?: number;
    programmers?: number;
    reviewers?: number;
  }) {
    const swarm: any[] = [];

    if (config.manager) {
      swarm.push(createManagerAgent());
    }

    for (let i = 0; i < (config.planners || 0); i++) {
      swarm.push(createPlannerAgent());
    }

    for (let i = 0; i < (config.programmers || 0); i++) {
      swarm.push(createProgrammerAgent());
    }

    for (let i = 0; i < (config.reviewers || 0); i++) {
      swarm.push(createReviewerAgent());
    }

    return swarm;
  }
}

/**
 * Migration utilities
 */
export class MigrationUtils {
  /**
   * Convert legacy Solomon agent config to LangGraph config
   */
  static convertLegacyConfig(legacyConfig: any) {
    return {
      type: legacyConfig.agentType || 'worker',
      capabilities: legacyConfig.skills || [],
      maxConcurrency: legacyConfig.maxTasks || 1,
      timeout: legacyConfig.taskTimeout || 60000,
    };
  }

  /**
   * Migrate legacy state to new format
   */
  static migrateState(legacyState: any, agentType: string) {
    switch (agentType) {
      case 'manager':
        return {
          projectGoals: legacyState.goals || [],
          currentPhase: legacyState.phase || 'planning',
          taskQueue: legacyState.tasks || [],
          teamStatus: legacyState.team || {},
          decisions: legacyState.decisions || [],
        };
      
      case 'planner':
        return {
          projectContext: legacyState.context || {},
          plan: legacyState.plan || { phases: [], milestones: [], risks: [] },
          executionStrategy: legacyState.strategy || 'sequential',
          resourceAllocation: legacyState.resources || {},
          status: legacyState.status || 'planning',
        };
      
      case 'programmer':
        return {
          task: legacyState.currentTask || {},
          implementation: legacyState.code || { files: [], dependencies: [], tests: [] },
          codeQuality: legacyState.quality || {},
          refactoringSuggestions: [],
          status: legacyState.status || 'analyzing',
          messages: [],
        };
      
      case 'reviewer':
        return {
          reviewRequest: legacyState.request || {},
          reviewFindings: legacyState.findings || { issues: [], metrics: {}, suggestions: [] },
          reviewDecision: legacyState.decision || { verdict: 'pending', confidence: 0, blockers: [], approvalConditions: [], comments: [] },
          bestPractices: [],
          status: legacyState.status || 'analyzing',
          messages: [],
        };
      
      default:
        return legacyState;
    }
  }
}

/**
 * Agent Registry
 * Manages all active agents in the system
 */
export class AgentRegistry {
  private static agents = new Map<string, any>();

  static register(id: string, agent: any) {
    this.agents.set(id, agent);
  }

  static get(id: string) {
    return this.agents.get(id);
  }

  static remove(id: string) {
    return this.agents.delete(id);
  }

  static list() {
    return Array.from(this.agents.entries());
  }

  static clear() {
    this.agents.clear();
  }

  static getByType(type: string) {
    return Array.from(this.agents.values()).filter(agent => agent.type === type);
  }
}