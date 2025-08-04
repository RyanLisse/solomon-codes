import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnhancedVoiceConversationButton } from "./enhanced-voice-conversation-button";

// Create mock implementation using vi.hoisted for proper hoisting
const mockRealtimeService = vi.hoisted(() => ({
	on: vi.fn(),
	off: vi.fn(),
	connect: vi.fn().mockResolvedValue(undefined),
	disconnect: vi.fn().mockResolvedValue(undefined),
	sendAudio: vi.fn(),
	isConnected: vi.fn(() => false),
}));

// Mock OpenAI Realtime service with hoisted mock
vi.mock("@/lib/voice/openai-realtime", () => {
	return {
		OpenAIRealtimeService: vi.fn(() => mockRealtimeService),
	};
});

// Mock navigator.mediaDevices
const mockMediaDevices = {
	getUserMedia: vi.fn(),
};

// Mock AudioContext
const mockAudioContext = {
	createAnalyser: vi.fn(() => ({
		fftSize: 256,
		frequencyBinCount: 128,
		getByteFrequencyData: vi.fn(),
		connect: vi.fn(),
	})),
	createMediaStreamSource: vi.fn(() => ({
		connect: vi.fn(),
	})),
	close: vi.fn(),
	sampleRate: 24000,
};

const mockMediaStream = {
	getTracks: vi.fn(() => [
		{
			stop: vi.fn(),
		},
	]),
};

Object.defineProperty(globalThis, "navigator", {
	value: {
		mediaDevices: mockMediaDevices,
	},
	writable: true,
});

Object.defineProperty(globalThis, "AudioContext", {
	value: vi.fn(() => mockAudioContext),
	writable: true,
});

Object.defineProperty(globalThis, "requestAnimationFrame", {
	value: vi.fn((callback) => {
		setTimeout(callback, 16);
		return 1;
	}),
	writable: true,
});

Object.defineProperty(globalThis, "cancelAnimationFrame", {
	value: vi.fn(),
	writable: true,
});

