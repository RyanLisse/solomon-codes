/**
 * Planner Agent Migration
 * Migrates Solomon's Planner Agent to LangGraph Strategic Worker architecture
 */

import { StateGraph, END } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import type { WorkerAgentCapabilities, WorkerInstance } from '../../types/swarm-types';

// Planner Agent State Schema
export const PlannerStateSchema = z.object({
  projectContext: z.object({
    description: z.string(),
    requirements: z.array(z.string()),
    constraints: z.array(z.string()),
    resources: z.array(z.string()),
  }),
  plan: z.object({
    phases: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      dependencies: z.array(z.string()),
      estimatedDuration: z.number(), // in hours
      requiredSkills: z.array(z.string()),
    })),
    milestones: z.array(z.object({
      id: z.string(),
      name: z.string(),
      criteria: z.array(z.string()),
      deadline: z.string().optional(),
    })),
    risks: z.array(z.object({
      id: z.string(),
      description: z.string(),
      probability: z.enum(['low', 'medium', 'high']),
      impact: z.enum(['low', 'medium', 'high']),
      mitigation: z.string(),
    })),
  }),
  executionStrategy: z.enum(['sequential', 'parallel', 'hybrid']),
  resourceAllocation: z.record(z.string(), z.array(z.string())),
  status: z.enum(['planning', 'ready', 'executing', 'completed']),
});

export type PlannerState = z.infer<typeof PlannerStateSchema>;

/**
 * Planner Agent implementation using LangGraph
 * Acts as a Strategic Worker in the swarm hierarchy
 */
export class PlannerAgent implements WorkerAgentCapabilities {
  private graph: StateGraph<PlannerState>;
  private state: PlannerState;
  private instance: WorkerInstance | null = null;

  constructor() {
    this.state = {
      projectContext: {
        description: '',
        requirements: [],
        constraints: [],
        resources: [],
      },
      plan: {
        phases: [],
        milestones: [],
        risks: [],
      },
      executionStrategy: 'sequential',
      resourceAllocation: {},
      status: 'planning',
    };

    // Initialize the state graph
    this.graph = new StateGraph<PlannerState>({
      channels: PlannerStateSchema.shape,
    });

    this.setupGraph();
  }

  /**
   * Setup the LangGraph workflow
   */
  private setupGraph(): void {
    // Add nodes for planning workflow
    this.graph.addNode('analyze_requirements', this.analyzeRequirements.bind(this));
    this.graph.addNode('identify_phases', this.identifyPhases.bind(this));
    this.graph.addNode('assess_risks', this.assessRisks.bind(this));
    this.graph.addNode('allocate_resources', this.allocateResources.bind(this));
    this.graph.addNode('optimize_plan', this.optimizePlan.bind(this));
    this.graph.addNode('finalize_plan', this.finalizePlan.bind(this));

    // Define workflow edges
    this.graph.addEdge('analyze_requirements', 'identify_phases');
    this.graph.addEdge('identify_phases', 'assess_risks');
    this.graph.addEdge('assess_risks', 'allocate_resources');
    this.graph.addEdge('allocate_resources', 'optimize_plan');
    
    // Conditional edge for optimization iterations
    this.graph.addConditionalEdges('optimize_plan', (state) => {
      // Check if plan meets criteria
      const hasAllPhases = state.plan.phases.length > 0;
      const hasResourceAllocation = Object.keys(state.resourceAllocation).length > 0;
      
      if (hasAllPhases && hasResourceAllocation) {
        return 'finalize_plan';
      }
      return 'identify_phases'; // Re-iterate if needed
    });

    this.graph.addEdge('finalize_plan', END);

    // Set entry point
    this.graph.setEntryPoint('analyze_requirements');
  }

  /**
   * Analyze project requirements
   */
  private async analyzeRequirements(state: PlannerState): Promise<Partial<PlannerState>> {
    // Extract and structure requirements from context
    return {
      projectContext: {
        ...state.projectContext,
        requirements: [
          'Implement core functionality',
          'Ensure scalability',
          'Maintain backward compatibility',
          'Provide comprehensive documentation',
        ],
        constraints: [
          'Limited timeline',
          'Resource constraints',
          'Technology stack limitations',
        ],
        resources: [
          'Development team',
          'Testing infrastructure',
          'Deployment pipeline',
        ],
      },
    };
  }

