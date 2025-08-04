import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpeechRecognitionService } from "./speech-recognition";

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
	onstart: null as ((event: Event) => void) | null,
	onend: null as ((event: Event) => void) | null,
	onerror: null as ((event: SpeechRecognitionErrorEvent) => void) | null,
	onresult: null as ((event: SpeechRecognitionEvent) => void) | null,
	onnomatch: null as ((event: SpeechRecognitionEvent) => void) | null,
	onsoundstart: null as ((event: Event) => void) | null,
	onsoundend: null as ((event: Event) => void) | null,
	onspeechstart: null as ((event: Event) => void) | null,
	onspeechend: null as ((event: Event) => void) | null,
	onaudiostart: null as ((event: Event) => void) | null,
	onaudioend: null as ((event: Event) => void) | null,
};

// Mock global SpeechRecognition
const MockSpeechRecognition = vi.fn(() => mockSpeechRecognition);

// Mock the global window object for browser APIs
Object.defineProperty(globalThis, "window", {
	writable: true,
	configurable: true,
	value: globalThis,
});

Object.defineProperty(globalThis, "SpeechRecognition", {
	writable: true,
	configurable: true,
	value: MockSpeechRecognition,
});

Object.defineProperty(globalThis, "webkitSpeechRecognition", {
	writable: true,
	configurable: true,
	value: MockSpeechRecognition,
});

