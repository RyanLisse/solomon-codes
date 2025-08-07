import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AgentInbox, createAgentInbox } from "../../src/inbox/agent-inbox";

describe("AgentInbox", () => {
	let inbox: AgentInbox;

	beforeEach(() => {
		inbox = createAgentInbox({
			maxQueueSize: 10,
			maxRetries: 2,
			deadLetterEnabled: true,
			priorityQueuing: true,
		});
	});

	describe("Message Queuing", () => {
		it("should queue messages with correct priority order", async () => {
			const handler = vi.fn().mockResolvedValue({ result: "processed" });
			inbox.registerHandler("test-agent", handler);

			// Send messages with different priorities
			await inbox.send({
				from: "user",
				to: "test-agent",
				type: "test",
				priority: "low",
				content: "low priority message",
				retryCount: 0,
				maxRetries: 3,
			});

			await inbox.send({
				from: "user",
				to: "test-agent",
				type: "test",
				priority: "critical",
				content: "critical priority message",
				retryCount: 0,
				maxRetries: 3,
			});

			await inbox.send({
				from: "user",
				to: "test-agent",
				type: "test",
				priority: "normal",
				content: "normal priority message",
				retryCount: 0,
				maxRetries: 3,
			});

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Critical should be processed first
			expect(handler).toHaveBeenCalledTimes(3);
			const firstCall = handler.mock.calls[0][0];
			expect(firstCall.priority).toBe("critical");
		});

		it("should enforce max queue size", async () => {
			const handler = vi.fn().mockResolvedValue({ result: "processed" });
			inbox.registerHandler("test-agent", handler);

			// Fill up the queue
			const promises = [];
			for (let i = 0; i < 10; i++) {
				promises.push(
					inbox.send({
						from: "user",
						to: "test-agent",
						type: "test",
						priority: "normal",
						content: `message ${i}`,
						retryCount: 0,
						maxRetries: 3,
					}),
				);
			}

			await Promise.all(promises);

			// Try to exceed queue size
			await expect(
				inbox.send({
					from: "user",
					to: "test-agent",
					type: "test",
					priority: "normal",
					content: "overflow message",
					retryCount: 0,
					maxRetries: 3,
				}),
			).rejects.toThrow("Queue size limit reached");
		});
	});

	describe("Message Handlers", () => {
		it("should register and unregister handlers", () => {
			const handler = vi.fn();

			inbox.registerHandler("agent1", handler);
			expect(inbox.getStats().handlers).toContain("agent1");

			inbox.unregisterHandler("agent1");
			expect(inbox.getStats().handlers).not.toContain("agent1");
		});

		it("should handle missing handler gracefully", async () => {
			const messageId = await inbox.send({
				from: "user",
				to: "non-existent-agent",
				type: "test",
				priority: "normal",
				content: "test message",
				retryCount: 0,
				maxRetries: 2,
			});

			// Wait for processing attempts
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Message should end up in dead letter queue
			const deadLetters = inbox.getDeadLetterQueue();
			expect(deadLetters.length).toBeGreaterThan(0);
			expect(deadLetters[0].id).toBe(messageId);
		});
	});

	describe("Retry Mechanism", () => {
		it("should retry failed messages up to max retries", async () => {
			let attemptCount = 0;
			const handler = vi.fn().mockImplementation(() => {
				attemptCount++;
				if (attemptCount < 3) {
					throw new Error("Processing failed");
				}
				return { result: "success" };
			});

			inbox.registerHandler("retry-agent", handler);

			await inbox.send({
				from: "user",
				to: "retry-agent",
				type: "test",
				priority: "normal",
				content: "retry test",
				retryCount: 0,
				maxRetries: 3,
			});

			// Wait for retries
			await new Promise((resolve) => setTimeout(resolve, 300));

			expect(handler).toHaveBeenCalledTimes(3);
		});

		it("should move to dead letter queue after max retries", async () => {
			const handler = vi.fn().mockRejectedValue(new Error("Always fails"));
			inbox.registerHandler("failing-agent", handler);

			const messageId = await inbox.send({
				from: "user",
				to: "failing-agent",
				type: "test",
				priority: "normal",
				content: "will fail",
				retryCount: 0,
				maxRetries: 2,
			});

			// Wait for retries
			await new Promise((resolve) => setTimeout(resolve, 300));

			const deadLetters = inbox.getDeadLetterQueue();
			expect(deadLetters.length).toBe(1);
			expect(deadLetters[0].id).toBe(messageId);
			expect(deadLetters[0].status).toBe("dead");
		});
	});

	describe("Dead Letter Queue", () => {
		it("should retry dead letter messages", async () => {
			const handler = vi.fn().mockResolvedValue({ result: "processed" });

			// Send message without handler to force dead letter
			const _messageId = await inbox.send({
				from: "user",
				to: "dead-agent",
				type: "test",
				priority: "normal",
				content: "dead letter test",
				retryCount: 0,
				maxRetries: 1,
			});

			// Wait for it to go to dead letter
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Register handler and retry
			inbox.registerHandler("dead-agent", handler);
			await inbox.retryDeadLetters();

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(handler).toHaveBeenCalled();
			expect(inbox.getDeadLetterQueue().length).toBe(0);
		});
	});

	describe("Statistics", () => {
		it("should track queue statistics", async () => {
			const handler = vi
				.fn()
				.mockImplementation(
					() =>
						new Promise((resolve) =>
							setTimeout(() => resolve({ result: "done" }), 50),
						),
				);
			inbox.registerHandler("stats-agent", handler);

			// Send multiple messages
			for (let i = 0; i < 3; i++) {
				await inbox.send({
					from: "user",
					to: "stats-agent",
					type: "test",
					priority: "normal",
					content: `message ${i}`,
					retryCount: 0,
					maxRetries: 3,
				});
			}

			// Check initial stats
			let stats = inbox.getStats();
			expect(stats.handlers).toContain("stats-agent");

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Check final stats
			stats = inbox.getStats();
			expect(stats.queueSize).toBe(0);
			expect(stats.processingCount).toBe(0);
		});
	});

	describe("Event Emission", () => {
		it("should emit events for message lifecycle", async () => {
			const events: string[] = [];

			inbox.on("message:queued", () => events.push("queued"));
			inbox.on("message:processing", () => events.push("processing"));
			inbox.on("message:completed", () => events.push("completed"));

			const handler = vi.fn().mockResolvedValue({ result: "done" });
			inbox.registerHandler("event-agent", handler);

			await inbox.send({
				from: "user",
				to: "event-agent",
				type: "test",
				priority: "normal",
				content: "event test",
				retryCount: 0,
				maxRetries: 3,
			});

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(events).toContain("queued");
			expect(events).toContain("processing");
			expect(events).toContain("completed");
		});
	});
});
