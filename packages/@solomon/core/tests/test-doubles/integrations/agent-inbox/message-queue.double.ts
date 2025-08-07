/**
 * Message Queue Test Double
 * TDD London School approach for Agent Inbox message queuing
 */

import { expect } from "vitest";

export interface AgentMessage {
	id: string;
	from: string;
	to: string;
	content: string;
	priority: "low" | "medium" | "high" | "critical";
	timestamp: string;
	status: "pending" | "delivered" | "acknowledged" | "failed";
	type: "direct" | "broadcast" | "system";
	metadata?: Record<string, any>;
}

export interface MessageQueueState {
	agentQueues: Record<string, AgentMessage[]>;
	broadcastMessages: AgentMessage[];
	totalMessages: number;
	deliveredMessages: number;
	failedMessages: number;
	lastActivity: string;
}

export interface MessageQueueCapabilities {
	enqueue(message: AgentMessage): Promise<void>;
	dequeue(agentId: string): Promise<AgentMessage | null>;
	peek(agentId: string): AgentMessage | null;
	broadcast(message: Omit<AgentMessage, "to" | "type">): Promise<void>;
	acknowledge(messageId: string): Promise<void>;
	markFailed(messageId: string, error: string): Promise<void>;
	getQueueSize(agentId: string): number;
	getQueueContents(agentId: string): AgentMessage[];
	purgeQueue(agentId: string): Promise<number>;
	getState(): MessageQueueState;
	hasMessages(agentId: string): boolean;
	getMessageById(messageId: string): AgentMessage | null;
}

export class MessageQueueDouble implements MessageQueueCapabilities {
	private readonly state: MessageQueueState;
	private readonly messageStore: Map<string, AgentMessage> = new Map();

	// Test helpers for controlling behavior
	public shouldFailEnqueue = false;
	public shouldFailDequeue = false;
	public shouldFailBroadcast = false;
	public enqueueLog: AgentMessage[] = [];
	public dequeueLog: { agentId: string; message: AgentMessage | null }[] = [];
	public broadcastLog: AgentMessage[] = [];
	public simulateDelay = 0;

	constructor() {
		this.state = {
			agentQueues: {},
			broadcastMessages: [],
			totalMessages: 0,
			deliveredMessages: 0,
			failedMessages: 0,
			lastActivity: new Date().toISOString(),
		};
	}

	async enqueue(message: AgentMessage): Promise<void> {
		this.enqueueLog.push({ ...message });
		this.state.lastActivity = new Date().toISOString();

		if (this.shouldFailEnqueue) {
			throw new Error("Simulated enqueue failure");
		}

		// Simulate processing delay
		if (this.simulateDelay > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.simulateDelay));
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
	}

	async dequeue(agentId: string): Promise<AgentMessage | null> {
		this.state.lastActivity = new Date().toISOString();

		if (this.shouldFailDequeue) {
			throw new Error("Simulated dequeue failure");
		}

		// Simulate processing delay
		if (this.simulateDelay > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.simulateDelay));
		}

		// Get agent's queue
		const queue = this.state.agentQueues[agentId] || [];

		// Sort by priority (critical > high > medium > low) and timestamp
		queue.sort((a, b) => {
			const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
			const aPriority = priorityOrder[a.priority];
			const bPriority = priorityOrder[b.priority];

			if (aPriority !== bPriority) {
				return bPriority - aPriority; // Higher priority first
			}

			// Same priority, sort by timestamp (oldest first)
			return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
		});

		const message = queue.shift() || null;

		if (message) {
			// Update message status
			message.status = "delivered";
			this.messageStore.set(message.id, message);
			this.state.deliveredMessages++;

			// Update queue in state
			this.state.agentQueues[agentId] = queue;
		}

		this.dequeueLog.push({ agentId, message });
		return message;
	}

	peek(agentId: string): AgentMessage | null {
		const queue = this.state.agentQueues[agentId] || [];

		if (queue.length === 0) {
			return null;
		}

		// Sort by priority (same logic as dequeue)
		queue.sort((a, b) => {
			const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
			const aPriority = priorityOrder[a.priority];
			const bPriority = priorityOrder[b.priority];

			if (aPriority !== bPriority) {
				return bPriority - aPriority;
			}

			return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
		});

		return { ...queue[0] };
	}

	async broadcast(message: Omit<AgentMessage, "to" | "type">): Promise<void> {
		this.state.lastActivity = new Date().toISOString();

		if (this.shouldFailBroadcast) {
			throw new Error("Simulated broadcast failure");
		}

		const broadcastMessage: AgentMessage = {
			...message,
			to: "*", // Broadcast indicator
			type: "broadcast",
		};

		this.broadcastLog.push({ ...broadcastMessage });
		await this.enqueue(broadcastMessage);
	}

	async acknowledge(messageId: string): Promise<void> {
		const message = this.messageStore.get(messageId);
		if (message) {
			message.status = "acknowledged";
			this.messageStore.set(messageId, message);
			this.state.lastActivity = new Date().toISOString();
		}
	}

	async markFailed(messageId: string, error: string): Promise<void> {
		const message = this.messageStore.get(messageId);
		if (message) {
			message.status = "failed";
			message.metadata = { ...message.metadata, error };
			this.messageStore.set(messageId, message);
			this.state.failedMessages++;
			this.state.lastActivity = new Date().toISOString();
		}
	}

	getQueueSize(agentId: string): number {
		return (this.state.agentQueues[agentId] || []).length;
	}

	getQueueContents(agentId: string): AgentMessage[] {
		return [...(this.state.agentQueues[agentId] || [])];
	}

	async purgeQueue(agentId: string): Promise<number> {
		const queueSize = this.getQueueSize(agentId);
		this.state.agentQueues[agentId] = [];
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

	// Test helper methods
	getEnqueueLog(): AgentMessage[] {
		return [...this.enqueueLog];
	}

	getDequeueLog(): { agentId: string; message: AgentMessage | null }[] {
		return [...this.dequeueLog];
	}

	getBroadcastLog(): AgentMessage[] {
		return [...this.broadcastLog];
	}

	addTestMessage(agentId: string, message: Partial<AgentMessage>): void {
		const fullMessage: AgentMessage = {
			id: `test-msg-${Date.now()}`,
			from: "test-sender",
			to: agentId,
			content: "Test message",
			priority: "medium",
			timestamp: new Date().toISOString(),
			status: "pending",
			type: "direct",
			...message,
		};

		if (!this.state.agentQueues[agentId]) {
			this.state.agentQueues[agentId] = [];
		}
		this.state.agentQueues[agentId].push(fullMessage);
		this.messageStore.set(fullMessage.id, fullMessage);
		this.state.totalMessages++;
	}

	clearAllQueues(): void {
		this.state.agentQueues = {};
		this.state.broadcastMessages = [];
		this.messageStore.clear();
		this.state.totalMessages = 0;
		this.state.deliveredMessages = 0;
		this.state.failedMessages = 0;
	}

	clearLogs(): void {
		this.enqueueLog = [];
		this.dequeueLog = [];
		this.broadcastLog = [];
	}

	resetState(): void {
		this.clearAllQueues();
		this.clearLogs();
		this.shouldFailEnqueue = false;
		this.shouldFailDequeue = false;
		this.shouldFailBroadcast = false;
		this.simulateDelay = 0;
		this.state.lastActivity = new Date().toISOString();
	}
}

