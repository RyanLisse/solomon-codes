/**
 * Google Gemini Text-to-Speech Service
 * Provides advanced, controllable speech generation using Gemini's native TTS
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiVoiceConfig {
	voiceName: string;
	style?: string;
	emotion?: string;
	pace?: string;
	accent?: string;
}

export interface MultiSpeakerConfig {
	speakers: Array<{
		name: string;
		voice: string;
		style?: string;
	}>;
}

export interface GeminiTTSResult {
	audioData: ArrayBuffer;
	format: string;
	sampleRate: number;
	channels: number;
}

export class GeminiTTSService {
	private client: GoogleGenerativeAI;
	private model: string;

	constructor(apiKey: string, model = "gemini-2.5-flash-preview-tts") {
		this.client = new GoogleGenerativeAI(apiKey);
		this.model = model;
	}

	/**
	 * Generate single-speaker speech with style control
	 */
	async generateSpeechWithStyle(
		text: string,
		voiceConfig: GeminiVoiceConfig,
	): Promise<GeminiTTSResult> {
		try {
			// Construct prompt with style instructions
			const styledPrompt = this.buildStyledPrompt(text, voiceConfig);

			const model = this.client.getGenerativeModel({ model: this.model });

			const response = await model.generateContent({
				contents: [{ role: "user", parts: [{ text: styledPrompt }] }],
				// Note: Audio generation is experimental and not yet available in the SDK
				// Future implementation will use proper TTS configuration
				generationConfig: {
					temperature: 0.9,
					maxOutputTokens: 1000,
				},
			});

			const audioData =
				response.response.candidates?.[0]?.content?.parts?.[0]?.inlineData
					?.data;
			if (!audioData) {
				throw new Error("No audio data received from Gemini TTS");
			}

			// Convert base64 to ArrayBuffer
			const buffer = this.base64ToArrayBuffer(audioData);

			return {
				audioData: buffer,
				format: "pcm16",
				sampleRate: 24000,
				channels: 1,
			};
		} catch (error) {
			throw new Error(`Gemini TTS error: ${error}`);
		}
	}

	/**
	 * Generate multi-speaker conversation audio
	 */
	async generateMultiSpeakerAudio(
		conversation: Array<{ speaker: string; text: string }>,
		speakerConfig: MultiSpeakerConfig,
	): Promise<GeminiTTSResult> {
		try {
			// Build conversation transcript
			const transcript = conversation
				.map((c) => `${c.speaker}: ${c.text}`)
				.join("\n");

			// Build speaker voice configurations
			const _speakerVoiceConfigs = speakerConfig.speakers.map((speaker) => ({
				speaker: speaker.name,
				voiceConfig: {
					prebuiltVoiceConfig: {
						voiceName: speaker.voice,
					},
				},
			}));

			const model = this.client.getGenerativeModel({ model: this.model });

			const response = await model.generateContent({
				contents: [
					{
						role: "user",
						parts: [{ text: `TTS the following conversation:\n${transcript}` }],
					},
				],
				// Note: Audio generation is experimental and not yet available in the SDK
				// Future implementation will use proper TTS configuration
				generationConfig: {
					temperature: 0.9,
					maxOutputTokens: 1000,
				},
			});

			const audioData =
				response.response.candidates?.[0]?.content?.parts?.[0]?.inlineData
					?.data;
			if (!audioData) {
				throw new Error("No audio data received from Gemini multi-speaker TTS");
			}

			const buffer = this.base64ToArrayBuffer(audioData);

			return {
				audioData: buffer,
				format: "pcm16",
				sampleRate: 24000,
				channels: 1,
			};
		} catch (error) {
			throw new Error(`Gemini multi-speaker TTS error: ${error}`);
		}
	}

	/**
	 * Generate speech for agent conversations with different personalities
	 */
	async generateAgentSpeech(
		text: string,
		agentType: "voice" | "code" | "task",
		emotion?: string,
	): Promise<GeminiTTSResult> {
		const voiceConfig = this.getAgentVoiceConfig(agentType, emotion);
		return this.generateSpeechWithStyle(text, voiceConfig);
	}

	/**
	 * Generate speech with natural language style control
	 */
	async generateWithNaturalStyle(
		text: string,
		styleDescription: string,
		voiceName = "Kore",
	): Promise<GeminiTTSResult> {
		const styledText = `Say in a ${styleDescription} way: ${text}`;

		return this.generateSpeechWithStyle(styledText, {
			voiceName,
			style: styleDescription,
		});
	}

	/**
	 * Build styled prompt for single-speaker TTS
	 */
	private buildStyledPrompt(text: string, config: GeminiVoiceConfig): string {
		let prompt = "";

		// Add style instructions
		const styleInstructions = [];
		if (config.style) styleInstructions.push(`in a ${config.style} tone`);
		if (config.emotion)
			styleInstructions.push(`with ${config.emotion} emotion`);
		if (config.pace) styleInstructions.push(`at a ${config.pace} pace`);
		if (config.accent) styleInstructions.push(`with a ${config.accent} accent`);

		if (styleInstructions.length > 0) {
			prompt = `Say ${styleInstructions.join(", ")}: `;
		}

		return prompt + text;
	}

	/**
	 * Get voice configuration for different agent types
	 */
	private getAgentVoiceConfig(
		agentType: "voice" | "code" | "task",
		emotion?: string,
	): GeminiVoiceConfig {
		const configs = {
			voice: {
				voiceName: "Kore", // Firm, professional
				style: "helpful and conversational",
				emotion: emotion || "friendly",
			},
			code: {
				voiceName: "Charon", // Informative
				style: "technical and precise",
				emotion: emotion || "focused",
			},
			task: {
				voiceName: "Puck", // Upbeat
				style: "organized and efficient",
				emotion: emotion || "motivated",
			},
		};

		return configs[agentType];
	}

	/**
	 * Convert base64 to ArrayBuffer
	 */
	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	/**
	 * Get available Gemini voices
	 */
	static getAvailableVoices(): Array<{ name: string; description: string }> {
		return [
			{ name: "Zephyr", description: "Bright" },
			{ name: "Puck", description: "Upbeat" },
			{ name: "Charon", description: "Informative" },
			{ name: "Kore", description: "Firm" },
			{ name: "Fenrir", description: "Excitable" },
			{ name: "Leda", description: "Youthful" },
			{ name: "Orus", description: "Firm" },
			{ name: "Aoede", description: "Breezy" },
			{ name: "Callirrhoe", description: "Easy-going" },
			{ name: "Autonoe", description: "Bright" },
			{ name: "Enceladus", description: "Breathy" },
			{ name: "Iapetus", description: "Clear" },
			{ name: "Umbriel", description: "Easy-going" },
			{ name: "Algieba", description: "Smooth" },
			{ name: "Despina", description: "Smooth" },
			{ name: "Erinome", description: "Clear" },
			{ name: "Algenib", description: "Gravelly" },
			{ name: "Rasalgethi", description: "Informative" },
			{ name: "Laomedeia", description: "Upbeat" },
			{ name: "Achernar", description: "Soft" },
			{ name: "Alnilam", description: "Firm" },
			{ name: "Schedar", description: "Even" },
			{ name: "Gacrux", description: "Mature" },
			{ name: "Pulcherrima", description: "Forward" },
			{ name: "Achird", description: "Friendly" },
			{ name: "Zubenelgenubi", description: "Casual" },
			{ name: "Vindemiatrix", description: "Gentle" },
			{ name: "Sadachbia", description: "Lively" },
			{ name: "Sadaltager", description: "Knowledgeable" },
			{ name: "Sulafat", description: "Warm" },
		];
	}

	/**
	 * Check if the service is available
	 */
	isAvailable(): boolean {
		return !!this.client;
	}
}

