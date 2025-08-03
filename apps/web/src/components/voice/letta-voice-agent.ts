import { createLettaClient, type LettaClient } from "@/lib/letta";
import type {
	LettaMemoryBlock,
	LettaVoiceAgentConfig,
	TextToSpeechOptions,
	VoiceAgentResponse,
	VoiceSettings,
} from "./types";

export class LettaVoiceAgent {
	private lettaClient: LettaClient;
	private config: LettaVoiceAgentConfig;
	private voicePreferences: VoiceSettings;
	private isDestroyed = false;

	constructor(config: LettaVoiceAgentConfig) {
		this.config = config;
		this.voicePreferences = { ...config.voicePreferences };
		this.lettaClient = createLettaClient();
		this.initializeAgent();
	}

	private async initializeAgent(): Promise<void> {
		try {
			const personaBlock = this.config.memoryBlocks.find(
				(block) => block.label === "persona",
			);
			const humanBlock = this.config.memoryBlocks.find(
				(block) => block.label === "human",
			);

			await this.lettaClient.agents.create({
				name: `voice-agent-${this.config.agentId}`,
				memoryBlocks: [
					{
						label: "persona",
						value: personaBlock?.value || "You are a helpful voice assistant.",
					},
					{
						label: "human",
						value: humanBlock?.value || "User prefers voice interactions.",
					},
				],
				tools: this.config.tools,
				model: this.config.model,
				embedding: this.config.embedding,
			});
		} catch (error) {
			console.error("Failed to initialize Letta agent:", error);
			throw new Error(`Failed to initialize voice agent: ${error}`);
		}
	}

	async processVoiceInput(transcript: string): Promise<VoiceAgentResponse> {
		if (this.isDestroyed) {
			throw new Error("Voice agent has been destroyed");
		}

		try {
			const startTime = Date.now();

			const response = await this.lettaClient.agents.messages.create(
				this.config.agentId,
				{ messages: [{ role: "user", content: transcript }] },
			);

			const processingTime = Date.now() - startTime;

			// Extract the response content from the first message
			const firstMessage = response.messages[0];
			const responseContent = firstMessage?.content || "No response received";

			return {
				messageId: firstMessage?.messageId || `msg-${Date.now()}`,
				agentId: this.config.agentId,
				content: responseContent,
				memoryUpdates: [],
				toolCalls: firstMessage?.toolCall
					? [
							{
								name: firstMessage.toolCall.name,
								arguments: firstMessage.toolCall.arguments as Record<
									string,
									unknown
								>,
								timestamp: new Date(),
							},
						]
					: [],
				metadata: {
					processingTime,
					confidence: 0.95,
					voiceGenerated: false,
				},
			};
		} catch (error) {
			throw new Error(`Failed to process voice input: ${error}`);
		}
	}

	async speakResponse(
		text: string,
		options?: TextToSpeechOptions,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!window.speechSynthesis) {
				reject(new Error("Speech synthesis not supported"));
				return;
			}

			const utterance = new SpeechSynthesisUtterance(text);

			// Apply voice preferences
			utterance.rate = options?.rate || this.voicePreferences.rate;
			utterance.pitch = options?.pitch || this.voicePreferences.pitch;
			utterance.volume = options?.volume || this.voicePreferences.volume;
			utterance.lang = options?.language || this.voicePreferences.language;

			// Set voice if specified
			if (options?.voice || this.voicePreferences.voice !== "default") {
				const voices = window.speechSynthesis.getVoices();
				const selectedVoice = voices.find(
					(voice) =>
						voice.name === (options?.voice || this.voicePreferences.voice) ||
						voice.lang === utterance.lang,
				);
				if (selectedVoice) {
					utterance.voice = selectedVoice;
				}
			}

			utterance.onend = () => resolve();
			utterance.onerror = (event) =>
				reject(new Error(`Speech synthesis failed: ${event.error}`));

			window.speechSynthesis.speak(utterance);
		});
	}

	async updateMemory(memoryBlocks: LettaMemoryBlock[]): Promise<void> {
		if (this.isDestroyed) {
			throw new Error("Voice agent has been destroyed");
		}

		try {
			// Note: Memory updates would need to be implemented with the actual Letta API
			console.log("Updating memory blocks:", memoryBlocks);

			// Update local memory blocks
			memoryBlocks.forEach((newBlock) => {
				const existingIndex = this.config.memoryBlocks.findIndex(
					(block) => block.label === newBlock.label,
				);

				if (existingIndex >= 0) {
					this.config.memoryBlocks[existingIndex] = newBlock;
				} else {
					this.config.memoryBlocks.push(newBlock);
				}
			});
		} catch (error) {
			throw new Error(`Failed to update memory: ${error}`);
		}
	}

	async getMemory(): Promise<LettaMemoryBlock[]> {
		if (this.isDestroyed) {
			throw new Error("Voice agent has been destroyed");
		}

		try {
			const agent = await this.lettaClient.agents.get(this.config.agentId);
			return agent.memoryBlocks || this.config.memoryBlocks;
		} catch (error) {
			throw new Error(`Failed to retrieve memory: ${error}`);
		}
	}

	updateVoicePreferences(
		preferences: VoiceSettings,
		persistToMemory = false,
	): void {
		this.voicePreferences = { ...preferences };

		if (persistToMemory) {
			const voicePreferencesBlock: LettaMemoryBlock = {
				label: "voice_preferences",
				value: JSON.stringify(preferences),
				description: "User voice interaction preferences",
			};

			this.updateMemory([voicePreferencesBlock]).catch((error) => {
				console.error("Failed to persist voice preferences to memory:", error);
			});
		}
	}

	getVoicePreferences(): VoiceSettings {
		return { ...this.voicePreferences };
	}

	getAgentId(): string {
		return this.config.agentId;
	}

	getConfig(): LettaVoiceAgentConfig {
		return { ...this.config };
	}

	async destroy(): Promise<void> {
		if (this.isDestroyed) return;

		try {
			// Cancel any ongoing speech synthesis
			if (window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}

			// Delete the Letta agent
			await this.lettaClient.agents.delete(this.config.agentId);

			this.isDestroyed = true;
		} catch (error) {
			console.error("Error during voice agent cleanup:", error);
			throw new Error(`Failed to cleanup voice agent: ${error}`);
		}
	}

	isActive(): boolean {
		return !this.isDestroyed;
	}
}

// Factory function to create voice agent with default configuration
export function createVoiceAgent(
	agentId: string,
	overrides: Partial<LettaVoiceAgentConfig> = {},
): LettaVoiceAgent {
	const defaultConfig: LettaVoiceAgentConfig = {
		agentId,
		memoryBlocks: [
			{
				label: "persona",
				value:
					"You are a helpful AI voice assistant. Provide clear, concise responses optimized for voice interaction.",
				description: "Agent personality and behavior guidelines",
			},
			{
				label: "human",
				value:
					"User prefers voice interactions and appreciates natural, conversational responses.",
				description: "Information about the user and their preferences",
			},
		],
		tools: [],
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
		...overrides,
	};

	return new LettaVoiceAgent(defaultConfig);
}
