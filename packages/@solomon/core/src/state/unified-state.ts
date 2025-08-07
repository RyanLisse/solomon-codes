/**
 * Unified state schema that combines all system features
 * This is the single source of truth for the entire agent system
 */

import type { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

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

// Claude Flow hive-mind state with LangGraph extensions
export const HiveMindStateSchema = BaseStateSchema.extend({
	// Strategic decision making (Queen Agent)
	queenDecisions: z
		.array(
			z.object({
				id: z.string(),
				type: z.enum(["technical", "resource", "priority", "strategic"]),
				timestamp: z.string(),
				decision: z.string(),
				reasoning: z.string(),
				confidence: z.number().min(0).max(1),
				impact: z.enum(["low", "medium", "high", "critical"]).default("medium"),
				status: z
					.enum(["proposed", "approved", "rejected", "implemented"])
					.default("proposed"),
			}),
		)
		.default([]),

	// Enhanced swarm coordination metrics
	swarmMetrics: z
		.object({
			totalAgents: z.number(),
			activeAgents: z.number(),
			idleAgents: z.number().default(0),
			busyAgents: z.number().default(0),
			failedAgents: z.number().default(0),
			taskCompletionRate: z.number(),
			averageResponseTime: z.number(),
			throughput: z.number().default(0),
			errorRate: z.number().default(0),
			lastUpdated: z.string().optional(),
		})
		.optional(),

	// Byzantine fault-tolerant consensus engine
	consensusEngine: z
		.object({
			// Current consensus session
			currentConsensus: z
				.object({
					id: z.string(),
					topic: z.string(),
					type: z.enum([
						"decision",
						"resource_allocation",
						"priority_change",
						"topology_switch",
					]),
					proposer: z.string(),
					votes: z.record(
						z.string(),
						z.object({
							vote: z.enum(["approve", "reject", "abstain"]),
							confidence: z.number().min(0).max(1),
							timestamp: z.string(),
							reasoning: z.string().optional(),
						}),
					),
					result: z.enum(["approved", "rejected", "pending", "timeout"]),
					quorumRequired: z.number().min(1),
					quorumReached: z.boolean().default(false),
					finalConfidence: z.number().min(0).max(1).optional(),
					startTime: z.string(),
					endTime: z.string().optional(),
					timeoutMs: z.number().default(30000),
				})
				.optional(),

			// Byzantine fault tolerance settings (2f+1 formula)
			byzantineSettings: z
				.object({
					maxFaultyNodes: z.number(), // f in 2f+1
					minQuorum: z.number(), // 2f+1
					currentNodes: z.number(),
					faultTolerance: z.number().min(0).max(1), // percentage
				})
				.default({
					maxFaultyNodes: 1,
					minQuorum: 3,
					currentNodes: 3,
					faultTolerance: 0.33,
				}),

			// Consensus history
			consensusHistory: z
				.array(
					z.object({
						id: z.string(),
						topic: z.string(),
						result: z.enum(["approved", "rejected", "timeout"]),
						voteSummary: z.object({
							approve: z.number(),
							reject: z.number(),
							abstain: z.number(),
						}),
						confidence: z.number().min(0).max(1),
						timestamp: z.string(),
						durationMs: z.number(),
					}),
				)
				.default([]),
		})
		.optional(),

	// Dynamic topology management
	topologyManager: z
		.object({
			currentTopology: z
				.enum(["hierarchical", "mesh", "ring", "star"])
				.default("hierarchical"),
			targetTopology: z
				.enum(["hierarchical", "mesh", "ring", "star"])
				.optional(),
			switchInProgress: z.boolean().default(false),
			switchStartTime: z.string().optional(),
			lastSwitchTime: z.string().optional(),

			// Topology performance metrics
			topologyMetrics: z
				.record(
					z.enum(["hierarchical", "mesh", "ring", "star"]),
					z.object({
						latency: z.number(),
						throughput: z.number(),
						efficiency: z.number().min(0).max(1),
						faultTolerance: z.number().min(0).max(1),
						lastMeasured: z.string(),
					}),
				)
				.default({}),

			// Network graph representation
			networkGraph: z
				.object({
					nodes: z.array(
						z.object({
							id: z.string(),
							type: z.enum(["queen", "worker", "specialist"]),
							status: z.enum(["active", "idle", "busy", "failed"]),
							connections: z.array(z.string()),
							load: z.number().min(0).max(1).default(0),
						}),
					),
					edges: z.array(
						z.object({
							from: z.string(),
							to: z.string(),
							weight: z.number().default(1),
							latency: z.number().default(0),
							bandwidth: z.number().default(100),
						}),
					),
				})
				.optional(),
		})
		.optional(),

	// 17-Phase implementation tracking
	implementationPhases: z
		.object({
			currentPhase: z.number().min(1).max(17).default(1),
			phases: z.record(
				z.string(), // phase-1, phase-2, etc.
				z.object({
					id: z.number(),
					name: z.string(),
					description: z.string(),
					status: z.enum([
						"pending",
						"in_progress",
						"completed",
						"failed",
						"blocked",
					]),
					priority: z.enum(["critical", "high", "medium", "low"]),
					dependencies: z.array(z.string()).default([]),
					assignedAgents: z.array(z.string()).default([]),
					startTime: z.string().optional(),
					endTime: z.string().optional(),
					estimatedDuration: z.number().optional(), // in minutes
					actualDuration: z.number().optional(),
					progress: z.number().min(0).max(100).default(0),
					tasks: z
						.array(
							z.object({
								id: z.string(),
								description: z.string(),
								status: z.enum([
									"pending",
									"in_progress",
									"completed",
									"failed",
								]),
								assignedAgent: z.string().optional(),
							}),
						)
						.default([]),
					blockers: z
						.array(
							z.object({
								id: z.string(),
								description: z.string(),
								severity: z.enum(["low", "medium", "high", "critical"]),
								resolvedBy: z.string().optional(),
								resolvedAt: z.string().optional(),
							}),
						)
						.default([]),
					qualityGates: z
						.array(
							z.object({
								name: z.string(),
								criteria: z.string(),
								status: z.enum(["pending", "passed", "failed"]),
								lastCheck: z.string().optional(),
							}),
						)
						.default([]),
				}),
			),
			overallProgress: z.number().min(0).max(100).default(0),
			lastUpdated: z.string().optional(),
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

// Enhanced tool integration state for adapters
export const ToolIntegrationStateSchema = z.object({
	// VibeTunnel real-time communication
	vibeTunnel: z
		.object({
			connections: z
				.array(
					z.object({
						id: z.string(),
						url: z.string(),
						status: z.enum([
							"connected",
							"disconnected",
							"reconnecting",
							"error",
						]),
						lastHeartbeat: z.string().optional(),
						latency: z.number().optional(),
					}),
				)
				.default([]),
			isEnabled: z.boolean().default(false),
			lastError: z.string().optional(),
		})
		.optional(),

	// Agent Inbox message coordination
	agentInbox: z
		.object({
			messageQueues: z
				.record(
					z.string(), // agent ID
					z.array(
						z.object({
							id: z.string(),
							from: z.string(),
							to: z.string(),
							content: z.string(),
							priority: z.enum(["low", "medium", "high", "critical"]),
							timestamp: z.string(),
							status: z.enum([
								"pending",
								"delivered",
								"acknowledged",
								"failed",
							]),
						}),
					),
				)
				.default({}),
			broadcastMessages: z
				.array(
					z.object({
						id: z.string(),
						from: z.string(),
						content: z.string(),
						timestamp: z.string(),
						recipients: z.array(z.string()),
						deliveryStatus: z.record(
							z.string(),
							z.enum(["pending", "delivered", "failed"]),
						),
					}),
				)
				.default([]),
			isEnabled: z.boolean().default(false),
		})
		.optional(),

	// Voice System speech processing
	voiceSystem: z
		.object({
			isListening: z.boolean().default(false),
			isSpeaking: z.boolean().default(false),
			currentTranscript: z.string().optional(),
			voiceProfile: z
				.object({
					voiceId: z.string(),
					language: z.string().default("en-US"),
					speed: z.number().min(0.1).max(3.0).default(1.0),
					pitch: z.number().min(-20).max(20).default(0),
					volume: z.number().min(0).max(1).default(0.8),
				})
				.optional(),
			speechQueue: z
				.array(
					z.object({
						id: z.string(),
						text: z.string(),
						priority: z.enum(["low", "medium", "high", "interrupt"]),
						status: z.enum(["queued", "speaking", "completed", "failed"]),
						timestamp: z.string(),
					}),
				)
				.default([]),
			isEnabled: z.boolean().default(false),
			lastError: z.string().optional(),
		})
		.optional(),

	// VibeKit Sandbox integration (future)
	vibeKitSandbox: z
		.object({
			sandboxes: z
				.array(
					z.object({
						id: z.string(),
						name: z.string(),
						status: z.enum(["creating", "running", "stopped", "error"]),
						url: z.string().optional(),
						environment: z.record(z.string(), z.string()).default({}),
						lastActivity: z.string(),
					}),
				)
				.default([]),
			isEnabled: z.boolean().default(false),
		})
		.optional(),
});

// Combined unified state with LangGraph migration support
export const UnifiedStateSchema = z.object({
	manager: ManagerStateSchema,
	planner: PlannerStateSchema,
	programmer: ProgrammerStateSchema,
	reviewer: ReviewerStateSchema,
	hiveMind: HiveMindStateSchema,
	voice: VoiceStateSchema,
	toolIntegration: ToolIntegrationStateSchema.optional(),

	// LangGraph checkpoint management
	checkpoint: z
		.object({
			id: z.string(),
			timestamp: z.string(),
			version: z.number().default(1),
			frequency: z
				.enum(["never", "low", "medium", "high", "always"])
				.default("medium"),
			lastCheckpoint: z.string().optional(),
			nextCheckpoint: z.string().optional(),
			isAutomatic: z.boolean().default(true),
			compressionEnabled: z.boolean().default(true),
			retentionDays: z.number().default(30),
			storageUsageMB: z.number().default(0),
		})
		.optional(),

	// Performance and monitoring
	performanceMetrics: z
		.object({
			cpuUsage: z.number().min(0).max(100).default(0),
			memoryUsageMB: z.number().default(0),
			networkLatencyMs: z.number().default(0),
			throughputOpsPerSec: z.number().default(0),
			errorCount: z.number().default(0),
			successCount: z.number().default(0),
			averageDurationMs: z.number().default(0),
			lastMeasurement: z.string().optional(),
		})
		.optional(),

	// Global metadata
	sessionId: z.string(),
	startTime: z.string(),
	lastActivity: z.string(),
	version: z.string().default("2.0.0"), // Incremented for LangGraph migration
	migrationState: z
		.object({
			phase: z
				.enum([
					"planning",
					"preparation",
					"migration",
					"validation",
					"completion",
				])
				.default("planning"),
			startedAt: z.string().optional(),
			completedAt: z.string().optional(),
			previousVersion: z.string().optional(),
			rollbackAvailable: z.boolean().default(false),
			migrationLog: z
				.array(
					z.object({
						timestamp: z.string(),
						action: z.string(),
						status: z.enum(["success", "error", "warning"]),
						message: z.string(),
						details: z.any().optional(),
					}),
				)
				.default([]),
		})
		.optional(),
});

// Type exports with LangGraph migration extensions
export type BaseState = z.infer<typeof BaseStateSchema>;
export type ToolIntegrationState = z.infer<typeof ToolIntegrationStateSchema>;

// LangGraph Annotation for BaseState - required for proper graph compilation
export const BaseStateAnnotation = Annotation.Root({
	// Core messaging - append new messages
	messages: Annotation<BaseMessage[]>({
		reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
		default: () => [],
	}),

	// Agent coordination - replace arrays
	activeAgents: Annotation<string[]>({
		reducer: (x: string[], y: string[]) => y,
		default: () => [],
	}),
	swarmTopology: Annotation<"hierarchical" | "mesh" | "ring" | "star">({
		reducer: (x, y) => y ?? x,
		default: () => "hierarchical" as const,
	}),

	// Task management
	currentTask: Annotation<string | undefined>({
		reducer: (x, y) => y ?? x,
		default: () => undefined,
	}),
	taskQueue: Annotation<
		Array<{
			id: string;
			description: string;
			priority: "low" | "medium" | "high" | "critical";
			status: "pending" | "in_progress" | "completed" | "failed";
			assignedAgent?: string;
		}>
	>({
		reducer: (x, y) => y,
		default: () => [],
	}),

	// Context and memory - merge objects
	memory: Annotation<Record<string, any>>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({}),
	}),
	context: Annotation<Record<string, any>>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({}),
	}),

	// Execution state
	executionMode: Annotation<"planning" | "coding" | "testing" | "reviewing">({
		reducer: (x, y) => y ?? x,
		default: () => "planning" as const,
	}),
	iterations: Annotation<number>({
		reducer: (x, y) => y ?? x,
		default: () => 0,
	}),
	maxIterations: Annotation<number>({
		reducer: (x, y) => y ?? x,
		default: () => 10,
	}),

	// Error handling - append errors (with clearing support)
	errors: Annotation<
		Array<{
			timestamp: string;
			agent: string;
			error: string;
			context?: any;
		}>
	>({
		reducer: (x, y) => {
			// Support clearing errors by passing empty array
			if (y.length === 0) return [];
			// Otherwise append new errors
			return x.concat(y);
		},
		default: () => [],
	}),

	// Human interaction
	humanInteractionRequired: Annotation<boolean>({
		reducer: (x, y) => y ?? x,
		default: () => false,
	}),
	humanFeedback: Annotation<string | undefined>({
		reducer: (x, y) => y ?? x,
		default: () => undefined,
	}),
	approvalStatus: Annotation<"pending" | "approved" | "rejected" | undefined>({
		reducer: (x, y) => y ?? x,
		default: () => undefined,
	}),
});
export type ManagerState = z.infer<typeof ManagerStateSchema>;
export type PlannerState = z.infer<typeof PlannerStateSchema>;
export type ProgrammerState = z.infer<typeof ProgrammerStateSchema>;
export type ReviewerState = z.infer<typeof ReviewerStateSchema>;
export type HiveMindState = z.infer<typeof HiveMindStateSchema>;
export type VoiceState = z.infer<typeof VoiceStateSchema>;
export type UnifiedState = z.infer<typeof UnifiedStateSchema>;

// Enhanced type exports for LangGraph migration
export type ByzantineConsensusEngine = NonNullable<
	HiveMindState["consensusEngine"]
>;
export type TopologyManager = NonNullable<HiveMindState["topologyManager"]>;
export type ImplementationPhases = NonNullable<
	HiveMindState["implementationPhases"]
>;
export type NetworkGraph = NonNullable<TopologyManager["networkGraph"]>;
export type ConsensusSession = NonNullable<
	ByzantineConsensusEngine["currentConsensus"]
>;

// Enhanced state factory functions for LangGraph migration
export function createInitialState(): UnifiedState {
	const now = new Date().toISOString();
	const sessionId = crypto.randomUUID();

	return {
		manager: ManagerStateSchema.parse({}),
		planner: PlannerStateSchema.parse({}),
		programmer: ProgrammerStateSchema.parse({}),
		reviewer: ReviewerStateSchema.parse({}),
		hiveMind: HiveMindStateSchema.parse({}),
		voice: VoiceStateSchema.parse({}),
		toolIntegration: ToolIntegrationStateSchema.parse({}),
		checkpoint: {
			id: `checkpoint-${sessionId}`,
			timestamp: now,
			version: 1,
			frequency: "medium",
			isAutomatic: true,
			compressionEnabled: true,
			retentionDays: 30,
			storageUsageMB: 0,
		},
		performanceMetrics: {
			cpuUsage: 0,
			memoryUsageMB: 0,
			networkLatencyMs: 0,
			throughputOpsPerSec: 0,
			errorCount: 0,
			successCount: 0,
			averageDurationMs: 0,
			lastMeasurement: now,
		},
		sessionId,
		startTime: now,
		lastActivity: now,
		version: "2.0.0",
		migrationState: {
			phase: "planning",
			startedAt: now,
			previousVersion: "1.0.0",
			rollbackAvailable: true,
			migrationLog: [
				{
					timestamp: now,
					action: "initialization",
					status: "success",
					message: "LangGraph migration state initialized",
					details: { sessionId, version: "2.0.0" },
				},
			],
		},
	};
}

// Create initial 17-phase implementation plan
export function createImplementationPhases(): ImplementationPhases {
	const now = new Date().toISOString();

	return {
		currentPhase: 1,
		phases: {
			"phase-1": {
				id: 1,
				name: "Foundation",
				description:
					"Fix SwarmCoordinator, implement LangGraph base config, create tool adapter framework",
				status: "in_progress",
				priority: "critical",
				dependencies: [],
				assignedAgents: [
					"system-architect",
					"backend-dev",
					"integration-specialist",
				],
				startTime: now,
				estimatedDuration: 120, // 2 hours
				progress: 25,
				tasks: [
					{
						id: "task-1-1",
						description: "Extend unified state schema",
						status: "in_progress",
						assignedAgent: "system-architect",
					},
					{
						id: "task-1-2",
						description: "Implement tool adapter framework",
						status: "pending",
						assignedAgent: "backend-dev",
					},
					{
						id: "task-1-3",
						description: "Setup checkpoint management",
						status: "pending",
						assignedAgent: "integration-specialist",
					},
				],
				qualityGates: [
					{
						name: "All tests passing",
						criteria: "100% test suite completion",
						status: "pending",
					},
					{
						name: "State schema validation",
						criteria: "All state transitions validated",
						status: "pending",
					},
				],
			},
			// Additional phases would be defined here...
		},
		overallProgress: 5,
		lastUpdated: now,
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
	context?: Record<string, unknown>,
): BaseState {
	return {
		...state,
		errors: [
			...(state.errors || []),
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

// LangGraph migration-specific helpers
export function updateImplementationPhase(
	state: HiveMindState,
	phaseId: string,
	updates: Partial<ImplementationPhases["phases"][string]>,
): HiveMindState {
	if (!state.implementationPhases) {
		return {
			...state,
			implementationPhases: createImplementationPhases(),
		};
	}

	return {
		...state,
		implementationPhases: {
			...state.implementationPhases,
			phases: {
				...state.implementationPhases.phases,
				[phaseId]: {
					...state.implementationPhases.phases[phaseId],
					...updates,
				},
			},
			lastUpdated: new Date().toISOString(),
		},
	};
}

export function startConsensusSession(
	state: HiveMindState,
	topic: string,
	type: ConsensusSession["type"],
	proposer: string,
	timeoutMs = 30000,
): HiveMindState {
	const sessionId = `consensus-${Date.now()}`;
	const now = new Date().toISOString();

	// Calculate Byzantine quorum (2f+1)
	const totalAgents = state.swarmMetrics?.totalAgents || 3;
	const maxFaultyNodes = Math.floor((totalAgents - 1) / 3);
	const quorumRequired = 2 * maxFaultyNodes + 1;

	return {
		...state,
		consensusEngine: {
			...state.consensusEngine,
			currentConsensus: {
				id: sessionId,
				topic,
				type,
				proposer,
				votes: {},
				result: "pending",
				quorumRequired,
				quorumReached: false,
				startTime: now,
				timeoutMs,
			},
			byzantineSettings: {
				maxFaultyNodes,
				minQuorum: quorumRequired,
				currentNodes: totalAgents,
				faultTolerance: maxFaultyNodes / totalAgents,
			},
		},
	};
}

export function switchTopology(
	state: HiveMindState,
	targetTopology: TopologyManager["currentTopology"],
): HiveMindState {
	const now = new Date().toISOString();

	return {
		...state,
		topologyManager: {
			...state.topologyManager,
			targetTopology,
			switchInProgress: true,
			switchStartTime: now,
			lastSwitchTime: now,
		},
	};
}
