/**
 * Agent Inbox Message Queue Implementation
 * Priority-based message routing and delivery system
 */

import type {
	AgentMessage,
	MessageQueueCapabilities,
	MessageQueueState,
} from "../../tests/test-doubles/integrations/agent-inbox/message-queue.double";

export interface MessageQueueConfig {
	maxQueueSize?: number;
	maxMessageAge?: number; // in milliseconds
	persistenceEnabled?: boolean;
	retryAttempts?: number;
	retryDelay?: number;
}

export class AgentInboxMessageQueue implements MessageQueueCapabilities {
	private readonly state: MessageQueueState;
	private readonly messageStore: Map<string, AgentMessage> = new Map();
	private readonly config: Required<MessageQueueConfig>;
	private readonly retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

	constructor(config: MessageQueueConfig = {}) {
		this.config = {
			maxQueueSize: config.maxQueueSize || 10000,
			maxMessageAge: config.maxMessageAge || 24 * 60 * 60 * 1000, // 24 hours
			persistenceEnabled: config.persistenceEnabled || false,
			retryAttempts: config.retryAttempts || 3,
			retryDelay: config.retryDelay || 5000, // 5 seconds
		};

		this.state = {
			agentQueues: {},
			broadcastMessages: [],
			totalMessages: 0,
			deliveredMessages: 0,
			failedMessages: 0,
			lastActivity: new Date().toISOString(),
		};

		// Start cleanup routine for expired messages
		this.startCleanupRoutine();
	}

	async enqueue(message: AgentMessage): Promise<void> {
		this.state.lastActivity = new Date().toISOString();

		// Validate message
		this.validateMessage(message);

		// Check queue size limits
		if (this.state.totalMessages >= this.config.maxQueueSize) {
			throw new Error("Queue capacity exceeded");
		}

		// Store message by ID for lookup
		this.messageStore.set(message.id, { ...message });

		// Add to appropriate queue
		if (message.type === "broadcast") {
			this.state.broadcastMessages.push({ ...message });
		} else {
			if (!this.state.agentQueues[message.to]) {
				this.state.agentQueues[message.to] = [];
			}
			this.state.agentQueues[message.to].push({ ...message });
		}

		this.state.totalMessages++;

		// Persist if enabled
		if (this.config.persistenceEnabled) {
			await this.persistMessage(message);
		}
	}

	async dequeue(agentId: string): Promise<AgentMessage | null> {
		this.state.lastActivity = new Date().toISOString();

		// Get agent's queue and broadcast messages
		const agentQueue = this.state.agentQueues[agentId] || [];
		const applicableBroadcasts = this.state.broadcastMessages.filter(
			(msg) => msg.status === "pending",
		);

		// Combine queues for priority sorting
		const allMessages = [...agentQueue, ...applicableBroadcasts];

		if (allMessages.length === 0) {
			return null;
		}

		// Sort by priority and timestamp
		allMessages.sort((a, b) => {
			const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
			const aPriority = priorityOrder[a.priority];
			const bPriority = priorityOrder[b.priority];

			if (aPriority !== bPriority) {
				return bPriority - aPriority; // Higher priority first
			}

			// Same priority, sort by timestamp (oldest first)
			return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
		});

		const message = allMessages[0];

		// Remove from appropriate queue
		if (message.type === "broadcast") {
			// Mark broadcast as delivered (don't remove, other agents might need it)
			message.status = "delivered";
			this.messageStore.set(message.id, message);
		} else {
			// Remove from agent queue
			const queueIndex = this.state.agentQueues[agentId].findIndex(
				(msg) => msg.id === message.id,
			);
			if (queueIndex !== -1) {
				this.state.agentQueues[agentId].splice(queueIndex, 1);
			}

			// Update message status
			message.status = "delivered";
			this.messageStore.set(message.id, message);
		}

		this.state.deliveredMessages++;

		return message;
	}

	peek(agentId: string): AgentMessage | null {
		const agentQueue = this.state.agentQueues[agentId] || [];
		const applicableBroadcasts = this.state.broadcastMessages.filter(
			(msg) => msg.status === "pending",
		);

		const allMessages = [...agentQueue, ...applicableBroadcasts];

		if (allMessages.length === 0) {
			return null;
		}

		// Sort by priority (same logic as dequeue)
		allMessages.sort((a, b) => {
			const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
			const aPriority = priorityOrder[a.priority];
			const bPriority = priorityOrder[b.priority];

			if (aPriority !== bPriority) {
				return bPriority - aPriority;
			}

			return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
		});

		return { ...allMessages[0] };
	}

	async broadcast(message: Omit<AgentMessage, "to" | "type">): Promise<void> {
		this.state.lastActivity = new Date().toISOString();

		const broadcastMessage: AgentMessage = {
			...message,
			to: "*", // Broadcast indicator
			type: "broadcast",
		};

		await this.enqueue(broadcastMessage);
	}

	async acknowledge(messageId: string): Promise<void> {
		const message = this.messageStore.get(messageId);
		if (message) {
			message.status = "acknowledged";
			this.messageStore.set(messageId, message);
			this.state.lastActivity = new Date().toISOString();

			if (this.config.persistenceEnabled) {
				await this.persistMessage(message);
			}
		}
	}

	async markFailed(messageId: string, error: string): Promise<void> {
		const message = this.messageStore.get(messageId);
		if (message) {
			message.status = "failed";
			message.metadata = {
				...message.metadata,
				error,
				failedAt: new Date().toISOString(),
			};
			this.messageStore.set(messageId, message);
			this.state.failedMessages++;
			this.state.lastActivity = new Date().toISOString();

			// Schedule retry if configured
			if (this.config.retryAttempts > 0) {
				this.scheduleRetry(message);
			}

			if (this.config.persistenceEnabled) {
				await this.persistMessage(message);
			}
		}
	}

