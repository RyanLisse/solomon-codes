import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LettaVoiceAgent } from "./letta-voice-agent";
import type { LettaVoiceAgentConfig } from "./types";

// Mock Letta client with proper interface structure
const mockLettaClient = {
	agents: {
		create: vi.fn(),
		get: vi.fn(),
		delete: vi.fn(),
		list: vi.fn(),
		messages: {
			create: vi.fn(),
			createStream: vi.fn(),
		},
	},
	tools: {
		list: vi.fn(),
	},
	// Direct methods for convenience (used by tests)
	createAgent: vi.fn(),
	sendMessage: vi.fn(),
	updateMemory: vi.fn(),
	getAgent: vi.fn(),
	deleteAgent: vi.fn(),
};

// Mock the Letta client module
vi.mock("@/lib/letta", () => ({
	createLettaClient: vi.fn(() => mockLettaClient),
}));

// Mock Text-to-Speech
const mockSpeechSynthesis = {
	speak: vi.fn(),
	cancel: vi.fn(),
	pause: vi.fn(),
	resume: vi.fn(),
	getVoices: vi.fn(() => []),
};

Object.defineProperty(window, "speechSynthesis", {
	writable: true,
	value: mockSpeechSynthesis,
});

describe("LettaVoiceAgent", () => {
	let agent: LettaVoiceAgent;
	let mockConfig: LettaVoiceAgentConfig;

	beforeEach(() => {
		vi.clearAllMocks();

		mockConfig = {
			agentId: "test-agent-123",
			memoryBlocks: [
				{ label: "persona", value: "You are a helpful voice assistant." },
				{ label: "human", value: "User prefers concise responses." },
			],
			tools: ["web_search", "code_generation"],
			model: "openai/gpt-4",
			embedding: "openai/text-embedding-3-small",
			voicePreferences: {
				language: "en-US",
				voice: "default",
				rate: 1.0,
				pitch: 1.0,
				volume: 1.0,
				transcriptionEnabled: true,
			},
		};

		agent = new LettaVoiceAgent(mockConfig);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initialization", () => {
		it("should initialize with provided configuration", () => {
			expect(agent.getAgentId()).toBe("test-agent-123");
			expect(agent.getVoicePreferences()).toEqual(mockConfig.voicePreferences);
		});

		it("should create Letta agent on initialization", () => {
			expect(mockLettaClient.agents.create).toHaveBeenCalledWith({
				name: "voice-agent-test-agent-123",
				memoryBlocks: [
					{
						label: "persona",
						value: "You are a helpful voice assistant.",
					},
					{
						label: "human",
						value: "User prefers concise responses.",
					},
				],
				tools: ["web_search", "code_generation"],
				model: "openai/gpt-4",
				embedding: "openai/text-embedding-3-small",
			});
		});
	});

	describe("voice message processing", () => {
		it("should process voice input and return response", async () => {
			const mockResponse = {
				messages: [
					{
						messageId: "msg-123",
						agentId: "test-agent-123",
						content: "Hello! How can I help you today?",
						messageType: "assistant_message" as const,
						metadata: {
							processingTime: 1500,
							confidence: 0.95,
							voiceGenerated: false,
						},
					},
				],
				usage: {
					completion_tokens: 20,
					prompt_tokens: 10,
					total_tokens: 30,
					step_count: 1,
				},
			};

			mockLettaClient.agents.messages.create.mockResolvedValue(mockResponse);

			const result = await agent.processVoiceInput("Hello, how are you?");

			expect(mockLettaClient.agents.messages.create).toHaveBeenCalledWith(
				"test-agent-123",
				{ messages: [{ role: "user", content: "Hello, how are you?" }] },
			);
			expect(result).toEqual({
				messageId: "msg-123",
				agentId: "test-agent-123",
				content: "Hello! How can I help you today?",
				memoryUpdates: [],
				toolCalls: [],
				metadata: {
					processingTime: expect.any(Number),
					confidence: 0.95,
					voiceGenerated: false,
				},
			});
		});

		it("should handle voice input with memory updates", async () => {
			const mockResponse = {
				messages: [
					{
						messageId: "msg-124",
						agentId: "test-agent-123",
						content: "I remember you prefer short answers.",
						messageType: "assistant_message" as const,
						metadata: {
							processingTime: 1200,
							confidence: 0.92,
							voiceGenerated: false,
						},
					},
				],
				usage: {
					completion_tokens: 15,
					prompt_tokens: 8,
					total_tokens: 23,
					step_count: 1,
				},
			};

			mockLettaClient.agents.messages.create.mockResolvedValue(mockResponse);

			const result = await agent.processVoiceInput(
				"Please keep responses short",
			);

			expect(result.memoryUpdates).toHaveLength(0);
			expect(mockLettaClient.agents.messages.create).toHaveBeenCalledWith(
				"test-agent-123",
				{
					messages: [{ role: "user", content: "Please keep responses short" }],
				},
			);
		});

		it("should handle tool calls in responses", async () => {
			const mockResponse = {
				messages: [
					{
						messageId: "msg-125",
						agentId: "test-agent-123",
						content: "Let me search for that information.",
						messageType: "assistant_message" as const,
						toolCall: {
							name: "web_search",
							arguments: { query: "latest AI news" },
						},
						metadata: {
							processingTime: 3000,
							confidence: 0.88,
							voiceGenerated: false,
						},
					},
				],
				usage: {
					completion_tokens: 25,
					prompt_tokens: 12,
					total_tokens: 37,
					step_count: 1,
				},
			};

			mockLettaClient.agents.messages.create.mockResolvedValue(mockResponse);

			const result = await agent.processVoiceInput(
				"What are the latest AI news?",
			);

			expect(result.toolCalls).toHaveLength(1);
			expect(result.toolCalls?.[0].name).toBe("web_search");
		});

		it("should handle errors gracefully", async () => {
			mockLettaClient.agents.messages.create.mockRejectedValue(
				new Error("Network error"),
			);

			await expect(agent.processVoiceInput("Hello")).rejects.toThrow(
				"Failed to process voice input: Error: Network error",
			);
		});
	});

	describe("text-to-speech integration", () => {
		it("should convert response to speech", async () => {
			const mockUtterance = {
				text: "Hello! How can I help you today?",
				voice: null,
				rate: 1.0,
				pitch: 1.0,
				volume: 1.0,
				lang: "en-US",
				onend: null as ((event: Event) => void) | null,
				onerror: null as ((event: SpeechSynthesisErrorEvent) => void) | null,
			};

			// Mock SpeechSynthesisUtterance constructor
			global.SpeechSynthesisUtterance = vi
				.fn()
				.mockImplementation(
					() => mockUtterance,
				) as unknown as typeof SpeechSynthesisUtterance;

			const speakPromise = agent.speakResponse(
				"Hello! How can I help you today?",
			);

			// Simulate successful speech synthesis
			setTimeout(() => {
				if (mockUtterance.onend) {
					(mockUtterance.onend as (event: Event) => void)(new Event("end"));
				}
			}, 10);

			await speakPromise;

			expect(global.SpeechSynthesisUtterance).toHaveBeenCalledWith(
				"Hello! How can I help you today?",
			);
			expect(mockSpeechSynthesis.speak).toHaveBeenCalledWith(mockUtterance);
		});

		it("should apply voice preferences to speech synthesis", async () => {
			const customPreferences = {
				...mockConfig.voicePreferences,
				rate: 1.2,
				pitch: 0.8,
				volume: 0.9,
			};

			agent.updateVoicePreferences(customPreferences);

			const mockUtterance = {
				text: "Test message",
				voice: null,
				rate: 1.0,
				pitch: 1.0,
				volume: 1.0,
				lang: "en-US",
				onend: null,
				onerror: null,
			};

			global.SpeechSynthesisUtterance = vi
				.fn()
				.mockImplementation(
					() => mockUtterance,
				) as unknown as typeof SpeechSynthesisUtterance;

			const speakPromise = agent.speakResponse("Test message");

			// Simulate successful speech synthesis
			setTimeout(() => {
				if (mockUtterance.onend) {
					(mockUtterance.onend as (event: Event) => void)(new Event("end"));
				}
			}, 10);

			await speakPromise;

			expect(mockUtterance.rate).toBe(1.2);
			expect(mockUtterance.pitch).toBe(0.8);
			expect(mockUtterance.volume).toBe(0.9);
		});

		it("should handle speech synthesis errors", async () => {
			const mockUtterance = {
				text: "Test message",
				voice: null,
				rate: 1.0,
				pitch: 1.0,
				volume: 1.0,
				onend: null as ((event: Event) => void) | null,
				onerror: null as ((event: SpeechSynthesisErrorEvent) => void) | null,
			};

			global.SpeechSynthesisUtterance = vi
				.fn()
				.mockImplementation(
					() => mockUtterance,
				) as unknown as typeof SpeechSynthesisUtterance;

			const speakPromise = agent.speakResponse("Test message");

			// Simulate speech synthesis error
			setTimeout(() => {
				if (mockUtterance.onerror) {
					const errorEvent = new Event("error") as SpeechSynthesisErrorEvent;
					Object.defineProperty(errorEvent, "error", {
						value: "synthesis-failed",
						enumerable: true,
					});
					mockUtterance.onerror(errorEvent);
				}
			}, 10);

			await expect(speakPromise).rejects.toThrow("Speech synthesis failed");
		});
	});

	describe("memory management", () => {
		it("should update memory blocks", async () => {
			const newMemoryBlocks = [
				{ label: "persona", value: "You are a coding assistant." },
				{ label: "context", value: "Working on a React project." },
			];

			await agent.updateMemory(newMemoryBlocks);

			// Memory update is handled locally in the current implementation
			const config = agent.getConfig();
			expect(config.memoryBlocks).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						label: "persona",
						value: "You are a coding assistant.",
					}),
					expect.objectContaining({
						label: "context",
						value: "Working on a React project.",
					}),
				]),
			);
		});

		it("should retrieve current memory blocks", async () => {
			const mockMemoryBlocks = [
				{ label: "persona", value: "You are a helpful assistant." },
				{ label: "human", value: "User is a developer." },
			];

			mockLettaClient.agents.get.mockResolvedValue({
				id: "test-agent-123",
				name: "Test Agent",
				memoryBlocks: mockMemoryBlocks,
				model: "openai/gpt-4",
				embedding: "openai/text-embedding-3-small",
				tools: [],
			});

			const memory = await agent.getMemory();

			expect(memory).toEqual(mockMemoryBlocks);
			expect(mockLettaClient.agents.get).toHaveBeenCalledWith("test-agent-123");
		});
	});

	describe("voice preferences", () => {
		it("should update voice preferences", () => {
			const newPreferences = {
				language: "es-ES",
				voice: "spanish-female",
				rate: 0.8,
				pitch: 1.2,
				volume: 0.7,
				transcriptionEnabled: false,
			};

			agent.updateVoicePreferences(newPreferences);

			expect(agent.getVoicePreferences()).toEqual(newPreferences);
		});

		it("should persist voice preferences in memory", async () => {
			const newPreferences = {
				language: "fr-FR",
				voice: "french-male",
				rate: 1.1,
				pitch: 0.9,
				volume: 1.0,
				transcriptionEnabled: true,
			};

			agent.updateVoicePreferences(newPreferences, true);

			// Check that preferences were updated locally
			expect(agent.getVoicePreferences()).toEqual(newPreferences);

			// Check that the memory block was updated in the config
			const config = agent.getConfig();
			const voicePreferencesBlock = config.memoryBlocks.find(
				(block) => block.label === "voice_preferences",
			);
			expect(voicePreferencesBlock?.value).toBe(JSON.stringify(newPreferences));
		});
	});

	describe("cleanup", () => {
		it("should cleanup resources on destroy", async () => {
			mockLettaClient.agents.delete.mockResolvedValue(true);

			await agent.destroy();

			expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
			expect(mockLettaClient.agents.delete).toHaveBeenCalledWith(
				"test-agent-123",
			);
		});
	});
});
