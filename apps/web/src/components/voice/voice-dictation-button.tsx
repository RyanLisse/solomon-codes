/**
 * VoiceDictationButton Component
 * ChatGPT-style microphone button for voice dictation that populates text input field
 */

import { Loader2, Mic, MicOff } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type VoiceError, VoiceErrorCode, VoiceState } from "./types";

export interface VoiceDictationProps {
	onTranscription: (text: string) => void;
	onDictationComplete: (text: string) => void;
	onError?: (error: VoiceError) => void;
	isRecording?: boolean;
	transcription?: string;
	disabled?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
}

export const VoiceDictationButton: React.FC<VoiceDictationProps> = ({
	onTranscription,
	onDictationComplete,
	onError,
	isRecording: externalIsRecording,
	transcription = "",
	disabled = false,
	size = "md",
	className,
}) => {
	const [internalIsRecording, setInternalIsRecording] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [voiceState, setVoiceState] = useState<VoiceState>(VoiceState.IDLE);
	const [currentTranscription, setCurrentTranscription] = useState("");

	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const isRecording = externalIsRecording ?? internalIsRecording;

	// Initialize speech recognition
	useEffect(() => {
		if (
			!("webkitSpeechRecognition" in window) &&
			!("SpeechRecognition" in window)
		) {
			const error: VoiceError = {
				code: VoiceErrorCode.BROWSER_NOT_SUPPORTED,
				message: "Speech recognition is not supported in this browser",
				recoverable: false,
			};
			onError?.(error);
			return;
		}

		const SpeechRecognition =
			window.SpeechRecognition || window.webkitSpeechRecognition;
		const recognition = new SpeechRecognition() as SpeechRecognition;

		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.lang = "en-US";
		recognition.maxAlternatives = 1;

		recognition.onstart = () => {
			setVoiceState(VoiceState.RECORDING);
			setIsProcessing(false);
		};

		recognition.onresult = (event) => {
			let interimTranscript = "";
			let finalTranscript = "";

			for (let i = event.resultIndex; i < event.results.length; i++) {
				const transcript = event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					finalTranscript += transcript;
				} else {
					interimTranscript += transcript;
				}
			}

			const fullTranscript = finalTranscript || interimTranscript;
			setCurrentTranscription(fullTranscript);
			onTranscription(fullTranscript);
		};

		recognition.onend = () => {
			setVoiceState(VoiceState.IDLE);
			setInternalIsRecording(false);
			setIsProcessing(false);

			if (currentTranscription.trim()) {
				onDictationComplete(currentTranscription.trim());
			}
		};

		recognition.onerror = (event) => {
			setVoiceState(VoiceState.ERROR);
			setInternalIsRecording(false);
			setIsProcessing(false);

			const error: VoiceError = {
				code: VoiceErrorCode.SPEECH_RECOGNITION_FAILED,
				message: `Speech recognition error: ${event.error}`,
				recoverable: true,
				details: { error: event.error },
			};
			onError?.(error);
		};

		recognitionRef.current = recognition as SpeechRecognition;

		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.abort();
			}
		};
	}, [onTranscription, onDictationComplete, onError, currentTranscription]);

	const startDictation = useCallback(async () => {
		if (!recognitionRef.current || disabled) return;

		try {
			// Request microphone permission
			await navigator.mediaDevices.getUserMedia({ audio: true });

			setCurrentTranscription("");
			setInternalIsRecording(true);
			setIsProcessing(true);
			setVoiceState(VoiceState.PROCESSING);

			recognitionRef.current.start();
		} catch (error) {
			const voiceError: VoiceError = {
				code: VoiceErrorCode.MICROPHONE_ACCESS_DENIED,
				message: "Microphone access denied",
				recoverable: true,
				details: { error },
			};
			onError?.(voiceError);
			setVoiceState(VoiceState.ERROR);
			setInternalIsRecording(false);
			setIsProcessing(false);
		}
	}, [disabled, onError]);

	const stopDictation = useCallback(() => {
		if (recognitionRef.current && isRecording) {
			recognitionRef.current.stop();
		}
	}, [isRecording]);

	const handleClick = useCallback(() => {
		if (disabled) return;

		if (isRecording) {
			stopDictation();
		} else {
			startDictation();
		}
	}, [disabled, isRecording, startDictation, stopDictation]);

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
			return <Loader2 className="h-5 w-5 animate-spin" />;
		}

		if (isRecording) {
			return <MicOff className="h-5 w-5" />;
		}

		return <Mic className="h-5 w-5" />;
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
				data-testid="voice-dictation-button"
			>
				{renderIcon()}

				{isRecording && (
					<div
						data-testid="recording-pulse"
						className="absolute inset-0 animate-ping rounded-full border-2 border-red-200 bg-red-500/20"
					/>
				)}
			</button>

			{/* Real-time transcription display */}
			{(isRecording || isProcessing) && transcription && (
				<div
					className="-translate-x-1/2 absolute top-full left-1/2 z-50 mt-2 min-w-48 max-w-sm transform rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
					data-testid="transcription-display"
				>
					<div className="mb-1 text-gray-500 text-xs">
						{isRecording ? "Listening..." : "Processing..."}
					</div>
					<div className="text-gray-800 text-sm">
						{transcription}
						{isRecording && <span className="animate-pulse">|</span>}
					</div>
				</div>
			)}
		</div>
	);
};

// Hook for using voice dictation
export const useVoiceDictation = () => {
	const [isRecording, setIsRecording] = useState(false);
	const [transcription, setTranscription] = useState("");
	const [error, setError] = useState<VoiceError | null>(null);

	const handleTranscription = useCallback((text: string) => {
		setTranscription(text);
		setError(null);
	}, []);

	const handleDictationComplete = useCallback((text: string) => {
		setTranscription(text);
		setIsRecording(false);
	}, []);

	const handleError = useCallback((voiceError: VoiceError) => {
		setError(voiceError);
		setIsRecording(false);
	}, []);

	const startDictation = useCallback(() => {
		setIsRecording(true);
		setError(null);
	}, []);

	const stopDictation = useCallback(() => {
		setIsRecording(false);
	}, []);

	const clearTranscription = useCallback(() => {
		setTranscription("");
		setError(null);
	}, []);

	return {
		isRecording,
		transcription,
		error,
		startDictation,
		stopDictation,
		clearTranscription,
		handleTranscription,
		handleDictationComplete,
		handleError,
	};
};
