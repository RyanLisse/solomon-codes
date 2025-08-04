/**
 * Letta Service Integration Tests
 * Tests the basic functionality of Letta SDK integration
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { AgentConfig } from "./index";
import { createLettaClient, getLettaService, resetLettaService } from "./index";

// Set up environment variables for testing
process.env.LETTA_API_KEY = "test-letta-api-key-123";
process.env.LETTA_BASE_URL = "https://api.letta.com";

describe("Letta Service Integration", () => {
	beforeEach(() => {
		// Reset service instance before each test
		resetLettaService();
	});

	describe("Service Initialization", () => {
		it("should create a Letta service instance", () => {
			const service = getLettaService();
			expect(service).toBeDefined();
			expect(service.client).toBeDefined();
			expect(service.memory).toBeDefined();
		});

		it("should initialize the service", async () => {
			const service = getLettaService();
			await expect(service.initialize()).resolves.not.toThrow();
		});

		it("should provide singleton service instance", () => {
			const service1 = getLettaService();
			const service2 = getLettaService();
			expect(service1).toBe(service2);
		});
	});

	describe("Agent Creation", () => {
		it("should create an agent with basic configuration", async () => {
			const service = getLettaService();
			await service.initialize();

			const config: AgentConfig = {
				name: "TestVoiceAgent",
				persona: "You are a helpful voice assistant for testing.",
				human: "User is testing the voice interface.",
				model: "gpt-4",
				embeddingModel: "text-embedding-ada-002",
			};

			const agent = await service.createAgent(config);

			expect(agent).toBeDefined();
			expect(agent.id).toBeDefined();
			expect(agent.name).toBe(config.name);
		});

		it("should create an agent with memory blocks", async () => {
			const service = getLettaService();
			await service.initialize();

			const config: AgentConfig = {
				name: "TestAgentWithMemory",
				persona: "You are a test agent with custom memory.",
				human: "User interacting with the test agent",
				model: "gpt-4",
				embeddingModel: "text-embedding-ada-002",
				memoryBlocks: [
					{
						label: "voice_preferences",
						value: "User prefers fast speech rate and clear pronunciation.",
						description: "Voice interaction preferences",
					},
					{
						label: "project_context",
						value: "Working on solomon_codes voice integration.",
						description: "Current project context",
					},
				],
			};

			const agent = await service.createAgent(config);

			expect(agent).toBeDefined();
			expect(agent.id).toBeDefined();
		});
	});

	describe("Message Handling", () => {
		it("should send a message to an agent", async () => {
			const service = getLettaService();
			await service.initialize();

			// Create test agent
			const agent = await service.createAgent({
				name: "TestMessageAgent",
				persona: "You are a test agent for message handling.",
				human: "User interacting with the test agent",
				model: "gpt-4",
				embeddingModel: "text-embedding-ada-002",
			});

			const message = "Hello, this is a test message for voice processing.";
			const response = await service.sendMessage(agent.id, message);

			expect(response).toBeDefined();
			expect(response.messageId).toBeDefined();
			expect(response.content).toBeDefined();
		});

		it("should handle voice-specific messages", async () => {
			const service = getLettaService();
			await service.initialize();

			const agent = await service.createAgent({
				name: "VoiceTestAgent",
				persona:
					"You are a voice assistant that helps with speech interactions.",
				human: "User interacts primarily through voice commands.",
				model: "gpt-4",
				embeddingModel: "text-embedding-ada-002",
			});

			const voiceMessage =
				"Can you help me generate some code using voice commands?";
			const response = await service.sendMessage(agent.id, voiceMessage);

			expect(response).toBeDefined();
			expect(response.messageId).toBeDefined();
		});
	});

	describe("Memory Management", () => {
		it("should retrieve agent memory", async () => {
			const service = getLettaService();
			await service.initialize();

			const agent = await service.createAgent({
				name: "MemoryTestAgent",
				persona: "Test agent for memory operations.",
				human: "User interacting with the test agent",
				model: "gpt-4",
				embeddingModel: "text-embedding-ada-002",
			});

			const memory = await service.memory.getMemory(agent.id);

			expect(Array.isArray(memory)).toBe(true);
		});

		it("should create and update memory blocks", async () => {
			const service = getLettaService();
			await service.initialize();

			const agent = await service.createAgent({
				name: "MemoryUpdateAgent",
				persona: "Agent for testing memory updates.",
				human: "User interacting with the test agent",
				model: "gpt-4",
				embeddingModel: "text-embedding-ada-002",
			});

			// Create a new memory block
			const newBlock = await service.memory.createBlock(agent.id, {
				label: "test_memory",
				value: "Initial test value",
				description: "Test memory block for voice preferences",
			});

			expect(newBlock).toBeDefined();
			expect(newBlock.id).toBeDefined();
			expect(newBlock.label).toBe("test_memory");
			expect(newBlock.value).toBe("Initial test value");

			// Update the memory block
			expect(newBlock.id).toBeDefined();
			const blockId = newBlock.id || newBlock.label;
			const updatedBlock = await service.memory.updateBlock(
				agent.id,
				blockId,
				"Updated test value",
			);

			expect(updatedBlock.value).toBe("Updated test value");
		});
	});

	describe("Legacy Client Compatibility", () => {
		it("should create a legacy-compatible client", () => {
			const client = createLettaClient();

			expect(client).toBeDefined();
			expect(typeof client.createAgent).toBe("function");
			expect(typeof client.sendMessage).toBe("function");
			expect(typeof client.updateMemory).toBe("function");
			expect(typeof client.getAgent).toBe("function");
			expect(typeof client.deleteAgent).toBe("function");
		});

		it("should handle legacy client operations", async () => {
			const client = createLettaClient();

			const agent = await client.createAgent({
				name: "LegacyTestAgent",
				persona: "Legacy compatibility test agent",
				human: "Testing legacy client interface",
				model: "gpt-4",
				embeddingModel: "text-embedding-ada-002",
			});

			expect(agent).toBeDefined();
			expect(agent.id).toBeDefined();
			expect(agent.name).toBe("LegacyTestAgent");

			const response = await client.sendMessage(
				agent.id,
				"Test message for legacy client",
			);

			expect(response).toBeDefined();
			expect(response.messageId).toBeDefined();
			expect(response.agentId).toBe(agent.id);
			expect(response.content).toBeDefined();
			expect(response.metadata).toBeDefined();
		});
	});
});

describe("Voice-Specific Agent Configuration", () => {
	it("should create a voice agent with appropriate memory blocks", async () => {
		const service = getLettaService();
		await service.initialize();

		const voiceAgentConfig: AgentConfig = {
			name: "VoiceAssistant",
			persona:
				"I am a helpful voice assistant that specializes in natural conversation and helping users navigate the solomon_codes platform through speech.",
			human: "User preferences and conversation context will be stored here.",
			memoryBlocks: [
				{
					label: "voice_preferences",
					value:
						"User's voice interaction preferences, language, and accessibility needs.",
					description:
						"Stores voice-specific user preferences and accessibility requirements",
				},
				{
					label: "conversation_context",
					value: "Current conversation context and topic flow.",
					description: "Maintains context about ongoing conversations",
				},
			],
			model: "gpt-4",
			embeddingModel: "text-embedding-ada-002",
		};

		const voiceAgent = await service.createAgent(voiceAgentConfig);

		expect(voiceAgent).toBeDefined();
		expect(voiceAgent.name).toBe("VoiceAssistant");

		// Verify memory blocks were created
		const memory = await service.memory.getMemory(voiceAgent.id);
		expect(memory.length).toBeGreaterThan(0);

		const voicePrefsBlock = memory.find(
			(block) => block.label === "voice_preferences",
		);
		expect(voicePrefsBlock).toBeDefined();
	});

	it("should create a code agent with VibeKit integration context", async () => {
		const service = getLettaService();
		await service.initialize();

		const codeAgentConfig: AgentConfig = {
			name: "CodeAssistant",
			persona:
				"I am an expert coding assistant that helps users generate, review, and manage code using VibeKit integration while maintaining conversation context.",
			human: "User's coding preferences, skill level, and project context.",
			memoryBlocks: [
				{
					label: "coding_context",
					value:
						"Current project details, repository information, and coding session context.",
					description:
						"Maintains context about current coding projects and user preferences",
				},
				{
					label: "vibekit_integration",
					value: "VibeKit SDK integration status and configuration details.",
					description: "Tracks VibeKit integration and usage patterns",
				},
			],
			model: "gpt-4",
			embeddingModel: "text-embedding-ada-002",
		};

		const codeAgent = await service.createAgent(codeAgentConfig);

		expect(codeAgent).toBeDefined();
		expect(codeAgent.name).toBe("CodeAssistant");
	});
});
