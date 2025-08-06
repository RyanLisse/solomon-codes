/**
 * Direct test of VibeKit server action to debug the specific error
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");

// Load environment variables
require("dotenv").config({ path: "apps/web/.env" });

async function testVibeKitDirectly() {
	console.log("🔍 Direct VibeKit Server Action Debug Test");
	console.log("=".repeat(50));

	// Check environment variables
	console.log("\n🔧 Environment Check:");
	const requiredEnvs = [
		"OPENAI_API_KEY",
		"E2B_API_KEY",
		"GITHUB_CLIENT_ID",
		"GITHUB_CLIENT_SECRET",
		"BROWSERBASE_API_KEY",
	];

	for (const env of requiredEnvs) {
		const value = process.env[env];
		console.log(`  ${env}: ${value ? "✅ Set" : "❌ Missing"}`);
		if (value) {
			console.log(
				`    Length: ${value.length}, Pattern: ${value.substring(0, 10)}...`,
			);
		}
	}

	console.log("\n🔍 Checking VibeKit Dependencies:");
	try {
		// Check if VibeKit packages exist
		const packageJson = JSON.parse(
			fs.readFileSync("apps/web/package.json", "utf8"),
		);
		console.log("  Dependencies:");

		const vibekitPackages = Object.keys(packageJson.dependencies || {}).filter(
			(pkg) => pkg.includes("vibe") || pkg.includes("e2b"),
		);

		vibekitPackages.forEach((pkg) => {
			console.log(`    ${pkg}: ${packageJson.dependencies[pkg]}`);
		});

		if (vibekitPackages.length === 0) {
			console.log("    ❌ No VibeKit packages found in dependencies");
		}
	} catch (error) {
		console.log(`  ❌ Error reading package.json: ${error.message}`);
	}

	console.log("\n🔍 Secure Config Patterns:");
	try {
		// Test E2B API key pattern
		const e2bKey = process.env.E2B_API_KEY;
		if (e2bKey) {
			const pattern = /^e2b_[a-zA-Z0-9]{40}$/;
			const matches = pattern.test(e2bKey);
			console.log(
				`  E2B Key Pattern Test: ${matches ? "✅ Valid" : "❌ Invalid"}`,
			);
			console.log(
				`  E2B Key: ${e2bKey.substring(0, 10)}... (${e2bKey.length} chars)`,
			);
		}

		const openaiKey = process.env.OPENAI_API_KEY;
		if (openaiKey) {
			const pattern = /^sk-[a-zA-Z0-9]{48}$/;
			const matches = pattern.test(openaiKey);
			console.log(
				`  OpenAI Key Pattern Test: ${matches ? "✅ Valid" : "❌ Invalid"}`,
			);
			console.log(
				`  OpenAI Key: ${openaiKey.substring(0, 10)}... (${openaiKey.length} chars)`,
			);
		}
	} catch (error) {
		console.log(`  ❌ Error testing patterns: ${error.message}`);
	}

	console.log("\n🔧 Server Status:");
	try {
		const response = execSync(
			'curl -s -o /dev/null -w "%{http_code}" http://localhost:3001',
			{ encoding: "utf8", timeout: 5000 },
		);
		console.log(`  Server Response Code: ${response.trim()}`);

		if (response.trim() === "200") {
			console.log("  ✅ Server is running and responding");
		} else {
			console.log("  ⚠️ Server not responding with 200");
		}
	} catch (error) {
		console.log(`  ❌ Server connection error: ${error.message}`);
	}

	console.log("\n📝 Next Steps:");
	console.log("1. Ensure server is running with: bun dev");
	console.log("2. Check server logs for VibeKit errors");
	console.log("3. Try the functional test: node functional-test.js");
	console.log("4. Look for error logs in apps/web/server.log");
}

testVibeKitDirectly().catch(console.error);
