/**
 * Voice Conversation Management Hook
 * Orchestrates audio context, WebSocket connection, and audio playback
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LettaVoiceAgentConfig, VoiceError, VoiceState } from "../types";
import { VoiceState as VoiceStateEnum } from "../types";
import { useAudioContext } from "./useAudioContext";
import { useAudioPlayback } from "./useAudioPlayback";
import { useWebSocketConnection } from "./useWebSocketConnection";

export interface VoiceConversationState {
	isActive: boolean;
	isConnected: boolean;
	audioLevel: number;
	lastActivity: Date;
	conversationId: string;
}

export interface VoiceConversationHook {
	// State
	voiceState: VoiceState;
	conversationState: VoiceConversationState;
	isConnecting: boolean;
	audioLevel: number;

	// Actions
	startVoiceConversation: () => Promise<void>;
	endVoiceConversation: () => void;

	// Event handlers for parent component
	onConversationStart: () => void;
	onConversationEnd: () => void;
	onVoiceMessage?: (audioData: ArrayBuffer) => void;
	onError?: (error: VoiceError) => void;
}

export const useVoiceConversation = (
	lettaAgent?: LettaVoiceAgentConfig,
	onConversationStart?: () => void,
	onConversationEnd?: () => void,
	onVoiceMessage?: (audioData: ArrayBuffer) => void,
	onError?: (error: VoiceError) => void,
): VoiceConversationHook => {
	const [voiceState, setVoiceState] = useState<VoiceState>(VoiceStateEnum.IDLE);
	const [isConnecting, setIsConnecting] = useState(false);
	const [conversationState, setConversationState] =
		useState<VoiceConversationState>({
			isActive: false,
			isConnected: false,
			audioLevel: 0,
			lastActivity: new Date(),
			conversationId: "",
		});

	const audioContextRef = useRef<AudioContext | null>(null);

	// Initialize hooks
	const {
		audioState,
		initializeAudioContext,
		cleanup: cleanupAudio,
		onAudioProcess,
	} = useAudioContext(onError);

	const {
		websocketState,
		connectToRealtimeAPI,
		sendAudioData,
		disconnect,
		onAudioResponse,
	} = useWebSocketConnection(onError);

	const { playAudioResponse, stopPlayback } = useAudioPlayback(
		audioContextRef,
		setVoiceState,
		VoiceStateEnum,
	);

	// Set up audio processing callback
	const handleAudioProcess = useCallback(
		(audioData: ArrayBuffer) => {
			onVoiceMessage?.(audioData);
			sendAudioData(audioData);
		},
		[onVoiceMessage, sendAudioData],
	);

	// Set up audio response callback
	const handleAudioResponse = useCallback(
		(audioData: ArrayBuffer) => {
			playAudioResponse(audioData);
		},
		[playAudioResponse],
	);

	// Initialize callbacks
	onAudioProcess(handleAudioProcess);
	onAudioResponse(handleAudioResponse);

	// Start voice conversation
	const startVoiceConversation = useCallback(async () => {
		if (isConnecting) return;

		setIsConnecting(true);
		setVoiceState(VoiceStateEnum.PROCESSING);

		// Initialize audio context
		const audioInitialized = await initializeAudioContext();
		if (!audioInitialized) {
			setIsConnecting(false);
			setVoiceState(VoiceStateEnum.ERROR);
			return;
		}

		// Connect to WebSocket
		const connected = await connectToRealtimeAPI(lettaAgent);
		if (connected) {
			setVoiceState(VoiceStateEnum.RECORDING);
			setConversationState((prev) => ({
				...prev,
				isActive: true,
				isConnected: true,
				conversationId: websocketState.conversationId,
			}));
			onConversationStart?.();
		} else {
			setVoiceState(VoiceStateEnum.ERROR);
		}

		setIsConnecting(false);
	}, [
		isConnecting,
		initializeAudioContext,
		connectToRealtimeAPI,
		lettaAgent,
		websocketState.conversationId,
		onConversationStart,
	]);

	// End voice conversation
	const endVoiceConversation = useCallback(() => {
		// Stop audio playback
		stopPlayback();

		// Disconnect WebSocket
		disconnect();

		// Cleanup audio context
		cleanupAudio();

		// Reset state
		setVoiceState(VoiceStateEnum.IDLE);
		setIsConnecting(false);
		setConversationState({
			isActive: false,
			isConnected: false,
			audioLevel: 0,
			lastActivity: new Date(),
			conversationId: "",
		});

		onConversationEnd?.();
	}, [stopPlayback, disconnect, cleanupAudio, onConversationEnd]);

	// Update conversation state when WebSocket state changes
	useEffect(() => {
		setConversationState((prev) => ({
			...prev,
			isConnected: websocketState.isConnected,
			conversationId: websocketState.conversationId,
		}));
	}, [websocketState.isConnected, websocketState.conversationId]);

	// Update audio level from audio context
	useEffect(() => {
		setConversationState((prev) => ({
			...prev,
			audioLevel: audioState.audioLevel,
		}));
	}, [audioState.audioLevel]);

	return {
		// State
		voiceState,
		conversationState,
		isConnecting,
		audioLevel: audioState.audioLevel,

		// Actions
		startVoiceConversation,
		endVoiceConversation,

		// Event handlers (for compatibility)
		onConversationStart: onConversationStart || (() => {}),
		onConversationEnd: onConversationEnd || (() => {}),
		onVoiceMessage,
		onError,
	};
};
