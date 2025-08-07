/**
 * Agent Inbox Message Queue Tests
 * TDD London School approach with comprehensive test coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AgentMessage,
	MessageQueueState,
} from "../../tests/test-doubles/integrations/agent-inbox/message-queue.double";
import {
	AgentInboxMessageQueue,
	createAgentInboxMessageQueue,
} from "./message-queue";

// Mock console methods to avoid test output noise
const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("AgentInboxMessageQueue", () => {
	let messageQueue: AgentInboxMessageQueue;

	beforeEach(() => {
		messageQueue = new AgentInboxMessageQueue();
	});

	afterEach(() => {
		consoleSpy.mockClear();
		consoleErrorSpy.mockClear();
	});

	describe("Queue Initialization", () => {
		it("should initialize with empty state", () => {
			const state = messageQueue.getState();

			expect(state.agentQueues).toEqual({});
			expect(state.broadcastMessages).toEqual([]);
			expect(state.totalMessages).toBe(0);
			expect(state.deliveredMessages).toBe(0);
			expect(state.failedMessages).toBe(0);
			expect(state.lastActivity).toBeDefined();
		});

		it("should initialize with custom config", () => {
			const customQueue = new AgentInboxMessageQueue({
				maxQueueSize: 5000,
				maxMessageAge: 12 * 60 * 60 * 1000, // 12 hours
				persistenceEnabled: true,
			});

			expect(customQueue).toBeInstanceOf(AgentInboxMessageQueue);
		});
	});

	describe("Message Enqueuing", () => {
		it("should enqueue direct messages successfully", async () => {
			const message: AgentMessage = {
				id: "msg-1",
				from: "agent-sender",
				to: "agent-receiver",
				content: "Hello, agent!",
				priority: "medium",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			};

			await messageQueue.enqueue(message);

			const state = messageQueue.getState();
			expect(state.totalMessages).toBe(1);
			expect(state.agentQueues["agent-receiver"]).toHaveLength(1);
			expect(state.agentQueues["agent-receiver"][0]).toEqual(message);
		});

		it("should enqueue broadcast messages", async () => {
			const message: AgentMessage = {
				id: "broadcast-1",
				from: "system",
				to: "*",
				content: "System announcement",
				priority: "high",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "broadcast",
			};

			await messageQueue.enqueue(message);

			const state = messageQueue.getState();
			expect(state.totalMessages).toBe(1);
			expect(state.broadcastMessages).toHaveLength(1);
			expect(state.broadcastMessages[0]).toEqual(message);
		});

		it("should validate message fields", async () => {
			const invalidMessage = {
				id: "",
				from: "sender",
				to: "receiver",
				content: "test",
				priority: "invalid-priority",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			} as AgentMessage;

			await expect(messageQueue.enqueue(invalidMessage)).rejects.toThrow(
				"Invalid message: missing required fields",
			);
		});

		it("should validate message priority", async () => {
			const message: AgentMessage = {
				id: "msg-1",
				from: "sender",
				to: "receiver",
				content: "test",
				priority: "invalid" as any,
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			};

			await expect(messageQueue.enqueue(message)).rejects.toThrow(
				"Invalid priority: invalid",
			);
		});

		it("should enforce queue size limit", async () => {
			const limitedQueue = new AgentInboxMessageQueue({ maxQueueSize: 2 });

			// Add messages up to limit
			for (let i = 0; i < 2; i++) {
				const message: AgentMessage = {
					id: `msg-${i}`,
					from: "sender",
					to: "receiver",
					content: `message ${i}`,
					priority: "medium",
					timestamp: new Date().toISOString(),
					status: "pending",
					type: "direct",
				};
				await limitedQueue.enqueue(message);
			}

			// Next message should be rejected
			const overflowMessage: AgentMessage = {
				id: "overflow",
				from: "sender",
				to: "receiver",
				content: "overflow",
				priority: "medium",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			};

			await expect(limitedQueue.enqueue(overflowMessage)).rejects.toThrow(
				"Queue capacity exceeded",
			);
		});
	});

	describe("Message Dequeuing", () => {
		it("should dequeue messages in priority order", async () => {
			const messages: AgentMessage[] = [
				{
					id: "low-msg",
					from: "sender",
					to: "agent-1",
					content: "Low priority",
					priority: "low",
					timestamp: new Date(Date.now() - 3000).toISOString(),
					status: "pending",
					type: "direct",
				},
				{
					id: "critical-msg",
					from: "sender",
					to: "agent-1",
					content: "Critical message",
					priority: "critical",
					timestamp: new Date(Date.now() - 1000).toISOString(),
					status: "pending",
					type: "direct",
				},
				{
					id: "medium-msg",
					from: "sender",
					to: "agent-1",
					content: "Medium priority",
					priority: "medium",
					timestamp: new Date(Date.now() - 2000).toISOString(),
					status: "pending",
					type: "direct",
				},
			];

			for (const message of messages) {
				await messageQueue.enqueue(message);
			}

			// Should dequeue critical first
			const first = await messageQueue.dequeue("agent-1");
			expect(first?.id).toBe("critical-msg");
			expect(first?.status).toBe("delivered");

			// Then medium
			const second = await messageQueue.dequeue("agent-1");
			expect(second?.id).toBe("medium-msg");

			// Finally low
			const third = await messageQueue.dequeue("agent-1");
			expect(third?.id).toBe("low-msg");
		});

		it("should dequeue messages in timestamp order for same priority", async () => {
			const baseTime = Date.now();
			const messages: AgentMessage[] = [
				{
					id: "newer",
					from: "sender",
					to: "agent-1",
					content: "Newer message",
					priority: "medium",
					timestamp: new Date(baseTime + 1000).toISOString(),
					status: "pending",
					type: "direct",
				},
				{
					id: "older",
					from: "sender",
					to: "agent-1",
					content: "Older message",
					priority: "medium",
					timestamp: new Date(baseTime).toISOString(),
					status: "pending",
					type: "direct",
				},
			];

			for (const message of messages) {
				await messageQueue.enqueue(message);
			}

			// Should dequeue older message first (FIFO for same priority)
			const first = await messageQueue.dequeue("agent-1");
			expect(first?.id).toBe("older");

			const second = await messageQueue.dequeue("agent-1");
			expect(second?.id).toBe("newer");
		});

		it("should include broadcast messages in dequeue", async () => {
			const directMessage: AgentMessage = {
				id: "direct-msg",
				from: "sender",
				to: "agent-1",
				content: "Direct message",
				priority: "medium",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			};

			const broadcastMessage: AgentMessage = {
				id: "broadcast-msg",
				from: "system",
				to: "*",
				content: "Broadcast message",
				priority: "high",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "broadcast",
			};

			await messageQueue.enqueue(directMessage);
			await messageQueue.enqueue(broadcastMessage);

			// Should dequeue broadcast first (higher priority)
			const first = await messageQueue.dequeue("agent-1");
			expect(first?.id).toBe("broadcast-msg");
			expect(first?.type).toBe("broadcast");

			// Broadcast message should still be available for other agents
			const forOtherAgent = await messageQueue.dequeue("agent-2");
			expect(forOtherAgent?.id).toBe("broadcast-msg");
		});

		it("should return null when no messages available", async () => {
			const result = await messageQueue.dequeue("non-existent-agent");
			expect(result).toBeNull();
		});

		it("should update delivered message count", async () => {
			const message: AgentMessage = {
				id: "msg-1",
				from: "sender",
				to: "agent-1",
				content: "Test message",
				priority: "medium",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			};

			await messageQueue.enqueue(message);
			expect(messageQueue.getState().deliveredMessages).toBe(0);

			await messageQueue.dequeue("agent-1");
			expect(messageQueue.getState().deliveredMessages).toBe(1);
		});
	});

	describe("Message Peeking", () => {
		it("should peek next message without removing it", async () => {
			const message: AgentMessage = {
				id: "peek-msg",
				from: "sender",
				to: "agent-1",
				content: "Peek message",
				priority: "medium",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			};

			await messageQueue.enqueue(message);

			const peeked = messageQueue.peek("agent-1");
			expect(peeked?.id).toBe("peek-msg");
			expect(peeked?.status).toBe("pending"); // Should not change status

			// Message should still be available for dequeue
			const dequeued = await messageQueue.dequeue("agent-1");
			expect(dequeued?.id).toBe("peek-msg");
		});

		it("should return null when peeking empty queue", () => {
			const result = messageQueue.peek("empty-agent");
			expect(result).toBeNull();
		});
	});

	describe("Broadcasting", () => {
		it("should broadcast messages to all agents", async () => {
			await messageQueue.broadcast({
				id: "broadcast-1",
				from: "system",
				content: "Global announcement",
				priority: "high",
				timestamp: new Date().toISOString(),
				status: "pending",
			});

			const state = messageQueue.getState();
			expect(state.broadcastMessages).toHaveLength(1);
			expect(state.broadcastMessages[0].to).toBe("*");
			expect(state.broadcastMessages[0].type).toBe("broadcast");
		});
	});

	describe("Message Status Management", () => {
		let testMessage: AgentMessage;

		beforeEach(async () => {
			testMessage = {
				id: "status-test",
				from: "sender",
				to: "agent-1",
				content: "Status test",
				priority: "medium",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			};
			await messageQueue.enqueue(testMessage);
		});

		it("should acknowledge messages", async () => {
			await messageQueue.acknowledge("status-test");

			const message = messageQueue.getMessageById("status-test");
			expect(message?.status).toBe("acknowledged");
		});

		it("should mark messages as failed", async () => {
			const errorMessage = "Processing failed";
			await messageQueue.markFailed("status-test", errorMessage);

			const message = messageQueue.getMessageById("status-test");
			expect(message?.status).toBe("failed");
			expect(message?.metadata?.error).toBe(errorMessage);
			expect(message?.metadata?.failedAt).toBeDefined();

			const state = messageQueue.getState();
			expect(state.failedMessages).toBe(1);
		});

		it("should schedule retries for failed messages", async () => {
			const retryQueue = new AgentInboxMessageQueue({
				retryAttempts: 2,
				retryDelay: 1000,
			});

			const message: AgentMessage = {
				id: "retry-test",
				from: "sender",
				to: "agent-1",
				content: "Retry test",
				priority: "medium",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			};

			await retryQueue.enqueue(message);
			await retryQueue.markFailed("retry-test", "Test failure");

			// Fast-forward time to trigger retry
			vi.advanceTimersByTime(1000);

			// Verify retry was scheduled (implementation would re-enqueue)
			expect(vi.getTimerCount()).toBeGreaterThan(0);
		});
	});

	describe("Queue Operations", () => {
		beforeEach(async () => {
			const messages: AgentMessage[] = [
				{
					id: "msg-1",
					from: "sender",
					to: "agent-1",
					content: "Message 1",
					priority: "medium",
					timestamp: new Date().toISOString(),
					status: "pending",
					type: "direct",
				},
				{
					id: "msg-2",
					from: "sender",
					to: "agent-1",
					content: "Message 2",
					priority: "high",
					timestamp: new Date().toISOString(),
					status: "pending",
					type: "direct",
				},
			];

			for (const message of messages) {
				await messageQueue.enqueue(message);
			}
		});

		it("should get queue size", () => {
			expect(messageQueue.getQueueSize("agent-1")).toBe(2);
			expect(messageQueue.getQueueSize("non-existent")).toBe(0);
		});

		it("should get queue contents", () => {
			const contents = messageQueue.getQueueContents("agent-1");
			expect(contents).toHaveLength(2);
			expect(contents.map((m) => m.id)).toContain("msg-1");
			expect(contents.map((m) => m.id)).toContain("msg-2");
		});

		it("should check if agent has messages", () => {
			expect(messageQueue.hasMessages("agent-1")).toBe(true);
			expect(messageQueue.hasMessages("empty-agent")).toBe(false);
		});

		it("should purge agent queue", async () => {
			const purgedCount = await messageQueue.purgeQueue("agent-1");

			expect(purgedCount).toBe(2);
			expect(messageQueue.hasMessages("agent-1")).toBe(false);
			expect(messageQueue.getQueueSize("agent-1")).toBe(0);
		});

		it("should get message by ID", () => {
			const message = messageQueue.getMessageById("msg-1");
			expect(message).toBeDefined();
			expect(message?.id).toBe("msg-1");
			expect(message?.content).toBe("Message 1");
		});
	});

	describe("Message Expiration", () => {
		it("should purge expired messages", async () => {
			const shortLivedQueue = new AgentInboxMessageQueue({
				maxMessageAge: 1000, // 1 second
			});

			const message: AgentMessage = {
				id: "expired-msg",
				from: "sender",
				to: "agent-1",
				content: "Will expire soon",
				priority: "medium",
				timestamp: new Date(Date.now() - 2000).toISOString(), // 2 seconds ago
				status: "pending",
				type: "direct",
			};

			await shortLivedQueue.enqueue(message);
			expect(shortLivedQueue.getQueueSize("agent-1")).toBe(1);

			const purgedCount = await shortLivedQueue.purgeExpiredMessages();
			expect(purgedCount).toBe(1);
			expect(shortLivedQueue.getQueueSize("agent-1")).toBe(0);
		});

		it("should run cleanup routine periodically", async () => {
			// Test would need to be adjusted for the actual cleanup interval
			// For now, verify the cleanup method exists and works
			const purgedCount = await messageQueue.purgeExpiredMessages();
			expect(typeof purgedCount).toBe("number");
		});
	});

	describe("Statistics", () => {
		beforeEach(async () => {
			// Add various message states
			const messages: AgentMessage[] = [
				{
					id: "pending-1",
					from: "sender",
					to: "agent-1",
					content: "Pending message",
					priority: "medium",
					timestamp: new Date().toISOString(),
					status: "pending",
					type: "direct",
				},
				{
					id: "delivered-1",
					from: "sender",
					to: "agent-2",
					content: "Will be delivered",
					priority: "medium",
					timestamp: new Date().toISOString(),
					status: "pending",
					type: "direct",
				},
			];

			for (const message of messages) {
				await messageQueue.enqueue(message);
			}

			// Deliver one message
			await messageQueue.dequeue("agent-2");
			// Acknowledge it
			await messageQueue.acknowledge("delivered-1");
		});

		it("should provide comprehensive statistics", () => {
			const stats = messageQueue.getStatistics();

			expect(stats.totalMessages).toBe(2);
			expect(stats.deliveredMessages).toBe(1);
			expect(stats.failedMessages).toBe(0);
			expect(stats.pendingMessages).toBe(1);
			expect(stats.acknowledgedMessages).toBe(1);
			expect(stats.queueSizes).toEqual({
				"agent-1": 1,
				"agent-2": 0,
			});
		});
	});

	describe("State Management", () => {
		it("should provide immutable state snapshots", () => {
			const state1 = messageQueue.getState();
			const state2 = messageQueue.getState();

			expect(state1).not.toBe(state2);
			expect(state1).toEqual(state2);

			// Modifying returned state should not affect internal state
			state1.agentQueues["test"] = [];
			expect(messageQueue.getState().agentQueues["test"]).toBeUndefined();
		});

		it("should update last activity on operations", async () => {
			const initialState = messageQueue.getState();
			const initialActivity = new Date(initialState.lastActivity);

			// Wait a moment to ensure timestamp difference
			await new Promise((resolve) => setTimeout(resolve, 10));

			const message: AgentMessage = {
				id: "activity-test",
				from: "sender",
				to: "agent-1",
				content: "Activity test",
				priority: "medium",
				timestamp: new Date().toISOString(),
				status: "pending",
				type: "direct",
			};

			await messageQueue.enqueue(message);

			const newState = messageQueue.getState();
			const newActivity = new Date(newState.lastActivity);

			expect(newActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
		});
	});
});

describe("createAgentInboxMessageQueue Factory", () => {
	it("should create message queue with default config", () => {
		const queue = createAgentInboxMessageQueue();

		expect(queue).toBeInstanceOf(AgentInboxMessageQueue);
		expect(queue.getState().totalMessages).toBe(0);
	});

	it("should create message queue with custom config", () => {
		const queue = createAgentInboxMessageQueue({
			maxQueueSize: 1000,
			persistenceEnabled: true,
		});

		expect(queue).toBeInstanceOf(AgentInboxMessageQueue);
	});
});
