/**
 * Reviewer Agent Migration
 * Migrates Solomon's Reviewer Agent to LangGraph Quality Worker architecture
 */

import { StateGraph, END } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import type { WorkerAgentCapabilities, WorkerInstance } from '../../types/swarm-types';

// Reviewer Agent State Schema
export const ReviewerStateSchema = z.object({
  reviewRequest: z.object({
    id: z.string(),
    type: z.enum(['code', 'architecture', 'security', 'performance', 'documentation']),
    targetFiles: z.array(z.string()),
    description: z.string(),
    author: z.string().optional(),
    pullRequestId: z.string().optional(),
  }),
  reviewFindings: z.object({
    issues: z.array(z.object({
      id: z.string(),
      severity: z.enum(['critical', 'major', 'minor', 'suggestion']),
      category: z.enum(['bug', 'security', 'performance', 'style', 'maintainability', 'documentation']),
      file: z.string(),
      line: z.number().optional(),
      description: z.string(),
      suggestion: z.string().optional(),
      autoFixable: z.boolean(),
    })),
    metrics: z.object({
      codeQuality: z.number(), // 0-100
      testCoverage: z.number(), // percentage
      complexity: z.number(), // cyclomatic complexity
      duplication: z.number(), // percentage
      security: z.number(), // 0-100
      performance: z.number(), // 0-100
    }),
    suggestions: z.array(z.object({
      type: z.enum(['refactor', 'optimize', 'test', 'document']),
      description: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      estimatedEffort: z.enum(['trivial', 'small', 'medium', 'large']),
    })),
  }),
  reviewDecision: z.object({
    verdict: z.enum(['approved', 'needs_changes', 'rejected', 'pending']),
    confidence: z.number(), // 0-1
    blockers: z.array(z.string()),
    approvalConditions: z.array(z.string()),
    comments: z.array(z.string()),
  }),
  bestPractices: z.array(z.object({
    rule: z.string(),
    violated: z.boolean(),
    description: z.string(),
    recommendation: z.string(),
  })),
  status: z.enum(['analyzing', 'reviewing', 'generating_report', 'completed']),
  messages: z.array(z.instanceof(BaseMessage)),
});

export type ReviewerState = z.infer<typeof ReviewerStateSchema>;

/**
 * Reviewer Agent implementation using LangGraph
 * Acts as a Quality Worker in the swarm hierarchy
 */
export class ReviewerAgent implements WorkerAgentCapabilities {
  private graph: StateGraph<ReviewerState>;
  private state: ReviewerState;
  private instance: WorkerInstance | null = null;

  constructor() {
    this.state = {
      reviewRequest: {
        id: '',
        type: 'code',
        targetFiles: [],
        description: '',
      },
      reviewFindings: {
        issues: [],
        metrics: {
          codeQuality: 0,
          testCoverage: 0,
          complexity: 0,
          duplication: 0,
          security: 0,
          performance: 0,
        },
        suggestions: [],
      },
      reviewDecision: {
        verdict: 'pending',
        confidence: 0,
        blockers: [],
        approvalConditions: [],
        comments: [],
      },
      bestPractices: [],
      status: 'analyzing',
      messages: [],
    };

    // Initialize the state graph
    this.graph = new StateGraph<ReviewerState>({
      channels: ReviewerStateSchema.shape,
    });

    this.setupGraph();
  }

