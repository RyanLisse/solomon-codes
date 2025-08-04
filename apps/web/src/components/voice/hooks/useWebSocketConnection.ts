/**
 * WebSocket Connection Management Hook
 * Handles OpenAI Realtime API WebSocket connection and message handling
 */

import { useCallback, useRef, useState } from "react";
import { SESSION_CONFIG, WEBSOCKET_CONFIG } from "../constants";
import type {
	LettaVoiceAgentConfig,
	VoiceError,
	VoiceErrorCode,
} from "../types";

export interface WebSocketState {
	isConnected: boolean;
	isConnecting: boolean;
	conversationId: string;
}

export interface WebSocketHook {
	websocketState: WebSocketState;
	connectToRealtimeAPI: (
		lettaAgent?: LettaVoiceAgentConfig,
	) => Promise<boolean>;
	sendAudioData: (audioData: ArrayBuffer) => void;
	disconnect: () => void;
	onAudioResponse: (callback: (audioData: ArrayBuffer) => void) => void;
	onTranscript: (callback: (transcript: string) => void) => void;
}

export const useWebSocketConnection = (
	onError?: (error: VoiceError) => void,
): WebSocketHook => {
	const [websocketState, setWebSocketState] = useState<WebSocketState>({
		isConnected: false,
		isConnecting: false,
		conversationId: "",
	});

	const websocketRef = useRef<WebSocket | null>(null);
	const audioResponseCallbackRef = useRef<
		((audioData: ArrayBuffer) => void) | null
	>(null);
	const transcriptCallbackRef = useRef<((transcript: string) => void) | null>(
		null,
	);

	const connectToRealtimeAPI = useCallback(
		async (lettaAgent?: LettaVoiceAgentConfig): Promise<boolean> => {
			try {
				setWebSocketState((prev) => ({ ...prev, isConnecting: true }));

				const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
				if (!apiKey) {
					throw new Error("OpenAI API key not configured");
				}

				const websocket = new WebSocket(WEBSOCKET_CONFIG.REALTIME_API_URL, [
					...WEBSOCKET_CONFIG.PROTOCOLS,
					`Bearer.${apiKey}`,
				]);

				websocket.onopen = () => {
					console.log("Connected to OpenAI Realtime API");
					const conversationId = `conv-${Date.now()}`;

					setWebSocketState({
						isConnected: true,
						isConnecting: false,
						conversationId,
					});

					// Configure session
					websocket.send(
						JSON.stringify({
							type: "session.update",
							session: {
								...SESSION_CONFIG,
								instructions: lettaAgent?.agentId
									? `You are integrated with Letta agent ${lettaAgent.agentId}. Maintain conversation context and memory.`
									: "You are a helpful voice assistant. Respond naturally and conversationally.",
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
								if (message.delta && audioResponseCallbackRef.current) {
									const audioData = new Uint8Array(message.delta).buffer;
									audioResponseCallbackRef.current(audioData);
								}
								break;

							case "conversation.item.input_audio_transcription.completed":
								console.log("User said:", message.transcript);
								if (transcriptCallbackRef.current) {
									transcriptCallbackRef.current(message.transcript);
								}
								break;

							case "response.done":
								// Response completed - handled by parent component
								break;

							case "error": {
								console.error("Realtime API error:", message.error);
								const error: VoiceError = {
									code: "NETWORK_ERROR" as VoiceErrorCode,
									message: message.error.message || "Realtime API error",
									recoverable: true,
									details: message.error,
								};
								onError?.(error);
								break;
							}
						}
					} catch (error) {
						console.error("Error parsing WebSocket message:", error);
					}
				};

				websocket.onerror = (error) => {
					console.error("WebSocket error:", error);
					const voiceError: VoiceError = {
						code: "NETWORK_ERROR" as VoiceErrorCode,
						message: "Failed to connect to voice service",
						recoverable: true,
						details: { error },
					};
					onError?.(voiceError);
					setWebSocketState((prev) => ({
						...prev,
						isConnecting: false,
						isConnected: false,
					}));
				};

				websocket.onclose = () => {
					console.log("Disconnected from OpenAI Realtime API");
					setWebSocketState({
						isConnected: false,
						isConnecting: false,
						conversationId: "",
					});
				};

				websocketRef.current = websocket;
				return true;
			} catch (error) {
				const voiceError: VoiceError = {
					code: "NETWORK_ERROR" as VoiceErrorCode,
					message: "Failed to connect to realtime API",
					recoverable: true,
					details: { error },
				};
				onError?.(voiceError);
				setWebSocketState((prev) => ({
					...prev,
					isConnecting: false,
					isConnected: false,
				}));
				return false;
			}
		},
		[onError],
	);

	const sendAudioData = useCallback((audioData: ArrayBuffer) => {
		if (websocketRef.current?.readyState === WebSocket.OPEN) {
			websocketRef.current.send(
				JSON.stringify({
					type: "input_audio_buffer.append",
					audio: Array.from(new Uint8Array(audioData)),
				}),
			);
		}
	}, []);

	const disconnect = useCallback(() => {
		if (websocketRef.current) {
			websocketRef.current.close();
			websocketRef.current = null;
		}
		setWebSocketState({
			isConnected: false,
			isConnecting: false,
			conversationId: "",
		});
	}, []);

	const onAudioResponse = useCallback(
		(callback: (audioData: ArrayBuffer) => void) => {
			audioResponseCallbackRef.current = callback;
		},
		[],
	);

	const onTranscript = useCallback((callback: (transcript: string) => void) => {
		transcriptCallbackRef.current = callback;
	}, []);

	return {
		websocketState,
		connectToRealtimeAPI,
		sendAudioData,
		disconnect,
		onAudioResponse,
		onTranscript,
	};
};
