/**
 * Simple Letta Integration Test Script
 * Run with: node test-letta.js
 */

// Mock environment variables for testing
process.env.LETTA_API_KEY = process.env.LETTA_API_KEY || "";
process.env.LETTA_BASE_URL =
	process.env.LETTA_BASE_URL || "https://api.letta.com";

async function testLettaIntegration() {
	console.log("🧪 Testing Letta Integration...");
	console.log("API Key available:", !!process.env.LETTA_API_KEY);
	console.log("Base URL:", process.env.LETTA_BASE_URL);

	try {
		// Import our Letta service (this will use CommonJS for now)
		const {
			getLettaService,
			createVoiceAgent,
		} = require("./src/lib/letta/index.ts");

		// Test 1: Initialize Letta service
		console.log("1. Initializing Letta service...");
		const lettaService = getLettaService();
		await lettaService.initialize();
		console.log("✅ Letta service initialized");

		// Test 2: Create a voice agent
		console.log("2. Creating voice agent...");
		const voiceAgent = await createVoiceAgent(lettaService.client, {
			name: "TestVoiceAgent",
			persona: "I am a test voice assistant for solomon_codes.",
			human: "This is a test user.",
		});
		console.log("✅ Voice agent created:", voiceAgent.id);

		// Test 3: Send a message to the agent
		console.log("3. Sending test message to agent...");
		const response = await lettaService.client.agents.messages.create(
			voiceAgent.id,
			{
				messages: [{ role: "user", content: "Hello, can you hear me?" }],
			},
		);
		console.log("✅ Agent response received:");

		for (const message of response.messages) {
			if (message.messageType === "assistant_message") {
				console.log("   Assistant:", message.content);
			} else if (message.messageType === "reasoning_message") {
				console.log("   Reasoning:", message.reasoning);
			}
		}

		console.log("🎉 All Letta integration tests passed!");
		return true;
	} catch (error) {
		console.error("❌ Letta integration test failed:", error);
		return false;
	}
}

// Run the test
testLettaIntegration()
	.then((success) => {
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error("Test execution failed:", error);
		process.exit(1);
	});
