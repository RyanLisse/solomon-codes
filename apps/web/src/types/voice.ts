/**
 * Voice and AI integration types
 */

// Voice recognition and synthesis types
export interface VoiceRecognitionConfig {
	language: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	serviceType: "browser" | "cloud" | "hybrid";
}

export interface VoiceRecognitionResult {
	transcript: string;
	confidence: number;
	isFinal: boolean;
	alternatives?: Array<{
		transcript: string;
		confidence: number;
	}>;
	timestamp: string;
}

export interface VoiceSynthesisConfig {
	voice?: SpeechSynthesisVoice;
	rate: number;
	pitch: number;
	volume: number;
	language: string;
}

export interface VoiceSynthesisRequest {
	text: string;
	config?: Partial<VoiceSynthesisConfig>;
	priority?: "low" | "normal" | "high";
}

// Microphone and audio types
export interface MicrophoneState {
	isActive: boolean;
	isListening: boolean;
	isSupported: boolean;
	hasPermission: boolean;
	error?: string;
	volume?: number;
}

export interface AudioStreamConfig {
	sampleRate: number;
	channels: number;
	bitDepth: number;
	bufferSize: number;
	echoCancellation: boolean;
	noiseSuppression: boolean;
	autoGainControl: boolean;
}

export interface AudioAnalysis {
	volume: number;
	frequency: number[];
	isSpeaking: boolean;
	backgroundNoise: number;
	quality: "poor" | "fair" | "good" | "excellent";
}

// Conversation and dialogue types
export interface ConversationMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: string;
	metadata?: {
		confidence?: number;
		duration?: number;
		audioUrl?: string;
		isVoice?: boolean;
	};
}

export interface ConversationContext {
	sessionId: string;
	userId?: string;
	messages: ConversationMessage[];
	currentTopic?: string;
	intent?: string;
	entities?: Record<string, unknown>;
	lastActivity: string;
	state: "idle" | "listening" | "processing" | "speaking" | "error";
}

export interface VoiceCommand {
	phrase: string;
	intent: string;
	confidence: number;
	parameters?: Record<string, unknown>;
	action?: () => Promise<void> | void;
}

export interface VoiceCommandRegistry {
	commands: VoiceCommand[];
	aliases: Record<string, string>;
	contextualCommands?: Record<string, VoiceCommand[]>;
}

// AI and LLM integration types
export interface LLMRequest {
	messages: ConversationMessage[];
	model?: string;
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
	functions?: LLMFunction[];
	functionCall?: "auto" | "none" | { name: string };
}

export interface LLMResponse {
	id: string;
	choices: Array<{
		message: ConversationMessage;
		finishReason: "stop" | "length" | "function_call" | "content_filter";
		index: number;
	}>;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
	created: number;
}

export interface LLMFunction {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<
			string,
			{
				type: string;
				description: string;
				enum?: string[];
			}
		>;
		required?: string[];
	};
}

export interface LLMFunctionCall {
	name: string;
	arguments: string;
}

// Letta/MemGPT integration types
export interface LettaAgent {
	id: string;
	name: string;
	persona: string;
	human: string;
	model: string;
	memoryCapacity: number;
	created: string;
	lastActive: string;
	state: "active" | "paused" | "archived";
	tools: string[];
}

export interface LettaMessage {
	id: string;
	agentId: string;
	role: "user" | "assistant" | "system" | "function";
	content: string;
	timestamp: string;
	memoryPressure?: number;
	functionCalls?: LLMFunctionCall[];
}

export interface LettaMemory {
	core: string;
	human: string;
	persona: string;
	archival: Array<{
		id: string;
		content: string;
		timestamp: string;
		importance: number;
	}>;
	recall: Array<{
		id: string;
		content: string;
		timestamp: string;
		accessCount: number;
	}>;
}

// Speech processing types
export interface SpeechPattern {
	type: "wake_word" | "command" | "question" | "statement";
	pattern: string | RegExp;
	confidence: number;
	context?: string[];
}

export interface SpeechIntent {
	name: string;
	confidence: number;
	parameters: Record<string, unknown>;
	slots?: Record<
		string,
		{
			value: string;
			resolved?: string;
			confidence: number;
		}
	>;
}

export interface SpeechProcessingResult {
	transcript: string;
	intent?: SpeechIntent;
	sentiment?: {
		polarity: number; // -1 to 1
		magnitude: number; // 0 to 1
		label: "positive" | "negative" | "neutral";
	};
	entities?: Array<{
		type: string;
		value: string;
		confidence: number;
		startIndex: number;
		endIndex: number;
	}>;
	language: string;
	processingTime: number;
}

// Voice UI state types
export interface VoiceUIState {
	isListening: boolean;
	isSpeaking: boolean;
	isProcessing: boolean;
	currentTranscript: string;
	recentCommands: VoiceCommand[];
	visualFeedback: {
		waveform?: number[];
		volume: number;
		status: "idle" | "listening" | "processing" | "speaking" | "error";
	};
	error?: {
		code: string;
		message: string;
		recoverable: boolean;
	};
}

export interface VoiceSettings {
	enabled: boolean;
	wakeWordEnabled: boolean;
	wakeWord: string;
	language: string;
	voice: {
		name: string;
		rate: number;
		pitch: number;
		volume: number;
	};
	recognition: {
		continuous: boolean;
		interimResults: boolean;
		sensitivity: number;
	};
	privacy: {
		storeTranscripts: boolean;
		shareWithProviders: boolean;
		localProcessingOnly: boolean;
	};
}

// Error types specific to voice functionality
export interface VoiceError extends Error {
	code:
		| "PERMISSION_DENIED"
		| "NOT_SUPPORTED"
		| "NETWORK_ERROR"
		| "ABORTED"
		| "AUDIO_CAPTURE"
		| "SERVICE_NOT_ALLOWED"
		| "BAD_GRAMMAR"
		| "LANGUAGE_NOT_SUPPORTED";
	details?: Record<string, unknown>;
	recoverable: boolean;
}

// Voice analytics types
export interface VoiceAnalytics {
	sessionId: string;
	totalDuration: number;
	speechDuration: number;
	silenceDuration: number;
	commandsRecognized: number;
	recognitionAccuracy: number;
	responseTime: number;
	userSatisfaction?: number;
	errors: Array<{
		code: string;
		count: number;
		lastOccurrence: string;
	}>;
}

// Integration hooks and callbacks
export interface VoiceEventHandlers {
	onStart?: () => void;
	onEnd?: () => void;
	onResult?: (result: VoiceRecognitionResult) => void;
	onError?: (error: VoiceError) => void;
	onSpeechStart?: () => void;
	onSpeechEnd?: () => void;
	onAudioStart?: () => void;
	onAudioEnd?: () => void;
	onVolumeChange?: (volume: number) => void;
}
