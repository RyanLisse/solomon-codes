/**
 * Voice Conversation UI Management Hook
 * Handles UI state, styling, and interaction logic for voice conversation button
 */

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { COMPONENT_SIZES, CSS_CLASSES } from "../constants";
import type { VoiceState } from "../types";
import { VoiceState as VoiceStateEnum } from "../types";

export interface VoiceConversationUIHook {
	getAriaLabel: () => string;
	getSizeClasses: () => string;
	getStateClasses: () => string;
	handleClick: () => void;
	handleKeyDown: (event: React.KeyboardEvent) => void;
}

export const useVoiceConversationUI = (
	voiceState: VoiceState,
	isConnecting: boolean,
	isInConversation: boolean,
	disabled: boolean,
	size: "sm" | "md" | "lg",
	_className?: string,
	startVoiceConversation?: () => Promise<void>,
	endVoiceConversation?: () => void,
): VoiceConversationUIHook => {
	const getAriaLabel = useCallback(() => {
		if (voiceState === VoiceStateEnum.ERROR) return "Voice conversation error";
		if (isConnecting) return "Connecting to voice service...";
		if (voiceState === VoiceStateEnum.SPEAKING) return "AI is speaking";
		if (isInConversation) return "End voice conversation";
		return "Start voice conversation";
	}, [voiceState, isConnecting, isInConversation]);

	const getSizeClasses = useCallback(() => {
		return COMPONENT_SIZES[size];
	}, [size]);

	const getStateClasses = useCallback(() => {
		if (disabled) {
			return cn(CSS_CLASSES.BASE_BUTTON, CSS_CLASSES.DISABLED);
		}

		if (voiceState === VoiceStateEnum.ERROR) {
			return cn(CSS_CLASSES.BASE_BUTTON, CSS_CLASSES.ERROR);
		}

		if (isConnecting) {
			return cn(CSS_CLASSES.BASE_BUTTON, CSS_CLASSES.CONNECTING);
		}

		if (voiceState === VoiceStateEnum.SPEAKING) {
			return cn(CSS_CLASSES.BASE_BUTTON, CSS_CLASSES.SPEAKING);
		}

		if (isInConversation) {
			return cn(CSS_CLASSES.BASE_BUTTON, CSS_CLASSES.ACTIVE);
		}

		return cn(CSS_CLASSES.BASE_BUTTON, CSS_CLASSES.IDLE);
	}, [voiceState, isConnecting, isInConversation, disabled]);

	const handleClick = useCallback(() => {
		if (disabled) return;

		if (isInConversation) {
			endVoiceConversation?.();
		} else {
			startVoiceConversation?.();
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

	return {
		getAriaLabel,
		getSizeClasses,
		getStateClasses,
		handleClick,
		handleKeyDown,
	};
};
