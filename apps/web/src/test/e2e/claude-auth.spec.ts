import { expect, test } from "@playwright/test";

/**
 * Claude Authentication E2E Tests
 *
 * London School TDD approach:
 * - Tests interaction between UI components and authentication system
 * - Uses mock server to control OAuth flow responses
 * - Verifies behavior rather than implementation details
 */

test.describe("Claude Authentication Flow", () => {
	test.beforeEach(async ({ page }) => {
		// Reset mock server state before each test
		await page.request.post("http://localhost:3002/test/reset");

		// Navigate to settings page where Claude auth is configured
		await page.goto("/settings");
		await expect(page).toHaveTitle(/Settings/);
	});

	test("should show disconnected state initially", async ({ page }) => {
		// Verify initial UI state shows Claude as disconnected
		const claudeSection = page.locator('[data-testid="claude-auth-section"]');
		await expect(claudeSection).toBeVisible();

		const statusIndicator = claudeSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Disconnected");

		const connectButton = claudeSection.locator(
			'button:has-text("Connect Claude")',
		);
		await expect(connectButton).toBeVisible();
		await expect(connectButton).toBeEnabled();
	});

	test("should complete OAuth flow successfully", async ({ page, context }) => {
		// Click connect button to start OAuth flow
		const connectButton = page.locator('button:has-text("Connect Claude")');
		await connectButton.click();

		// OAuth should open in new tab/popup
		const [oauthPage] = await Promise.all([
			context.waitForEvent("page"),
			// The click above should trigger the OAuth flow
		]);

		// Verify we're on the mock OAuth authorization page
		await expect(oauthPage).toHaveURL(/localhost:3002\/oauth2\/authorize/);
		await expect(oauthPage.locator("h1")).toContainText(
			"Mock Claude Authorization",
		);

		// Click approve button on OAuth page
		await oauthPage.locator('button:has-text("Approve")').click();

		// Wait for redirect back to main app with auth code
		await page.waitForURL(/\/settings/);

		// Verify UI updates to show connected state
		const claudeSection = page.locator('[data-testid="claude-auth-section"]');
		const statusIndicator = claudeSection.locator(
			'[data-testid="auth-status"]',
		);

		// Should show connected state
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Connect button should change to disconnect
		const disconnectButton = claudeSection.locator(
			'button:has-text("Disconnect")',
		);
		await expect(disconnectButton).toBeVisible();

		// Verify user info is displayed
		const userInfo = claudeSection.locator('[data-testid="user-info"]');
		await expect(userInfo).toContainText("test-user@example.com");
	});

	test("should handle OAuth denial gracefully", async ({ page, context }) => {
		// Start OAuth flow
		const connectButton = page.locator('button:has-text("Connect Claude")');
		await connectButton.click();

		// Wait for OAuth page
		const [oauthPage] = await Promise.all([context.waitForEvent("page")]);

		// Click deny button instead of approve
		await oauthPage.locator('button:has-text("Deny")').click();

		// Should return to settings page
		await page.waitForURL(/\/settings/);

		// Verify error handling - should still show disconnected state
		const claudeSection = page.locator('[data-testid="claude-auth-section"]');
		const statusIndicator = claudeSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Disconnected");

		// Should show error message
		const errorMessage = page.locator('[data-testid="auth-error"]');
		await expect(errorMessage).toContainText("authorization denied");
	});

	test("should disconnect successfully", async ({ page, context }) => {
		// First connect (reuse the connect flow)
		const connectButton = page.locator('button:has-text("Connect Claude")');
		await connectButton.click();

		const [oauthPage] = await Promise.all([context.waitForEvent("page")]);

		await oauthPage.locator('button:has-text("Approve")').click();
		await page.waitForURL(/\/settings/);

		// Wait for connected state
		const claudeSection = page.locator('[data-testid="claude-auth-section"]');
		const statusIndicator = claudeSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Click disconnect
		const disconnectButton = claudeSection.locator(
			'button:has-text("Disconnect")',
		);
		await disconnectButton.click();

		// Verify return to disconnected state
		await expect(statusIndicator).toContainText("Disconnected");
		const newConnectButton = claudeSection.locator(
			'button:has-text("Connect Claude")',
		);
		await expect(newConnectButton).toBeVisible();

		// User info should be cleared
		const userInfo = claudeSection.locator('[data-testid="user-info"]');
		await expect(userInfo).not.toBeVisible();
	});

	test("should persist authentication across page reloads", async ({
		page,
		context,
	}) => {
		// Complete OAuth flow
		const connectButton = page.locator('button:has-text("Connect Claude")');
		await connectButton.click();

		const [oauthPage] = await Promise.all([context.waitForEvent("page")]);

		await oauthPage.locator('button:has-text("Approve")').click();
		await page.waitForURL(/\/settings/);

		// Wait for connected state
		const claudeSection = page.locator('[data-testid="claude-auth-section"]');
		const statusIndicator = claudeSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Reload the page
		await page.reload();

		// Should still show connected state after reload
		await expect(statusIndicator).toContainText("Connected");
		const disconnectButton = claudeSection.locator(
			'button:has-text("Disconnect")',
		);
		await expect(disconnectButton).toBeVisible();
	});

	test.afterEach(async ({ page }) => {
		// Verify mock server interactions
		const response = await page.request.get(
			"http://localhost:3002/test/interactions",
		);
		const interactions = await response.json();

		// Log interactions for debugging
		console.log(
			"Mock server interactions:",
			JSON.stringify(interactions, null, 2),
		);
	});
});