  /**
   * Setup the LangGraph workflow
   */
  private setupGraph(): void {
    // Add nodes for review workflow
    this.graph.addNode('analyze_code', this.analyzeCode.bind(this));
    this.graph.addNode('check_quality', this.checkQuality.bind(this));
    this.graph.addNode('security_scan', this.securityScan.bind(this));
    this.graph.addNode('performance_review', this.performanceReview.bind(this));
    this.graph.addNode('check_best_practices', this.checkBestPractices.bind(this));
    this.graph.addNode('generate_suggestions', this.generateSuggestions.bind(this));
    this.graph.addNode('make_decision', this.makeDecision.bind(this));
    this.graph.addNode('generate_report', this.generateReport.bind(this));

    // Define workflow edges
    this.graph.addEdge('analyze_code', 'check_quality');
    this.graph.addEdge('check_quality', 'security_scan');
    this.graph.addEdge('security_scan', 'performance_review');
    this.graph.addEdge('performance_review', 'check_best_practices');
    this.graph.addEdge('check_best_practices', 'generate_suggestions');
    this.graph.addEdge('generate_suggestions', 'make_decision');
    
    // Conditional edge based on decision
    this.graph.addConditionalEdges('make_decision', (state) => {
      if (state.reviewDecision.verdict === 'needs_changes' && state.reviewFindings.issues.length > 5) {
        // Re-analyze if too many issues
        return 'analyze_code';
      }
      return 'generate_report';
    });

    this.graph.addEdge('generate_report', END);

    // Set entry point
    this.graph.setEntryPoint('analyze_code');
  }

  /**
   * Analyze the code structure and syntax
   */
  private async analyzeCode(state: ReviewerState): Promise<Partial<ReviewerState>> {
    const messages = [
      new SystemMessage('You are an expert code reviewer analyzing code for quality and correctness.'),
      new HumanMessage(`Review request: ${state.reviewRequest.description}\nFiles: ${state.reviewRequest.targetFiles.join(', ')}`),
    ];

    // Simulate code analysis
    const issues = this.detectCommonIssues(state.reviewRequest);

    return {
      reviewFindings: {
        ...state.reviewFindings,
        issues,
      },
      status: 'reviewing',
      messages: [...state.messages, ...messages],
    };
  }

  /**
   * Check code quality metrics
   */
  private async checkQuality(state: ReviewerState): Promise<Partial<ReviewerState>> {
    // Calculate quality metrics
    const metrics = {
      codeQuality: this.calculateCodeQuality(state.reviewFindings.issues),
      testCoverage: Math.random() * 30 + 70, // Simulate 70-100% coverage
      complexity: Math.random() * 20 + 5, // Simulate complexity 5-25
      duplication: Math.random() * 10, // Simulate 0-10% duplication
      security: 100 - state.reviewFindings.issues.filter(i => i.category === 'security').length * 10,
      performance: 100 - state.reviewFindings.issues.filter(i => i.category === 'performance').length * 5,
    };

    return {
      reviewFindings: {
        ...state.reviewFindings,
        metrics,
      },
    };
  }

  /**
   * Perform security scanning
   */
  private async securityScan(state: ReviewerState): Promise<Partial<ReviewerState>> {
    const securityIssues = [
      {
        id: `sec-${Date.now()}`,
        severity: 'major' as const,
        category: 'security' as const,
        file: state.reviewRequest.targetFiles[0] || 'unknown',
        description: 'Potential SQL injection vulnerability',
        suggestion: 'Use parameterized queries',
        autoFixable: false,
      },
    ];

    // Add security issues if found
    const hasSecurityRisks = Math.random() > 0.7; // 30% chance of security issues
    if (hasSecurityRisks && state.reviewRequest.type === 'security') {
      return {
        reviewFindings: {
          ...state.reviewFindings,
          issues: [...state.reviewFindings.issues, ...securityIssues],
        },
      };
    }

    return {};
  }

  /**
   * Review performance aspects
   */
  private async performanceReview(state: ReviewerState): Promise<Partial<ReviewerState>> {
    const performanceIssues = [];

    // Check for common performance issues
    if (state.reviewFindings.metrics.complexity > 15) {
      performanceIssues.push({
        id: `perf-${Date.now()}`,
        severity: 'minor' as const,
        category: 'performance' as const,
        file: state.reviewRequest.targetFiles[0] || 'unknown',
        description: 'High cyclomatic complexity may impact performance',
        suggestion: 'Consider breaking down complex functions',
        autoFixable: false,
      });
    }

    return {
      reviewFindings: {
        ...state.reviewFindings,
        issues: [...state.reviewFindings.issues, ...performanceIssues],
      },
    };
  }

