import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for Authentication E2E Testing
 *
 * This configuration follows London School TDD principles:
 * - Focuses on interaction testing and behavior verification
 * - Uses mock servers to control external dependencies
 * - Tests the collaboration between authentication components
 */
export default defineConfig({
	testDir: "./src/test/e2e",

	/* Run tests in files in parallel */
	fullyParallel: true,

	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,

	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,

	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,

	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [
		["html", { open: "never" }],
		["json", { outputFile: "playwright-report/results.json" }],
		["line"],
	],

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: "http://localhost:3001",

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "on-first-retry",

		/* Take screenshot on failure */
		screenshot: "only-on-failure",

		/* Record video on failure */
		video: "retain-on-failure",

		/* Mock external APIs for controlled testing */
		extraHTTPHeaders: {
			"X-Test-Mode": "true",
		},
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},

		// Uncomment for cross-browser testing
		// {
		//   name: 'firefox',
		//   use: { ...devices['Desktop Firefox'] },
		// },
		// {
		//   name: 'webkit',
		//   use: { ...devices['Desktop Safari'] },
		// },
	],

	/* Run your local dev server before starting the tests */
	webServer: [
		{
			command: "npm run dev",
			url: "http://localhost:3001",
			reuseExistingServer: !process.env.CI,
			timeout: 120 * 1000,
		},
		{
			// Mock server for external API dependencies
			command: "node src/test/mocks/mock-server.js",
			url: "http://localhost:3002",
			reuseExistingServer: !process.env.CI,
			timeout: 60 * 1000,
		},
	],

	/* Global setup for mock infrastructure */
	globalSetup: "./src/test/e2e/global-setup.ts",
	globalTeardown: "./src/test/e2e/global-teardown.ts",

	/* Timeout settings */
	expect: {
		timeout: 10 * 1000,
	},
	timeout: 30 * 1000,
});