  /**
   * Identify project phases
   */
  private async identifyPhases(state: PlannerState): Promise<Partial<PlannerState>> {
    const phases = [
      {
        id: 'phase-1',
        name: 'Foundation',
        description: 'Setup project structure and core dependencies',
        dependencies: [],
        estimatedDuration: 8,
        requiredSkills: ['architecture', 'setup'],
      },
      {
        id: 'phase-2',
        name: 'Core Implementation',
        description: 'Implement main features and functionality',
        dependencies: ['phase-1'],
        estimatedDuration: 40,
        requiredSkills: ['programming', 'testing'],
      },
      {
        id: 'phase-3',
        name: 'Integration',
        description: 'Integrate components and external services',
        dependencies: ['phase-2'],
        estimatedDuration: 16,
        requiredSkills: ['integration', 'debugging'],
      },
      {
        id: 'phase-4',
        name: 'Testing & Optimization',
        description: 'Comprehensive testing and performance optimization',
        dependencies: ['phase-3'],
        estimatedDuration: 24,
        requiredSkills: ['testing', 'optimization'],
      },
      {
        id: 'phase-5',
        name: 'Deployment',
        description: 'Deploy to production environment',
        dependencies: ['phase-4'],
        estimatedDuration: 8,
        requiredSkills: ['deployment', 'monitoring'],
      },
    ];

    const milestones = [
      {
        id: 'milestone-1',
        name: 'MVP Complete',
        criteria: ['Core features implemented', 'Basic testing complete'],
      },
      {
        id: 'milestone-2',
        name: 'Production Ready',
        criteria: ['All tests passing', 'Performance targets met', 'Documentation complete'],
      },
    ];

    return {
      plan: {
        ...state.plan,
        phases,
        milestones,
      },
    };
  }

  /**
   * Assess project risks
   */
  private async assessRisks(state: PlannerState): Promise<Partial<PlannerState>> {
    const risks = [
      {
        id: 'risk-1',
        description: 'Scope creep affecting timeline',
        probability: 'medium' as const,
        impact: 'high' as const,
        mitigation: 'Strict change control process and regular scope reviews',
      },
      {
        id: 'risk-2',
        description: 'Technical complexity exceeding estimates',
        probability: 'medium' as const,
        impact: 'medium' as const,
        mitigation: 'Early prototyping and proof of concepts',
      },
      {
        id: 'risk-3',
        description: 'Resource availability issues',
        probability: 'low' as const,
        impact: 'high' as const,
        mitigation: 'Cross-training team members and maintaining resource buffer',
      },
    ];

    return {
      plan: {
        ...state.plan,
        risks,
      },
    };
  }

  /**
   * Allocate resources to phases
   */
  private async allocateResources(state: PlannerState): Promise<Partial<PlannerState>> {
    const allocation: Record<string, string[]> = {};

    // Allocate resources based on phase requirements
    state.plan.phases.forEach(phase => {
      allocation[phase.id] = phase.requiredSkills.map(skill => {
        switch (skill) {
          case 'programming':
            return 'programmer-agent';
          case 'testing':
            return 'tester-agent';
          case 'architecture':
            return 'architect-agent';
          case 'deployment':
            return 'devops-agent';
          default:
            return 'worker-agent';
        }
      });
    });

    return {
      resourceAllocation: allocation,
    };
  }

  /**
   * Optimize the execution plan
   */
  private async optimizePlan(state: PlannerState): Promise<Partial<PlannerState>> {
    // Determine optimal execution strategy
    const hasParallelizablePhases = state.plan.phases.some(phase => 
      phase.dependencies.length === 0 || 
      phase.dependencies.every(dep => 
        state.plan.phases.find(p => p.id === dep)?.estimatedDuration || 0 < 16
      )
    );

    const strategy = hasParallelizablePhases ? 'hybrid' : 'sequential';

    return {
      executionStrategy: strategy,
    };
  }

  /**
   * Finalize the plan
   */
  private async finalizePlan(state: PlannerState): Promise<Partial<PlannerState>> {
    return {
      status: 'ready',
    };
  }

  // Implement WorkerAgentCapabilities interface
  async spawn(config: any): Promise<WorkerInstance> {
    this.instance = {
      id: config.id || `planner-${Date.now()}`,
      type: 'planner',
      capabilities: ['strategic_planning', 'risk_assessment', 'resource_allocation'],
      status: 'active',
      execute: this.execute.bind(this),
      terminate: this.terminate.bind(this),
    };
    return this.instance;
  }

  async execute(task: any): Promise<any> {
    // Update state with task context
    if (task.context) {
      this.state.projectContext = {
        ...this.state.projectContext,
        description: task.description || '',
      };
    }

    // Execute the planning workflow
    const compiledGraph = this.graph.compile();
    const result = await compiledGraph.invoke(this.state);
    
    this.state = result;
    
    // Return the generated plan
    return {
      success: true,
      plan: result.plan,
      strategy: result.executionStrategy,
      allocation: result.resourceAllocation,
    };
  }

  async terminate(): Promise<void> {
    if (this.instance) {
      this.instance.status = 'terminated';
    }
  }

  async getMetrics(): Promise<any> {
    return {
      phasesPlanned: this.state.plan.phases.length,
      risksIdentified: this.state.plan.risks.length,
      resourcesAllocated: Object.keys(this.state.resourceAllocation).length,
      status: this.state.status,
    };
  }
}

/**
 * Factory function to create a Planner Agent
 */
export function createPlannerAgent(): PlannerAgent {
  return new PlannerAgent();
}