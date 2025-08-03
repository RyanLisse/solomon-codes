/**
 * Voice Transcription API Route
 * Handles speech-to-text conversion using OpenAI Whisper
 */

import { type NextRequest, NextResponse } from "next/server";
import { speechProcessingService } from "@/lib/voice/speech-processing";

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const audioFile = formData.get("audio") as File;
		const language = (formData.get("language") as string) || "en-US";
		const provider = (formData.get("provider") as string) || "auto";

		if (!audioFile) {
			return NextResponse.json(
				{ error: "No audio file provided" },
				{ status: 400 },
			);
		}

		// Convert file to ArrayBuffer
		const audioBuffer = await audioFile.arrayBuffer();

		// Process speech-to-text
		const result = await speechProcessingService.speechToText(audioBuffer, {
			language,
		});

		return NextResponse.json({
			success: true,
			transcript: result.text,
			confidence: result.confidence,
			isFinal: result.isFinal,
			timestamp: result.timestamp,
			provider: provider,
		});
	} catch (error) {
		console.error("Transcription error:", error);
		return NextResponse.json(
			{
				error: "Transcription failed",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

export async function GET() {
	return NextResponse.json({
		message: "Voice transcription endpoint",
		methods: ["POST"],
		parameters: {
			audio: "Audio file (required)",
			language: "Language code (optional, default: en-US)",
			provider: "Provider preference (optional, default: auto)",
		},
	});
}
