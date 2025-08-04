// Speech Recognition API types for browser compatibility

interface SpeechRecognitionEvent extends Event {
	readonly resultIndex: number;
	readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
	readonly error: string;
	readonly message: string;
}

interface SpeechRecognitionResult {
	readonly isFinal: boolean;
	readonly length: number;
	item(index: number): SpeechRecognitionAlternative;
	[index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
	readonly length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionAlternative {
	readonly transcript: string;
	readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	grammars: SpeechGrammarList;
	interimResults: boolean;
	lang: string;
	maxAlternatives: number;
	serviceURI: string;

	onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
	onend: ((this: SpeechRecognition, ev: Event) => void) | null;
	onerror:
		| ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
		| null;
	onresult:
		| ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
		| null;
	onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
	onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
	onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
	onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
	onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
	onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
	onnomatch:
		| ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
		| null;

	start(): void;
	stop(): void;
	abort(): void;
}

interface SpeechRecognitionConstructor {
	new (): SpeechRecognition;
}

interface SpeechGrammar {
	src: string;
	weight: number;
}

interface SpeechGrammarList {
	readonly length: number;
	item(index: number): SpeechGrammar;
	[index: number]: SpeechGrammar;
	addFromURI(src: string, weight?: number): void;
	addFromString(string: string, weight?: number): void;
}

interface SpeechGrammarListConstructor {
	new (): SpeechGrammarList;
}

declare global {
	interface Window {
		SpeechRecognition: SpeechRecognitionConstructor;
		webkitSpeechRecognition: SpeechRecognitionConstructor;
		SpeechGrammarList: SpeechGrammarListConstructor;
		webkitSpeechGrammarList: SpeechGrammarListConstructor;
	}
}

export {};
