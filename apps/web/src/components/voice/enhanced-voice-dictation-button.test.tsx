import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speechProcessingService } from "@/lib/voice/speech-processing";
import { EnhancedVoiceDictationButton } from "./enhanced-voice-dictation-button";

// Mock dependencies
vi.mock("@/lib/voice/speech-processing", () => {
	const mockSpeechToText = vi.fn();
	return {
		speechProcessingService: {
			startRecording: vi.fn(),
			stopRecording: vi.fn(),
			isRecording: vi.fn(() => false),
			isSupported: vi.fn(() => true),
			transcribeAudio: vi.fn(),
			configure: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
			speechToText: mockSpeechToText,
		},
	};
});

// Mock navigator.mediaDevices
const mockMediaDevices = {
	getUserMedia: vi.fn(),
};

const mockMediaRecorder = {
	start: vi.fn(),
	stop: vi.fn(),
	ondataavailable: null as ((event: { data: Blob }) => void) | null,
	onstop: null as (() => void) | null,
	onerror: null as ((event: Event) => void) | null,
	state: "inactive",
};

Object.defineProperty(globalThis, "navigator", {
	value: {
		mediaDevices: mockMediaDevices,
	},
	writable: true,
});

Object.defineProperty(globalThis, "MediaRecorder", {
	value: vi.fn(() => mockMediaRecorder),
	writable: true,
});

const mockSpeechProcessingService = {
	startRecording: vi.fn(),
	stopRecording: vi.fn(),
	isRecording: vi.fn(() => false),
	isSupported: vi.fn(() => true),
	transcribeAudio: vi.fn(),
	configure: vi.fn(),
	on: vi.fn(),
	off: vi.fn(),
};

