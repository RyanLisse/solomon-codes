/**
 * Audio Context Management Hook
 * Handles audio context initialization, microphone access, and audio processing
 */

import { useCallback, useRef, useState } from "react";
import {
	AUDIO_CONFIG,
	AUDIO_PROCESSING,
	MEDIA_CONSTRAINTS,
} from "../constants";
import type { VoiceError } from "../types";
import { VoiceErrorCode } from "../types";

export interface AudioContextState {
	isInitialized: boolean;
	audioLevel: number;
	isProcessing: boolean;
}

export interface AudioContextHook {
	audioState: AudioContextState;
	initializeAudioContext: () => Promise<boolean>;
	cleanup: () => void;
	onAudioProcess: (callback: (audioData: ArrayBuffer) => void) => void;
}

export const useAudioContext = (
	onError?: (error: VoiceError) => void,
): AudioContextHook => {
	const [audioState, setAudioState] = useState<AudioContextState>({
		isInitialized: false,
		audioLevel: 0,
		isProcessing: false,
	});

	const audioContextRef = useRef<AudioContext | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const processorRef = useRef<AudioNode | null>(null);
	const audioProcessCallbackRef = useRef<
		((audioData: ArrayBuffer) => void) | null
	>(null);

	const initializeAudioContext = useCallback(async (): Promise<boolean> => {
		try {
			setAudioState((prev) => ({ ...prev, isProcessing: true }));

			// Request microphone access
			const stream =
				await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
			mediaStreamRef.current = stream;

			// Create audio context
			const audioContext = new (
				window.AudioContext || window.webkitAudioContext
			)({
				sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
			});
			audioContextRef.current = audioContext;

			// Create audio source and processor
			const source = audioContext.createMediaStreamSource(stream);
			const processor = audioContext.createScriptProcessor(
				AUDIO_CONFIG.BUFFER_SIZE,
				AUDIO_CONFIG.CHANNELS,
				AUDIO_CONFIG.CHANNELS,
			);

			processor.onaudioprocess = (event) => {
				const inputBuffer = event.inputBuffer;
				const inputData = inputBuffer.getChannelData(0);

				// Calculate audio level for visualization
				let sum = 0;
				for (const sample of inputData) {
					sum += sample * sample;
				}
				const rms = Math.sqrt(sum / inputData.length);
				const audioLevel = rms * AUDIO_PROCESSING.RMS_MULTIPLIER;

				setAudioState((prev) => ({ ...prev, audioLevel }));

				// Convert to ArrayBuffer
				const audioData = new ArrayBuffer(inputData.length * 2);
				const view = new Int16Array(audioData);

				for (const [i, sample] of inputData.entries()) {
					view[i] = Math.max(
						AUDIO_CONFIG.MIN_SAMPLE_VALUE,
						Math.min(
							AUDIO_CONFIG.MAX_SAMPLE_VALUE,
							sample * AUDIO_CONFIG.MAX_SAMPLE_VALUE,
						),
					);
				}

				// Call the registered callback
				audioProcessCallbackRef.current?.(audioData);
			};

			source.connect(processor);
			processor.connect(audioContext.destination);
			processorRef.current = processor;

			setAudioState((prev) => ({
				...prev,
				isInitialized: true,
				isProcessing: false,
			}));

			return true;
		} catch (error) {
			const voiceError: VoiceError = {
				code: VoiceErrorCode.MICROPHONE_ACCESS_DENIED,
				message: "Failed to initialize audio context",
				recoverable: true,
				details: { error },
			};
			onError?.(voiceError);

			setAudioState((prev) => ({
				...prev,
				isInitialized: false,
				isProcessing: false,
			}));

			return false;
		}
	}, [onError]);

	const cleanup = useCallback(() => {
		// Stop audio processing
		if (processorRef.current) {
			processorRef.current.disconnect();
			processorRef.current = null;
		}

		// Close audio context
		if (audioContextRef.current) {
			audioContextRef.current.close();
			audioContextRef.current = null;
		}

		// Stop media stream
		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((track) => track.stop());
			mediaStreamRef.current = null;
		}

		audioProcessCallbackRef.current = null;

		setAudioState({
			isInitialized: false,
			audioLevel: 0,
			isProcessing: false,
		});
	}, []);

	const onAudioProcess = useCallback(
		(callback: (audioData: ArrayBuffer) => void) => {
			audioProcessCallbackRef.current = callback;
		},
		[],
	);

	return {
		audioState,
		initializeAudioContext,
		cleanup,
		onAudioProcess,
	};
};