/**
 * Audio utility functions
 */
export class AudioUtils {
	/**
	 * Convert PCM16 audio to WAV format
	 */
	static pcm16ToWav(pcmData: ArrayBuffer, sampleRate = 24000): ArrayBuffer {
		const pcm = new Int16Array(pcmData);
		const wavBuffer = new ArrayBuffer(44 + pcm.length * 2);
		const view = new DataView(wavBuffer);

		// WAV header
		const writeString = (offset: number, string: string) => {
			for (let i = 0; i < string.length; i++) {
				view.setUint8(offset + i, string.charCodeAt(i));
			}
		};

		writeString(0, "RIFF");
		view.setUint32(4, 36 + pcm.length * 2, true);
		writeString(8, "WAVE");
		writeString(12, "fmt ");
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, 1, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * 2, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		writeString(36, "data");
		view.setUint32(40, pcm.length * 2, true);

		// Copy PCM data
		const wavPcm = new Int16Array(wavBuffer, 44);
		wavPcm.set(pcm);

		return wavBuffer;
	}

	/**
	 * Play audio data in the browser
	 */
	static async playAudio(
		audioData: ArrayBuffer,
		format = "wav",
	): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				let blob: Blob;

				if (format === "pcm16") {
					// Convert PCM16 to WAV for browser playback
					const wavData = AudioUtils.pcm16ToWav(audioData);
					blob = new Blob([wavData], { type: "audio/wav" });
				} else {
					blob = new Blob([audioData], { type: `audio/${format}` });
				}

				const audio = new Audio();
				const url = URL.createObjectURL(blob);

				audio.onended = () => {
					URL.revokeObjectURL(url);
					resolve();
				};

				audio.onerror = (error) => {
					URL.revokeObjectURL(url);
					reject(error);
				};

				audio.src = url;
				audio.play();
			} catch (error) {
				reject(error);
			}
		});
	}
}
