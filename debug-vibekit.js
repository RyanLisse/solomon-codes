/**
 * Debug script to test VibeKit action directly
 */

async function testVibeKitDirectly() {
	console.log("🔍 Testing VibeKit integration directly...");

	try {
		// Simulate a fetch to the VibeKit action
		const response = await fetch("http://localhost:3001/api/vibekit/generate", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				task: {
					id: "test-task-1",
					title: "Create a simple JavaScript function that adds two numbers",
					mode: "code",
					repository: "SolomonCodes/main-solver-bot",
					branch: "main",
				},
				useLocal: false,
				agentConfig: {
					type: "opencode",
					provider: "openai",
					model: "gpt-4",
					openaiApiKey: process.env.OPENAI_API_KEY,
				},
			}),
		});

		console.log("📡 Response status:", response.status);
		console.log(
			"📡 Response headers:",
			Object.fromEntries(response.headers.entries()),
		);

		if (!response.ok) {
			console.log("❌ Response not OK");
			const errorText = await response.text();
			console.log("❌ Error response:", errorText);
			return;
		}

		const result = await response.json();
		console.log("✅ Success! Response:", result);
	} catch (error) {
		console.error("❌ Fetch error:", error);
	}
}

async function testConfigurationEndpoint() {
	console.log("🔧 Testing configuration endpoint...");

	try {
		const response = await fetch("http://localhost:3001/api/health/config");

		if (response.ok) {
			const config = await response.json();
			console.log("⚙️  Configuration status:", config);
		} else {
			console.log("⚙️  Config endpoint not available");
		}
	} catch (error) {
		console.error("⚙️  Config check error:", error.message);
	}
}

async function main() {
	console.log("🚀 Starting VibeKit Debug Session...");

	// Test configuration first
	await testConfigurationEndpoint();

	// Test VibeKit directly
	await testVibeKitDirectly();

	console.log("🏁 Debug session completed");
}

main().catch(console.error);
