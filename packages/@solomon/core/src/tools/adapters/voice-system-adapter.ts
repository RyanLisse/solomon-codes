/**
 * Voice System Adapter - Speech processing and synthesis for agent communication
 * Integrates speech-to-text, text-to-speech, and voice interaction management
 */

import { z } from "zod";
import type { ToolIntegrationState } from "../../state/unified-state";
import { BaseAdapter } from "../adapter-framework";

// Voice System specific configuration
export const VoiceSystemConfigSchema = z.object({
	...z.object({
		retryAttempts: z.number().min(0).default(3),
		retryDelayMs: z.number().min(100).default(1000),
		healthCheckIntervalMs: z.number().min(1000).default(30000),
		timeoutMs: z.number().min(1000).default(10000),
		circuitBreakerThreshold: z.number().min(1).default(5),
		enabled: z.boolean().default(true),
	}).shape,
	// Voice System specific settings
	speechToTextProvider: z
		.enum(["browser", "openai", "deepgram"])
		.default("browser"),
	textToSpeechProvider: z
		.enum(["browser", "elevenlabs", "openai"])
		.default("browser"),
	defaultVoiceId: z.string().default("alloy"),
	defaultLanguage: z.string().default("en-US"),
	defaultSpeed: z.number().min(0.1).max(3.0).default(1.0),
	defaultPitch: z.number().min(-20).max(20).default(0),
	defaultVolume: z.number().min(0).max(1).default(0.8),
	maxSpeechQueueSize: z.number().min(1).default(10),
	speechTimeoutMs: z.number().min(1000).default(30000),
	listeningTimeoutMs: z.number().min(1000).default(60000),
	silenceDetectionMs: z.number().min(100).default(2000),
	voiceActivityThreshold: z.number().min(0).max(1).default(0.01),
});

export type VoiceSystemConfig = z.infer<typeof VoiceSystemConfigSchema>;

// Voice profile configuration
interface VoiceProfile {
	voiceId: string;
	language: string;
	speed: number;
	pitch: number;
	volume: number;
}

// Speech queue item
interface SpeechQueueItem {
	id: string;
	text: string;
	priority: "low" | "medium" | "high" | "interrupt";
	status: "queued" | "speaking" | "completed" | "failed";
	timestamp: string;
	voiceProfile?: Partial<VoiceProfile>;
}

// Input/Output types for Voice System operations
export interface VoiceSystemInput {
	action:
		| "start_listening"
		| "stop_listening"
		| "speak"
		| "interrupt_speech"
		| "set_voice_profile"
		| "get_transcript"
		| "clear_queue"
		| "get_status";
	text?: string;
	priority?: "low" | "medium" | "high" | "interrupt";
	voiceProfile?: Partial<VoiceProfile>;
	language?: string;
}

export interface VoiceSystemResult {
	success: boolean;
	transcript?: string;
	isListening?: boolean;
	isSpeaking?: boolean;
	speechQueueSize?: number;
	voiceProfile?: VoiceProfile;
	status?: {
		isListening: boolean;
		isSpeaking: boolean;
		currentTranscript?: string;
		speechQueueSize: number;
		lastActivity?: string;
	};
	error?: string;
}

export class VoiceSystemAdapter extends BaseAdapter<
	VoiceSystemConfig,
	VoiceSystemResult
