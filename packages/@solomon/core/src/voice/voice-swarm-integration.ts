import { EventEmitter } from "events";
import { z } from "zod";
import type { AgentInbox } from "../inbox/agent-inbox";
import type { SwarmCoordinator } from "../swarm/swarm-coordinator";

// Voice command schemas
export const VoiceCommandSchema = z.object({
	id: z.string(),
	userId: z.string(),
	sessionId: z.string(),
	transcript: z.string(),
	intent: z.string().optional(),
	entities: z.record(z.any()).optional(),
	confidence: z.number().min(0).max(1),
	timestamp: z.string(),
	audioData: z.string().optional(), // Base64 encoded audio
	language: z.string().default("en-US"),
});

export type VoiceCommand = z.infer<typeof VoiceCommandSchema>;

export const VoiceResponseSchema = z.object({
	id: z.string(),
	commandId: z.string(),
	agentId: z.string(),
	text: z.string(),
	audioUrl: z.string().optional(),
	emotion: z
		.enum(["neutral", "happy", "confident", "thoughtful"])
		.default("neutral"),
	visualData: z.any().optional(),
	actions: z
		.array(
			z.object({
				type: z.string(),
				payload: z.any(),
			}),
		)
		.optional(),
});

export type VoiceResponse = z.infer<typeof VoiceResponseSchema>;

// Voice-to-Agent routing configuration
export interface VoiceRoutingConfig {
	intents: Map<string, string>; // intent -> agentId mapping
	defaultAgent: string;
	confidenceThreshold: number;
}

// Voice Swarm Integration
export class VoiceSwarmIntegration extends EventEmitter {
	private inbox: AgentInbox;
	private swarmCoordinator: SwarmCoordinator;
	private routingConfig: VoiceRoutingConfig;
	private activeCommands: Map<string, VoiceCommand> = new Map();
	private commandHistory: VoiceCommand[] = [];
	private responseHistory: VoiceResponse[] = [];

	constructor(
		inbox: AgentInbox,
		swarmCoordinator: SwarmCoordinator,
		routingConfig: VoiceRoutingConfig,
	) {
		super();
		this.inbox = inbox;
		this.swarmCoordinator = swarmCoordinator;
		this.routingConfig = routingConfig;

		this.setupInboxHandlers();
	}

	// Process incoming voice command
	async processVoiceCommand(command: VoiceCommand): Promise<VoiceResponse> {
		try {
			// Validate command
			const validated = VoiceCommandSchema.parse(command);

			// Store command
			this.activeCommands.set(validated.id, validated);
			this.commandHistory.push(validated);
			this.emit("command:received", validated);

			// Determine target agent
			const targetAgent = await this.determineTargetAgent(validated);

			// Create inbox message
			const messageId = await this.inbox.send({
				from: `voice_${validated.userId}`,
				to: targetAgent,
				type: "voice_command",
				priority: this.getPriority(validated),
				content: {
					command: validated,
					context: await this.gatherContext(validated),
				},
				correlationId: validated.id,
				sessionId: validated.sessionId,
				retryCount: 0,
				maxRetries: 2,
			});

			// Wait for response
			const response = await this.waitForResponse(validated.id, messageId);

			// Store and return response
			this.responseHistory.push(response);
			this.activeCommands.delete(validated.id);
			this.emit("response:sent", response);

			return response;
		} catch (error) {
			this.emit("error", error);
			throw error;
		}
	}

	// Determine which agent should handle the command
	private async determineTargetAgent(command: VoiceCommand): Promise<string> {
		// Check confidence threshold
		if (command.confidence < this.routingConfig.confidenceThreshold) {
			return this.routingConfig.defaultAgent;
		}

		// Use intent-based routing if available
		if (command.intent && this.routingConfig.intents.has(command.intent)) {
			return this.routingConfig.intents.get(command.intent)!;
		}

		// Analyze command for routing
		const analysis = await this.analyzeCommand(command);

		// Route based on analysis
		if (analysis.suggestedAgent) {
			return analysis.suggestedAgent;
		}

		return this.routingConfig.defaultAgent;
	}

	// Analyze command to determine routing
	private async analyzeCommand(
		command: VoiceCommand,
	): Promise<{ suggestedAgent?: string }> {
		const lowerTranscript = command.transcript.toLowerCase();

		// Code-related keywords
		if (
			lowerTranscript.match(
				/\b(code|function|class|debug|implement|fix|bug|error)\b/,
			)
		) {
			return { suggestedAgent: "programmer" };
		}

		// Planning keywords
		if (
			lowerTranscript.match(
				/\b(plan|design|architect|structure|organize|strategy)\b/,
			)
		) {
			return { suggestedAgent: "planner" };
		}

		// Review keywords
		if (
			lowerTranscript.match(/\b(review|check|verify|test|quality|improve)\b/)
		) {
			return { suggestedAgent: "reviewer" };
		}

		// Task management keywords
		if (
			lowerTranscript.match(/\b(task|todo|assign|schedule|manage|coordinate)\b/)
		) {
			return { suggestedAgent: "manager" };
		}

		return {};
	}

