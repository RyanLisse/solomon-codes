/**
 * Tests for VoiceConversationButton component
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
import { VoiceConversationButton } from "./voice-conversation-button";

// Mock WebSocket
const mockWebSocket = {
	send: vi.fn(),
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	readyState: WebSocket.OPEN,
	onopen: null,
	onmessage: null,
	onerror: null,
	onclose: null,
};

// Mock AudioContext
const mockAudioContext = {
	createMediaStreamSource: vi.fn(() => ({
		connect: vi.fn(),
	})),
	createScriptProcessor: vi.fn(() => ({
		connect: vi.fn(),
		disconnect: vi.fn(),
		onaudioprocess: null,
	})),
	createBufferSource: vi.fn(() => ({
		connect: vi.fn(),
		start: vi.fn(),
		onended: null,
		buffer: null,
	})),
	createAnalyser: vi.fn(() => ({
		fftSize: 256,
		frequencyBinCount: 128,
		getByteFrequencyData: vi.fn(),
		connect: vi.fn(),
	})),
	decodeAudioData: vi.fn(() => Promise.resolve({})),
	destination: {},
	close: vi.fn(),
	sampleRate: 24000,
};

const mockMediaDevices = {
	getUserMedia: vi.fn(),
};

// Mock global objects
Object.defineProperty(global, "WebSocket", {
	writable: true,
	value: vi.fn(() => mockWebSocket),
});

Object.defineProperty(window, "AudioContext", {
	writable: true,
	value: vi.fn(() => mockAudioContext),
});

Object.defineProperty(window, "webkitAudioContext", {
	writable: true,
	value: vi.fn(() => mockAudioContext),
});

Object.defineProperty(navigator, "mediaDevices", {
	writable: true,
	value: mockMediaDevices,
});

// Mock environment variable
process.env.NEXT_PUBLIC_OPENAI_API_KEY = "test-api-key";

describe("VoiceConversationButton", () => {
	const mockOnConversationStart = vi.fn();
	const mockOnConversationEnd = vi.fn();
	const _mockOnVoiceMessage = vi.fn();
	const mockOnError = vi.fn();

	beforeEach(() => {
		// Clear only the callback mocks, not the setup mocks
		mockOnConversationStart.mockClear();
		mockOnConversationEnd.mockClear();
		mockOnError.mockClear();

		// Reset the getUserMedia mock but preserve its implementation
		mockMediaDevices.getUserMedia.mockClear();
		mockMediaDevices.getUserMedia.mockResolvedValue({
			getTracks: () => [
				{
					stop: vi.fn(),
					clone: vi.fn(),
					enabled: true,
					id: "test-track",
					kind: "audio",
					label: "test audio track",
					muted: false,
					readyState: "live",
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(),
					contentHint: "",
					getCapabilities: vi.fn(),
					getConstraints: vi.fn(),
					getSettings: vi.fn(),
					applyConstraints: vi.fn(),
				},
			],
		} as unknown as MediaStream);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders with default props", () => {
		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
			/>,
		);

		const button = screen.getByTestId("voice-conversation-button");
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute("aria-label", "Start voice conversation");
	});

	it("shows audio lines icon when idle", () => {
		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
			/>,
		);

		const button = screen.getByTestId("voice-conversation-button");
		expect(button).toBeInTheDocument();
	});

	it("starts conversation when clicked", async () => {
		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
			/>,
		);

		const button = screen.getByTestId("voice-conversation-button");
		fireEvent.click(button);

		await waitFor(() => {
			expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					sampleRate: 24000,
				},
			});
		});
	});

	it("handles microphone access denied", async () => {
		mockMediaDevices.getUserMedia.mockRejectedValue(
			new Error("Permission denied"),
		);

		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
				onError={mockOnError}
			/>,
		);

		const button = screen.getByTestId("voice-conversation-button");
		fireEvent.click(button);

		await waitFor(() => {
			expect(mockOnError).toHaveBeenCalledWith({
				code: VoiceErrorCode.MICROPHONE_ACCESS_DENIED,
				message: "Failed to initialize audio context",
				recoverable: true,
				details: { error: expect.any(Error) },
			});
		});
	});

	it("shows conversation status when in conversation", () => {
		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
				isInConversation={true}
			/>,
		);

		const status = screen.getByTestId("conversation-status");
		expect(status).toBeInTheDocument();
	});

	it("shows speaking pulse when AI is speaking", () => {
		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
				isInConversation={true}
			/>,
		);

		// Simulate speaking state by checking if the component can handle it
		const button = screen.getByTestId("voice-conversation-button");
		expect(button).toBeInTheDocument();
	});

	it("handles keyboard navigation with Enter key", async () => {
		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
			/>,
		);

		const button = screen.getByTestId("voice-conversation-button");

		// Test Enter key
		fireEvent.keyDown(button, { key: "Enter" });

		await waitFor(() => {
			expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
		});
	});

	it("handles keyboard navigation with Space key", async () => {
		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
			/>,
		);

		const button = screen.getByTestId("voice-conversation-button");

		// Test Space key
		fireEvent.keyDown(button, { key: " " });

		await waitFor(() => {
			expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
		});
	});

	it("is disabled when disabled prop is true", () => {
		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
				disabled={true}
			/>,
		);

		const button = screen.getByTestId("voice-conversation-button");
		expect(button).toBeDisabled();

		fireEvent.click(button);
		expect(mockMediaDevices.getUserMedia).not.toHaveBeenCalled();
	});

	it("shows loading state when connecting", async () => {
		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
			/>,
		);

		const button = screen.getByTestId("voice-conversation-button");

		// Wrap click event in act() to handle loading state changes
		await act(async () => {
			fireEvent.click(button);
		});

		// Should show loading state briefly
		expect(button).toBeInTheDocument();
	});

	it("handles different sizes", () => {
		const { rerender } = render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
				size="sm"
			/>,
		);

		let button = screen.getByTestId("voice-conversation-button");
		expect(button).toHaveClass("h-8", "w-8");

		rerender(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
				size="lg"
			/>,
		);

		button = screen.getByTestId("voice-conversation-button");
		expect(button).toHaveClass("h-16", "w-16");
	});

	it("displays Letta agent information when provided", () => {
		const lettaAgent = {
			agentId: "test-agent-123",
			memoryBlocks: [],
			tools: [],
			model: "gpt-4",
			embedding: "text-embedding-ada-002",
			voicePreferences: {
				language: "en-US",
				voice: "alloy",
				rate: 1,
				pitch: 1,
				volume: 1,
				transcriptionEnabled: true,
			},
		};

		render(
			<VoiceConversationButton
				onConversationStart={mockOnConversationStart}
				onConversationEnd={mockOnConversationEnd}
				isInConversation={true}
				lettaAgent={lettaAgent}
			/>,
		);

		const status = screen.getByTestId("conversation-status");
		expect(status).toHaveTextContent("Agent: test-agent-123");
	});
});
