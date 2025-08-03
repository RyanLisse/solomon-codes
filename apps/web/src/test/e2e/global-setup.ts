/**
 * Global Setup for E2E Authentication Tests
 *
 * London School TDD Global Setup
 * - Initializes mock server state
 * - Configures environment for controlled testing
 * - Sets up interaction monitoring
 */
import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
	console.log("🔧 Setting up E2E test environment...");

	// Launch browser for setup tasks
	const browser = await chromium.launch();
	const page = await browser.newPage();

	try {
		// Wait for mock server to be ready
		console.log("⏳ Waiting for mock server...");
		let retries = 10;
		while (retries > 0) {
			try {
				const response = await page.goto("http://localhost:3002/health");
				if (response?.ok()) {
					console.log("✅ Mock server is ready");
					break;
				}
			} catch (_error) {
				retries--;
				if (retries === 0) {
					throw new Error("Mock server failed to start");
				}
				await page.waitForTimeout(1000);
			}
		}

		// Initialize mock server state
		console.log("🔄 Resetting mock server state...");
		await page.request.post("http://localhost:3002/test/reset");

		// Verify main application is running
		console.log("⏳ Waiting for main application...");
		retries = 20;
		while (retries > 0) {
			try {
				const response = await page.goto(
					"http://localhost:3001/api/health/test",
				);
				if (response?.ok()) {
					console.log("✅ Main application is ready");
					break;
				}
			} catch (_error) {
				retries--;
				if (retries === 0) {
					throw new Error("Main application failed to start");
				}
				await page.waitForTimeout(1000);
			}
		}

		console.log("🎯 E2E environment setup complete");
	} finally {
		await browser.close();
	}
}

export default globalSetup;
