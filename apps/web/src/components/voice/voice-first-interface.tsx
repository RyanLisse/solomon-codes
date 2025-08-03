/**
 * Voice-First Interface Component
 * Main interface that integrates all voice processing capabilities with Letta agents
 */

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AgentType } from "@/lib/voice/agent-orchestration";
import { AudioUtils, GeminiTTSService } from "@/lib/voice/gemini-tts";
import { speechProcessingService } from "@/lib/voice/speech-processing";
import { EnhancedVoiceConversationButton } from "./enhanced-voice-conversation-button";
import { EnhancedVoiceDictationButton } from "./enhanced-voice-dictation-button";
import { type VoiceError, VoiceState } from "./types";

export interface VoiceFirstInterfaceProps {
	onTextInput?: (text: string) => void;
	onVoiceMessage?: (message: string, isUser: boolean) => void;
	onError?: (error: VoiceError) => void;
	className?: string;
	sessionId?: string;
	userId?: string;
	enableDictation?: boolean;
	enableConversation?: boolean;
	enableLettaIntegration?: boolean;
	showAgentStatus?: boolean;
	defaultLanguage?: string;
	defaultVoice?: string;
}

export interface VoiceInterfaceState {
	isDictating: boolean;
	isInConversation: boolean;
	currentAgent: AgentType;
	voiceState: VoiceState;
	lastTranscription: string;
	audioLevel: number;
	connectionStatus: string;
}

