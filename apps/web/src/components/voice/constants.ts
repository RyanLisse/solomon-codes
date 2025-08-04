/**
 * Voice Processing Constants
 * Centralized constants for audio processing and voice conversation components
 */

// Audio Configuration
export const AUDIO_CONFIG = {
	SAMPLE_RATE: 24000,
	BUFFER_SIZE: 4096,
	CHANNELS: 1,
	BIT_DEPTH: 16,
	MAX_SAMPLE_VALUE: 32767,
	MIN_SAMPLE_VALUE: -32768,
} as const;

// Audio Processing
export const AUDIO_PROCESSING = {
	RMS_MULTIPLIER: 100,
	LEVEL_VISUALIZATION_SCALE: 100,
	AUDIO_LEVEL_THRESHOLD: 0,
} as const;

// WebSocket Configuration
export const WEBSOCKET_CONFIG = {
	REALTIME_API_URL:
		"wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
	PROTOCOLS: ["realtime"],
	RECONNECT_DELAY: 1000,
	MAX_RECONNECT_ATTEMPTS: 3,
} as const;

// Component Sizes
export const COMPONENT_SIZES = {
	sm: "h-8 w-8",
	md: "h-10 w-10",
	lg: "h-12 w-12",
} as const;

// Animation Durations
export const ANIMATION = {
	TRANSITION_DURATION: 200,
	PULSE_ANIMATION: "animate-pulse",
	PING_ANIMATION: "animate-ping",
	SPIN_ANIMATION: "animate-spin",
} as const;

// Audio Constraints
export const MEDIA_CONSTRAINTS = {
	audio: {
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true,
		sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
	},
} as const;

// Session Configuration
export const SESSION_CONFIG = {
	modalities: ["text", "audio"] as const,
	voice: "alloy" as const,
	input_audio_format: "pcm16" as const,
	output_audio_format: "pcm16" as const,
	input_audio_transcription: {
		model: "whisper-1",
	},
} as const;

// CSS Classes
export const CSS_CLASSES = {
	BASE_BUTTON:
		"relative rounded-full transition-all duration-200 flex items-center justify-center border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
	DISABLED: "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400",
	ERROR: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
	CONNECTING: "border-blue-200 bg-blue-50 text-blue-600",
	SPEAKING: "animate-pulse border-green-200 bg-green-50 text-green-600",
	ACTIVE: "border-blue-200 bg-blue-50 text-blue-600",
	IDLE: "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
} as const;