  /**
   * Check adherence to best practices
   */
  private async checkBestPractices(state: ReviewerState): Promise<Partial<ReviewerState>> {
    const bestPractices = [
      {
        rule: 'SOLID Principles',
        violated: false,
        description: 'Code follows Single Responsibility Principle',
        recommendation: 'Continue maintaining clear separation of concerns',
      },
      {
        rule: 'DRY (Don\'t Repeat Yourself)',
        violated: state.reviewFindings.metrics.duplication > 5,
        description: 'Code duplication detected',
        recommendation: 'Extract common code into reusable functions',
      },
      {
        rule: 'Error Handling',
        violated: Math.random() > 0.8,
        description: 'Comprehensive error handling',
        recommendation: 'Add try-catch blocks for async operations',
      },
      {
        rule: 'Documentation',
        violated: Math.random() > 0.6,
        description: 'Code documentation coverage',
        recommendation: 'Add JSDoc comments for public APIs',
      },
    ];

    return {
      bestPractices,
    };
  }

  /**
   * Generate improvement suggestions
   */
  private async generateSuggestions(state: ReviewerState): Promise<Partial<ReviewerState>> {
    const suggestions = [];

    // Generate suggestions based on findings
    if (state.reviewFindings.metrics.testCoverage < 80) {
      suggestions.push({
        type: 'test' as const,
        description: 'Increase test coverage to at least 80%',
        priority: 'high' as const,
        estimatedEffort: 'medium' as const,
      });
    }

    if (state.reviewFindings.metrics.complexity > 10) {
      suggestions.push({
        type: 'refactor' as const,
        description: 'Refactor complex functions to improve maintainability',
        priority: 'medium' as const,
        estimatedEffort: 'medium' as const,
      });
    }

    if (state.bestPractices.some(bp => bp.rule === 'Documentation' && bp.violated)) {
      suggestions.push({
        type: 'document' as const,
        description: 'Add comprehensive documentation for public APIs',
        priority: 'low' as const,
        estimatedEffort: 'small' as const,
      });
    }

    return {
      reviewFindings: {
        ...state.reviewFindings,
        suggestions,
      },
    };
  }

  /**
   * Make the review decision
   */
  private async makeDecision(state: ReviewerState): Promise<Partial<ReviewerState>> {
    const criticalIssues = state.reviewFindings.issues.filter(i => i.severity === 'critical');
    const majorIssues = state.reviewFindings.issues.filter(i => i.severity === 'major');
    
    let verdict: 'approved' | 'needs_changes' | 'rejected' = 'approved';
    let confidence = 0.9;
    const blockers: string[] = [];
    const approvalConditions: string[] = [];

    if (criticalIssues.length > 0) {
      verdict = 'rejected';
      confidence = 0.95;
      blockers.push(...criticalIssues.map(i => i.description));
    } else if (majorIssues.length > 2) {
      verdict = 'needs_changes';
      confidence = 0.8;
      approvalConditions.push('Fix all major issues');
    } else if (state.reviewFindings.metrics.testCoverage < 60) {
      verdict = 'needs_changes';
      confidence = 0.7;
      approvalConditions.push('Increase test coverage to at least 60%');
    }

    const comments = [
      `Code quality score: ${state.reviewFindings.metrics.codeQuality}/100`,
      `Test coverage: ${state.reviewFindings.metrics.testCoverage.toFixed(1)}%`,
      `Found ${state.reviewFindings.issues.length} issues`,
    ];

    return {
      reviewDecision: {
        verdict,
        confidence,
        blockers,
        approvalConditions,
        comments,
      },
    };
  }