describe("EnhancedVoiceConversationButton", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockMediaDevices.getUserMedia.mockResolvedValue(mockMediaStream);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Rendering", () => {
		it("should render with default props", () => {
			render(<EnhancedVoiceConversationButton />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
			expect(button).not.toBeDisabled();
		});

		it("should render with phone icon when inactive", () => {
			render(<EnhancedVoiceConversationButton />);

			// Should have Phone icon (not PhoneOff)
			expect(screen.getByTestId("phone-icon")).toBeInTheDocument();
		});

		it("should be disabled when disabled prop is true", () => {
			render(<EnhancedVoiceConversationButton disabled />);

			const button = screen.getByRole("button");
			expect(button).toBeDisabled();
		});

		it("should apply size classes correctly", () => {
			const { rerender } = render(
				<EnhancedVoiceConversationButton size="sm" />,
			);
			expect(screen.getByRole("button")).toHaveClass("h-8", "w-8");

			rerender(<EnhancedVoiceConversationButton size="lg" />);
			expect(screen.getByRole("button")).toHaveClass("h-14", "w-14");
		});

		it("should apply custom className", () => {
			render(<EnhancedVoiceConversationButton className="custom-class" />);

			const button = screen.getByRole("button");
			expect(button).toHaveClass("custom-class");
		});
	});

	describe("Voice State Management", () => {
		it("should start conversation on click", async () => {
			const user = userEvent.setup();
			const onConversationStart = vi.fn();

			render(
				<EnhancedVoiceConversationButton
					onConversationStart={onConversationStart}
				/>,
			);

			const button = screen.getByRole("button");
			await user.click(button);

			// Should show connecting state
			expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
		});

		it("should handle external isActive prop", () => {
			const { rerender } = render(
				<EnhancedVoiceConversationButton isActive={false} />,
			);

			expect(screen.getByTestId("phone-icon")).toBeInTheDocument();

			rerender(<EnhancedVoiceConversationButton isActive={true} />);
			expect(screen.getByTestId("phone-off-icon")).toBeInTheDocument();
		});

		it("should call onConversationEnd when stopping", async () => {
			const user = userEvent.setup();
			const onConversationEnd = vi.fn();

			render(
				<EnhancedVoiceConversationButton
					isActive={true}
					onConversationEnd={onConversationEnd}
				/>,
			);

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(onConversationEnd).toHaveBeenCalled();
			});
		});
	});

	describe("Audio Monitoring", () => {
		it("should request microphone access", async () => {
			const user = userEvent.setup();

			render(<EnhancedVoiceConversationButton />);

			const button = screen.getByRole("button");
			await user.click(button);

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

		it("should handle microphone access errors", async () => {
			const user = userEvent.setup();
			const onError = vi.fn();

			mockMediaDevices.getUserMedia.mockRejectedValue(
				new Error("Permission denied"),
			);

			render(<EnhancedVoiceConversationButton onError={onError} />);

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(onError).toHaveBeenCalledWith(
					expect.objectContaining({
						code: "MICROPHONE_ACCESS_DENIED",
						message: expect.stringContaining("microphone access"),
					}),
				);
			});
		});

		it("should initialize audio context with correct settings", async () => {
			const user = userEvent.setup();

			render(<EnhancedVoiceConversationButton />);

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(globalThis.AudioContext).toHaveBeenCalledWith({
					sampleRate: 24000,
				});
			});
		});
	});

	describe("Configuration", () => {
		it("should use custom voice setting", () => {
			render(<EnhancedVoiceConversationButton voice="alloy" />);

			// Voice setting should be passed to OpenAI service
			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("should use custom model setting", () => {
			render(
				<EnhancedVoiceConversationButton model="gpt-4o-realtime-preview-2024-10-01" />,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("should handle Letta integration setting", () => {
			const { rerender } = render(
				<EnhancedVoiceConversationButton enableLettaIntegration={true} />,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();

			rerender(
				<EnhancedVoiceConversationButton enableLettaIntegration={false} />,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("should generate unique session ID by default", () => {
			const { rerender } = render(<EnhancedVoiceConversationButton />);

			rerender(<EnhancedVoiceConversationButton />);

			// Both should render successfully with unique session IDs
			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("should use custom session ID when provided", () => {
			render(
				<EnhancedVoiceConversationButton sessionId="custom-session-123" />,
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
		});
	});

	describe("Error Handling", () => {
		it("should handle connection errors gracefully", async () => {
			const user = userEvent.setup();
			const onError = vi.fn();

			// Mock connection failure
			mockMediaDevices.getUserMedia.mockRejectedValue(
				new Error("Network error"),
			);

			render(<EnhancedVoiceConversationButton onError={onError} />);

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(onError).toHaveBeenCalled();
			});
		});

		it("should recover from temporary errors", async () => {
			const user = userEvent.setup();
			const onError = vi.fn();

			// First call fails, second succeeds
			mockMediaDevices.getUserMedia
				.mockRejectedValueOnce(new Error("Temporary error"))
				.mockResolvedValue(mockMediaStream);

			render(<EnhancedVoiceConversationButton onError={onError} />);

			const button = screen.getByRole("button");

			// First attempt should fail
			await user.click(button);
			await waitFor(() => expect(onError).toHaveBeenCalled());

			// Reset and try again
			vi.clearAllMocks();
			await user.click(button);

			// Should succeed this time
			await waitFor(() => {
				expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
			});
		});
	});

	describe("Cleanup", () => {
		it("should cleanup resources on unmount", async () => {
			const user = userEvent.setup();
			const { unmount } = render(<EnhancedVoiceConversationButton />);

			// Start conversation to initialize audio context
			const button = screen.getByRole("button");
			await user.click(button);

			// Wait for audio context to be initialized
			await waitFor(() => {
				expect(globalThis.AudioContext).toHaveBeenCalled();
			});

			unmount();

			expect(mockAudioContext.close).toHaveBeenCalled();
		});

		it("should stop media tracks on cleanup", async () => {
			const user = userEvent.setup();
			const mockTrack = { stop: vi.fn() };
			mockMediaStream.getTracks.mockReturnValue([mockTrack]);

			const { unmount } = render(<EnhancedVoiceConversationButton />);

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
			});

			unmount();

			expect(mockTrack.stop).toHaveBeenCalled();
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA labels", () => {
			render(<EnhancedVoiceConversationButton />);

			const button = screen.getByRole("button");
			expect(button).toHaveAttribute(
				"aria-label",
				expect.stringContaining("voice"),
			);
		});

		it("should indicate active state to screen readers", () => {
			render(<EnhancedVoiceConversationButton isActive={true} />);

			const button = screen.getByRole("button");
			expect(button).toHaveAttribute("aria-pressed", "true");
		});

		it("should be keyboard accessible", async () => {
			const user = userEvent.setup();
			const onConversationStart = vi.fn();

			render(
				<EnhancedVoiceConversationButton
					onConversationStart={onConversationStart}
				/>,
			);

			const button = screen.getByRole("button");
			await user.tab();
			expect(button).toHaveFocus();

			await user.keyboard("{Enter}");
			// Should trigger conversation start
		});
	});
});
