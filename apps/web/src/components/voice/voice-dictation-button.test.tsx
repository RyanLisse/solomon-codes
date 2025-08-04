/**
 * Tests for VoiceDictationButton component
 */

import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceErrorCode } from "./types";
import {
	useVoiceDictation,
	VoiceDictationButton,
} from "./voice-dictation-button";

// Mock Speech Recognition API
const mockSpeechRecognition = {
	start: vi.fn(() => {
		// Simulate the onstart event being fired immediately
		if (mockSpeechRecognition.onstart) {
			mockSpeechRecognition.onstart(new Event("start"));
		}
	}),
	stop: vi.fn(() => {
		// Simulate the onend event being fired immediately
		if (mockSpeechRecognition.onend) {
			mockSpeechRecognition.onend(new Event("end"));
		}
	}),
	abort: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	continuous: false,
	interimResults: false,
	lang: "en-US",
	maxAlternatives: 1,
	onstart: null as ((event: Event) => void) | null,
	onend: null as ((event: Event) => void) | null,
	onresult: null as ((event: SpeechRecognitionEvent) => void) | null,
	onerror: null as ((event: SpeechRecognitionErrorEvent) => void) | null,
};

const mockMediaDevices = {
	getUserMedia: vi.fn(),
};

// Mock global objects
Object.defineProperty(window, "SpeechRecognition", {
	writable: true,
	value: vi.fn(() => mockSpeechRecognition),
});

Object.defineProperty(window, "webkitSpeechRecognition", {
	writable: true,
	value: vi.fn(() => mockSpeechRecognition),
});

Object.defineProperty(navigator, "mediaDevices", {
	writable: true,
	value: mockMediaDevices,
});

describe("VoiceDictationButton", () => {
	const mockOnTranscription = vi.fn();
	const mockOnDictationComplete = vi.fn();
	const mockOnError = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		mockMediaDevices.getUserMedia.mockResolvedValue({} as MediaStream);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders with default props", () => {
		render(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
			/>,
		);

		const button = screen.getByTestId("voice-dictation-button");
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute("aria-label", "Start voice dictation");
	});

	it("shows microphone icon when idle", () => {
		render(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
			/>,
		);

		// Check for Mic icon (Lucide React icons have specific test attributes)
		const button = screen.getByTestId("voice-dictation-button");
		expect(button).toBeInTheDocument();
	});

	it("starts dictation when clicked", async () => {
		render(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
			/>,
		);

		const button = screen.getByTestId("voice-dictation-button");
		fireEvent.click(button);

		await waitFor(() => {
			expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
				audio: true,
			});
		});
	});

	it("handles microphone access denied", async () => {
		mockMediaDevices.getUserMedia.mockRejectedValue(
			new Error("Permission denied"),
		);

		render(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
				onError={mockOnError}
			/>,
		);

		const button = screen.getByTestId("voice-dictation-button");
		fireEvent.click(button);

		await waitFor(() => {
			expect(mockOnError).toHaveBeenCalledWith({
				code: VoiceErrorCode.MICROPHONE_ACCESS_DENIED,
				message: "Microphone access denied",
				recoverable: true,
				details: { error: expect.any(Error) },
			});
		});
	});

	it("shows transcription display when recording", () => {
		render(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
				isRecording={true}
				transcription="Hello world"
			/>,
		);

		const transcriptionDisplay = screen.getByTestId("transcription-display");
		expect(transcriptionDisplay).toBeInTheDocument();
		expect(transcriptionDisplay).toHaveTextContent("Hello world");
	});

	it("handles keyboard navigation", async () => {
		render(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
			/>,
		);

		const button = screen.getByTestId("voice-dictation-button");

		// Wait for component to initialize (recognition ref to be set)
		await waitFor(() => {
			expect(button).toHaveAttribute("aria-label", "Start voice dictation");
		});

		// Test Enter key - wrap in act() to handle state updates
		await act(async () => {
			fireEvent.keyDown(button, { key: "Enter" });
		});

		// Wait for getUserMedia to be called and component to be in recording state
		await waitFor(() => {
			expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
			expect(button).toHaveAttribute("aria-label", "Stop voice dictation");
		});

		// Simulate stopping recording
		await act(async () => {
			fireEvent.keyDown(button, { key: "Enter" });
		});

		// Wait for component to return to idle state
		await waitFor(() => {
			expect(button).toHaveAttribute("aria-label", "Start voice dictation");
		});

		mockMediaDevices.getUserMedia.mockClear();

		// Test Space key
		await act(async () => {
			fireEvent.keyDown(button, { key: " " });
		});

		// Wait for getUserMedia to be called again
		await waitFor(() => {
			expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
			expect(button).toHaveAttribute("aria-label", "Stop voice dictation");
		});
	});

	it("is disabled when disabled prop is true", () => {
		render(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
				disabled={true}
			/>,
		);

		const button = screen.getByTestId("voice-dictation-button");
		expect(button).toBeDisabled();

		fireEvent.click(button);
		expect(mockMediaDevices.getUserMedia).not.toHaveBeenCalled();
	});

	it("shows recording pulse when recording", () => {
		render(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
				isRecording={true}
			/>,
		);

		const pulse = screen.getByTestId("recording-pulse");
		expect(pulse).toBeInTheDocument();
		expect(pulse).toHaveClass("animate-ping");
	});

	it("handles different sizes", () => {
		const { rerender } = render(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
				size="sm"
			/>,
		);

		let button = screen.getByTestId("voice-dictation-button");
		expect(button).toHaveClass("h-8", "w-8");

		rerender(
			<VoiceDictationButton
				onTranscription={mockOnTranscription}
				onDictationComplete={mockOnDictationComplete}
				size="lg"
			/>,
		);

		button = screen.getByTestId("voice-dictation-button");
		expect(button).toHaveClass("h-12", "w-12");
	});
});

describe("useVoiceDictation hook", () => {
	it("provides correct initial state", () => {
		let hookResult: ReturnType<typeof useVoiceDictation> | undefined;

		function TestComponent() {
			hookResult = useVoiceDictation();
			return null;
		}

		render(<TestComponent />);

		expect(hookResult?.isRecording).toBe(false);
		expect(hookResult?.transcription).toBe("");
		expect(hookResult?.error).toBe(null);
	});

	it("updates transcription when handleTranscription is called", () => {
		let hookResult: ReturnType<typeof useVoiceDictation> | undefined;

		function TestComponent() {
			hookResult = useVoiceDictation();
			return null;
		}

		render(<TestComponent />);

		act(() => {
			hookResult?.handleTranscription("Hello world");
		});

		expect(hookResult?.transcription).toBe("Hello world");
	});

	it("clears transcription when clearTranscription is called", () => {
		let hookResult: ReturnType<typeof useVoiceDictation> | undefined;

		function TestComponent() {
			hookResult = useVoiceDictation();
			return null;
		}

		render(<TestComponent />);

		act(() => {
			hookResult?.handleTranscription("Hello world");
		});
		expect(hookResult?.transcription).toBe("Hello world");

		act(() => {
			hookResult?.clearTranscription();
		});
		expect(hookResult?.transcription).toBe("");
	});
});
