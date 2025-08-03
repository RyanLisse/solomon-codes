/**
 * Speech Processing Service
 * Handles speech-to-text and text-to-speech using multiple providers
 */

// Type declarations for Web Speech API
interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	lang: string;
	onresult:
		| ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
		| null;
	onerror:
		| ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
		| null;
	onend: ((this: SpeechRecognition, ev: Event) => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

interface SpeechRecognitionEvent extends Event {
	resultIndex: number;
	results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
	error: string;
	message: string;
}

interface SpeechRecognitionResultList {
	readonly length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
	readonly length: number;
	item(index: number): SpeechRecognitionAlternative;
	isFinal: boolean;
	[index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
	transcript: string;
	confidence: number;
}

interface SpeechRecognitionConstructor {
	new (): SpeechRecognition;
}

export interface SpeechConfig {
	language: string;
	voice: string;
	rate: number;
	pitch: number;
	volume: number;
}

export interface TranscriptionResult {
	text: string;
	confidence: number;
	isFinal: boolean;
	timestamp: Date;
}

export interface SynthesisResult {
	audioData: ArrayBuffer;
	duration: number;
	format: string;
}

export interface SpeechProvider {
	name: string;
	speechToText: (
		audioData: ArrayBuffer,
		config?: Partial<SpeechConfig>,
	) => Promise<TranscriptionResult>;
	textToSpeech: (
		text: string,
		config?: Partial<SpeechConfig>,
	) => Promise<SynthesisResult>;
	isAvailable: () => boolean;
}

/**
 * Web Speech API Provider
 */
export class WebSpeechProvider implements SpeechProvider {
	name = "WebSpeech";
	private recognition: SpeechRecognition | null = null;
	private synthesis: SpeechSynthesis | null = null;

	constructor() {
		this.initializeRecognition();
		this.initializeSynthesis();
	}

	private initializeRecognition(): void {
		if (typeof window !== "undefined") {
			const SpeechRecognition =
				window.SpeechRecognition || window.webkitSpeechRecognition;
			if (SpeechRecognition) {
				this.recognition = new SpeechRecognition();
				this.recognition.continuous = false;
				this.recognition.interimResults = true;
				this.recognition.maxAlternatives = 1;
			}
		}
	}

	private initializeSynthesis(): void {
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			this.synthesis = window.speechSynthesis;
		}
	}

	isAvailable(): boolean {
		return this.recognition !== null && this.synthesis !== null;
	}

	async speechToText(
		_audioData: ArrayBuffer,
		config?: Partial<SpeechConfig>,
	): Promise<TranscriptionResult> {
		if (!this.recognition) {
			throw new Error("Speech recognition not available");
		}

		return new Promise((resolve, reject) => {
			if (!this.recognition) {
				reject(new Error("Speech recognition not available"));
				return;
			}

			this.recognition.lang = config?.language || "en-US";

			let finalTranscript = "";
			let confidence = 0;

			this.recognition.onresult = (event: SpeechRecognitionEvent) => {
				for (let i = event.resultIndex; i < event.results.length; i++) {
					const transcript = event.results[i][0].transcript;
					confidence = event.results[i][0].confidence || 0;

					if (event.results[i].isFinal) {
						finalTranscript += transcript;
					}
				}
			};

			this.recognition.onend = () => {
				resolve({
					text: finalTranscript,
					confidence,
					isFinal: true,
					timestamp: new Date(),
				});
			};

			this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
				reject(new Error(`Speech recognition error: ${event.error}`));
			};

			// Note: Web Speech API doesn't directly accept ArrayBuffer
			// This would need to be adapted for real-time audio streaming
			this.recognition.start();
		});
	}

	async textToSpeech(
		text: string,
		config?: Partial<SpeechConfig>,
	): Promise<SynthesisResult> {
		if (!this.synthesis) {
			throw new Error("Speech synthesis not available");
		}

		return new Promise((resolve, reject) => {
			const utterance = new SpeechSynthesisUtterance(text);

			utterance.voice = this.getVoiceByName(config?.voice || "default");
			utterance.rate = config?.rate || 1.0;
			utterance.pitch = config?.pitch || 1.0;
			utterance.volume = config?.volume || 1.0;
			utterance.lang = config?.language || "en-US";

			utterance.onend = () => {
				// Web Speech API doesn't provide audio data directly
				// This is a limitation - for actual audio data, use OpenAI TTS
				resolve({
					audioData: new ArrayBuffer(0),
					duration: 0,
					format: "web-speech",
				});
			};

			utterance.onerror = (event) => {
				reject(new Error(`Speech synthesis error: ${event.error}`));
			};

			this.synthesis?.speak(utterance);
		});
	}

	private getVoiceByName(voiceName: string): SpeechSynthesisVoice | null {
		if (!this.synthesis) return null;

		const voices = this.synthesis.getVoices();
		return (
			voices.find((voice) => voice.name.includes(voiceName)) ||
			voices[0] ||
			null
		);
	}
}

/**
 * OpenAI Speech Provider
 */
export class OpenAISpeechProvider implements SpeechProvider {
	name = "OpenAI";
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	isAvailable(): boolean {
		return !!this.apiKey;
	}

