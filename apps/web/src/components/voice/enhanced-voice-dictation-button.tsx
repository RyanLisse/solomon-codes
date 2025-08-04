/**
 * Enhanced Voice Dictation Button Component
 * Advanced microphone button with API integration and multiple providers
 */

import { Loader2, Mic, MicOff, Settings } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { speechProcessingService } from "@/lib/voice/speech-processing";
import { type VoiceError, VoiceErrorCode, VoiceState } from "./types";

export interface EnhancedVoiceDictationProps {
	onTranscription: (text: string) => void;
	onDictationComplete: (text: string) => void;
	onError?: (error: VoiceError) => void;
	isRecording?: boolean;
	isProcessing?: boolean;
	disabled?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
	useAPI?: boolean; // Use API transcription vs Web Speech API
	language?: string;
	provider?: "auto" | "openai" | "webspeech";
	showSettings?: boolean;
}

export const EnhancedVoiceDictationButton: React.FC<
	EnhancedVoiceDictationProps
> = ({
	onTranscription,
	onDictationComplete,
	onError,
	isRecording: externalIsRecording,
	isProcessing: externalIsProcessing,
	disabled = false,
	size = "md",
	className,
	useAPI = false,
	language = "en-US",
	provider = "auto",
	showSettings = false,
}) => {
	const [internalIsRecording, setInternalIsRecording] = useState(false);
	const [internalIsProcessing, setInternalIsProcessing] = useState(false);
	const [voiceState, setVoiceState] = useState<VoiceState>(VoiceState.IDLE);
	const [transcription, setTranscription] = useState("");
	const [interimTranscription, setInterimTranscription] = useState("");
	const [currentProvider, setCurrentProvider] = useState(provider);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);

	const isRecording = externalIsRecording ?? internalIsRecording;
	const isProcessing = externalIsProcessing ?? internalIsProcessing;

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
			}
		};
	}, []);

	// Handle transcription via API
	const transcribeAudio = useCallback(
		async (audioBlob: Blob) => {
			try {
				setInternalIsProcessing(true);
				setVoiceState(VoiceState.PROCESSING);

				const formData = new FormData();
				formData.append("audio", audioBlob, "recording.wav");
				formData.append("language", language);
				formData.append("provider", currentProvider);

				const response = await fetch("/api/voice/transcribe", {
					method: "POST",
					body: formData,
				});

				if (!response.ok) {
					throw new Error(`Transcription failed: ${response.statusText}`);
				}

				const result = await response.json();

				if (result.success) {
					setTranscription(result.transcript);
					onTranscription(result.transcript);
					onDictationComplete(result.transcript);
					setVoiceState(VoiceState.IDLE);
				} else {
					throw new Error(result.error || "Transcription failed");
				}
			} catch (error) {
				const voiceError: VoiceError = {
					code: VoiceErrorCode.SPEECH_RECOGNITION_FAILED,
					message:
						error instanceof Error ? error.message : "Transcription failed",
					recoverable: true,
					details: { error },
				};
				onError?.(voiceError);
				setVoiceState(VoiceState.ERROR);
			} finally {
				setInternalIsProcessing(false);
			}
		},
		[language, currentProvider, onTranscription, onDictationComplete, onError],
	);

	// Handle Web Speech API transcription
	const handleWebSpeechTranscription = useCallback(async () => {
		try {
			setInternalIsProcessing(true);
			setVoiceState(VoiceState.PROCESSING);

			// Even for Web Speech API, we need to request microphone access for consistency
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			streamRef.current = stream;

			// Use the speech processing service
			const audioData = new ArrayBuffer(0); // Placeholder - Web Speech API handles this internally
			const result = await speechProcessingService.speechToText(audioData, {
				language,
			});

			if (
				!result ||
				typeof result.text !== "string" ||
				result.text.trim() === ""
			) {
				console.warn("Invalid transcription result:", result);
				const voiceError: VoiceError = {
					code: VoiceErrorCode.SPEECH_RECOGNITION_FAILED,
					message: "Invalid transcription result",
					recoverable: true,
					details: { result },
				};
				throw voiceError;
			}

			setTranscription(result.text);
			onTranscription(result.text);
			onDictationComplete(result.text);
			setVoiceState(VoiceState.IDLE);
		} catch (error) {
			// If error is already a VoiceError, use it directly
			const voiceError: VoiceError =
				error && typeof error === "object" && "code" in error
					? (error as VoiceError)
					: {
							code: VoiceErrorCode.SPEECH_RECOGNITION_FAILED,
							message:
								error instanceof Error
									? error.message
									: "Speech recognition failed",
							recoverable: true,
							details: { error },
						};
			onError?.(voiceError);
			setVoiceState(VoiceState.ERROR);
		} finally {
			setInternalIsProcessing(false);
		}
	}, [language, onTranscription, onDictationComplete, onError]);

	// Start dictation
	const startDictation = useCallback(async () => {
		try {
			setInternalIsRecording(true);
			setVoiceState(VoiceState.RECORDING);
			setTranscription("");
			setInterimTranscription("");

			if (useAPI || currentProvider === "openai") {
				// Use MediaRecorder for API transcription
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
						sampleRate: 16000,
					},
				});

				streamRef.current = stream;
				audioChunksRef.current = [];

				const mediaRecorder = new MediaRecorder(stream, {
					mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
						? "audio/webm;codecs=opus"
						: "audio/webm",
				});

				mediaRecorder.ondataavailable = (event) => {
					if (event.data.size > 0) {
						audioChunksRef.current.push(event.data);
					}
				};

				mediaRecorder.onstop = () => {
					const audioBlob = new Blob(audioChunksRef.current, {
						type: mediaRecorder.mimeType,
					});
					transcribeAudio(audioBlob);
				};

				mediaRecorderRef.current = mediaRecorder;
				mediaRecorder.start();
			} else {
				// Use Web Speech API directly
				await handleWebSpeechTranscription();
			}
		} catch (error) {
			const voiceError: VoiceError = {
				code: VoiceErrorCode.MICROPHONE_ACCESS_DENIED,
				message: "Failed to access microphone",
				recoverable: true,
				details: { error },
			};
			onError?.(voiceError);
			setVoiceState(VoiceState.ERROR);
			setInternalIsRecording(false);
		}
	}, [
		useAPI,
		currentProvider,
		transcribeAudio,
		handleWebSpeechTranscription,
		onError,
	]);

	// Stop dictation
	const stopDictation = useCallback(() => {
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state === "recording"
		) {
			mediaRecorderRef.current.stop();
		}

		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}

		setInternalIsRecording(false);
		if (!useAPI && currentProvider !== "openai") {
			setVoiceState(VoiceState.IDLE);
		}
	}, [useAPI, currentProvider]);

	// Handle button click
	const handleClick = useCallback(() => {
		if (disabled || isProcessing) return;

		if (isRecording) {
			stopDictation();
		} else {
			startDictation();
		}
	}, [disabled, isProcessing, isRecording, startDictation, stopDictation]);

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
		if (voiceState === VoiceState.ERROR) return "Voice dictation error";
		if (isProcessing) return "Processing speech...";
		if (isRecording) return "Stop voice dictation";
		return "Start voice dictation";
	}, [voiceState, isProcessing, isRecording]);

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

		if (isProcessing) {
			return cn(baseClasses, "border-blue-200 bg-blue-50 text-blue-600");
		}

		if (isRecording) {
			return cn(
				baseClasses,
				"animate-pulse border-red-200 bg-red-50 text-red-600",
			);
		}

		return cn(
			baseClasses,
			"border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
		);
	}, [voiceState, isProcessing, isRecording, disabled]);

	const renderIcon = () => {
		if (isProcessing) {
			return (
				<Loader2 className="h-5 w-5 animate-spin" data-testid="loader-icon" />
			);
		}

		if (isRecording) {
			return <MicOff className="h-5 w-5" data-testid="mic-off-icon" />;
		}

		return <Mic className="h-5 w-5" data-testid="mic-icon" />;
	};

	return (
		<div className="relative flex items-center gap-2">
			<button
				type="button"
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				aria-label={getAriaLabel()}
				aria-pressed={isRecording ? "true" : "false"}
				aria-busy={isProcessing ? "true" : "false"}
				className={cn(getSizeClasses(), getStateClasses(), className)}
				data-testid="enhanced-voice-dictation-button"
			>
				{renderIcon()}

				{/* Recording pulse animation */}
				{isRecording && (
					<div
						data-testid="recording-pulse"
						className="absolute inset-0 animate-ping rounded-full border-2 border-red-200 bg-red-500/20"
					/>
				)}
			</button>

			{/* Settings button */}
			{showSettings && (
				<button
					type="button"
					className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
					onClick={() => {
						// Toggle provider or show settings modal
						const providers = ["auto", "openai", "webspeech"] as const;
						const currentIndex = providers.indexOf(
							currentProvider as (typeof providers)[number],
						);
						const nextProvider =
							providers[(currentIndex + 1) % providers.length];
						setCurrentProvider(nextProvider);
					}}
					title={`Current provider: ${currentProvider}`}
				>
					<Settings className="h-3 w-3" data-testid="settings-icon" />
				</button>
			)}

			{/* Real-time transcription display */}
			{(transcription || interimTranscription) && (
				<div
					className="-translate-x-1/2 absolute top-full left-1/2 z-50 mt-2 min-w-48 max-w-xs transform rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
					data-testid="transcription-display"
				>
					<div className="text-gray-800 text-sm">
						{transcription}
						{interimTranscription && (
							<span className="text-gray-500 italic">
								{interimTranscription}
							</span>
						)}
					</div>
					{isRecording && (useAPI || currentProvider === "openai") && (
						<div className="mt-2 text-gray-500 text-xs">
							Recording... Click to stop and transcribe
						</div>
					)}
					{isProcessing && (
						<div className="mt-2 flex items-center gap-1 text-blue-500 text-xs">
							<Loader2 className="h-3 w-3 animate-spin" />
							Processing with {currentProvider}...
						</div>
					)}
					{showSettings && (
						<div className="mt-2 text-gray-400 text-xs">
							Provider: {currentProvider}
						</div>
					)}
				</div>
			)}
		</div>
	);
};