export const VoiceFirstInterface: React.FC<VoiceFirstInterfaceProps> = ({
	onTextInput,
	onVoiceMessage,
	onError,
	className,
	sessionId = `session-${Date.now()}`,
	userId = "default-user",
	enableDictation = true,
	enableConversation = true,
	enableLettaIntegration = true,
	showAgentStatus = true,
	defaultLanguage = "en-US",
	defaultVoice = "coral",
}) => {
	const [interfaceState, setInterfaceState] = useState<VoiceInterfaceState>({
		isDictating: false,
		isInConversation: false,
		currentAgent: AgentType.VOICE,
		voiceState: VoiceState.IDLE,
		lastTranscription: "",
		audioLevel: 0,
		connectionStatus: "disconnected",
	});

	const [availableProviders, setAvailableProviders] = useState<string[]>([]);
	const [currentProvider, setCurrentProvider] = useState<string>("auto");
	const [geminiTTS, setGeminiTTS] = useState<GeminiTTSService | null>(null);

	// Initialize services
	useEffect(() => {
		// Get available speech processing providers
		const providers = speechProcessingService.getAvailableProviders();
		setAvailableProviders(providers);

		// Initialize Gemini TTS if API key is available
		const geminiApiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
		if (geminiApiKey) {
			setGeminiTTS(new GeminiTTSService(geminiApiKey));
		}

		// Initialize agent orchestration service
		if (enableLettaIntegration) {
			console.log("Voice-first interface initialized with Letta integration");
		}
	}, [enableLettaIntegration]);

	// Handle dictation events
	const _handleDictationStart = useCallback(() => {
		setInterfaceState((prev) => ({
			...prev,
			isDictating: true,
			voiceState: VoiceState.RECORDING,
		}));
	}, []);

	const handleDictationComplete = useCallback(
		(text: string) => {
			setInterfaceState((prev) => ({
				...prev,
				isDictating: false,
				voiceState: VoiceState.IDLE,
				lastTranscription: text,
			}));
			onTextInput?.(text);
		},
		[onTextInput],
	);

	const handleDictationTranscription = useCallback((text: string) => {
		setInterfaceState((prev) => ({
			...prev,
			lastTranscription: text,
		}));
	}, []);

	// Handle conversation events
	const handleConversationStart = useCallback(() => {
		setInterfaceState((prev) => ({
			...prev,
			isInConversation: true,
			voiceState: VoiceState.RECORDING,
			connectionStatus: "connecting",
		}));
	}, []);

	const handleConversationEnd = useCallback(() => {
		setInterfaceState((prev) => ({
			...prev,
			isInConversation: false,
			voiceState: VoiceState.IDLE,
			connectionStatus: "disconnected",
		}));
	}, []);

	// Generate speech for assistant responses using Gemini TTS
	const generateResponseSpeech = useCallback(
		async (text: string) => {
			if (!geminiTTS) return;

			try {
				const result = await geminiTTS.generateAgentSpeech(
					text,
					interfaceState.currentAgent as "voice" | "code" | "task",
					"helpful",
				);

				// Play the generated audio
				await AudioUtils.playAudio(result.audioData, result.format);
			} catch (error) {
				console.warn("Failed to generate response speech:", error);
			}
		},
		[geminiTTS, interfaceState.currentAgent],
	);

	const handleConversationMessage = useCallback(
		(message: string, isUser: boolean) => {
			onVoiceMessage?.(message, isUser);

			// If this is an assistant message and we have Gemini TTS, generate speech
			if (!isUser && geminiTTS) {
				generateResponseSpeech(message);
			}
		},
		[onVoiceMessage, geminiTTS, generateResponseSpeech],
	);

	const handleConversationTranscript = useCallback(
		(transcript: string, isUser: boolean) => {
			setInterfaceState((prev) => ({
				...prev,
				lastTranscription: isUser ? transcript : prev.lastTranscription,
			}));
		},
		[],
	);

	// Handle errors from voice components
	const handleVoiceError = useCallback(
		(error: VoiceError) => {
			console.error("Voice interface error:", error);
			setInterfaceState((prev) => ({
				...prev,
				voiceState: VoiceState.ERROR,
			}));
			onError?.(error);
		},
		[onError],
	);

	// Handle agent switching
	const handleAgentSwitch = useCallback(
		async (newAgent: AgentType) => {
			if (enableLettaIntegration) {
				try {
					// This would integrate with the agent orchestration service
					console.log(`Switching to ${newAgent} agent`);
					setInterfaceState((prev) => ({
						...prev,
						currentAgent: newAgent,
					}));
				} catch (error) {
					console.error("Agent switch failed:", error);
				}
			}
		},
		[enableLettaIntegration],
	);

	// Get status indicator color
	const getStatusColor = useCallback(() => {
		if (interfaceState.voiceState === VoiceState.ERROR) return "text-red-500";
		if (interfaceState.isInConversation) return "text-green-500";
		if (interfaceState.isDictating) return "text-blue-500";
		return "text-gray-500";
	}, [interfaceState]);

	// Get status text
	const getStatusText = useCallback(() => {
		if (interfaceState.voiceState === VoiceState.ERROR) return "Error";
		if (interfaceState.isInConversation) return "In Conversation";
		if (interfaceState.isDictating) return "Dictating";
		return "Ready";
	}, [interfaceState]);

	return (
		<div className={cn("voice-first-interface", className)}>
			{/* Main Voice Controls */}
			<div className="flex items-center gap-4">
				{/* Dictation Button */}
				{enableDictation && (
					<div className="relative">
						<EnhancedVoiceDictationButton
							onTranscription={handleDictationTranscription}
							onDictationComplete={handleDictationComplete}
							onError={handleVoiceError}
							language={defaultLanguage}
							useAPI={currentProvider === "openai"}
							provider={currentProvider as "auto" | "openai" | "webspeech"}
							showSettings={true}
							size="lg"
							className="voice-dictation-control"
						/>
						<div className="-bottom-6 -translate-x-1/2 absolute left-1/2 transform text-gray-500 text-xs">
							Dictation
						</div>
					</div>
				)}

				{/* Conversation Button */}
				{enableConversation && (
					<div className="relative">
						<EnhancedVoiceConversationButton
							onConversationStart={handleConversationStart}
							onConversationEnd={handleConversationEnd}
							onMessage={handleConversationMessage}
							onTranscript={handleConversationTranscript}
							onError={handleVoiceError}
							sessionId={sessionId}
							userId={userId}
							enableLettaIntegration={enableLettaIntegration}
							voice={defaultVoice}
							size="lg"
							className="voice-conversation-control"
						/>
						<div className="-bottom-6 -translate-x-1/2 absolute left-1/2 transform text-gray-500 text-xs">
							Conversation
						</div>
					</div>
				)}
			</div>

			{/* Status Display */}
			{showAgentStatus && (
				<div className="mt-6 rounded-lg bg-gray-50 p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className={cn("h-2 w-2 rounded-full", getStatusColor())} />
							<span className="font-medium text-sm">
								Status: {getStatusText()}
							</span>
						</div>

						{enableLettaIntegration && (
							<div className="flex items-center gap-2">
								<span className="text-gray-600 text-sm">Agent:</span>
								<select
									value={interfaceState.currentAgent}
									onChange={(e) =>
										handleAgentSwitch(e.target.value as AgentType)
									}
									className="rounded border border-gray-300 px-2 py-1 text-sm"
								>
									<option value={AgentType.VOICE}>Voice Assistant</option>
									<option value={AgentType.CODE}>Code Assistant</option>
									<option value={AgentType.TASK}>Task Manager</option>
								</select>
							</div>
						)}
					</div>

					{/* Provider Selection */}
					<div className="mt-2 flex items-center gap-4 text-gray-600 text-sm">
						<div className="flex items-center gap-2">
							<span>Provider:</span>
							<select
								value={currentProvider}
								onChange={(e) => setCurrentProvider(e.target.value)}
								className="rounded border border-gray-300 px-2 py-1"
							>
								<option value="auto">Auto</option>
								{availableProviders.map((provider) => (
									<option key={provider} value={provider.toLowerCase()}>
										{provider}
									</option>
								))}
							</select>
						</div>

						<div className="flex items-center gap-2">
							<span>Language:</span>
							<span className="font-mono">{defaultLanguage}</span>
						</div>

						<div className="flex items-center gap-2">
							<span>Voice:</span>
							<span className="font-mono">{defaultVoice}</span>
						</div>
					</div>

					{/* Last Transcription */}
					{interfaceState.lastTranscription && (
						<div className="mt-2 rounded border bg-white p-2">
							<div className="mb-1 text-gray-500 text-xs">
								Last transcription:
							</div>
							<div className="text-sm">{interfaceState.lastTranscription}</div>
						</div>
					)}
				</div>
			)}

			{/* Connection Status for Conversation */}
			{interfaceState.isInConversation && (
				<div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
					<div className="flex items-center gap-2">
						<div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
						<span className="text-green-800 text-sm">
							Voice conversation active
						</span>
						{enableLettaIntegration && (
							<span className="ml-2 text-green-600 text-xs">
								with {interfaceState.currentAgent} agent
							</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
