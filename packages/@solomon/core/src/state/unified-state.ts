/**
 * Unified state schema that combines all system features
 * This is the single source of truth for the entire agent system
 */

import { z } from "zod";
import { BaseMessage } from "@langchain/core/messages";

// Base state that all agents share
export const BaseStateSchema = z.object({
  // Core messaging
  messages: z.array(z.custom<BaseMessage>()).default([]),

  // Agent coordination
  activeAgents: z.array(z.string()).default([]),
  swarmTopology: z
    .enum(["hierarchical", "mesh", "ring", "star"])
    .default("hierarchical"),

  // Task management
  currentTask: z.string().optional(),
  taskQueue: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        priority: z.enum(["low", "medium", "high", "critical"]),
        status: z.enum(["pending", "in_progress", "completed", "failed"]),
        assignedAgent: z.string().optional(),
      }),
    )
    .default([]),

  // Context and memory
  memory: z.record(z.string(), z.any()).default({}),
  context: z
    .object({
      repository: z.string().optional(),
      branch: z.string().optional(),
      sessionId: z.string().optional(),
      sandboxId: z.string().optional(),
    })
    .default({}),

  // Execution state
  executionMode: z
    .enum(["planning", "coding", "testing", "reviewing"])
    .default("planning"),
  iterations: z.number().default(0),
  maxIterations: z.number().default(10),

  // Error handling
  errors: z
    .array(
      z.object({
        timestamp: z.string(),
        agent: z.string(),
        error: z.string(),
        context: z.any().optional(),
      }),
    )
    .default([]),

  // Human interaction
  humanInteractionRequired: z.boolean().default(false),
  humanFeedback: z.string().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
});

// Manager graph state (orchestrator)
export const ManagerStateSchema = BaseStateSchema.extend({
  plannerSession: z
    .object({
      threadId: z.string(),
      runId: z.string(),
    })
    .optional(),

  programmerSession: z
    .object({
      threadId: z.string(),
      runId: z.string(),
    })
    .optional(),

  reviewerSession: z
    .object({
      threadId: z.string(),
      runId: z.string(),
    })
    .optional(),

  // Task classification
  taskType: z
    .enum(["bug_fix", "feature", "refactor", "test", "documentation"])
    .optional(),
  complexity: z.enum(["simple", "medium", "complex"]).optional(),

  // Resource allocation
  resourceAllocation: z
    .record(
      z.string(),
      z.object({
        cpu: z.number(),
        memory: z.number(),
        priority: z.number(),
      }),
    )
    .default({}),
});

// Planner graph state
export const PlannerStateSchema = BaseStateSchema.extend({
  plan: z
    .object({
      id: z.string(),
      steps: z.array(
        z.object({
          id: z.string(),
          description: z.string(),
          dependencies: z.array(z.string()).default([]),
          status: z.enum(["pending", "in_progress", "completed", "failed"]),
          assignedAgent: z.string().optional(),
        }),
      ),
      estimatedTime: z.number().optional(),
      requiredTools: z.array(z.string()).default([]),
    })
    .optional(),

  // DeepAgents integration
  subAgents: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        status: z.enum(["idle", "working", "completed", "failed"]),
        context: z.any(),
      }),
    )
    .default([]),

  // VibeTunnel integration
  remoteTerminals: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        status: z.enum(["connected", "disconnected"]),
      }),
    )
    .default([]),
});

// Programmer graph state
export const ProgrammerStateSchema = BaseStateSchema.extend({
  codeChanges: z
    .array(
      z.object({
        file: z.string(),
        changes: z.string(),
        language: z.string(),
        status: z.enum(["pending", "applied", "reverted"]),
      }),
    )
    .default([]),

  // Sandbox state
  sandboxConfig: z
    .object({
      provider: z.enum(["e2b", "dagger", "cloudflare", "daytona"]),
      sessionId: z.string().optional(),
      environment: z.record(z.string(), z.string()).default({}),
    })
    .optional(),

  // Browser automation state
  browserSessions: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        status: z.enum(["active", "idle", "closed"]),
        stagehandReady: z.boolean().default(false),
      }),
    )
    .default([]),

  // Test results
  testResults: z
    .object({
      passed: z.number().default(0),
      failed: z.number().default(0),
      skipped: z.number().default(0),
      coverage: z.number().optional(),
    })
    .optional(),
});

