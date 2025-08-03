import { Loader2, Mic, MicOff } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { type MicrophoneButtonProps, VoiceState } from "./types";

export const MicrophoneButton: React.FC<MicrophoneButtonProps> = ({
	onStartRecording,
	onStopRecording,
	onTranscription: _onTranscription,
	onError: _onError,
	isRecording = false,
	isProcessing = false,
	isDisabled = false,
	voiceState = VoiceState.IDLE,
	size = "md",
	variant: _variant = "default",
	className,
}) => {
	const [,] = useState(false);

	const getAriaLabel = useCallback(() => {
		if (voiceState === VoiceState.ERROR) return "Voice recording error";
		if (isProcessing) return "Processing speech...";
		if (isRecording) return "Stop voice recording";
		return "Start voice recording";
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
			"relative rounded-full transition-all duration-200 flex items-center justify-center";

		if (voiceState === VoiceState.ERROR) {
			return cn(baseClasses, "error bg-red-500 text-white");
		}

		if (isProcessing) {
			return cn(baseClasses, "processing bg-blue-500 text-white");
		}

		if (isRecording) {
			return cn(baseClasses, "recording animate-pulse bg-red-500 text-white");
		}

		return cn(baseClasses, "bg-gray-100 text-gray-700 hover:bg-gray-200");
	}, [voiceState, isProcessing, isRecording]);

	const handleClick = useCallback(() => {
		if (isDisabled || isProcessing) return;

		if (isRecording) {
			onStopRecording();
		} else {
			onStartRecording();
		}
	}, [
		isDisabled,
		isProcessing,
		isRecording,
		onStartRecording,
		onStopRecording,
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
		<button
			type="button"
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			disabled={isDisabled || isProcessing}
			aria-label={getAriaLabel()}
			className={cn(getSizeClasses(), getStateClasses(), className)}
		>
			{renderIcon()}

			{isRecording && (
				<div
					data-testid="pulse-indicator"
					className="absolute inset-0 animate-ping rounded-full bg-red-500/20"
				/>
			)}
		</button>
	);
};
