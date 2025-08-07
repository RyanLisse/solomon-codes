/**
 * Agent Inbox Adapter - Message coordination and communication hub for swarm agents
 * Provides reliable message delivery, queuing, and broadcast capabilities
 */

import { z } from "zod";
import type { ToolIntegrationState } from "../../state/unified-state";
import { type AdapterConfig, BaseAdapter } from "../adapter-framework";

// Agent Inbox specific configuration
export const AgentInboxConfigSchema = z.object({
	...z.object({
		retryAttempts: z.number().min(0).default(3),
		retryDelayMs: z.number().min(100).default(1000),
		healthCheckIntervalMs: z.number().min(1000).default(30000),
		timeoutMs: z.number().min(1000).default(10000),
		circuitBreakerThreshold: z.number().min(1).default(5),
		enabled: z.boolean().default(true),
	}).shape,
	// Agent Inbox specific settings
	maxQueueSize: z.number().min(1).default(1000),
	messageRetentionMs: z.number().min(1000).default(86400000), // 24 hours
	deliveryTimeoutMs: z.number().min(1000).default(30000),
	maxBroadcastRecipients: z.number().min(1).default(100),
	compressionEnabled: z.boolean().default(true),
	priorityLevels: z
		.array(z.enum(["low", "medium", "high", "critical"]))
		.default(["low", "medium", "high", "critical"]),
});

export type AgentInboxConfig = z.infer<typeof AgentInboxConfigSchema>;

// Message structure
interface InboxMessage {
	id: string;
	from: string;
	to: string;
	content: string;
	priority: "low" | "medium" | "high" | "critical";
	timestamp: string;
	status: "pending" | "delivered" | "acknowledged" | "failed";
	retryCount: number;
	expiresAt?: string;
	metadata?: Record<string, unknown>;
}

// Broadcast message structure
interface BroadcastMessage {
	id: string;
	from: string;
	content: string;
	timestamp: string;
	recipients: string[];
	deliveryStatus: Record<string, "pending" | "delivered" | "failed">;
	metadata?: Record<string, unknown>;
}

// Input/Output types for Agent Inbox operations
export interface AgentInboxInput {
	action:
		| "send"
		| "receive"
		| "broadcast"
		| "acknowledge"
		| "get_status"
		| "clear_queue"
		| "register_agent"
		| "unregister_agent";
	agentId?: string;
	message?: {
		to: string;
		content: string;
		priority?: "low" | "medium" | "high" | "critical";
		expiresAt?: string;
		metadata?: Record<string, unknown>;
	};
	messageId?: string;
	broadcast?: {
		content: string;
		recipients: string[];
		metadata?: Record<string, unknown>;
	};
	limit?: number;
}

export interface AgentInboxResult {
	success: boolean;
	messages?: InboxMessage[];
	message?: InboxMessage;
	broadcast?: BroadcastMessage;
	status?: {
		agentId: string;
		queueSize: number;
		pendingMessages: number;
		lastActivity?: string;
	};
	agents?: string[];
	error?: string;
}

export class AgentInboxAdapter extends BaseAdapter<
	AgentInboxConfig,
	AgentInboxResult