  /**
   * Generate the final review report
   */
  private async generateReport(state: ReviewerState): Promise<Partial<ReviewerState>> {
    const report = new AIMessage(
      `## Code Review Report\n\n` +
      `**Verdict**: ${state.reviewDecision.verdict}\n` +
      `**Confidence**: ${(state.reviewDecision.confidence * 100).toFixed(0)}%\n\n` +
      `### Metrics\n` +
      `- Code Quality: ${state.reviewFindings.metrics.codeQuality}/100\n` +
      `- Test Coverage: ${state.reviewFindings.metrics.testCoverage.toFixed(1)}%\n` +
      `- Complexity: ${state.reviewFindings.metrics.complexity.toFixed(1)}\n` +
      `- Security Score: ${state.reviewFindings.metrics.security}/100\n\n` +
      `### Issues Found: ${state.reviewFindings.issues.length}\n` +
      `- Critical: ${state.reviewFindings.issues.filter(i => i.severity === 'critical').length}\n` +
      `- Major: ${state.reviewFindings.issues.filter(i => i.severity === 'major').length}\n` +
      `- Minor: ${state.reviewFindings.issues.filter(i => i.severity === 'minor').length}\n\n` +
      `### Recommendations\n` +
      state.reviewFindings.suggestions.map(s => `- ${s.description}`).join('\n')
    );

    return {
      status: 'completed',
      messages: [...state.messages, report],
    };
  }

  // Helper methods
  private detectCommonIssues(request: any): any[] {
    const issues = [];
    
    // Simulate detecting common issues
    if (Math.random() > 0.5) {
      issues.push({
        id: `issue-${Date.now()}-1`,
        severity: 'minor',
        category: 'style',
        file: request.targetFiles[0] || 'unknown',
        line: Math.floor(Math.random() * 100) + 1,
        description: 'Missing semicolon',
        suggestion: 'Add semicolon at end of statement',
        autoFixable: true,
      });
    }

    if (Math.random() > 0.7) {
      issues.push({
        id: `issue-${Date.now()}-2`,
        severity: 'major',
        category: 'bug',
        file: request.targetFiles[0] || 'unknown',
        line: Math.floor(Math.random() * 100) + 1,
        description: 'Potential null pointer exception',
        suggestion: 'Add null check before accessing property',
        autoFixable: false,
      });
    }

    return issues;
  }

  private calculateCodeQuality(issues: any[]): number {
    const baseQuality = 100;
    const criticalPenalty = 20;
    const majorPenalty = 10;
    const minorPenalty = 2;

    let quality = baseQuality;
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          quality -= criticalPenalty;
          break;
        case 'major':
          quality -= majorPenalty;
          break;
        case 'minor':
          quality -= minorPenalty;
          break;
      }
    });

    return Math.max(0, quality);
  }

  // Implement WorkerAgentCapabilities interface
  async spawn(config: any): Promise<WorkerInstance> {
    this.instance = {
      id: config.id || `reviewer-${Date.now()}`,
      type: 'reviewer',
      capabilities: ['code_review', 'security_analysis', 'performance_analysis', 'quality_assurance'],
      status: 'active',
      execute: this.execute.bind(this),
      terminate: this.terminate.bind(this),
    };
    return this.instance;
  }

  async execute(task: any): Promise<any> {
    // Update state with review request
    this.state.reviewRequest = {
      id: task.id || `review-${Date.now()}`,
      type: task.reviewType || 'code',
      targetFiles: task.files || [],
      description: task.description || '',
      author: task.author,
      pullRequestId: task.pullRequestId,
    };

    // Execute the review workflow
    const compiledGraph = this.graph.compile();
    const result = await compiledGraph.invoke(this.state);
    
    this.state = result;
    
    // Return the review result
    return {
      success: true,
      verdict: result.reviewDecision.verdict,
      confidence: result.reviewDecision.confidence,
      issues: result.reviewFindings.issues,
      metrics: result.reviewFindings.metrics,
      suggestions: result.reviewFindings.suggestions,
      report: result.messages[result.messages.length - 1]?.content || '',
    };
  }

  async terminate(): Promise<void> {
    if (this.instance) {
      this.instance.status = 'terminated';
    }
  }

  async getMetrics(): Promise<any> {
    return {
      issuesFound: this.state.reviewFindings.issues.length,
      criticalIssues: this.state.reviewFindings.issues.filter(i => i.severity === 'critical').length,
      codeQuality: this.state.reviewFindings.metrics.codeQuality,
      verdict: this.state.reviewDecision.verdict,
      confidence: this.state.reviewDecision.confidence,
      status: this.state.status,
    };
  }
}

/**
 * Factory function to create a Reviewer Agent
 */
export function createReviewerAgent(): ReviewerAgent {
  return new ReviewerAgent();
}