/**
 * VoiceConversationButton Component
 * ChatGPT-style voice button for real-time voice conversations using OpenAI Realtime API
 */

import { AudioLines, Loader2, Volume2, VolumeX } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LettaVoiceAgentConfig, VoiceError } from "./types";
import { VoiceErrorCode, VoiceState } from "./types";

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
	onVoiceMessage: _onVoiceMessage,
	onError,
	isInConversation: externalIsInConversation,
	lettaAgent,
	disabled = false,
	size = "md",
	className,
}) => {
	const [internalIsInConversation, setInternalIsInConversation] =
		useState(false);

	const isInConversation = externalIsInConversation ?? internalIsInConversation;

	// Voice conversation state
	const [voiceState, setVoiceState] = useState(VoiceState.IDLE);
	const [conversationState, setConversationState] =
		useState<VoiceConversationState>({
			isActive: false,
			isConnected: false,
			audioLevel: 0,
			lastActivity: new Date(),
			conversationId: "",
		});
	const [isConnecting, setIsConnecting] = useState(false);
	const [audioLevel, _setAudioLevel] = useState(0);

	const startVoiceConversation = useCallback(async () => {
		setIsConnecting(true);

		try {
			// Initialize audio context and get user media
			await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					sampleRate: 24000,
				},
			});

			setVoiceState(VoiceState.RECORDING);
			setInternalIsInConversation(true);
			onConversationStart();
			setConversationState((prev) => ({
				...prev,
				isActive: true,
				isConnected: true,
				lastActivity: new Date(),
			}));
		} catch (error) {
			onError?.({
				code: VoiceErrorCode.MICROPHONE_ACCESS_DENIED,
				message: "Failed to initialize audio context",
				recoverable: true,
				details: { error },
			});
		} finally {
			setIsConnecting(false);
		}
	}, [onConversationStart, onError]);

	const endVoiceConversation = useCallback(() => {
		setVoiceState(VoiceState.IDLE);
		setInternalIsInConversation(false);
		onConversationEnd();
		setConversationState({
			isActive: false,
			isConnected: false,
			audioLevel: 0,
			lastActivity: new Date(),
			conversationId: "",
		});
	}, [onConversationEnd]);

	// UI handlers
	const getSizeClasses = () => {
		switch (size) {
			case "sm":
				return "h-8 w-8";
			case "lg":
				return "h-16 w-16";
			default:
				return "h-12 w-12";
		}
	};

	const getStateClasses = () => {
		return cn(
			"relative flex items-center justify-center rounded-full border-2 transition-all duration-200",
			disabled
				? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400"
				: isInConversation
					? "border-red-500 bg-red-50 text-red-600 hover:bg-red-100"
					: "border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100",
		);
	};

	const getAriaLabel = () => {
		if (disabled) return "Voice conversation disabled";
		if (isConnecting) return "Connecting to voice conversation";
		if (isInConversation) return "End voice conversation";
		return "Start voice conversation";
	};

	const handleClick = async () => {
		if (disabled || isConnecting) return;
		if (isInConversation) {
			endVoiceConversation();
		} else {
			await startVoiceConversation();
		}
	};

	const handleKeyDown = async (event: React.KeyboardEvent) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			await handleClick();
		}
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			endVoiceConversation();
		};
	}, [endVoiceConversation]);

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

// Add global type declarations for Web Audio API
declare global {
	interface Window {
		AudioContext: typeof AudioContext;
		webkitAudioContext: typeof AudioContext;
	}
}
