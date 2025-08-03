import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MicrophoneButton } from "./microphone-button";
import { VoiceState } from "./types";

// Mock Web Speech API
const mockSpeechRecognition = {
	start: vi.fn(),
	stop: vi.fn(),
	abort: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	continuous: false,
	interimResults: false,
	lang: "en-US",
	maxAlternatives: 1,
	serviceURI: "",
	grammars: null,
	onstart: null,
	onend: null,
	onerror: null,
	onresult: null,
	onnomatch: null,
	onsoundstart: null,
	onsoundend: null,
	onspeechstart: null,
	onspeechend: null,
	onaudiostart: null,
	onaudioend: null,
};

// Mock the global window object for browser APIs
Object.defineProperty(globalThis, "window", {
	writable: true,
	configurable: true,
	value: globalThis,
});

// Mock global SpeechRecognition
Object.defineProperty(globalThis, "SpeechRecognition", {
	writable: true,
	configurable: true,
	value: vi.fn(() => mockSpeechRecognition),
});

Object.defineProperty(globalThis, "webkitSpeechRecognition", {
	writable: true,
	configurable: true,
	value: vi.fn(() => mockSpeechRecognition),
});

describe("MicrophoneButton", () => {
	const mockProps = {
		onStartRecording: vi.fn(),
		onStopRecording: vi.fn(),
		onTranscription: vi.fn(),
		onError: vi.fn(),
		isRecording: false,
		isProcessing: false,
		isDisabled: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should render microphone button in idle state", () => {
		render(<MicrophoneButton {...mockProps} />);

		const button = screen.getByRole("button", {
			name: /start voice recording/i,
		});
		expect(button).toBeInTheDocument();
		expect(button).not.toBeDisabled();
		expect(button).toHaveAttribute("aria-label", "Start voice recording");
	});

	it("should show recording state when isRecording is true", () => {
		render(<MicrophoneButton {...mockProps} isRecording={true} />);

		const button = screen.getByRole("button", {
			name: /stop voice recording/i,
		});
		expect(button).toHaveAttribute("aria-label", "Stop voice recording");
		expect(button).toHaveClass("recording");
	});

	it("should show processing state when isProcessing is true", () => {
		render(<MicrophoneButton {...mockProps} isProcessing={true} />);

		const button = screen.getByRole("button");
		expect(button).toBeDisabled();
		expect(button).toHaveAttribute("aria-label", "Processing speech...");
		expect(button).toHaveClass("processing");
	});

	it("should be disabled when isDisabled is true", () => {
		render(<MicrophoneButton {...mockProps} isDisabled={true} />);

		const button = screen.getByRole("button");
		expect(button).toBeDisabled();
	});

	it("should call onStartRecording when clicked in idle state", async () => {
		render(<MicrophoneButton {...mockProps} />);

		const button = screen.getByRole("button");
		fireEvent.click(button);

		await waitFor(() => {
			expect(mockProps.onStartRecording).toHaveBeenCalledTimes(1);
		});
	});

	it("should call onStopRecording when clicked in recording state", async () => {
		render(<MicrophoneButton {...mockProps} isRecording={true} />);

		const button = screen.getByRole("button");
		fireEvent.click(button);

		await waitFor(() => {
			expect(mockProps.onStopRecording).toHaveBeenCalledTimes(1);
		});
	});

	it("should handle keyboard navigation", () => {
		render(<MicrophoneButton {...mockProps} />);

		const button = screen.getByRole("button");
		button.focus();

		expect(button).toHaveFocus();

		fireEvent.keyDown(button, { key: "Enter" });
		expect(mockProps.onStartRecording).toHaveBeenCalledTimes(1);

		fireEvent.keyDown(button, { key: " " });
		expect(mockProps.onStartRecording).toHaveBeenCalledTimes(2);
	});

	it("should show visual feedback with pulsing animation when recording", () => {
		render(<MicrophoneButton {...mockProps} isRecording={true} />);

		const button = screen.getByRole("button");
		expect(button).toHaveClass("animate-pulse");

		const pulseIndicator = screen.getByTestId("pulse-indicator");
		expect(pulseIndicator).toBeInTheDocument();
		expect(pulseIndicator).toHaveClass("animate-ping");
	});

	it("should handle different sizes", () => {
		const { rerender } = render(<MicrophoneButton {...mockProps} size="sm" />);
		expect(screen.getByRole("button")).toHaveClass("h-8", "w-8");

		rerender(<MicrophoneButton {...mockProps} size="lg" />);
		expect(screen.getByRole("button")).toHaveClass("h-12", "w-12");
	});

	it("should apply custom className", () => {
		render(<MicrophoneButton {...mockProps} className="custom-class" />);

		const button = screen.getByRole("button");
		expect(button).toHaveClass("custom-class");
	});

	it("should handle error state", () => {
		render(<MicrophoneButton {...mockProps} voiceState={VoiceState.ERROR} />);

		const button = screen.getByRole("button");
		expect(button).toHaveClass("error");
		expect(button).toHaveAttribute("aria-label", "Voice recording error");
	});
});