	getQueueSize(agentId: string): number {
		const agentQueue = this.state.agentQueues[agentId] || [];
		const applicableBroadcasts = this.state.broadcastMessages.filter(
			(msg) => msg.status === "pending",
		);
		return agentQueue.length + applicableBroadcasts.length;
	}

	getQueueContents(agentId: string): AgentMessage[] {
		const agentQueue = this.state.agentQueues[agentId] || [];
		const applicableBroadcasts = this.state.broadcastMessages.filter(
			(msg) => msg.status === "pending",
		);
		return [...agentQueue, ...applicableBroadcasts];
	}

	async purgeQueue(agentId: string): Promise<number> {
		const queueSize = (this.state.agentQueues[agentId] || []).length;

		// Remove messages from message store
		const agentMessages = this.state.agentQueues[agentId] || [];
		for (const message of agentMessages) {
			this.messageStore.delete(message.id);
		}

		this.state.agentQueues[agentId] = [];
		this.state.totalMessages -= queueSize;
		this.state.lastActivity = new Date().toISOString();

		return queueSize;
	}

	getState(): MessageQueueState {
		return {
			...this.state,
			agentQueues: { ...this.state.agentQueues },
			broadcastMessages: [...this.state.broadcastMessages],
		};
	}

	hasMessages(agentId: string): boolean {
		return this.getQueueSize(agentId) > 0;
	}

	getMessageById(messageId: string): AgentMessage | null {
		const message = this.messageStore.get(messageId);
		return message ? { ...message } : null;
	}

	// Additional management methods
	async purgeExpiredMessages(): Promise<number> {
		const currentTime = Date.now();
		let purgedCount = 0;

		for (const [messageId, message] of this.messageStore) {
			const messageAge = currentTime - new Date(message.timestamp).getTime();

			if (messageAge > this.config.maxMessageAge) {
				// Remove from queues
				for (const queue of Object.values(this.state.agentQueues)) {
					const index = queue.findIndex((msg) => msg.id === messageId);
					if (index !== -1) {
						queue.splice(index, 1);
					}
				}

				// Remove from broadcast messages
				const broadcastIndex = this.state.broadcastMessages.findIndex(
					(msg) => msg.id === messageId,
				);
				if (broadcastIndex !== -1) {
					this.state.broadcastMessages.splice(broadcastIndex, 1);
				}

				// Remove from message store
				this.messageStore.delete(messageId);
				purgedCount++;
			}
		}

		this.state.totalMessages -= purgedCount;
		return purgedCount;
	}

	getStatistics(): {
		totalMessages: number;
		deliveredMessages: number;
		failedMessages: number;
		pendingMessages: number;
		acknowledgedMessages: number;
		queueSizes: Record<string, number>;
	} {
		const pendingMessages = Array.from(this.messageStore.values()).filter(
			(msg) => msg.status === "pending",
		).length;

		const acknowledgedMessages = Array.from(this.messageStore.values()).filter(
			(msg) => msg.status === "acknowledged",
		).length;

		const queueSizes: Record<string, number> = {};
		for (const agentId of Object.keys(this.state.agentQueues)) {
			queueSizes[agentId] = this.getQueueSize(agentId);
		}

		return {
			totalMessages: this.state.totalMessages,
			deliveredMessages: this.state.deliveredMessages,
			failedMessages: this.state.failedMessages,
			pendingMessages,
			acknowledgedMessages,
			queueSizes,
		};
	}

	private validateMessage(message: AgentMessage): void {
		if (!message.id || !message.from || !message.to || !message.content) {
			throw new Error("Invalid message: missing required fields");
		}

		if (!["low", "medium", "high", "critical"].includes(message.priority)) {
			throw new Error(`Invalid priority: ${message.priority}`);
		}

		if (
			!["pending", "delivered", "acknowledged", "failed"].includes(
				message.status,
			)
		) {
			throw new Error(`Invalid status: ${message.status}`);
		}

		if (!["direct", "broadcast", "system"].includes(message.type)) {
			throw new Error(`Invalid type: ${message.type}`);
		}
	}

	private async persistMessage(message: AgentMessage): Promise<void> {
		// In a real implementation, this would persist to a database
		// For now, this is a placeholder
		console.debug(`Persisting message: ${message.id}`);
	}

	private scheduleRetry(message: AgentMessage): void {
		const retryCount = (message.metadata?.retryCount || 0) + 1;

		if (retryCount <= this.config.retryAttempts) {
			const retryDelay = this.config.retryDelay * retryCount; // Exponential backoff

			const timeout = setTimeout(async () => {
				message.status = "pending";
				message.metadata = {
					...message.metadata,
					retryCount,
					lastRetry: new Date().toISOString(),
				};

				// Re-enqueue the message
				await this.enqueue(message);

				this.retryTimeouts.delete(message.id);
			}, retryDelay);

			this.retryTimeouts.set(message.id, timeout);
		}
	}

	private startCleanupRoutine(): void {
		// Run cleanup every hour
		setInterval(
			async () => {
				try {
					const purged = await this.purgeExpiredMessages();
					if (purged > 0) {
						console.debug(`Purged ${purged} expired messages`);
					}
				} catch (error) {
					console.error("Error in cleanup routine:", error);
				}
			},
			60 * 60 * 1000,
		); // 1 hour
	}
}

// Factory function for creating Agent Inbox message queues
export function createAgentInboxMessageQueue(
	config?: MessageQueueConfig,
): AgentInboxMessageQueue {
	return new AgentInboxMessageQueue(config);
}
