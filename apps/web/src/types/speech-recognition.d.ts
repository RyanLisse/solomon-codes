/**
 * Web Speech API Type Declarations
 * Provides TypeScript definitions for the Speech Recognition API
 */

declare global {
	interface Window {
		SpeechRecognition: typeof SpeechRecognition;
		webkitSpeechRecognition: typeof SpeechRecognition;
	}

	interface SpeechRecognition extends EventTarget {
		continuous: boolean;
		grammars: SpeechGrammarList;
		interimResults: boolean;
		lang: string;
		maxAlternatives: number;
		serviceURI: string;

		// Event handlers
		onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
		onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
		onend: ((this: SpeechRecognition, ev: Event) => void) | null;
		onerror:
			| ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
			| null;
		onnomatch:
			| ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
			| null;
		onresult:
			| ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
			| null;
		onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
		onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
		onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
		onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
		onstart: ((this: SpeechRecognition, ev: Event) => void) | null;

		// Methods
		abort(): void;
		start(): void;
		stop(): void;

		addEventListener<K extends keyof SpeechRecognitionEventMap>(
			type: K,
			listener: (
				this: SpeechRecognition,
				ev: SpeechRecognitionEventMap[K],
			) => void,
			options?: boolean | AddEventListenerOptions,
		): void;
		removeEventListener<K extends keyof SpeechRecognitionEventMap>(
			type: K,
			listener: (
				this: SpeechRecognition,
				ev: SpeechRecognitionEventMap[K],
			) => void,
			options?: boolean | EventListenerOptions,
		): void;
	}

	interface SpeechRecognitionEventMap {
		audioend: Event;
		audiostart: Event;
		end: Event;
		error: SpeechRecognitionErrorEvent;
		nomatch: SpeechRecognitionEvent;
		result: SpeechRecognitionEvent;
		soundend: Event;
		soundstart: Event;
		speechend: Event;
		speechstart: Event;
		start: Event;
	}

	const SpeechRecognition: {
		prototype: SpeechRecognition;
		new (): SpeechRecognition;
	};

	interface SpeechRecognitionEvent extends Event {
		readonly resultIndex: number;
		readonly results: SpeechRecognitionResultList;
	}

	interface SpeechRecognitionErrorEvent extends Event {
		readonly error: SpeechRecognitionErrorCode;
		readonly message: string;
	}

	type SpeechRecognitionErrorCode =
		| "no-speech"
		| "aborted"
		| "audio-capture"
		| "network"
		| "not-allowed"
		| "service-not-allowed"
		| "bad-grammar"
		| "language-not-supported";

	interface SpeechRecognitionResultList {
		readonly length: number;
		item(index: number): SpeechRecognitionResult;
		[index: number]: SpeechRecognitionResult;
	}

	interface SpeechRecognitionResult {
		readonly isFinal: boolean;
		readonly length: number;
		item(index: number): SpeechRecognitionAlternative;
		[index: number]: SpeechRecognitionAlternative;
	}

	interface SpeechRecognitionAlternative {
		readonly confidence: number;
		readonly transcript: string;
	}

	interface SpeechGrammarList {
		readonly length: number;
		addFromString(string: string, weight?: number): void;
		addFromURI(src: string, weight?: number): void;
		item(index: number): SpeechGrammar;
		[index: number]: SpeechGrammar;
	}

	interface SpeechGrammar {
		src: string;
		weight: number;
	}

	const SpeechGrammarList: {
		prototype: SpeechGrammarList;
		new (): SpeechGrammarList;
	};

	const SpeechGrammar: {
		prototype: SpeechGrammar;
		new (): SpeechGrammar;
	};
}

export {};