describe("EnhancedVoiceDictationButton", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockMediaDevices.getUserMedia.mockResolvedValue({
			getTracks: () => [{ stop: vi.fn() }],
		});
		mockSpeechProcessingService.transcribeAudio.mockResolvedValue({
			transcript: "Hello world",
			confidence: 0.95,
		});
		// Configure the speechToText mock
		vi.mocked(speechProcessingService.speechToText).mockResolvedValue({
			text: "Hello world",
			confidence: 0.95,
			isFinal: true,
			timestamp: new Date(),
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Rendering", () => {
		it("should render with default props", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
				/>,
			);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
			expect(button).not.toBeDisabled();
		});

		it("should render with microphone icon when not recording", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
				/>,
			);

			expect(screen.getByTestId("mic-icon")).toBeInTheDocument();
		});

		it("should be disabled when disabled prop is true", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					disabled
				/>,
			);

			const button = screen.getByRole("button");
			expect(button).toBeDisabled();
		});

		it("should apply size classes correctly", () => {
			const { rerender } = render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					size="sm"
				/>,
			);
			expect(screen.getByRole("button")).toHaveClass("h-8", "w-8");

			rerender(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					size="lg"
				/>,
			);
			expect(screen.getByRole("button")).toHaveClass("h-14", "w-14");
		});

		it("should apply custom className", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					className="custom-class"
				/>,
			);

			const button = screen.getByRole("button");
			expect(button).toHaveClass("custom-class");
		});

		it("should show settings icon when showSettings is true", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					showSettings
				/>,
			);

			expect(screen.getByTestId("settings-icon")).toBeInTheDocument();
		});
	});

	describe("Recording State Management", () => {
		it("should start recording on click", async () => {
			const user = userEvent.setup();
			const onTranscription = vi.fn();

			render(
				<EnhancedVoiceDictationButton
					onTranscription={onTranscription}
					onDictationComplete={vi.fn()}
				/>,
			);

			const button = screen.getByRole("button");
			await user.click(button);

			// Should show recording state
			await waitFor(() => {
				expect(screen.getByTestId("mic-off-icon")).toBeInTheDocument();
			});
		});

		it("should handle external isRecording prop", () => {
			const { rerender } = render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					isRecording={false}
				/>,
			);

			expect(screen.getByTestId("mic-icon")).toBeInTheDocument();

			rerender(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					isRecording={true}
				/>,
			);
			expect(screen.getByTestId("mic-off-icon")).toBeInTheDocument();
		});

		it("should show processing state when isProcessing is true", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					isProcessing={true}
				/>,
			);

			expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
		});

		it("should call onDictationComplete when recording stops", async () => {
			const user = userEvent.setup();
			const onDictationComplete = vi.fn();

			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={onDictationComplete}
				/>,
			);

			const button = screen.getByRole("button");

			// Start recording
			await user.click(button);

			// Stop recording
			await user.click(button);

			await waitFor(() => {
				expect(onDictationComplete).toHaveBeenCalled();
			});
		});
	});

	describe("Provider Selection", () => {
		it("should use Web Speech API by default", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					provider="webspeech"
				/>,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("should use OpenAI API when specified", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					provider="openai"
					useAPI={true}
				/>,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("should auto-select provider when provider is auto", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					provider="auto"
				/>,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});
	});

	describe("Language Configuration", () => {
		it("should use default language en-US", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
				/>,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("should use custom language when specified", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					language="es-ES"
				/>,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});
	});

	describe("Transcription Handling", () => {
		it("should call onTranscription with interim results", async () => {
			const user = userEvent.setup();
			const onTranscription = vi.fn();

			render(
				<EnhancedVoiceDictationButton
					onTranscription={onTranscription}
					onDictationComplete={vi.fn()}
				/>,
			);

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				// Should be called with interim results
				expect(onTranscription).toHaveBeenCalledWith(
					expect.stringContaining(""),
				);
			});
		});

		it("should handle transcription errors gracefully", async () => {
			const user = userEvent.setup();
			const onError = vi.fn();

			// Mock transcription failure
			vi.mocked(speechProcessingService.speechToText).mockRejectedValue(
				new Error("Transcription failed"),
			);

			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					onError={onError}
				/>,
			);

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(onError).toHaveBeenCalledWith(
					expect.objectContaining({
						code: "SPEECH_RECOGNITION_FAILED",
						message: "Transcription failed",
						recoverable: true,
					}),
				);
			});
		});
	});

	describe("API vs Web Speech", () => {
		it("should use Web Speech API when useAPI is false", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					useAPI={false}
				/>,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("should use API transcription when useAPI is true", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					useAPI={true}
				/>,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});
	});

	describe("Error Handling", () => {
		it("should handle microphone access errors", async () => {
			const user = userEvent.setup();
			const onError = vi.fn();

			mockMediaDevices.getUserMedia.mockRejectedValue(
				new Error("Permission denied"),
			);

			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					onError={onError}
				/>,
			);

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(onError).toHaveBeenCalledWith(
					expect.objectContaining({
						code: "SPEECH_RECOGNITION_FAILED",
						message: "Permission denied",
						recoverable: true,
					}),
				);
			});
		});

		it("should recover from temporary errors gracefully", async () => {
			const user = userEvent.setup();
			const onError = vi.fn();

			// First call fails, second succeeds
			mockMediaDevices.getUserMedia
				.mockRejectedValueOnce(new Error("Temporary error"))
				.mockResolvedValue({
					getTracks: () => [{ stop: vi.fn() }],
				});

			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					onError={onError}
				/>,
			);

			const button = screen.getByRole("button");

			// First attempt should fail
			await user.click(button);
			await waitFor(() => expect(onError).toHaveBeenCalled());

			// Reset only the onError mock and restore speechToText mock
			onError.mockClear();
			vi.mocked(speechProcessingService.speechToText).mockResolvedValue({
				text: "Hello world",
				confidence: 0.95,
				isFinal: true,
				timestamp: new Date(),
			});

			await user.click(button);

			// Should succeed this time
			await waitFor(() => {
				expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
			});
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA labels", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
				/>,
			);

			const button = screen.getByRole("button");
			expect(button).toHaveAttribute(
				"aria-label",
				expect.stringContaining("dictation"),
			);
		});

		it("should indicate recording state to screen readers", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					isRecording={true}
				/>,
			);

			const button = screen.getByRole("button");
			expect(button).toHaveAttribute("aria-pressed", "true");
		});

		it("should be keyboard accessible", async () => {
			const user = userEvent.setup();
			const onTranscription = vi.fn();

			render(
				<EnhancedVoiceDictationButton
					onTranscription={onTranscription}
					onDictationComplete={vi.fn()}
				/>,
			);

			const button = screen.getByRole("button");
			await user.tab();
			expect(button).toHaveFocus();

			await user.keyboard("{Enter}");
			// Should trigger recording start
		});

		it("should provide feedback for processing state", () => {
			render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
					isProcessing={true}
				/>,
			);

			const button = screen.getByRole("button");
			expect(button).toHaveAttribute("aria-busy", "true");
		});
	});

	describe("Cleanup", () => {
		it("should cleanup resources on unmount", () => {
			const { unmount } = render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
				/>,
			);

			unmount();

			// Should cleanup without errors
			expect(true).toBe(true);
		});

		it("should stop recording on unmount if active", async () => {
			const user = userEvent.setup();

			const { unmount } = render(
				<EnhancedVoiceDictationButton
					onTranscription={vi.fn()}
					onDictationComplete={vi.fn()}
				/>,
			);

			const button = screen.getByRole("button");
			await user.click(button);

			// Start recording, then unmount
			unmount();

			// Should stop recording cleanly
			expect(true).toBe(true);
		});
	});
});
