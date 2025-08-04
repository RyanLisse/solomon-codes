/**
 * Enhanced Voice Conversation Button Component
 * Advanced voice button with OpenAI Realtime API and Letta agent integration
 */

import { Loader2, Phone, PhoneOff, Volume2, Zap } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { OpenAIRealtimeService } from "@/lib/voice/openai-realtime";
import { type VoiceError, VoiceErrorCode, VoiceState } from "./types";

export interface EnhancedVoiceConversationProps {
	onConversationStart?: () => void;
	onConversationEnd?: () => void;
	onMessage?: (message: string, isUser: boolean) => void;
	onTranscript?: (transcript: string, isUser: boolean) => void;
	onError?: (error: VoiceError) => void;
	isActive?: boolean;
	disabled?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
	sessionId?: string;
	userId?: string;
	enableLettaIntegration?: boolean;
	voice?: string;
	model?: string;
}

export const EnhancedVoiceConversationButton: React.FC<
	EnhancedVoiceConversationProps
> = ({
	onConversationStart,
	onConversationEnd,
	onMessage: _onMessage,
	onTranscript,
	onError,
	isActive: externalIsActive,
	disabled = false,
	size = "md",
	className,
	sessionId = `session-${Date.now()}`,
	userId: _userId = "default-user",
	enableLettaIntegration = true,
	voice = "coral",
	model = "gpt-4o-realtime-preview-2024-12-17",
}) => {
	const [internalIsActive, setInternalIsActive] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [voiceState, setVoiceState] = useState<VoiceState>(VoiceState.IDLE);
	const [currentAgent, _setCurrentAgent] = useState<string>("voice");
	const [audioLevel, setAudioLevel] = useState(0);
	const [connectionStatus, setConnectionStatus] =
		useState<string>("disconnected");

	const realtimeServiceRef = useRef<OpenAIRealtimeService | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | undefined>(undefined);
	const streamRef = useRef<MediaStream | null>(null);

	const isActive = externalIsActive ?? internalIsActive;

	// Initialize audio level monitoring
	const initializeAudioMonitoring = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					sampleRate: 24000,
				},
			});

			streamRef.current = stream;
			audioContextRef.current = new AudioContext({ sampleRate: 24000 });
			analyserRef.current = audioContextRef.current.createAnalyser();

			const source = audioContextRef.current.createMediaStreamSource(stream);
			source.connect(analyserRef.current);

			analyserRef.current.fftSize = 256;
			const bufferLength = analyserRef.current.frequencyBinCount;
			const dataArray = new Uint8Array(bufferLength);

			const updateAudioLevel = () => {
				if (analyserRef.current && isActive) {
					analyserRef.current.getByteFrequencyData(dataArray);
					const average = dataArray.reduce((a, b) => a + b) / bufferLength;
					setAudioLevel(average / 255);
					animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
				}
			};

			updateAudioLevel();
			return stream;
		} catch (error) {
			console.warn("Audio monitoring initialization failed:", error);
			// Convert getUserMedia errors to proper VoiceError format
			if (
				error instanceof Error &&
				error.message.includes("Permission denied")
			) {
				const voiceError: VoiceError = {
					code: VoiceErrorCode.MICROPHONE_ACCESS_DENIED,
					message: "Failed to access microphone access - permission denied",
					recoverable: true,
					details: { originalError: error },
				};
				throw voiceError;
			}
			throw error;
		}
	}, [isActive]);

	// Cleanup audio monitoring
	const cleanupAudioMonitoring = useCallback(() => {
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
		}
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}
		if (audioContextRef.current) {
			audioContextRef.current.close();
			audioContextRef.current = null;
		}
		setAudioLevel(0);
	}, []);

	// Initialize Realtime service
	const initializeRealtimeService = useCallback(() => {
		const config = {
			model,
			voice,
			temperature: 0.7,
			maxTokens: 1000,
			instructions: enableLettaIntegration
				? "You are integrated with Letta agents. Route complex requests to appropriate specialized agents while maintaining natural conversation flow. Use function calling to interact with agents when needed."
				: "You are a helpful voice assistant. Respond naturally and conversationally.",
		};

		realtimeServiceRef.current = new OpenAIRealtimeService(config);

		// Set up event listeners
		realtimeServiceRef.current.on("connected", () => {
			console.log("Connected to OpenAI Realtime API");
			setConnectionStatus("connected");
			setIsConnecting(false);
			setVoiceState(VoiceState.RECORDING);
		});

		realtimeServiceRef.current.on("disconnected", () => {
			console.log("Disconnected from OpenAI Realtime API");
			setConnectionStatus("disconnected");
			setInternalIsActive(false);
			setVoiceState(VoiceState.IDLE);
		});

		realtimeServiceRef.current.on("session.created", (event) => {
			console.log("Realtime session created:", event);
			setConnectionStatus("session_ready");
		});

		realtimeServiceRef.current.on("audio.received", (_event) => {
			console.log("Received audio from API");
			// Audio playback is handled automatically by the browser
		});

		realtimeServiceRef.current.on("transcript.received", (event) => {
			console.log("User transcript:", event);
			const transcript = (event as { transcript?: string }).transcript;
			if (transcript) {
				onTranscript?.(transcript, true);
			}
		});

		realtimeServiceRef.current.on("response.done", (event) => {
			console.log("Response completed:", event);
			// Handle completed response - could extract text content if available
		});

		realtimeServiceRef.current.on("error", (event) => {
			console.error("Realtime API error:", event);
			const errorData = event as {
				code?: string;
				message?: string;
				recoverable?: boolean;
				details?: unknown;
			};
			const voiceError: VoiceError = {
				code:
					(errorData.code as VoiceErrorCode) || VoiceErrorCode.NETWORK_ERROR,
				message: errorData.message || "Realtime API error",
				recoverable: errorData.recoverable ?? true,
				details: errorData.details as Record<string, unknown>,
			};
			onError?.(voiceError);
			setVoiceState(VoiceState.ERROR);
			setConnectionStatus("error");
		});
	}, [enableLettaIntegration, model, voice, onTranscript, onError]);

	// Start voice conversation
	const startConversation = useCallback(async () => {
		try {
			setIsConnecting(true);
			setVoiceState(VoiceState.PROCESSING);
			setConnectionStatus("connecting");

			// Initialize audio monitoring first
			await initializeAudioMonitoring();

			// Initialize Realtime service if not already done
			if (!realtimeServiceRef.current) {
				initializeRealtimeService();
			}

			// Connect to OpenAI Realtime API
			await realtimeServiceRef.current?.connect();

			// Integrate with Letta if enabled
			if (enableLettaIntegration) {
				console.log("Letta integration enabled for session:", sessionId);
				// This would integrate with the agent orchestration service
				// For now, we'll just log it
			}

			setInternalIsActive(true);
			onConversationStart?.();
		} catch (error) {
			console.error("Failed to start conversation:", error);

			// If error is already a VoiceError, pass it through
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				"message" in error
			) {
				onError?.(error as VoiceError);
			} else {
				// Otherwise, wrap in a generic VoiceError
				const voiceError: VoiceError = {
					code: VoiceErrorCode.NETWORK_ERROR,
					message: "Failed to start voice conversation",
					recoverable: true,
					details: { error },
				};
				onError?.(voiceError);
			}

			setVoiceState(VoiceState.ERROR);
			setConnectionStatus("error");
			setIsConnecting(false);
			cleanupAudioMonitoring();
		}
	}, [
		initializeAudioMonitoring,
		initializeRealtimeService,
		enableLettaIntegration,
		sessionId,
		onConversationStart,
		onError,
		cleanupAudioMonitoring,
	]);

	// End voice conversation
	const endConversation = useCallback(async () => {
		try {
			if (realtimeServiceRef.current) {
				// Check if disconnect method exists and is a function
				if (typeof realtimeServiceRef.current.disconnect === "function") {
					await realtimeServiceRef.current.disconnect();
				} else {
					console.warn("disconnect method not available on realtime service");
				}
			}

			cleanupAudioMonitoring();
			setInternalIsActive(false);
			setVoiceState(VoiceState.IDLE);
			setConnectionStatus("disconnected");
			onConversationEnd?.();
		} catch (error) {
			console.error("Error ending conversation:", error);
			// Still end the conversation even if cleanup fails
			cleanupAudioMonitoring();
			setInternalIsActive(false);
			setVoiceState(VoiceState.IDLE);
			setConnectionStatus("disconnected");
			onConversationEnd?.();
		}
	}, [cleanupAudioMonitoring, onConversationEnd]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (realtimeServiceRef.current) {
				// Check if disconnect method exists and is a function
				if (typeof realtimeServiceRef.current.disconnect === "function") {
					realtimeServiceRef.current.disconnect();
				}
			}
			cleanupAudioMonitoring();
		};
	}, [cleanupAudioMonitoring]);

	// Handle button click
	const handleClick = useCallback(() => {
		if (disabled || isConnecting) return;

		if (isActive) {
			endConversation();
		} else {
			startConversation();
		}
	}, [disabled, isConnecting, isActive, startConversation, endConversation]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				handleClick();
			}
		},
		[handleClick],
	);

	const getAriaLabel = useCallback(() => {
		if (voiceState === VoiceState.ERROR) return "Voice conversation error";
		if (isConnecting) return "Connecting to voice conversation...";
		if (isActive) return "End voice conversation";
		return "Start voice conversation";
	}, [voiceState, isConnecting, isActive]);

	const getSizeClasses = useCallback(() => {
		switch (size) {
			case "sm":
				return "h-8 w-8";
			case "lg":
				return "h-14 w-14";
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

		if (isActive) {
			return cn(
				baseClasses,
				"border-green-200 bg-green-50 text-green-600",
				audioLevel > 0.1 ? "animate-pulse" : "",
			);
		}

		return cn(
			baseClasses,
			"border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
		);
	}, [voiceState, isConnecting, isActive, disabled, audioLevel]);

	const renderIcon = () => {
		if (isConnecting) {
			return (
				<Loader2 className="h-5 w-5 animate-spin" data-testid="loader-icon" />
			);
		}

		if (isActive) {
			return <PhoneOff className="h-5 w-5" data-testid="phone-off-icon" />;
		}

		return <Phone className="h-5 w-5" data-testid="phone-icon" />;
	};

	const getConnectionStatusText = () => {
		switch (connectionStatus) {
			case "connecting":
				return "Connecting to OpenAI Realtime...";
			case "connected":
				return "Connected to OpenAI Realtime";
			case "session_ready":
				return "Voice conversation ready";
			case "error":
				return "Connection error";
			default:
				return "Voice conversation active";
		}
	};

	return (
		<div className="relative">
			<button
				type="button"
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				aria-label={getAriaLabel()}
				aria-pressed={isActive}
				className={cn(getSizeClasses(), getStateClasses(), className)}
				data-testid="enhanced-voice-conversation-button"
			>
				{renderIcon()}

				{/* Active conversation pulse animation */}
				{isActive && (
					<div
						data-testid="conversation-pulse"
						className="absolute inset-0 animate-ping rounded-full border-2 border-green-200 bg-green-500/20"
						style={{
							opacity: 0.3 + audioLevel * 0.7,
						}}
					/>
				)}

				{/* Letta integration indicator */}
				{enableLettaIntegration && isActive && (
					<div className="-top-1 -right-1 absolute flex h-3 w-3 items-center justify-center rounded-full border border-white bg-purple-500">
						<Zap className="h-2 w-2 text-white" />
					</div>
				)}

				{/* Audio level indicator */}
				{isActive && audioLevel > 0.05 && (
					<div className="-bottom-1 -right-1 absolute flex h-3 w-3 items-center justify-center rounded-full border border-white bg-blue-500">
						<Volume2 className="h-2 w-2 text-white" />
					</div>
				)}
			</button>

			{/* Connection status indicator */}
			{(isConnecting || isActive) && (
				<div
					className="-translate-x-1/2 absolute top-full left-1/2 z-50 mt-2 min-w-max transform rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
					data-testid="conversation-status"
				>
					<div className="text-gray-800 text-sm">
						{isConnecting && getConnectionStatusText()}
						{isActive && (
							<div className="flex items-center gap-2">
								<div className="flex items-center gap-1">
									<div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
									{getConnectionStatusText()}
								</div>
								{enableLettaIntegration && (
									<div className="text-purple-600 text-xs">
										Agent: {currentAgent}
									</div>
								)}
							</div>
						)}
					</div>
					{isActive && audioLevel > 0 && (
						<div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-200">
							<div
								className="h-full bg-green-500 transition-all duration-100"
								style={{ width: `${audioLevel * 100}%` }}
							/>
						</div>
					)}
					{isActive && (
						<div className="mt-1 text-gray-500 text-xs">
							Model: {model} | Voice: {voice}
						</div>
					)}
				</div>
			)}
		</div>
	);
};
