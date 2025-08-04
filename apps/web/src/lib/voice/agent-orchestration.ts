/**
 * Agent Orchestration System
 * Routes voice inputs to appropriate Letta agents and manages agent handoffs
 */

import type { LettaVoiceAgent } from "@/components/voice/letta-voice-agent";
import type { VoiceAgentResponse } from "@/components/voice/types";

export enum AgentType {
	VOICE = "voice",
	CODE = "code",
	TASK = "task",
	MEMORY = "memory",
	ORCHESTRATOR = "orchestrator",
}

export interface AgentRoute {
	pattern: RegExp;
	agent: AgentType;
	priority: number;
	description: string;
}

export interface ConversationContext {
	sessionId: string;
	userId: string;
	currentAgentId?: string;
	conversationHistory: Message[];
	currentIntent: string;
	metadata: Record<string, unknown>;
	voicePreferences?: VoicePreferences;
}

export interface Message {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	agentType?: AgentType;
	metadata?: Record<string, unknown>;
}

export interface VoicePreferences {
	language: string;
	voice: string;
	rate: number;
	pitch: number;
	volume: number;
	transcriptionEnabled: boolean;
}

export interface AgentHandoffResult {
	success: boolean;
	fromAgent: AgentType;
	toAgent: AgentType;
	context: unknown;
	contextPreserved: boolean;
	handoffReason: string;
}

export class AgentRouter {
	private routes: AgentRoute[] = [];
	private readonly agents: Map<AgentType, LettaVoiceAgent> = new Map();
	private readonly defaultAgent: AgentType = AgentType.VOICE;

	constructor() {
		this.initializeRoutes();
	}