// Helper functions for test setup
export function createMessageQueueDouble(
	options: Partial<{
		shouldFailEnqueue: boolean;
		shouldFailDequeue: boolean;
		shouldFailBroadcast: boolean;
		simulateDelay: number;
	}> = {},
): MessageQueueDouble {
	const double = new MessageQueueDouble();

	if (options.shouldFailEnqueue) {
		double.shouldFailEnqueue = true;
	}
	if (options.shouldFailDequeue) {
		double.shouldFailDequeue = true;
	}
	if (options.shouldFailBroadcast) {
		double.shouldFailBroadcast = true;
	}
	if (options.simulateDelay) {
		double.simulateDelay = options.simulateDelay;
	}

	return double;
}

export function expectMessageQueue(queue: MessageQueueDouble) {
	return {
		toHaveEnqueuedMessage: (message: Partial<AgentMessage>) => {
			const enqueueLog = queue.getEnqueueLog();
			const matchingMessage = enqueueLog.find((msg) =>
				Object.entries(message).every(
					([key, value]) => msg[key as keyof AgentMessage] === value,
				),
			);
			expect(matchingMessage).toBeDefined();
		},

		toHaveDequeuedMessageFor: (agentId: string) => {
			const dequeueLog = queue.getDequeueLog();
			expect(
				dequeueLog.some(
					(entry) => entry.agentId === agentId && entry.message !== null,
				),
			).toBe(true);
		},

		toHaveBroadcastMessage: (message: Partial<AgentMessage>) => {
			const broadcastLog = queue.getBroadcastLog();
			const matchingMessage = broadcastLog.find((msg) =>
				Object.entries(message).every(
					([key, value]) => msg[key as keyof AgentMessage] === value,
				),
			);
			expect(matchingMessage).toBeDefined();
		},

		toHaveQueueSize: (agentId: string, size: number) => {
			expect(queue.getQueueSize(agentId)).toBe(size);
		},

		toHaveMessage: (agentId: string) => {
			expect(queue.hasMessages(agentId)).toBe(true);
		},

		toBeEmpty: (agentId: string) => {
			expect(queue.hasMessages(agentId)).toBe(false);
		},

		toHaveState: (expectedState: Partial<MessageQueueState>) => {
			const currentState = queue.getState();
			Object.entries(expectedState).forEach(([key, value]) => {
				if (key === "agentQueues" || key === "broadcastMessages") {
					expect(currentState[key]).toEqual(value);
				} else {
					expect(currentState[key as keyof MessageQueueState]).toBe(value);
				}
			});
		},
	};
}