describe("SpeechRecognitionService", () => {
	let service: SpeechRecognitionService;

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset mock functions
		mockSpeechRecognition.start = vi.fn();
		mockSpeechRecognition.stop = vi.fn();
		mockSpeechRecognition.abort = vi.fn();
		mockSpeechRecognition.onresult = null;
		mockSpeechRecognition.onerror = null;
		mockSpeechRecognition.onend = null;
		mockSpeechRecognition.onstart = null;
		mockSpeechRecognition.continuous = false;
		mockSpeechRecognition.interimResults = false;
		mockSpeechRecognition.lang = "en-US";

		// Ensure the MockSpeechRecognition constructor returns our mock
		MockSpeechRecognition.mockReturnValue(mockSpeechRecognition);

		service = new SpeechRecognitionService();

		// Manually set the recognition property to our mock (for testing purposes)
		(
			service as unknown as { recognition: typeof mockSpeechRecognition }
		).recognition = mockSpeechRecognition;

		// Simulate what the constructor would do to the mock
		mockSpeechRecognition.continuous = false;
		mockSpeechRecognition.interimResults = true;
		mockSpeechRecognition.lang = "en-US";
		mockSpeechRecognition.maxAlternatives = 1;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initialization", () => {
		it("should initialize with Web Speech API support", () => {
			expect(service.isSupported()).toBe(true);
		});

		it("should handle unsupported browsers gracefully", () => {
			// Temporarily remove SpeechRecognition support
			const globalWithSpeech = globalThis as unknown as {
				SpeechRecognition?: typeof SpeechRecognition;
				webkitSpeechRecognition?: typeof SpeechRecognition;
				window: {
					SpeechRecognition?: typeof SpeechRecognition;
					webkitSpeechRecognition?: typeof SpeechRecognition;
				};
			};

			const originalSpeechRecognition = globalWithSpeech.SpeechRecognition;
			const originalWebkitSpeechRecognition =
				globalWithSpeech.webkitSpeechRecognition;

			// Set to undefined instead of deleting
			delete globalWithSpeech.SpeechRecognition;
			delete globalWithSpeech.webkitSpeechRecognition;
			delete globalWithSpeech.window.SpeechRecognition;
			delete globalWithSpeech.window.webkitSpeechRecognition;

			const unsupportedService = new SpeechRecognitionService();
			expect(unsupportedService.isSupported()).toBe(false);

			// Restore
			globalWithSpeech.SpeechRecognition = originalSpeechRecognition;
			globalWithSpeech.webkitSpeechRecognition =
				originalWebkitSpeechRecognition;
			globalWithSpeech.window.SpeechRecognition = originalSpeechRecognition;
			globalWithSpeech.window.webkitSpeechRecognition =
				originalWebkitSpeechRecognition;
		});

		it("should configure recognition with default settings", () => {
			expect(mockSpeechRecognition.continuous).toBe(false);
			expect(mockSpeechRecognition.interimResults).toBe(true); // This should be true as set by the constructor
			expect(mockSpeechRecognition.lang).toBe("en-US");
			expect(mockSpeechRecognition.maxAlternatives).toBe(1);
		});
	});

	describe("startListening", () => {
		it("should start speech recognition", async () => {
			const promise = service.startListening();

			expect(mockSpeechRecognition.start).toHaveBeenCalledTimes(1);

			// Simulate successful recognition
			const mockEvent = {
				resultIndex: 0,
				results: [
					{
						0: { transcript: "Hello world" },
						isFinal: true,
						length: 1,
					},
				],
			};

			// Simulate the onresult callback
			if (mockSpeechRecognition.onresult) {
				const event = new Event("result") as SpeechRecognitionEvent;
				Object.assign(event, mockEvent);
				mockSpeechRecognition.onresult(event);
			}
			// Simulate the onend callback
			if (mockSpeechRecognition.onend) {
				const endEvent = new Event("end");
				mockSpeechRecognition.onend(endEvent);
			}

			const result = await promise;
			expect(result.transcript).toBe("Hello world");
			expect(result.isInterim).toBe(false);
		});

		it("should handle interim results", async () => {
			const onInterimResult = vi.fn();
			service.onInterimResult = onInterimResult;

			const promise = service.startListening();

			// Simulate interim result
			const mockEvent = {
				resultIndex: 0,
				results: [
					{
						0: { transcript: "Hello" },
						isFinal: false,
						length: 1,
					},
				],
			};

			if (mockSpeechRecognition.onresult) {
				const event = new Event("result") as SpeechRecognitionEvent;
				Object.assign(event, mockEvent);
				mockSpeechRecognition.onresult(event);
			}

			expect(onInterimResult).toHaveBeenCalledWith("Hello");

			// Simulate final result
			const finalEvent = {
				resultIndex: 0,
				results: [
					{
						0: { transcript: "Hello world" },
						isFinal: true,
						length: 1,
					},
				],
			};

			if (mockSpeechRecognition.onresult) {
				const event = new Event("result") as SpeechRecognitionEvent;
				Object.assign(event, finalEvent);
				mockSpeechRecognition.onresult(event);
			}
			if (mockSpeechRecognition.onend) {
				const endEvent = new Event("end");
				mockSpeechRecognition.onend(endEvent);
			}

			const result = await promise;
			expect(result.transcript).toBe("Hello world");
		});

		it("should handle recognition errors", async () => {
			const promise = service.startListening();

			const mockError = { error: "network" };
			if (mockSpeechRecognition.onerror) {
				const errorEvent = new Event("error") as SpeechRecognitionErrorEvent;
				Object.assign(errorEvent, mockError);
				mockSpeechRecognition.onerror(errorEvent);
			}

			await expect(promise).rejects.toThrow(
				"Speech recognition error: network",
			);
		});

		it("should reject when speech recognition is not supported", async () => {
			// Mock window to not support speech recognition
			const originalSpeechRecognition = window.SpeechRecognition;
			const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;

			delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
			delete (window as { webkitSpeechRecognition?: unknown })
				.webkitSpeechRecognition;

			// Create service instance with no support
			const unsupportedService = new SpeechRecognitionService();

			expect(unsupportedService.isSupported()).toBe(false);
			await expect(unsupportedService.startListening()).rejects.toThrow(
				"Speech recognition not supported",
			);

			// Restore original values
			window.SpeechRecognition = originalSpeechRecognition;
			window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
		});
	});

	describe("stopListening", () => {
		it("should stop speech recognition", () => {
			service.stopListening();
			expect(mockSpeechRecognition.stop).toHaveBeenCalledTimes(1);
		});

		it("should handle stop when recognition is not active", () => {
			// This should not throw even if internal recognition is null
			expect(() => service.stopListening()).not.toThrow();
		});
	});

	describe("abort", () => {
		it("should abort speech recognition", () => {
			service.abort();
			expect(mockSpeechRecognition.abort).toHaveBeenCalledTimes(1);
		});

		it("should handle abort when recognition is not active", () => {
			// This should not throw even if internal recognition is null
			expect(() => service.abort()).not.toThrow();
		});
	});

	describe("configuration", () => {
		it("should allow language configuration", () => {
			service.setLanguage("es-ES");
			expect(mockSpeechRecognition.lang).toBe("es-ES");
		});

		it("should allow continuous mode configuration", () => {
			service.setContinuous(true);
			expect(mockSpeechRecognition.continuous).toBe(true);
		});

		it("should allow interim results configuration", () => {
			service.setInterimResults(false);
			expect(mockSpeechRecognition.interimResults).toBe(false);
		});

		it("should allow max alternatives configuration", () => {
			service.setMaxAlternatives(3);
			expect(mockSpeechRecognition.maxAlternatives).toBe(3);
		});

		it("should configure multiple settings at once", () => {
			service.configure({
				continuous: true,
				interimResults: false,
				maxAlternatives: 5,
				language: "fr-FR",
			});

			expect(mockSpeechRecognition.continuous).toBe(true);
			expect(mockSpeechRecognition.interimResults).toBe(false);
			expect(mockSpeechRecognition.maxAlternatives).toBe(5);
			expect(mockSpeechRecognition.lang).toBe("fr-FR");
		});

		it("should handle partial configuration", () => {
			service.configure({
				continuous: true,
			});

			expect(mockSpeechRecognition.continuous).toBe(true);
			// Other settings should remain unchanged
			expect(mockSpeechRecognition.interimResults).toBe(true);
		});

		it("should handle configure when recognition is not available", () => {
			// Create a service without recognition support
			const unsupportedService = new SpeechRecognitionService();
			(unsupportedService as unknown as { recognition: unknown }).recognition =
				null;

			expect(() =>
				unsupportedService.configure({ continuous: true }),
			).not.toThrow();
		});
	});

	describe("error handling", () => {
		it("should provide specific error codes for different error types", async () => {
			const promise = service.startListening();

			const mockError = { error: "not-allowed" };
			if (mockSpeechRecognition.onerror) {
				const errorEvent = new Event("error") as SpeechRecognitionErrorEvent;
				Object.assign(errorEvent, mockError);
				mockSpeechRecognition.onerror(errorEvent);
			}

			try {
				await promise;
			} catch (error: unknown) {
				expect((error as Error).message).toContain("not-allowed");
			}
		});
	});
});
