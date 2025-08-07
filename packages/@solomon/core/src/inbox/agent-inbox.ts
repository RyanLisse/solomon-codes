import { EventEmitter } from "events";
import { z } from "zod";

// Message schemas
export const MessagePrioritySchema = z.enum([
	"critical",
	"high",
	"normal",
	"low",
]);
export type MessagePriority = z.infer<typeof MessagePrioritySchema>;

export const MessageStatusSchema = z.enum([
	"pending",
	"processing",
	"completed",
	"failed",
	"dead",
]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const InboxMessageSchema = z.object({
	id: z.string(),
	from: z.string(),
	to: z.string(),
	type: z.string(),
	priority: MessagePrioritySchema,
	status: MessageStatusSchema,
	content: z.any(),
	metadata: z.record(z.any()).optional(),
	timestamp: z.string(),
	retryCount: z.number().default(0),
	maxRetries: z.number().default(3),
	error: z.string().optional(),
	correlationId: z.string().optional(),
	sessionId: z.string().optional(),
});

export type InboxMessage = z.infer<typeof InboxMessageSchema>;

// Agent Inbox configuration
export interface AgentInboxConfig {
	maxQueueSize?: number;
	maxRetries?: number;
	deadLetterEnabled?: boolean;
	persistenceEnabled?: boolean;
	priorityQueuing?: boolean;
}

// Priority queue implementation
class PriorityQueue<T> {
	private queues: Map<MessagePriority, T[]> = new Map();
	private priorities: MessagePriority[] = ["critical", "high", "normal", "low"];

	constructor() {
		this.priorities.forEach((priority) => {
			this.queues.set(priority, []);
		});
	}

	enqueue(item: T, priority: MessagePriority): void {
		const queue = this.queues.get(priority);
		if (queue) {
			queue.push(item);
		}
	}

	dequeue(): T | undefined {
		for (const priority of this.priorities) {
			const queue = this.queues.get(priority);
			if (queue && queue.length > 0) {
				return queue.shift();
			}
		}
		return undefined;
	}

	size(): number {
		let total = 0;
		this.queues.forEach((queue) => {
			total += queue.length;
		});
		return total;
	}

	clear(): void {
		this.queues.forEach((queue) => {
			queue.length = 0;
		});
	}
}

// Main Agent Inbox implementation
export class AgentInbox extends EventEmitter {
	private messageQueue: PriorityQueue<InboxMessage>;
	private deadLetterQueue: InboxMessage[] = [];
	private processingMessages: Map<string, InboxMessage> = new Map();
	private messageHandlers: Map<
		string,
		(message: InboxMessage) => Promise<any>
	> = new Map();
	private config: Required<AgentInboxConfig>;
	private isProcessing = false;

	constructor(config: AgentInboxConfig = {}) {
		super();
		this.config = {
			maxQueueSize: config.maxQueueSize ?? 1000,
			maxRetries: config.maxRetries ?? 3,
			deadLetterEnabled: config.deadLetterEnabled ?? true,
			persistenceEnabled: config.persistenceEnabled ?? false,
			priorityQueuing: config.priorityQueuing ?? true,
		};
		this.messageQueue = new PriorityQueue<InboxMessage>();
	}

	// Send a message to an agent
	async send(
		message: Omit<InboxMessage, "id" | "timestamp" | "status">,
	): Promise<string> {
		const messageId = this.generateMessageId();
		const fullMessage: InboxMessage = {
			...message,
			id: messageId,
			timestamp: new Date().toISOString(),
			status: "pending",
			retryCount: 0,
		};

		// Validate message
		const validated = InboxMessageSchema.parse(fullMessage);

		// Check queue size
		if (this.messageQueue.size() >= this.config.maxQueueSize) {
			throw new Error(`Queue size limit reached: ${this.config.maxQueueSize}`);
		}

		// Enqueue message
		this.messageQueue.enqueue(validated, validated.priority);
		this.emit("message:queued", validated);

		// Start processing if not already running
		if (!this.isProcessing) {
			this.startProcessing();
		}

		return messageId;
	}

	// Register a message handler for a specific agent
	registerHandler(
		agentId: string,
		handler: (message: InboxMessage) => Promise<any>,
	): void {
		this.messageHandlers.set(agentId, handler);
		this.emit("handler:registered", agentId);
	}

	// Unregister a message handler
	unregisterHandler(agentId: string): void {
		this.messageHandlers.delete(agentId);
		this.emit("handler:unregistered", agentId);
	}

	// Process messages in the queue
	private async startProcessing(): Promise<void> {
		if (this.isProcessing) return;

		this.isProcessing = true;

		while (this.messageQueue.size() > 0) {
			const message = this.messageQueue.dequeue();
			if (!message) break;

			await this.processMessage(message);
		}

		this.isProcessing = false;
	}

	// Process a single message
	private async processMessage(message: InboxMessage): Promise<void> {
		try {
			// Update status
			message.status = "processing";
			this.processingMessages.set(message.id, message);
			this.emit("message:processing", message);

			// Get handler for the target agent
			const handler = this.messageHandlers.get(message.to);
			if (!handler) {
				throw new Error(`No handler registered for agent: ${message.to}`);
			}

			// Execute handler
			const result = await handler(message);

			// Mark as completed
			message.status = "completed";
			this.processingMessages.delete(message.id);
			this.emit("message:completed", { message, result });
		} catch (error) {
			await this.handleMessageError(message, error);
		}
	}

	// Handle message processing errors
	private async handleMessageError(
		message: InboxMessage,
		error: any,
	): Promise<void> {
		message.retryCount++;
		message.error = error?.message || "Unknown error";

		if (message.retryCount < message.maxRetries) {
			// Retry the message
			message.status = "pending";
			this.messageQueue.enqueue(message, message.priority);
			this.emit("message:retry", message);
		} else {
			// Move to dead letter queue
			message.status = "dead";
			if (this.config.deadLetterEnabled) {
				this.deadLetterQueue.push(message);
				this.emit("message:dead", message);
			} else {
				message.status = "failed";
				this.emit("message:failed", message);
			}
		}

		this.processingMessages.delete(message.id);
	}

	// Get queue statistics
	getStats() {
		return {
			queueSize: this.messageQueue.size(),
			processingCount: this.processingMessages.size,
			deadLetterCount: this.deadLetterQueue.length,
			handlers: Array.from(this.messageHandlers.keys()),
		};
	}

	// Get dead letter queue messages
	getDeadLetterQueue(): InboxMessage[] {
		return [...this.deadLetterQueue];
	}

	// Retry dead letter messages
	async retryDeadLetters(): Promise<void> {
		const messages = [...this.deadLetterQueue];
		this.deadLetterQueue = [];

		for (const message of messages) {
			message.status = "pending";
			message.retryCount = 0;
			this.messageQueue.enqueue(message, message.priority);
		}

		if (!this.isProcessing) {
			this.startProcessing();
		}
	}

	// Clear all queues
	clear(): void {
		this.messageQueue.clear();
		this.deadLetterQueue = [];
		this.processingMessages.clear();
	}

	// Generate unique message ID
	private generateMessageId(): string {
		return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}

// Factory function for creating inbox instances
export function createAgentInbox(config?: AgentInboxConfig): AgentInbox {
	return new AgentInbox(config);
}
