/**
 * Global Teardown for E2E Authentication Tests
 *
 * London School TDD Global Teardown
 * - Collects final interaction logs for verification
 * - Cleans up test data and state
 * - Provides test execution summary
 */
import { chromium, type FullConfig } from "@playwright/test";

async function globalTeardown(_config: FullConfig) {
	console.log("🧹 Cleaning up E2E test environment...");

	const browser = await chromium.launch();
	const page = await browser.newPage();

	try {
		// Collect final interaction logs
		console.log("📊 Collecting final interaction logs...");
		try {
			const response = await page.request.get(
				"http://localhost:3002/test/interactions",
			);
			if (response.ok()) {
				const interactions = await response.json();
				console.log("📈 Test execution summary:");
				console.log(
					`  - Claude OAuth calls: ${interactions.claudeOAuth?.length || 0}`,
				);
				console.log(
					`  - OpenAI validation calls: ${interactions.openaiValidation?.length || 0}`,
				);
				console.log(`  - Tokens issued: ${interactions.tokensIssued || 0}`);
			}
		} catch (_error) {
			console.log(
				"⚠️ Could not collect interaction logs (mock server may be down)",
			);
		}

		// Final cleanup
		console.log("🔄 Final cleanup...");
		try {
			await page.request.post("http://localhost:3002/test/reset");
		} catch (_error) {
			// Mock server may already be down, ignore
		}

		console.log("✅ E2E environment cleanup complete");
	} finally {
		await browser.close();
	}
}

export default globalTeardown;