	// Determine message priority based on command
	private getPriority(
		command: VoiceCommand,
	): "critical" | "high" | "normal" | "low" {
		const lowerTranscript = command.transcript.toLowerCase();

		if (
			lowerTranscript.includes("urgent") ||
			lowerTranscript.includes("critical")
		) {
			return "critical";
		}

		if (
			lowerTranscript.includes("important") ||
			lowerTranscript.includes("asap")
		) {
			return "high";
		}

		if (command.confidence < 0.5) {
			return "low";
		}

		return "normal";
	}

	// Gather context for the command
	private async gatherContext(command: VoiceCommand): Promise<any> {
		return {
			recentCommands: this.commandHistory.slice(-5),
			sessionContext: await this.getSessionContext(command.sessionId),
			userPreferences: await this.getUserPreferences(command.userId),
			timestamp: new Date().toISOString(),
		};
	}

	// Get session context
	private async getSessionContext(sessionId: string): Promise<any> {
		// Get recent commands and responses from this session
		const sessionCommands = this.commandHistory.filter(
			(c) => c.sessionId === sessionId,
		);
		const sessionResponses = this.responseHistory.filter((r) =>
			sessionCommands.some((c) => c.id === r.commandId),
		);

		return {
			commandCount: sessionCommands.length,
			lastCommand: sessionCommands[sessionCommands.length - 1],
			lastResponse: sessionResponses[sessionResponses.length - 1],
		};
	}

	// Get user preferences
	private async getUserPreferences(_userId: string): Promise<any> {
		// This would typically fetch from a database
		return {
			preferredAgent: null,
			language: "en-US",
			responseStyle: "concise",
		};
	}

	// Wait for agent response
	private async waitForResponse(
		commandId: string,
		_messageId: string,
	): Promise<VoiceResponse> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("Response timeout"));
			}, 30000); // 30 second timeout

			const handler = (data: any) => {
				if (data.message?.correlationId === commandId) {
					clearTimeout(timeout);
					this.inbox.off("message:completed", handler);

					const response: VoiceResponse = {
						id: this.generateResponseId(),
						commandId,
						agentId: data.message.to,
						text:
							data.result.text || "I understand. Let me help you with that.",
						audioUrl: data.result.audioUrl,
						emotion: data.result.emotion || "neutral",
						visualData: data.result.visualData,
						actions: data.result.actions,
					};

					resolve(response);
				}
			};

			this.inbox.on("message:completed", handler);
		});
	}

	// Setup inbox handlers for voice responses
	private setupInboxHandlers(): void {
		// Register voice response handler
		this.inbox.registerHandler("voice_response", async (message) => {
			const command = this.activeCommands.get(message.correlationId || "");
			if (!command) {
				throw new Error("Command not found for response");
			}

			// Process with swarm if needed
			if (message.content.requiresSwarm) {
				const swarmResult = await this.swarmCoordinator.processTask({
					id: message.id,
					type: "voice_processing",
					description: command.transcript,
					priority: message.priority as any,
					status: "pending",
					createdAt: new Date().toISOString(),
					assignedAgents: [],
				});

				return {
					text: swarmResult.result,
					emotion: "confident",
					actions: swarmResult.actions,
				};
			}

			return message.content;
		});
	}

	// Generate unique response ID
	private generateResponseId(): string {
		return `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	// Get voice interaction statistics
	getStats() {
		return {
			activeCommands: this.activeCommands.size,
			totalCommands: this.commandHistory.length,
			totalResponses: this.responseHistory.length,
			averageConfidence:
				this.commandHistory.reduce((sum, c) => sum + c.confidence, 0) /
				(this.commandHistory.length || 1),
			agentDistribution: this.getAgentDistribution(),
		};
	}

	// Get distribution of commands across agents
	private getAgentDistribution(): Record<string, number> {
		const distribution: Record<string, number> = {};

		for (const response of this.responseHistory) {
			distribution[response.agentId] =
				(distribution[response.agentId] || 0) + 1;
		}

		return distribution;
	}

	// Clear history
	clearHistory(): void {
		this.commandHistory = [];
		this.responseHistory = [];
		this.activeCommands.clear();
	}
}

// Factory function
export function createVoiceSwarmIntegration(
	inbox: AgentInbox,
	swarmCoordinator: SwarmCoordinator,
	config?: Partial<VoiceRoutingConfig>,
): VoiceSwarmIntegration {
	const defaultConfig: VoiceRoutingConfig = {
		intents: new Map([
			["code_generation", "programmer"],
			["code_review", "reviewer"],
			["planning", "planner"],
			["task_management", "manager"],
		]),
		defaultAgent: "manager",
		confidenceThreshold: 0.7,
		...config,
	};

	return new VoiceSwarmIntegration(inbox, swarmCoordinator, defaultConfig);
}
