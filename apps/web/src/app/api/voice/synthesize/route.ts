/**
 * Voice Synthesis API Route
 * Handles text-to-speech conversion using multiple providers
 */

import { type NextRequest, NextResponse } from "next/server";
import { GeminiTTSService } from "@/lib/voice/gemini-tts";
import { speechProcessingService } from "@/lib/voice/speech-processing";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const {
			text,
			voice = "coral",
			language = "en-US",
			rate = 1.0,
			pitch = 1.0,
			volume = 1.0,
			provider = "openai",
			style,
			emotion,
		} = body;

		if (!text) {
			return NextResponse.json({ error: "No text provided" }, { status: 400 });
		}

		let audioData: ArrayBuffer;
		let format: string;

		if (provider === "gemini" && process.env.GOOGLE_AI_API_KEY) {
			// Use Gemini TTS for advanced style control
			const geminiTTS = new GeminiTTSService(process.env.GOOGLE_AI_API_KEY);

			const result = await geminiTTS.generateSpeechWithStyle(text, {
				voiceName: voice,
				style,
				emotion,
			});

			audioData = result.audioData;
			format = result.format;
		} else {
			// Use standard speech processing service (OpenAI or Web Speech)
			const result = await speechProcessingService.textToSpeech(text, {
				voice,
				language,
				rate,
				pitch,
				volume,
			});

			audioData = result.audioData;
			format = result.format;
		}

		// Convert ArrayBuffer to base64 for JSON response
		const base64Audio = Buffer.from(audioData).toString("base64");

		return NextResponse.json({
			success: true,
			audioData: base64Audio,
			format,
			provider,
			metadata: {
				text,
				voice,
				language,
				style,
				emotion,
			},
		});
	} catch (error) {
		console.error("Speech synthesis error:", error);
		return NextResponse.json(
			{
				error: "Speech synthesis failed",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

export async function GET() {
	return NextResponse.json({
		message: "Voice synthesis endpoint",
		methods: ["POST"],
		parameters: {
			text: "Text to synthesize (required)",
			voice: "Voice name (optional, default: coral)",
			language: "Language code (optional, default: en-US)",
			rate: "Speech rate (optional, default: 1.0)",
			pitch: "Speech pitch (optional, default: 1.0)",
			volume: "Speech volume (optional, default: 1.0)",
			provider: "Provider (openai, gemini, webspeech, default: openai)",
			style: "Speech style for Gemini (optional)",
			emotion: "Speech emotion for Gemini (optional)",
		},
		providers: {
			openai: "OpenAI TTS with high quality voices",
			gemini: "Google Gemini TTS with style control",
			webspeech: "Browser Web Speech API",
		},
	});
}
