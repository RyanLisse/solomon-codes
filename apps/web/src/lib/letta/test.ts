/**
 * Letta Integration Test
 * Tests the basic functionality of the Letta service
 */

import { createVoiceAgent, getLettaService } from "./index";

export async function testLettaIntegration(): Promise<void> {
	console.log("🧪 Testing Letta Integration...");

	try {
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

		// Test 4: Test memory management
		console.log("4. Testing memory management...");
		const memory = await lettaService.memory.getMemory(voiceAgent.id);
		console.log("✅ Agent memory blocks:", memory.length);
		memory.forEach((block) => {
			console.log(`   - ${block.label}: ${block.value.substring(0, 50)}...`);
		});

		// Test 5: List available tools
		console.log("5. Listing available tools...");
		const tools = await lettaService.client.tools.list();
		console.log("✅ Available tools:", tools.map((t) => t.name).join(", "));

		console.log("🎉 All Letta integration tests passed!");
	} catch (error) {
		console.error("❌ Letta integration test failed:", error);
		throw error;
	}
}

// Helper function to run tests in development
export async function runLettaTests(): Promise<boolean> {
	try {
		await testLettaIntegration();
		return true;
	} catch (error) {
		console.error("Letta tests failed:", error);
		return false;
	}
}
