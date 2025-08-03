import "../../../types/speech-recognition.d.ts";
import type {
	SpeechRecognitionResult,
	VoiceError,
	VoiceProcessingConfig,
} from "./types";

export class SpeechRecognitionService {
	private recognition: SpeechRecognition | null = null;
	private readonly supported: boolean;

	constructor() {
		this.supported =
			"webkitSpeechRecognition" in window || "SpeechRecognition" in window;
		this.initializeRecognition();
	}

	private initializeRecognition(): void {
		if (!this.supported) return;

		const SpeechRecognition =
			window.SpeechRecognition || window.webkitSpeechRecognition;

		if (!SpeechRecognition) {
			return;
		}

		try {
			this.recognition = new SpeechRecognition() as SpeechRecognition;

			if (this.recognition) {
				this.recognition.continuous = false;
				this.recognition.interimResults = true;
				this.recognition.lang = "en-US";
				this.recognition.maxAlternatives = 1;
			}
		} catch (_error) {
			this.recognition = null;
		}
	}

	isSupported(): boolean {
		return this.supported;
	}

	async startListening(): Promise<SpeechRecognitionResult> {
		return new Promise((resolve, reject) => {
			if (!this.recognition) {
				reject(new Error("Speech recognition not supported"));
				return;
			}

			let finalTranscript = "";
			let confidence = 0;

			this.recognition.onresult = (event: SpeechRecognitionEvent) => {
				let interimTranscript = "";

				for (let i = event.resultIndex; i < event.results.length; i++) {
					const transcript = event.results[i][0].transcript;
					confidence = event.results[i][0].confidence || 0;

					if (event.results[i].isFinal) {
						finalTranscript += transcript;
					} else {
						interimTranscript += transcript;
						// Emit interim results for real-time feedback
						this.onInterimResult?.(interimTranscript);
					}
				}
			};

			this.recognition.onend = () => {
				resolve({
					transcript: finalTranscript.trim(),
					confidence,
					isInterim: false,
					timestamp: new Date(),
				});
			};

			this.recognition.onerror = (event) => {
				reject(new Error(`Speech recognition error: ${event.error}`));
			};

			this.recognition.start();
		});
	}

	stopListening(): void {
		this.recognition?.stop();
	}

	abort(): void {
		this.recognition?.abort();
	}

	setLanguage(language: string): void {
		if (this.recognition) {
			this.recognition.lang = language;
		}
	}

	setContinuous(continuous: boolean): void {
		if (this.recognition) {
			this.recognition.continuous = continuous;
		}
	}

	setInterimResults(interimResults: boolean): void {
		if (this.recognition) {
			this.recognition.interimResults = interimResults;
		}
	}

	setMaxAlternatives(maxAlternatives: number): void {
		if (this.recognition) {
			this.recognition.maxAlternatives = maxAlternatives;
		}
	}

	configure(config: Partial<VoiceProcessingConfig>): void {
		if (!this.recognition) return;

		if (config.continuous !== undefined) {
			this.recognition.continuous = config.continuous;
		}

		if (config.interimResults !== undefined) {
			this.recognition.interimResults = config.interimResults;
		}

		if (config.maxAlternatives !== undefined) {
			this.recognition.maxAlternatives = config.maxAlternatives;
		}

		if (config.language !== undefined) {
			this.recognition.lang = config.language;
		}
	}

	// Callback for interim results
	onInterimResult?: (transcript: string) => void;

	// Callback for errors
	onError?: (error: VoiceError) => void;

	// Callback for start
	onStart?: () => void;

	// Callback for end
	onEnd?: () => void;
}