// Reviewer graph state
export const ReviewerStateSchema = BaseStateSchema.extend({
  reviewComments: z
    .array(
      z.object({
        file: z.string(),
        line: z.number(),
        comment: z.string(),
        severity: z.enum(["info", "warning", "error"]),
        resolved: z.boolean().default(false),
      }),
    )
    .default([]),

  approvalStatus: z
    .enum(["pending", "approved", "changes_requested", "rejected"])
    .default("pending"),

  qualityMetrics: z
    .object({
      codeQuality: z.number().min(0).max(100),
      testCoverage: z.number().min(0).max(100),
      documentation: z.number().min(0).max(100),
      performance: z.number().min(0).max(100),
    })
    .optional(),
});

// Claude Flow hive-mind state
export const HiveMindStateSchema = BaseStateSchema.extend({
  queenDecisions: z
    .array(
      z.object({
        timestamp: z.string(),
        decision: z.string(),
        reasoning: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .default([]),

  swarmMetrics: z
    .object({
      totalAgents: z.number(),
      activeAgents: z.number(),
      taskCompletionRate: z.number(),
      averageResponseTime: z.number(),
    })
    .optional(),

  consensusState: z
    .object({
      topic: z.string(),
      votes: z.record(z.string(), z.enum(["approve", "reject", "abstain"])),
      result: z.enum(["approved", "rejected", "pending"]),
    })
    .optional(),
});

// Voice interaction state
export const VoiceStateSchema = z.object({
  isListening: z.boolean().default(false),
  transcript: z.string().optional(),
  audioLevel: z.number().min(0).max(1).default(0),

  lettaMemory: z
    .object({
      coreMemory: z.string(),
      archivalMemory: z.array(z.string()),
      recallMemory: z.array(z.string()),
    })
    .optional(),

  conversationContext: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        timestamp: z.string(),
      }),
    )
    .default([]),
});

// Combined unified state
export const UnifiedStateSchema = z.object({
  manager: ManagerStateSchema,
  planner: PlannerStateSchema,
  programmer: ProgrammerStateSchema,
  reviewer: ReviewerStateSchema,
  hiveMind: HiveMindStateSchema,
  voice: VoiceStateSchema,

  // Global metadata
  sessionId: z.string(),
  startTime: z.string(),
  lastActivity: z.string(),
  version: z.string().default("1.0.0"),
});

// Type exports
export type BaseState = z.infer<typeof BaseStateSchema>;
export type ManagerState = z.infer<typeof ManagerStateSchema>;
export type PlannerState = z.infer<typeof PlannerStateSchema>;
export type ProgrammerState = z.infer<typeof ProgrammerStateSchema>;
export type ReviewerState = z.infer<typeof ReviewerStateSchema>;
export type HiveMindState = z.infer<typeof HiveMindStateSchema>;
export type VoiceState = z.infer<typeof VoiceStateSchema>;
export type UnifiedState = z.infer<typeof UnifiedStateSchema>;

// State factory functions
export function createInitialState(): UnifiedState {
  const now = new Date().toISOString();
  return {
    manager: ManagerStateSchema.parse({}),
    planner: PlannerStateSchema.parse({}),
    programmer: ProgrammerStateSchema.parse({}),
    reviewer: ReviewerStateSchema.parse({}),
    hiveMind: HiveMindStateSchema.parse({}),
    voice: VoiceStateSchema.parse({}),
    sessionId: crypto.randomUUID(),
    startTime: now,
    lastActivity: now,
    version: "1.0.0",
  };
}

// State update helpers
export function updateLastActivity(state: UnifiedState): UnifiedState {
  return {
    ...state,
    lastActivity: new Date().toISOString(),
  };
}

export function addError(
  state: BaseState,
  agent: string,
  error: string,
  context?: any,
): BaseState {
  return {
    ...state,
    errors: [
      ...state.errors,
      {
        timestamp: new Date().toISOString(),
        agent,
        error,
        context,
      },
    ],
  };
}

export function updateTaskStatus(
  state: BaseState,
  taskId: string,
  status: "pending" | "in_progress" | "completed" | "failed",
): BaseState {
  return {
    ...state,
    taskQueue: state.taskQueue.map((task) =>
      task.id === taskId ? { ...task, status } : task,
    ),
  };
}

