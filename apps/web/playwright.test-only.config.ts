import { defineConfig, devices } from "@playwright/test";

/**
 * Minimal Playwright Configuration for Running Tests Only
 * (Assumes servers are already running)
 */
export default defineConfig({
	testDir: "./src/test/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,

	reporter: [
		["html", { open: "never" }],
		["json", { outputFile: "playwright-report/results.json" }],
		["line"],
	],

	use: {
		baseURL: "http://localhost:3001",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		extraHTTPHeaders: {
			"X-Test-Mode": "true",
		},
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// No webServer - assume they're already running
	// No global setup/teardown for now

	expect: {
		timeout: 10 * 1000,
	},
	timeout: 30 * 1000,
});