	/**
	 * Initialize routing patterns for different agent types
	 */
	private initializeRoutes(): void {
		this.routes = [
			// Code-related patterns (highest priority)
			{
				pattern:
					/\b(code|program|function|class|debug|error|bug|implement|generate|refactor|review)\b/i,
				agent: AgentType.CODE,
				priority: 10,
				description: "Code generation, debugging, and programming tasks",
			},
			{
				pattern:
					/\b(vibekit|react|javascript|typescript|python|html|css|api|component)\b/i,
				agent: AgentType.CODE,
				priority: 9,
				description: "Technology-specific code requests",
			},

			// Task management patterns
			{
				pattern:
					/\b(task|project|todo|organize|plan|schedule|github|repository|issue|pull request)\b/i,
				agent: AgentType.TASK,
				priority: 8,
				description: "Project and task management",
			},
			{
				pattern:
					/\b(create task|manage project|track progress|deadline|milestone)\b/i,
				agent: AgentType.TASK,
				priority: 9,
				description: "Specific task management actions",
			},

			// Memory management patterns
			{
				pattern:
					/\b(remember|forget|memory|recall|save|store|what did we discuss)\b/i,
				agent: AgentType.MEMORY,
				priority: 7,
				description: "Memory and context management",
			},

			// General conversation (lowest priority - fallback)
			{
				pattern: /.*/,
				agent: AgentType.VOICE,
				priority: 1,
				description: "General conversation and voice assistance",
			},
		];

		// Sort routes by priority (highest first)
		this.routes.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Route a message to the appropriate agent
	 */
	async routeMessage(
		message: string,
		_context: ConversationContext,
	): Promise<AgentType> {
		// Check for explicit agent switching commands
		const explicitAgent = this.checkExplicitAgentSwitch(message);
		if (explicitAgent) {
			return explicitAgent;
		}

		// Use pattern matching to determine the best agent
		for (const route of this.routes) {
			if (route.pattern.test(message)) {
				// Check if the agent is available
				if (this.agents.has(route.agent)) {
					return route.agent;
				}
			}
		}

		// Fallback to default agent
		return this.defaultAgent;
	}

	/**
	 * Handle agent handoff with context preservation
	 */
	async handleAgentHandoff(
		fromAgentType: AgentType,
		toAgentType: AgentType,
		context: ConversationContext,
		handoffReason = "User request routing",
	): Promise<AgentHandoffResult> {
		try {
			const fromAgent = this.agents.get(fromAgentType);
			const toAgent = this.agents.get(toAgentType);

			if (!fromAgent || !toAgent) {
				return {
					success: false,
					fromAgent: fromAgentType,
					toAgent: toAgentType,
					context: null,
					contextPreserved: false,
					handoffReason: "Agent not available",
				};
			}

			// Prepare handoff context
			const handoffContext = {
				conversationHistory: context.conversationHistory,
				currentIntent: context.currentIntent,
				metadata: context.metadata,
				handoffReason,
				timestamp: new Date(),
			};

			// Update context with new agent
			context.currentAgentId = toAgentType;
			context.metadata.lastHandoff = {
				from: fromAgentType,
				to: toAgentType,
				timestamp: new Date(),
				reason: handoffReason,
			};

			return {
				success: true,
				fromAgent: fromAgentType,
				toAgent: toAgentType,
				context: handoffContext,
				contextPreserved: true,
				handoffReason,
			};
		} catch (error) {
			console.error("Agent handoff failed:", error);
			return {
				success: false,
				fromAgent: fromAgentType,
				toAgent: toAgentType,
				context: null,
				contextPreserved: false,
				handoffReason: `Handoff failed: ${error}`,
			};
		}
	}

	/**
	 * Register an agent with the router
	 */
	registerAgent(type: AgentType, agent: LettaVoiceAgent): void {
		this.agents.set(type, agent);
		console.log(`Registered ${type} agent`);
	}

	/**
	 * Unregister an agent
	 */
	unregisterAgent(type: AgentType): void {
		this.agents.delete(type);
		console.log(`Unregistered ${type} agent`);
	}

	/**
	 * Get available agents
	 */
	getAvailableAgents(): AgentType[] {
		return Array.from(this.agents.keys());
	}

	/**
	 * Get agent by type
	 */
	getAgent(type: AgentType): LettaVoiceAgent | undefined {
		return this.agents.get(type);
	}

	/**
	 * Check for explicit agent switching commands
	 */
	private checkExplicitAgentSwitch(message: string): AgentType | null {
		const lowerMessage = message.toLowerCase();

		// Explicit agent switching patterns
		if (
			lowerMessage.includes("switch to code") ||
			lowerMessage.includes("code agent")
		) {
			return AgentType.CODE;
		}
		if (
			lowerMessage.includes("switch to task") ||
			lowerMessage.includes("task agent")
		) {
			return AgentType.TASK;
		}
		if (
			lowerMessage.includes("switch to voice") ||
			lowerMessage.includes("voice agent")
		) {
			return AgentType.VOICE;
		}
		if (
			lowerMessage.includes("switch to memory") ||
			lowerMessage.includes("memory agent")
		) {
			return AgentType.MEMORY;
		}

		return null;
	}

	/**
	 * Analyze conversation context to suggest agent switches
	 */
	analyzeContextForAgentSwitch(context: ConversationContext): AgentType | null {
		const recentMessages = context.conversationHistory.slice(-3);
		const combinedText = recentMessages.map((m) => m.content).join(" ");

		// If user is asking about multiple topics, suggest orchestrator
		const topicCount = this.countTopics(combinedText);
		if (topicCount > 2) {
			return AgentType.ORCHESTRATOR;
		}

		// Check if current agent is appropriate
		const suggestedAgent = this.routes.find((route) =>
			route.pattern.test(combinedText),
		)?.agent;
		if (suggestedAgent && suggestedAgent !== context.currentAgentId) {
			return suggestedAgent;
		}

		return null;
	}

	/**
	 * Count different topics in the text
	 */
	private countTopics(text: string): number {
		const topics = [
			/\b(code|program|function|class|debug)\b/i,
			/\b(task|project|todo|organize|plan)\b/i,
			/\b(remember|memory|recall|save)\b/i,
		];

		return topics.filter((topic) => topic.test(text)).length;
	}
}

/**
 * Agent Orchestration Service
 * Manages the overall coordination between agents
 */
export class AgentOrchestrationService {
	private router: AgentRouter;
	private activeContexts: Map<string, ConversationContext> = new Map();

