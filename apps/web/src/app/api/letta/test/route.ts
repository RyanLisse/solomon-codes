/**
 * Letta Integration Test API Route
 * Tests the Letta service integration
 */

import { type NextRequest, NextResponse } from "next/server";
import { testLettaIntegration } from "@/lib/letta/test";

export async function GET(_request: NextRequest) {
	try {
		console.log("🧪 Starting Letta integration test via API...");

		// Run the Letta integration test
		await testLettaIntegration();

		return NextResponse.json({
			success: true,
			message: "Letta integration test completed successfully",
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Letta integration test failed:", error);

		return NextResponse.json(
			{
				success: false,
				message: "Letta integration test failed",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { message = "Hello from API test" } = body;

		console.log("🧪 Testing Letta agent message via API...");

		const { getLettaService, createVoiceAgent } = await import("@/lib/letta");

		// Initialize service
		const lettaService = getLettaService();
		await lettaService.initialize();

		// Create or get a test agent
		const voiceAgent = await createVoiceAgent(lettaService.client, {
			name: "APITestAgent",
			persona: "I am a test voice assistant accessible via API.",
			human: "API test user.",
		});

		// Send message
		const response = await lettaService.client.agents.messages.create(
			voiceAgent.id,
			{
				messages: [{ role: "user", content: message }],
			},
		);

		// Extract assistant response
		const assistantMessage = response.messages.find(
			(msg) => msg.messageType === "assistant_message",
		);

		return NextResponse.json({
			success: true,
			agentId: voiceAgent.id,
			userMessage: message,
			agentResponse: assistantMessage?.content || "No response",
			usage: response.usage,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Letta API test failed:", error);

		return NextResponse.json(
			{
				success: false,
				message: "Letta API test failed",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}
