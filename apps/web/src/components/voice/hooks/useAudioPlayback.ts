/**
 * Audio Playback Management Hook
 * Handles audio response playback from WebSocket messages
 */

import { useCallback, useRef } from "react";
import type { VoiceState } from "../types";

export interface AudioPlaybackHook {
	playAudioResponse: (audioData: ArrayBuffer) => Promise<void>;
	stopPlayback: () => void;
}

export const useAudioPlayback = (
	audioContextRef: React.RefObject<AudioContext | null>,
	setVoiceState: (
		state: VoiceState | ((prev: VoiceState) => VoiceState),
	) => void,
	VoiceState: typeof import("../types").VoiceState,
): AudioPlaybackHook => {
	const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

	const playAudioResponse = useCallback(
		async (audioData: ArrayBuffer) => {
			if (!audioContextRef.current) return;

			try {
				setVoiceState(VoiceState.SPEAKING);

				const audioBuffer =
					await audioContextRef.current.decodeAudioData(audioData);
				const source = audioContextRef.current.createBufferSource();
				source.buffer = audioBuffer;
				source.connect(audioContextRef.current.destination);

				currentSourceRef.current = source;

				source.onended = () => {
					setVoiceState(VoiceState.RECORDING);
					currentSourceRef.current = null;
				};

				source.start();
			} catch (error) {
				console.error("Error playing audio response:", error);
				setVoiceState(VoiceState.RECORDING);
				currentSourceRef.current = null;
			}
		},
		[audioContextRef, setVoiceState, VoiceState],
	);

	const stopPlayback = useCallback(() => {
		if (currentSourceRef.current) {
			try {
				currentSourceRef.current.stop();
			} catch (error) {
				// Source might already be stopped
				console.warn("Audio source already stopped:", error);
			}
			currentSourceRef.current = null;
		}
	}, []);

	return {
		playAudioResponse,
		stopPlayback,
	};
};