	async speechToText(
		audioData: ArrayBuffer,
		config?: Partial<SpeechConfig>,
	): Promise<TranscriptionResult> {
		try {
			const formData = new FormData();
			const audioBlob = new Blob([audioData], { type: "audio/wav" });
			formData.append("file", audioBlob, "audio.wav");
			formData.append("model", "gpt-4o-mini-transcribe");
			formData.append("language", config?.language || "en");

			const response = await fetch(
				"https://api.openai.com/v1/audio/transcriptions",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: formData,
				},
			);

			if (!response.ok) {
				throw new Error(`OpenAI API error: ${response.statusText}`);
			}

			const result = await response.json();

			return {
				text: result.text,
				confidence: 0.95, // OpenAI doesn't provide confidence scores
				isFinal: true,
				timestamp: new Date(),
			};
		} catch (error) {
			throw new Error(`OpenAI speech-to-text error: ${error}`);
		}
	}

	async textToSpeech(
		text: string,
		config?: Partial<SpeechConfig>,
	): Promise<SynthesisResult> {
		try {
			const response = await fetch("https://api.openai.com/v1/audio/speech", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: "gpt-4o-mini-tts",
					input: text,
					voice: config?.voice || "coral",
					response_format: "wav",
					speed: config?.rate || 1.0,
				}),
			});

			if (!response.ok) {
				throw new Error(`OpenAI API error: ${response.statusText}`);
			}

			const audioData = await response.arrayBuffer();

			return {
				audioData,
				duration: 0, // Would need audio analysis to determine duration
				format: "wav",
			};
		} catch (error) {
			throw new Error(`OpenAI text-to-speech error: ${error}`);
		}
	}
}

/**
 * Main Speech Processing Service
 */
export class SpeechProcessingService {
	private providers: Map<string, SpeechProvider> = new Map();
	private defaultProvider = "WebSpeech";
	private fallbackProvider = "OpenAI";

	constructor() {
		// Initialize providers
		this.providers.set("WebSpeech", new WebSpeechProvider());

		// Initialize OpenAI provider if API key is available
		const openaiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
		if (openaiKey) {
			this.providers.set("OpenAI", new OpenAISpeechProvider(openaiKey));
		}
	}

	/**
	 * Convert speech to text using the best available provider
	 */
	async speechToText(
		audioData: ArrayBuffer,
		config?: Partial<SpeechConfig>,
	): Promise<TranscriptionResult> {
		const provider = this.getBestProvider("speechToText");

		try {
			return await provider.speechToText(audioData, config);
		} catch (error) {
			// Try fallback provider
			const fallback = this.providers.get(this.fallbackProvider);
			if (fallback && fallback !== provider && fallback.isAvailable()) {
				try {
					return await fallback.speechToText(audioData, config);
				} catch (fallbackError) {
					throw new Error(
						`Speech-to-text failed: ${error}. Fallback also failed: ${fallbackError}`,
					);
				}
			}
			throw error;
		}
	}

	/**
	 * Convert text to speech using the best available provider
	 */
	async textToSpeech(
		text: string,
		config?: Partial<SpeechConfig>,
	): Promise<SynthesisResult> {
		const provider = this.getBestProvider("textToSpeech");

		try {
			return await provider.textToSpeech(text, config);
		} catch (error) {
			// Try fallback provider
			const fallback = this.providers.get(this.fallbackProvider);
			if (fallback && fallback !== provider && fallback.isAvailable()) {
				try {
					return await fallback.textToSpeech(text, config);
				} catch (fallbackError) {
					throw new Error(
						`Text-to-speech failed: ${error}. Fallback also failed: ${fallbackError}`,
					);
				}
			}
			throw error;
		}
	}

	/**
	 * Detect language from audio data
	 */
	async detectLanguage(audioData: ArrayBuffer): Promise<string> {
		// Use OpenAI for language detection if available
		const openaiProvider = this.providers.get("OpenAI");
		if (openaiProvider?.isAvailable()) {
			try {
				await openaiProvider.speechToText(audioData);
				// OpenAI Whisper can detect language, but we'd need to modify the API call
				// For now, return default
				return "en-US";
			} catch (error) {
				console.warn("Language detection failed:", error);
			}
		}

		return "en-US"; // Default language
	}

	/**
	 * Enhance audio quality (placeholder for future implementation)
	 */
	async enhanceAudio(audioData: ArrayBuffer): Promise<ArrayBuffer> {
		// This would implement noise reduction, echo cancellation, etc.
		// For now, return the original audio data
		return audioData;
	}

	/**
	 * Get the best available provider for a specific operation
	 */
	private getBestProvider(
		operation: "speechToText" | "textToSpeech",
	): SpeechProvider {
		// For speech-to-text, prefer OpenAI for accuracy
		if (operation === "speechToText") {
			const openai = this.providers.get("OpenAI");
			if (openai?.isAvailable()) {
				return openai;
			}
		}

		// For text-to-speech, prefer OpenAI for quality
		if (operation === "textToSpeech") {
			const openai = this.providers.get("OpenAI");
			if (openai?.isAvailable()) {
				return openai;
			}
		}

		// Fall back to default provider
		const defaultProvider = this.providers.get(this.defaultProvider);
		if (defaultProvider?.isAvailable()) {
			return defaultProvider;
		}

		// If no providers available, throw error
		throw new Error("No speech processing providers available");
	}

	/**
	 * Get available providers
	 */
	getAvailableProviders(): string[] {
		return Array.from(this.providers.entries())
			.filter(([, provider]) => provider.isAvailable())
			.map(([name]) => name);
	}

	/**
	 * Set default provider
	 */
	setDefaultProvider(providerName: string): void {
		if (this.providers.has(providerName)) {
			this.defaultProvider = providerName;
		} else {
			throw new Error(`Provider ${providerName} not found`);
		}
	}
}

// Global instance
export const speechProcessingService = new SpeechProcessingService();

// Add global type declarations for Web Speech API
declare global {
	interface Window {
		SpeechRecognition: SpeechRecognitionConstructor;
		webkitSpeechRecognition: SpeechRecognitionConstructor;
	}
}
