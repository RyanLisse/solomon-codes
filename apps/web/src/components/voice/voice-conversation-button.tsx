/**
 * VoiceConversationButton Component
 * ChatGPT-style voice button for real-time voice conversations using OpenAI Realtime API
 */

import { AudioLines, Loader2, Volume2, VolumeX } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
	type LettaVoiceAgentConfig,
	type VoiceError,
	VoiceErrorCode,
	VoiceState,
} from "./types";

export interface VoiceConversationProps {
	onConversationStart: () => void;
	onConversationEnd: () => void;
	onVoiceMessage?: (audioData: ArrayBuffer) => void;
	onError?: (error: VoiceError) => void;
	isInConversation?: boolean;
	lettaAgent?: LettaVoiceAgentConfig;
	disabled?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
}

export interface VoiceConversationState {
	isActive: boolean;
	isConnected: boolean;
	audioLevel: number;
	lastActivity: Date;
	conversationId: string;
}

export const VoiceConversationButton: React.FC<VoiceConversationProps> = ({
	onConversationStart,
	onConversationEnd,
	onVoiceMessage,
	onError,
	isInConversation: externalIsInConversation,
	lettaAgent,
	disabled = false,
	size = "md",
	className,
}) => {
	const [internalIsInConversation, setInternalIsInConversation] =
		useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [voiceState, setVoiceState] = useState<VoiceState>(VoiceState.IDLE);
	const [audioLevel, setAudioLevel] = useState(0);
	const [conversationState, setConversationState] =
		useState<VoiceConversationState>({
			isActive: false,
			isConnected: false,
			audioLevel: 0,
			lastActivity: new Date(),
			conversationId: "",
		});

	const websocketRef = useRef<WebSocket | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const processorRef = useRef<ScriptProcessorNode | null>(null);

	const isInConversation = externalIsInConversation ?? internalIsInConversation;

	// Initialize audio context and WebSocket connection
	const initializeAudioContext = useCallback(async () => {
		try {
			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					sampleRate: 24000,
				},
			});

			mediaStreamRef.current = stream;

			// Create audio context
			const audioContext = new (
				window.AudioContext || window.webkitAudioContext
			)({
				sampleRate: 24000,
			});
			audioContextRef.current = audioContext;

			// Create audio source and processor
			const source = audioContext.createMediaStreamSource(stream);
			const processor = audioContext.createScriptProcessor(4096, 1, 1);

			processor.onaudioprocess = (event) => {
				const inputBuffer = event.inputBuffer;
				const inputData = inputBuffer.getChannelData(0);

				// Calculate audio level for visualization
				let sum = 0;
				for (let i = 0; i < inputData.length; i++) {
					sum += inputData[i] * inputData[i];
				}
				const rms = Math.sqrt(sum / inputData.length);
				setAudioLevel(rms * 100);

				// Convert to ArrayBuffer and send via WebSocket
				if (websocketRef.current?.readyState === WebSocket.OPEN) {
					const audioData = new ArrayBuffer(inputData.length * 2);
					const view = new Int16Array(audioData);

					for (let i = 0; i < inputData.length; i++) {
						view[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
					}

					onVoiceMessage?.(audioData);

					// Send to WebSocket (OpenAI Realtime API format)
					websocketRef.current.send(
						JSON.stringify({
							type: "input_audio_buffer.append",
							audio: Array.from(new Uint8Array(audioData)),
						}),
					);
				}
			};

			source.connect(processor);
			processor.connect(audioContext.destination);
			processorRef.current = processor;

			return true;
		} catch (error) {
			const voiceError: VoiceError = {
				code: VoiceErrorCode.MICROPHONE_ACCESS_DENIED,
				message: "Failed to initialize audio context",
				recoverable: true,
				details: { error },
			};
			onError?.(voiceError);
			return false;
		}
	}, [onVoiceMessage, onError]);

	// Play audio response
	const playAudioResponse = useCallback(async (audioData: ArrayBuffer) => {
		if (!audioContextRef.current) return;

		try {
			setVoiceState(VoiceState.SPEAKING);

			const audioBuffer =
				await audioContextRef.current.decodeAudioData(audioData);
			const source = audioContextRef.current.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(audioContextRef.current.destination);

			source.onended = () => {
				setVoiceState(VoiceState.RECORDING);
			};

			source.start();
		} catch (error) {
			console.error("Error playing audio response:", error);
			setVoiceState(VoiceState.RECORDING);
		}
	}, []);

	// Connect to OpenAI Realtime API
	const connectToRealtimeAPI = useCallback(async () => {
		try {
			const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
			if (!apiKey) {
				throw new Error("OpenAI API key not configured");
			}

			const websocket = new WebSocket(
				"wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
				["realtime", `Bearer.${apiKey}`],
			);

			websocket.onopen = () => {
				console.log("Connected to OpenAI Realtime API");
				setConversationState((prev) => ({
					...prev,
					isConnected: true,
					conversationId: `conv-${Date.now()}`,
				}));
				setVoiceState(VoiceState.RECORDING);
				setIsConnecting(false);

				// Configure session
				websocket.send(
					JSON.stringify({
						type: "session.update",
						session: {
							modalities: ["text", "audio"],
							instructions: lettaAgent?.agentId
								? `You are integrated with Letta agent ${lettaAgent.agentId}. Maintain conversation context and memory.`
								: "You are a helpful voice assistant. Respond naturally and conversationally.",
							voice: "alloy",
							input_audio_format: "pcm16",
							output_audio_format: "pcm16",
							input_audio_transcription: {
								model: "whisper-1",
							},
						},
					}),
				);
			};

			websocket.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);

					switch (message.type) {
						case "response.audio.delta":
							// Handle audio response from OpenAI
							if (message.delta) {
								const audioData = new Uint8Array(message.delta).buffer;
								playAudioResponse(audioData);
							}
							break;

						case "conversation.item.input_audio_transcription.completed":
							console.log("User said:", message.transcript);
							break;

						case "response.done":
							setVoiceState(VoiceState.RECORDING);
							break;

						case "error": {
							console.error("Realtime API error:", message.error);
							const error: VoiceError = {
								code: VoiceErrorCode.NETWORK_ERROR,
								message: message.error.message || "Realtime API error",
								recoverable: true,
								details: message.error,
							};
							onError?.(error);
							break;
						}
					}

					setConversationState((prev) => ({
						...prev,
						lastActivity: new Date(),
					}));
				} catch (error) {
					console.error("Error parsing WebSocket message:", error);
				}
			};

			websocket.onerror = (error) => {
				console.error("WebSocket error:", error);
				const voiceError: VoiceError = {
					code: VoiceErrorCode.NETWORK_ERROR,
					message: "Failed to connect to voice service",
					recoverable: true,
					details: { error },
				};
				onError?.(voiceError);
				setIsConnecting(false);
				setVoiceState(VoiceState.ERROR);
			};

			websocket.onclose = () => {
				console.log("Disconnected from OpenAI Realtime API");
				setConversationState((prev) => ({
					...prev,
					isConnected: false,
					isActive: false,
				}));
				setVoiceState(VoiceState.IDLE);
				setInternalIsInConversation(false);
			};

			websocketRef.current = websocket;
			return true;
		} catch (error) {
			const voiceError: VoiceError = {
				code: VoiceErrorCode.NETWORK_ERROR,
				message: "Failed to connect to realtime API",
				recoverable: true,
				details: { error },
			};
			onError?.(voiceError);
			setIsConnecting(false);
			setVoiceState(VoiceState.ERROR);
			return false;
		}
	}, [lettaAgent, onError, playAudioResponse]);

	// Start voice conversation
	const startVoiceConversation = useCallback(async () => {
		if (disabled || isConnecting) return;

		setIsConnecting(true);
		setVoiceState(VoiceState.PROCESSING);

		const audioInitialized = await initializeAudioContext();
		if (!audioInitialized) {
			setIsConnecting(false);
			return;
		}

		const connected = await connectToRealtimeAPI();
		if (connected) {
			setInternalIsInConversation(true);
			setConversationState((prev) => ({
				...prev,
				isActive: true,
			}));
			onConversationStart();
		}
	}, [
		disabled,
		isConnecting,
		initializeAudioContext,
		connectToRealtimeAPI,
		onConversationStart,
	]);

	// End voice conversation
	const endVoiceConversation = useCallback(() => {
		// Close WebSocket connection
		if (websocketRef.current) {
			websocketRef.current.close();
			websocketRef.current = null;
		}

		// Stop audio processing
		if (processorRef.current) {
			processorRef.current.disconnect();
			processorRef.current = null;
		}

		// Close audio context
		if (audioContextRef.current) {
			audioContextRef.current.close();
			audioContextRef.current = null;
		}

		// Stop media stream
		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((track) => track.stop());
			mediaStreamRef.current = null;
		}

		setInternalIsInConversation(false);
		setIsConnecting(false);
		setVoiceState(VoiceState.IDLE);
		setAudioLevel(0);
		setConversationState({
			isActive: false,
			isConnected: false,
			audioLevel: 0,
			lastActivity: new Date(),
			conversationId: "",
		});

		onConversationEnd();
	}, [onConversationEnd]);

	// Handle button click
	const handleClick = useCallback(() => {
		if (disabled) return;

		if (isInConversation) {
			endVoiceConversation();
		} else {
			startVoiceConversation();
		}
	}, [
		disabled,
		isInConversation,
		endVoiceConversation,
		startVoiceConversation,
	]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				handleClick();
			}
		},
		[handleClick],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			endVoiceConversation();
		};
	}, [endVoiceConversation]);

	const getAriaLabel = useCallback(() => {
		if (voiceState === VoiceState.ERROR) return "Voice conversation error";
		if (isConnecting) return "Connecting to voice service...";
		if (voiceState === VoiceState.SPEAKING) return "AI is speaking";
		if (isInConversation) return "End voice conversation";
		return "Start voice conversation";
	}, [voiceState, isConnecting, isInConversation]);

	const getSizeClasses = useCallback(() => {
		switch (size) {
			case "sm":
				return "h-8 w-8";
			case "lg":
				return "h-12 w-12";
			default:
				return "h-10 w-10";
		}
	}, [size]);

	const getStateClasses = useCallback(() => {
		const baseClasses =
			"relative rounded-full transition-all duration-200 flex items-center justify-center border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";

		if (disabled) {
			return cn(
				baseClasses,
				"cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400",
			);
		}

		if (voiceState === VoiceState.ERROR) {
			return cn(
				baseClasses,
				"border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
			);
		}

		if (isConnecting) {
			return cn(baseClasses, "border-blue-200 bg-blue-50 text-blue-600");
		}

		if (voiceState === VoiceState.SPEAKING) {
			return cn(
				baseClasses,
				"animate-pulse border-green-200 bg-green-50 text-green-600",
			);
		}

		if (isInConversation) {
			return cn(baseClasses, "border-blue-200 bg-blue-50 text-blue-600");
		}

		return cn(
			baseClasses,
			"border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
		);
	}, [voiceState, isConnecting, isInConversation, disabled]);

	const renderIcon = () => {
		if (isConnecting) {
			return <Loader2 className="h-5 w-5 animate-spin" />;
		}

		if (voiceState === VoiceState.SPEAKING) {
			return <Volume2 className="h-5 w-5" />;
		}

		if (isInConversation) {
			return <VolumeX className="h-5 w-5" />;
		}

		return <AudioLines className="h-5 w-5" />;
	};

	return (
		<div className="relative">
			<button
				type="button"
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				aria-label={getAriaLabel()}
				className={cn(getSizeClasses(), getStateClasses(), className)}
				data-testid="voice-conversation-button"
			>
				{renderIcon()}

				{/* Audio level visualization */}
				{isInConversation && audioLevel > 0 && (
					<div
						className="absolute inset-0 rounded-full border-2 border-blue-300"
						style={{
							transform: `scale(${1 + audioLevel / 100})`,
							opacity: audioLevel / 100,
						}}
						data-testid="audio-level-indicator"
					/>
				)}

				{/* Speaking pulse animation */}
				{voiceState === VoiceState.SPEAKING && (
					<div
						data-testid="speaking-pulse"
						className="absolute inset-0 animate-ping rounded-full border-2 border-green-200 bg-green-500/20"
					/>
				)}
			</button>

			{/* Conversation status indicator */}
			{isInConversation && (
				<div
					className="-translate-x-1/2 absolute top-full left-1/2 z-50 mt-2 min-w-48 transform rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
					data-testid="conversation-status"
				>
					<div className="flex items-center space-x-2">
						<div
							className={cn(
								"h-2 w-2 rounded-full",
								conversationState.isConnected ? "bg-green-500" : "bg-red-500",
							)}
						/>
						<div className="text-gray-600 text-xs">
							{voiceState === VoiceState.SPEAKING
								? "AI is speaking..."
								: voiceState === VoiceState.RECORDING
									? "Listening..."
									: "Connected"}
						</div>
					</div>

					{lettaAgent && (
						<div className="mt-1 text-gray-500 text-xs">
							Agent: {lettaAgent.agentId}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

// Hook for using voice conversation
export const useVoiceConversation = () => {
	const [isInConversation, setIsInConversation] = useState(false);
	const [conversationState, setConversationState] =
		useState<VoiceConversationState>({
			isActive: false,
			isConnected: false,
			audioLevel: 0,
			lastActivity: new Date(),
			conversationId: "",
		});
	const [error, setError] = useState<VoiceError | null>(null);

	const handleConversationStart = useCallback(() => {
		setIsInConversation(true);
		setError(null);
		setConversationState((prev) => ({
			...prev,
			isActive: true,
			lastActivity: new Date(),
		}));
	}, []);

	const handleConversationEnd = useCallback(() => {
		setIsInConversation(false);
		setConversationState({
			isActive: false,
			isConnected: false,
			audioLevel: 0,
			lastActivity: new Date(),
			conversationId: "",
		});
	}, []);

	const handleError = useCallback((voiceError: VoiceError) => {
		setError(voiceError);
		setIsInConversation(false);
	}, []);

	const handleVoiceMessage = useCallback((_audioData: ArrayBuffer) => {
		setConversationState((prev) => ({
			...prev,
			lastActivity: new Date(),
		}));
	}, []);

	return {
		isInConversation,
		conversationState,
		error,
		handleConversationStart,
		handleConversationEnd,
		handleError,
		handleVoiceMessage,
	};
};

// Add global type declarations for Web Audio API
declare global {
	interface Window {
		AudioContext: typeof AudioContext;
		webkitAudioContext: typeof AudioContext;
	}
}