> {
	private messageQueues = new Map<string, InboxMessage[]>();
	private broadcastMessages: BroadcastMessage[] = [];
	private registeredAgents = new Set<string>();
	private deliveryTimers = new Map<string, NodeJS.Timeout>();
	private cleanupTimer?: NodeJS.Timeout;
	private messageHandlers = new Map<string, (message: InboxMessage) => void>();

	constructor() {
		super("agentInbox", "1.0.0");
	}

	protected async onInitialize(): Promise<void> {
		// Start periodic cleanup of expired messages
		this.startMessageCleanup();
	}

	protected async onHealthCheck(): Promise<boolean> {
		// Check if queues are not overwhelmed
		const totalMessages = Array.from(this.messageQueues.values()).reduce(
			(sum, queue) => sum + queue.length,
			0,
		);

		return (
			totalMessages < this.config.maxQueueSize * this.registeredAgents.size
		);
	}

	protected async onExecute(input: unknown): Promise<AgentInboxResult> {
		const inboxInput = input as AgentInboxInput;

		switch (inboxInput.action) {
			case "register_agent":
				if (!inboxInput.agentId) {
					throw new Error("Agent ID required for register action");
				}
				return this.handleRegisterAgent(inboxInput.agentId);

			case "unregister_agent":
				if (!inboxInput.agentId) {
					throw new Error("Agent ID required for unregister action");
				}
				return this.handleUnregisterAgent(inboxInput.agentId);

			case "send":
				if (!inboxInput.agentId || !inboxInput.message) {
					throw new Error("Agent ID and message required for send action");
				}
				return this.handleSendMessage(inboxInput.agentId, inboxInput.message);

			case "receive":
				if (!inboxInput.agentId) {
					throw new Error("Agent ID required for receive action");
				}
				return this.handleReceiveMessages(inboxInput.agentId, inboxInput.limit);

			case "acknowledge":
				if (!inboxInput.agentId || !inboxInput.messageId) {
					throw new Error(
						"Agent ID and message ID required for acknowledge action",
					);
				}
				return this.handleAcknowledgeMessage(
					inboxInput.agentId,
					inboxInput.messageId,
				);

			case "broadcast":
				if (!inboxInput.agentId || !inboxInput.broadcast) {
					throw new Error(
						"Agent ID and broadcast data required for broadcast action",
					);
				}
				return this.handleBroadcastMessage(
					inboxInput.agentId,
					inboxInput.broadcast,
				);

			case "get_status":
				if (!inboxInput.agentId) {
					throw new Error("Agent ID required for get_status action");
				}
				return this.handleGetStatus(inboxInput.agentId);

			case "clear_queue":
				if (!inboxInput.agentId) {
					throw new Error("Agent ID required for clear_queue action");
				}
				return this.handleClearQueue(inboxInput.agentId);

			default:
				throw new Error(`Unknown AgentInbox action: ${inboxInput.action}`);
		}
	}

	protected async onShutdown(): Promise<void> {
		// Clear all timers
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = undefined;
		}

		this.deliveryTimers.forEach((timer) => clearTimeout(timer));
		this.deliveryTimers.clear();

		// Clear all data
		this.messageQueues.clear();
		this.broadcastMessages = [];
		this.registeredAgents.clear();
		this.messageHandlers.clear();
	}

	// Public methods for state integration
	public onMessage(
		agentId: string,
		handler: (message: InboxMessage) => void,
	): void {
		this.messageHandlers.set(agentId, handler);
	}

	public offMessage(agentId: string): void {
		this.messageHandlers.delete(agentId);
	}

	public getInboxState(): NonNullable<ToolIntegrationState["agentInbox"]> {
		const messageQueues: Record<
			string,
			Array<{
				id: string;
				from: string;
				to: string;
				content: string;
				priority: "low" | "medium" | "high" | "critical";
				timestamp: string;
				status: "pending" | "delivered" | "acknowledged" | "failed";
			}>
		> = {};

		// Convert internal message format to state format
		for (const [agentId, messages] of this.messageQueues.entries()) {
			messageQueues[agentId] = messages.map((msg) => ({
				id: msg.id,
				from: msg.from,
				to: msg.to,
				content: msg.content,
				priority: msg.priority,
				timestamp: msg.timestamp,
				status: msg.status,
			}));
		}

		return {
			messageQueues,
			broadcastMessages: this.broadcastMessages.map((msg) => ({
				id: msg.id,
				from: msg.from,
				content: msg.content,
				timestamp: msg.timestamp,
				recipients: msg.recipients,
				deliveryStatus: msg.deliveryStatus,
			})),
			isEnabled: this.isEnabled,
		};
	}

	// Private implementation methods
	private handleRegisterAgent(agentId: string): AgentInboxResult {
		this.registeredAgents.add(agentId);

		if (!this.messageQueues.has(agentId)) {
			this.messageQueues.set(agentId, []);
		}

		return {
			success: true,
			agents: Array.from(this.registeredAgents),
		};
	}

	private handleUnregisterAgent(agentId: string): AgentInboxResult {
		this.registeredAgents.delete(agentId);
		this.messageQueues.delete(agentId);
		this.messageHandlers.delete(agentId);

		// Cancel any pending delivery timers for this agent
		for (const [messageId, timer] of this.deliveryTimers.entries()) {
			if (messageId.includes(agentId)) {
				clearTimeout(timer);
				this.deliveryTimers.delete(messageId);
			}
		}

		return {
			success: true,
			agents: Array.from(this.registeredAgents),
		};
	}

	private handleSendMessage(
		fromAgentId: string,
		messageData: NonNullable<AgentInboxInput["message"]>,
	): AgentInboxResult {
		if (!this.registeredAgents.has(messageData.to)) {
			return {
				success: false,
				error: `Recipient agent ${messageData.to} is not registered`,
			};
		}

		const message: InboxMessage = {
			id: this.generateMessageId(),
			from: fromAgentId,
			to: messageData.to,
			content: messageData.content,
			priority: messageData.priority || "medium",
			timestamp: new Date().toISOString(),
			status: "pending",
			retryCount: 0,
			expiresAt: messageData.expiresAt,
			metadata: messageData.metadata,
		};

		// Add to recipient's queue
		const queue = this.messageQueues.get(messageData.to) || [];

		// Check queue size limit
		if (queue.length >= this.config.maxQueueSize) {
			return {
				success: false,
				error: `Queue full for agent ${messageData.to}`,
			};
		}

		// Insert message based on priority
		this.insertMessageByPriority(queue, message);
		this.messageQueues.set(messageData.to, queue);

		// Set delivery timeout
		this.setDeliveryTimeout(message);

		// Notify message handler if registered
		const handler = this.messageHandlers.get(messageData.to);
		if (handler) {
			try {
				handler(message);
			} catch (error) {
				console.error(`Error in message handler for ${messageData.to}:`, error);
			}
		}

		return {
			success: true,
			message,
		};
	}

	private handleReceiveMessages(agentId: string, limit = 10): AgentInboxResult {
		if (!this.registeredAgents.has(agentId)) {
			return {
				success: false,
				error: `Agent ${agentId} is not registered`,
			};
		}

		const queue = this.messageQueues.get(agentId) || [];
		const messages = queue
			.filter((msg) => msg.status === "pending")
			.slice(0, limit);

		// Mark messages as delivered
		messages.forEach((msg) => {
			msg.status = "delivered";

			// Clear delivery timeout
			const timerId = `${msg.id}-${agentId}`;
			const timer = this.deliveryTimers.get(timerId);
			if (timer) {
				clearTimeout(timer);
				this.deliveryTimers.delete(timerId);
			}
		});

		return {
			success: true,
			messages,
		};
	}

	private handleAcknowledgeMessage(
		agentId: string,
		messageId: string,
	): AgentInboxResult {
		const queue = this.messageQueues.get(agentId) || [];
		const message = queue.find((msg) => msg.id === messageId);

		if (!message) {
			return {
				success: false,
				error: `Message ${messageId} not found in queue for ${agentId}`,
			};
		}

		message.status = "acknowledged";

		return {
			success: true,
			message,
		};
	}

	private handleBroadcastMessage(
		fromAgentId: string,
		broadcastData: NonNullable<AgentInboxInput["broadcast"]>,
	): AgentInboxResult {
		if (broadcastData.recipients.length > this.config.maxBroadcastRecipients) {
			return {
				success: false,
				error: `Too many recipients (max ${this.config.maxBroadcastRecipients})`,
			};
		}

		// Validate all recipients are registered
		const invalidRecipients = broadcastData.recipients.filter(
			(id) => !this.registeredAgents.has(id),
		);
		if (invalidRecipients.length > 0) {
			return {
				success: false,
				error: `Invalid recipients: ${invalidRecipients.join(", ")}`,
			};
		}

		const broadcast: BroadcastMessage = {
			id: this.generateMessageId(),
			from: fromAgentId,
			content: broadcastData.content,
			timestamp: new Date().toISOString(),
			recipients: broadcastData.recipients,
			deliveryStatus: {},
			metadata: broadcastData.metadata,
		};

		// Initialize delivery status
		broadcastData.recipients.forEach((recipient) => {
			broadcast.deliveryStatus[recipient] = "pending";
		});

		// Send individual messages to each recipient
		const deliveryResults = broadcastData.recipients.map((recipient) => {
			const result = this.handleSendMessage(fromAgentId, {
				to: recipient,
				content: broadcastData.content,
				priority: "medium",
				metadata: {
					...broadcastData.metadata,
					broadcastId: broadcast.id,
					isBroadcast: true,
				},
			});

			broadcast.deliveryStatus[recipient] = result.success
				? "delivered"
				: "failed";
			return result.success;
		});

		// Store broadcast message
		this.broadcastMessages.push(broadcast);

		const successCount = deliveryResults.filter((success) => success).length;

		return {
			success: successCount > 0,
			broadcast,
		};
	}

	private handleGetStatus(agentId: string): AgentInboxResult {
		if (!this.registeredAgents.has(agentId)) {
			return {
				success: false,
				error: `Agent ${agentId} is not registered`,
			};
		}

		const queue = this.messageQueues.get(agentId) || [];
		const pendingMessages = queue.filter(
			(msg) => msg.status === "pending",
		).length;
		const lastMessage = queue[queue.length - 1];

		return {
			success: true,
			status: {
				agentId,
				queueSize: queue.length,
				pendingMessages,
				lastActivity: lastMessage?.timestamp,
			},
		};
	}

	private handleClearQueue(agentId: string): AgentInboxResult {
		if (!this.registeredAgents.has(agentId)) {
			return {
				success: false,
				error: `Agent ${agentId} is not registered`,
			};
		}

		const queue = this.messageQueues.get(agentId) || [];
		const clearedCount = queue.length;

		// Clear delivery timers for this agent's messages
		queue.forEach((msg) => {
			const timerId = `${msg.id}-${agentId}`;
			const timer = this.deliveryTimers.get(timerId);
			if (timer) {
				clearTimeout(timer);
				this.deliveryTimers.delete(timerId);
			}
		});

		this.messageQueues.set(agentId, []);

		return {
			success: true,
			status: {
				agentId,
				queueSize: 0,
				pendingMessages: 0,
			},
		};
	}

	private insertMessageByPriority(
		queue: InboxMessage[],
		message: InboxMessage,
	): void {
		const priorityOrder: Record<string, number> = {
			critical: 0,
			high: 1,
			medium: 2,
			low: 3,
		};

		const messagePriority = priorityOrder[message.priority];
		let insertIndex = queue.length;

		// Find insertion point based on priority
		for (let i = 0; i < queue.length; i++) {
			const queuePriority = priorityOrder[queue[i].priority];
			if (messagePriority < queuePriority) {
				insertIndex = i;
				break;
			}
		}

		queue.splice(insertIndex, 0, message);
	}

	private setDeliveryTimeout(message: InboxMessage): void {
		const timerId = `${message.id}-${message.to}`;

		const timer = setTimeout(() => {
			if (message.status === "pending") {
				if (message.retryCount < this.config.retryAttempts) {
					message.retryCount++;
					// Reschedule delivery
					this.setDeliveryTimeout(message);
				} else {
					message.status = "failed";
				}
			}
			this.deliveryTimers.delete(timerId);
		}, this.config.deliveryTimeoutMs);

		this.deliveryTimers.set(timerId, timer);
	}

	private startMessageCleanup(): void {
		this.cleanupTimer = setInterval(() => {
			const now = Date.now();

			// Clean expired messages from all queues
			for (const [agentId, queue] of this.messageQueues.entries()) {
				const filteredQueue = queue.filter((msg) => {
					if (msg.expiresAt) {
						return new Date(msg.expiresAt).getTime() > now;
					}

					// Remove old acknowledged/failed messages
					const messageAge = now - new Date(msg.timestamp).getTime();
					return (
						!(msg.status === "acknowledged" || msg.status === "failed") ||
						messageAge < this.config.messageRetentionMs
					);
				});

				if (filteredQueue.length !== queue.length) {
					this.messageQueues.set(agentId, filteredQueue);
				}
			}

			// Clean old broadcast messages
			this.broadcastMessages = this.broadcastMessages.filter((broadcast) => {
				const broadcastAge = now - new Date(broadcast.timestamp).getTime();
				return broadcastAge < this.config.messageRetentionMs;
			});
		}, this.config.messageRetentionMs / 10); // Run cleanup every 1/10 of retention time
	}

	private generateMessageId(): string {
		return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}
}