> {
	private isListening = false;
	private isSpeaking = false;
	private currentTranscript = "";
	private speechQueue: SpeechQueueItem[] = [];
	private voiceProfile: VoiceProfile;
	private currentUtterance: SpeechSynthesisUtterance | null = null;
	private recognition: SpeechRecognition | null = null;
	private listeningTimer?: NodeJS.Timeout;
	private readonly speechHandlers = new Set<
		(result: VoiceSystemResult) => void
	>();
	private readonly transcriptHandlers = new Set<(transcript: string) => void>();

	constructor() {
		super("voiceSystem", "1.0.0");

		// Initialize default voice profile
		this.voiceProfile = {
			voiceId: "alloy",
			language: "en-US",
			speed: 1.0,
			pitch: 0,
			volume: 0.8,
		};
	}

	protected async onInitialize(): Promise<void> {
		// Set voice profile from config
		this.voiceProfile = {
			voiceId: this.config.defaultVoiceId,
			language: this.config.defaultLanguage,
			speed: this.config.defaultSpeed,
			pitch: this.config.defaultPitch,
			volume: this.config.defaultVolume,
		};

		// Initialize speech recognition if available
		await this.initializeSpeechRecognition();

		// Check speech synthesis availability
		if (!this.isSpeechSynthesisAvailable()) {
			console.warn("Speech synthesis not available in this environment");
		}
	}

	protected async onHealthCheck(): Promise<boolean> {
		// Check if speech services are available
		const speechSynthesisOk = this.isSpeechSynthesisAvailable();
		const speechRecognitionOk = this.isSpeechRecognitionAvailable();

		// Consider healthy if at least one service is available
		return speechSynthesisOk || speechRecognitionOk;
	}

	protected async onExecute(input: unknown): Promise<VoiceSystemResult> {
		const voiceInput = input as VoiceSystemInput;

		switch (voiceInput.action) {
			case "start_listening":
				return this.handleStartListening(voiceInput.language);

			case "stop_listening":
				return this.handleStopListening();

			case "speak":
				if (!voiceInput.text) {
					throw new Error("Text required for speak action");
				}
				return this.handleSpeak(
					voiceInput.text,
					voiceInput.priority,
					voiceInput.voiceProfile,
				);

			case "interrupt_speech":
				return this.handleInterruptSpeech();

			case "set_voice_profile":
				if (!voiceInput.voiceProfile) {
					throw new Error(
						"Voice profile required for set_voice_profile action",
					);
				}
				return this.handleSetVoiceProfile(voiceInput.voiceProfile);

			case "get_transcript":
				return this.handleGetTranscript();

			case "clear_queue":
				return this.handleClearQueue();

			case "get_status":
				return this.handleGetStatus();

			default:
				throw new Error(`Unknown VoiceSystem action: ${voiceInput.action}`);
		}
	}

	protected async onShutdown(): Promise<void> {
		// Stop listening if active
		if (this.isListening) {
			this.handleStopListening();
		}

		// Stop speaking if active
		if (this.isSpeaking) {
			this.handleInterruptSpeech();
		}

		// Clear timers
		if (this.listeningTimer) {
			clearTimeout(this.listeningTimer);
			this.listeningTimer = undefined;
		}

		// Clear queues and handlers
		this.speechQueue = [];
		this.speechHandlers.clear();
		this.transcriptHandlers.clear();

		// Clean up recognition
		if (this.recognition) {
			this.recognition.abort();
			this.recognition = null;
		}
	}

	// Public methods for state integration
	public onSpeech(handler: (result: VoiceSystemResult) => void): void {
		this.speechHandlers.add(handler);
	}

	public offSpeech(handler: (result: VoiceSystemResult) => void): void {
		this.speechHandlers.delete(handler);
	}

	public onTranscript(handler: (transcript: string) => void): void {
		this.transcriptHandlers.add(handler);
	}

	public offTranscript(handler: (transcript: string) => void): void {
		this.transcriptHandlers.delete(handler);
	}

	public getVoiceState(): NonNullable<ToolIntegrationState["voiceSystem"]> {
		return {
			isListening: this.isListening,
			isSpeaking: this.isSpeaking,
			currentTranscript: this.currentTranscript,
			voiceProfile: { ...this.voiceProfile },
			speechQueue: this.speechQueue.map((item) => ({
				id: item.id,
				text: item.text,
				priority: item.priority,
				status: item.status,
				timestamp: item.timestamp,
			})),
			isEnabled: this.isEnabled,
			lastError: this.status.lastError,
		};
	}

	// Private implementation methods
	private async initializeSpeechRecognition(): Promise<void> {
		if (!this.isSpeechRecognitionAvailable()) {
			console.warn("Speech recognition not available in this environment");
			return;
		}

		try {
			const SpeechRecognition =
				window.SpeechRecognition || window.webkitSpeechRecognition;
			this.recognition = new SpeechRecognition();

			this.recognition.continuous = true;
			this.recognition.interimResults = true;
			this.recognition.lang = this.voiceProfile.language;

			this.recognition.onstart = () => {
				console.log("[VoiceSystem] Speech recognition started");
			};

			this.recognition.onresult = (event: SpeechRecognitionEvent) => {
				let transcript = "";

				for (let i = event.resultIndex; i < event.results.length; i++) {
					const result = event.results[i];
					if (result.isFinal) {
						transcript += result[0].transcript + " ";
					}
				}

				if (transcript.trim()) {
					this.currentTranscript = transcript.trim();
					this.notifyTranscriptHandlers(this.currentTranscript);
				}
			};

			this.recognition.onerror = (event) => {
				console.error("[VoiceSystem] Speech recognition error:", event.error);
				this.isListening = false;
			};

			this.recognition.onend = () => {
				console.log("[VoiceSystem] Speech recognition ended");
				this.isListening = false;
			};
		} catch (error) {
			console.error(
				"[VoiceSystem] Failed to initialize speech recognition:",
				error,
			);
		}
	}

	private async handleStartListening(
		language?: string,
	): Promise<VoiceSystemResult> {
		if (!this.isSpeechRecognitionAvailable() || !this.recognition) {
			return {
				success: false,
				error: "Speech recognition not available",
			};
		}

		if (this.isListening) {
			return {
				success: true,
				isListening: true,
			};
		}

		try {
			if (language && language !== this.recognition.lang) {
				this.recognition.lang = language;
			}

			this.recognition.start();
			this.isListening = true;
			this.currentTranscript = "";

			// Set listening timeout
			this.listeningTimer = setTimeout(() => {
				this.handleStopListening();
			}, this.config.listeningTimeoutMs);

			return {
				success: true,
				isListening: true,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private handleStopListening(): VoiceSystemResult {
		if (!this.isListening) {
			return {
				success: true,
				isListening: false,
			};
		}

		try {
			if (this.recognition) {
				this.recognition.stop();
			}

			this.isListening = false;

			if (this.listeningTimer) {
				clearTimeout(this.listeningTimer);
				this.listeningTimer = undefined;
			}

			return {
				success: true,
				isListening: false,
				transcript: this.currentTranscript,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async handleSpeak(
		text: string,
		priority: SpeechQueueItem["priority"] = "medium",
		voiceProfile?: Partial<VoiceProfile>,
	): Promise<VoiceSystemResult> {
		if (!this.isSpeechSynthesisAvailable()) {
			return {
				success: false,
				error: "Speech synthesis not available",
			};
		}

		// Check queue size limit
		if (this.speechQueue.length >= this.config.maxSpeechQueueSize) {
			return {
				success: false,
				error: "Speech queue is full",
			};
		}

		const speechItem: SpeechQueueItem = {
			id: this.generateSpeechId(),
			text,
			priority,
			status: "queued",
			timestamp: new Date().toISOString(),
			voiceProfile,
		};

		// Handle interrupt priority
		if (priority === "interrupt") {
			this.speechQueue.unshift(speechItem);

			// Stop current speech if any
			if (this.isSpeaking) {
				speechSynthesis.cancel();
				this.isSpeaking = false;
			}
		} else {
			// Insert based on priority
			this.insertSpeechByPriority(speechItem);
		}

		// Start processing queue if not already speaking
		if (!this.isSpeaking) {
			await this.processSpeechQueue();
		}

		return {
			success: true,
			speechQueueSize: this.speechQueue.length,
		};
	}

	private handleInterruptSpeech(): VoiceSystemResult {
		if (!this.isSpeaking) {
			return {
				success: true,
				isSpeaking: false,
			};
		}

		try {
			speechSynthesis.cancel();
			this.isSpeaking = false;
			this.currentUtterance = null;

			// Mark current item as failed
			const currentItem = this.speechQueue.find(
				(item) => item.status === "speaking",
			);
			if (currentItem) {
				currentItem.status = "failed";
			}

			return {
				success: true,
				isSpeaking: false,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private handleSetVoiceProfile(
		newProfile: Partial<VoiceProfile>,
	): VoiceSystemResult {
		this.voiceProfile = {
			...this.voiceProfile,
			...newProfile,
		};

		// Update speech recognition language if changed
		if (newProfile.language && this.recognition) {
			this.recognition.lang = newProfile.language;
		}

		return {
			success: true,
			voiceProfile: { ...this.voiceProfile },
		};
	}

	private handleGetTranscript(): VoiceSystemResult {
		return {
			success: true,
			transcript: this.currentTranscript,
		};
	}

	private handleClearQueue(): VoiceSystemResult {
		// Stop current speech
		if (this.isSpeaking) {
			speechSynthesis.cancel();
			this.isSpeaking = false;
		}

		this.speechQueue = [];
		this.currentUtterance = null;

		return {
			success: true,
			speechQueueSize: 0,
		};
	}

	private handleGetStatus(): VoiceSystemResult {
		return {
			success: true,
			status: {
				isListening: this.isListening,
				isSpeaking: this.isSpeaking,
				currentTranscript: this.currentTranscript,
				speechQueueSize: this.speechQueue.length,
				lastActivity:
					this.speechQueue[0]?.timestamp || new Date().toISOString(),
			},
		};
	}

	private async processSpeechQueue(): Promise<void> {
		while (this.speechQueue.length > 0) {
			const item = this.speechQueue.find((item) => item.status === "queued");
			if (!item) break;

			item.status = "speaking";
			this.isSpeaking = true;

			try {
				await this.speakText(item.text, item.voiceProfile);
				item.status = "completed";
			} catch (error) {
				item.status = "failed";
				console.error(`[VoiceSystem] Failed to speak: ${error}`);
			}

			// Remove completed/failed items
			this.speechQueue = this.speechQueue.filter(
				(queueItem) =>
					queueItem.status !== "completed" && queueItem.status !== "failed",
			);
		}

		this.isSpeaking = false;
	}

	private async speakText(
		text: string,
		voiceProfile?: Partial<VoiceProfile>,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const utterance = new SpeechSynthesisUtterance(text);
			const profile = { ...this.voiceProfile, ...voiceProfile };

			utterance.rate = profile.speed;
			utterance.pitch = profile.pitch;
			utterance.volume = profile.volume;
			utterance.lang = profile.language;

			// Try to find and set the voice
			const voices = speechSynthesis.getVoices();
			const voice = voices.find(
				(v) =>
					v.name.includes(profile.voiceId) ||
					v.voiceURI.includes(profile.voiceId),
			);
			if (voice) {
				utterance.voice = voice;
			}

			utterance.onend = () => {
				this.currentUtterance = null;
				resolve();
			};

			utterance.onerror = (error) => {
				this.currentUtterance = null;
				reject(error);
			};

			this.currentUtterance = utterance;
			speechSynthesis.speak(utterance);

			// Set timeout as fallback
			setTimeout(() => {
				if (this.currentUtterance === utterance) {
					speechSynthesis.cancel();
					reject(new Error("Speech timeout"));
				}
			}, this.config.speechTimeoutMs);
		});
	}

	private insertSpeechByPriority(item: SpeechQueueItem): void {
		const priorityOrder: Record<string, number> = {
			interrupt: 0,
			high: 1,
			medium: 2,
			low: 3,
		};

		const itemPriority = priorityOrder[item.priority];
		let insertIndex = this.speechQueue.length;

		for (let i = 0; i < this.speechQueue.length; i++) {
			const queuePriority = priorityOrder[this.speechQueue[i].priority];
			if (itemPriority < queuePriority) {
				insertIndex = i;
				break;
			}
		}

		this.speechQueue.splice(insertIndex, 0, item);
	}

	private notifyTranscriptHandlers(transcript: string): void {
		this.transcriptHandlers.forEach((handler) => {
			try {
				handler(transcript);
			} catch (error) {
				console.error("Error in voice transcript handler:", error);
			}
		});
	}

	private isSpeechRecognitionAvailable(): boolean {
		return (
			typeof window !== "undefined" &&
			(window.SpeechRecognition || window.webkitSpeechRecognition)
		);
	}

	private isSpeechSynthesisAvailable(): boolean {
		return typeof window !== "undefined" && window.speechSynthesis;
	}

	private generateSpeechId(): string {
		return `speech-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	}
}

// Type declarations for browser APIs
declare global {
	interface Window {
		SpeechRecognition: typeof SpeechRecognition;
		webkitSpeechRecognition: typeof SpeechRecognition;
	}
}

interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start(): void;
	stop(): void;
	abort(): void;
	onstart: ((event: Event) => void) | null;
	onend: ((event: Event) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
	results: SpeechRecognitionResultList;
	resultIndex: number;
}

interface SpeechRecognitionResultList {
	readonly length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
	readonly length: number;
	item(index: number): SpeechRecognitionAlternative;
	[index: number]: SpeechRecognitionAlternative;
	isFinal: boolean;
}

interface SpeechRecognitionAlternative {
	transcript: string;
	confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
	error: string;
	message: string;
}
