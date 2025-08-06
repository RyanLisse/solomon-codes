/**
 * Debug script to test VibeKit Server Action directly
 * This script examines the VibeKit configuration and dependencies
 */

// Since we can't directly import Server Actions, let's check the environment and configuration

async function debugVibeKitAction() {
	console.log("🔍 Testing VibeKit Server Action directly...");

	// Create a mock task
	const testTask = {
		id: "test-task-debug",
		title: "Create a simple JavaScript function that adds two numbers",
		mode: "code",
		repository: "SolomonCodes/main-solver-bot",
		branch: "main",
		status: "pending",
		createdAt: new Date(),
		description: "Create a simple JavaScript function that adds two numbers",
		sessionId: null,
	};

	const agentConfig = {
		type: "opencode",
		provider: "openai",
		model: "gpt-4",
		// Mock OpenAI API key for testing
		openaiApiKey: process.env.OPENAI_API_KEY,
	};

	try {
		console.log("📋 Test Task:", JSON.stringify(testTask, null, 2));
		console.log("⚙️  Agent Config:", JSON.stringify(agentConfig, null, 2));

		// Check environment variables first
		console.log("🔑 Environment Variables Check:");
		console.log(
			"  OPENAI_API_KEY:",
			process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Missing",
		);
		console.log(
			"  E2B_API_KEY:",
			process.env.E2B_API_KEY ? "✅ Set" : "❌ Missing",
		);
		console.log(
			"  GITHUB_CLIENT_ID:",
			process.env.GITHUB_CLIENT_ID ? "✅ Set" : "❌ Missing",
		);
		console.log(
			"  GITHUB_CLIENT_SECRET:",
			process.env.GITHUB_CLIENT_SECRET ? "✅ Set" : "❌ Missing",
		);
		console.log(
			"  BROWSERBASE_API_KEY:",
			process.env.BROWSERBASE_API_KEY ? "✅ Set" : "❌ Missing",
		);
		console.log(
			"  BROWSERBASE_PROJECT_ID:",
			process.env.BROWSERBASE_PROJECT_ID ? "✅ Set" : "❌ Missing",
		);

		console.log("\n🚀 Calling generateCodeAction...");

		const result = await generateCodeAction({
			task: testTask,
			prompt: testTask.title,
			useLocal: false,
			agentConfig,
		});

		console.log("✅ Success! Result:", JSON.stringify(result, null, 2));
	} catch (error) {
		console.error("❌ VibeKit Server Action failed:", error);
		console.error("❌ Error message:", error.message);
		console.error("❌ Error stack:", error.stack);

		// Try to extract more specific error information
		if (error.cause) {
			console.error("❌ Error cause:", error.cause);
		}

		if (error.details) {
			console.error("❌ Error details:", error.details);
		}
	}
}

async function main() {
	console.log("🚀 Starting VibeKit Server Action Debug...");
	await debugVibeKitAction();
	console.log("🏁 Debug session completed");
}

main().catch(console.error);