	constructor() {
		this.router = new AgentRouter();
	}

	/**
	 * Process a voice message through the orchestration system
	 */
	async processVoiceMessage(
		message: string,
		sessionId: string,
		userId: string,
	): Promise<VoiceAgentResponse> {
		// Get or create conversation context
		let context = this.activeContexts.get(sessionId);
		if (!context) {
			context = this.createNewContext(sessionId, userId);
			this.activeContexts.set(sessionId, context);
		}

		// Route message to appropriate agent
		const targetAgentType = await this.router.routeMessage(message, context);
		const targetAgent = this.router.getAgent(targetAgentType);

		if (!targetAgent) {
			throw new Error(`Agent ${targetAgentType} not available`);
		}

		// Handle agent handoff if necessary
		if (context.currentAgentId && context.currentAgentId !== targetAgentType) {
			const handoffResult = await this.router.handleAgentHandoff(
				context.currentAgentId as AgentType,
				targetAgentType,
				context,
				"Message routing",
			);

			if (!handoffResult.success) {
				console.warn("Agent handoff failed:", handoffResult.handoffReason);
			}
		}

		// Update context
		context.currentAgentId = targetAgentType;
		context.currentIntent = this.extractIntent(message);

		// Add message to conversation history
		const userMessage: Message = {
			id: `msg-${Date.now()}-user`,
			role: "user",
			content: message,
			timestamp: new Date(),
			agentType: targetAgentType,
		};
		context.conversationHistory.push(userMessage);

		// Process message with the selected agent
		const response = await targetAgent.processVoiceInput(message);

		// Add response to conversation history
		const assistantMessage: Message = {
			id: response.messageId,
			role: "assistant",
			content: response.content,
			timestamp: new Date(),
			agentType: targetAgentType,
			metadata: response.metadata,
		};
		context.conversationHistory.push(assistantMessage);

		// Update context metadata
		context.metadata.lastActivity = new Date();
		context.metadata.messageCount =
			((context.metadata.messageCount as number) || 0) + 1;

		return response;
	}

	/**
	 * Register an agent with the orchestration system
	 */
	registerAgent(type: AgentType, agent: LettaVoiceAgent): void {
		this.router.registerAgent(type, agent);
	}

	/**
	 * Get conversation context
	 */
	getContext(sessionId: string): ConversationContext | undefined {
		return this.activeContexts.get(sessionId);
	}

	/**
	 * Clear conversation context
	 */
	clearContext(sessionId: string): void {
		this.activeContexts.delete(sessionId);
	}

	/**
	 * Get router instance
	 */
	getRouter(): AgentRouter {
		return this.router;
	}

	/**
	 * Create new conversation context
	 */
	private createNewContext(
		sessionId: string,
		userId: string,
	): ConversationContext {
		return {
			sessionId,
			userId,
			conversationHistory: [],
			currentIntent: "general",
			metadata: {
				createdAt: new Date(),
				lastActivity: new Date(),
				messageCount: 0,
			},
		};
	}

	/**
	 * Extract intent from message
	 */
	private extractIntent(message: string): string {
		const lowerMessage = message.toLowerCase();

		if (/\b(code|program|implement|debug)\b/.test(lowerMessage)) {
			return "coding";
		}
		if (/\b(task|project|organize|plan)\b/.test(lowerMessage)) {
			return "task_management";
		}
		if (/\b(remember|recall|memory)\b/.test(lowerMessage)) {
			return "memory_management";
		}
		if (/\b(help|assist|support)\b/.test(lowerMessage)) {
			return "assistance";
		}

		return "general";
	}
}

// Global orchestration service instance
export const agentOrchestrationService = new AgentOrchestrationService();
