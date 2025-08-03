/**
 * OpenAI Realtime API Proxy Route
 * Handles WebSocket connections and proxies to OpenAI Realtime API
 */

import { type NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
	return NextResponse.json({
		message: "OpenAI Realtime API proxy endpoint",
		note: "WebSocket connections should be handled client-side",
		endpoints: {
			WebSocket: "wss://api.openai.com/v1/realtime",
			Models: ["gpt-4o-realtime-preview-2024-12-17"],
			Authentication: "Bearer token required",
		},
		configuration: {
			modalities: ["text", "audio"],
			inputAudioFormat: "pcm16",
			outputAudioFormat: "pcm16",
			voiceActivityDetection: "server_vad",
		},
	});
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { action, sessionConfig } = body;

		if (action === "validate-config") {
			// Validate session configuration
			const isValid = validateSessionConfig(sessionConfig);

			return NextResponse.json({
				success: true,
				valid: isValid,
				config: sessionConfig,
			});
		}

		if (action === "get-auth-token") {
			// Return authentication information (without exposing the actual key)
			const hasApiKey = !!process.env.OPENAI_API_KEY;

			return NextResponse.json({
				success: true,
				hasApiKey,
				authMethod: "Bearer token",
				note: "Use NEXT_PUBLIC_OPENAI_API_KEY for client-side connections",
			});
		}

		return NextResponse.json({ error: "Unknown action" }, { status: 400 });
	} catch (error) {
		console.error("Realtime API proxy error:", error);
		return NextResponse.json(
			{
				error: "Realtime API proxy failed",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

interface SessionConfig {
	modalities: string[];
	voice: string;
	[key: string]: unknown;
}

/**
 * Validate session configuration for OpenAI Realtime API
 */
function validateSessionConfig(config: unknown): config is SessionConfig {
	if (!config || typeof config !== "object") return false;

	const requiredFields = ["modalities", "voice"];
	const validModalities = ["text", "audio"];
	const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

	// Type guard to ensure config is an object
	const configObj = config as Record<string, unknown>;

	// Check required fields
	for (const field of requiredFields) {
		if (!(field in configObj)) {
			return false;
		}
	}

	// Validate modalities
	if (!Array.isArray(configObj.modalities)) {
		return false;
	}

	for (const modality of configObj.modalities) {
		if (!validModalities.includes(modality)) {
			return false;
		}
	}

	// Validate voice
	if (
		typeof configObj.voice !== "string" ||
		!validVoices.includes(configObj.voice)
	) {
		return false;
	}

	return true;
}
