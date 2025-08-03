/**
 * Voice Interface Types
 * Defines types for voice processing and interaction components
 */

export enum VoiceState {
	IDLE = "idle",
	RECORDING = "recording",
	PROCESSING = "processing",
	SPEAKING = "speaking",
	ERROR = "error",
}

export interface VoiceError {
	code: VoiceErrorCode;
	message: string;
	recoverable: boolean;
	details?: Record<string, unknown>;
}

export enum VoiceErrorCode {
	MICROPHONE_ACCESS_DENIED = "MICROPHONE_ACCESS_DENIED",
	SPEECH_RECOGNITION_FAILED = "SPEECH_RECOGNITION_FAILED",
	TEXT_TO_SPEECH_FAILED = "TEXT_TO_SPEECH_FAILED",
	AUDIO_PROCESSING_ERROR = "AUDIO_PROCESSING_ERROR",
	NETWORK_ERROR = "NETWORK_ERROR",
	BROWSER_NOT_SUPPORTED = "BROWSER_NOT_SUPPORTED",
}

export interface MicrophoneButtonProps {
	onStartRecording: () => void;
	onStopRecording: () => void;
	onTranscription?: (text: string, isInterim: boolean) => void;
	onError: (error: VoiceError) => void;
	isRecording: boolean;
	isProcessing: boolean;
	isDisabled: boolean;
	voiceState?: VoiceState;
	size?: "sm" | "md" | "lg";
	variant?: "default" | "outline" | "ghost";
	className?: string;
}

export interface VoiceVisualizationProps {
	isRecording: boolean;
	audioLevel: number;
	transcription: string;
	isInterim: boolean;
	error?: VoiceError;
}

export interface VoiceSettings {
	language: string;
	voice: string;
	rate: number;
	pitch: number;
	volume: number;
	transcriptionEnabled: boolean;
}

export interface VoiceControlsProps {
	onVolumeChange: (volume: number) => void;
	onRateChange: (rate: number) => void;
	onVoiceChange: (voiceId: string) => void;
	onLanguageChange: (language: string) => void;
	currentSettings: VoiceSettings;
	availableVoices: SpeechSynthesisVoice[];
}

export interface SpeechRecognitionResult {
	transcript: string;
	confidence: number;
	isInterim: boolean;
	timestamp: Date;
}

export interface TextToSpeechOptions {
	rate?: number;
	pitch?: number;
	volume?: number;
	voice?: string;
	language?: string;
}

export interface VoiceProcessingConfig {
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	language: string;
	noiseReduction: boolean;
	echoCancellation: boolean;
}

// Letta Voice Agent Integration Types
export interface LettaVoiceAgentConfig {
	agentId: string;
	memoryBlocks: LettaMemoryBlock[];
	tools: string[];
	model: string;
	embedding: string;
	voicePreferences: VoiceSettings;
}

export interface LettaMemoryBlock {
	label: string;
	value: string;
	description?: string;
}

export interface VoiceAgentResponse {
	messageId: string;
	agentId: string;
	content: string;
	audioData?: ArrayBuffer;
	memoryUpdates?: LettaMemoryBlock[];
	toolCalls?: ToolCall[];
	metadata: {
		processingTime: number;
		confidence: number;
		voiceGenerated: boolean;
	};
}

export interface ToolCall {
	name: string;
	arguments: Record<string, unknown>;
	result?: unknown;
	timestamp: Date;
}

// Voice Conversation Types (for OpenAI Realtime API integration)
export interface VoiceConversationProps {
	onConversationStart: () => void;
	onConversationEnd: () => void;
	onVoiceMessage: (audioData: ArrayBuffer) => void;
	isInConversation: boolean;
	lettaAgent?: LettaVoiceAgentConfig;
}

export interface RealtimeAudioConfig {
	sampleRate: number;
	channels: number;
	bitDepth: number;
	format: "pcm16" | "g711_ulaw" | "g711_alaw";
}

export interface VoiceConversationState {
	isActive: boolean;
	isConnected: boolean;
	audioLevel: number;
	lastActivity: Date;
	conversationId: string;
}
