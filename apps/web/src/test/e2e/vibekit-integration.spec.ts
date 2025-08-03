import { expect, test } from "@playwright/test";

/**
 * VibeKit Integration E2E Tests
 *
 * London School TDD approach:
 * - Tests that VibeKit properly uses authenticated tokens
 * - Verifies agent selection works with different authentication states
 * - Tests end-to-end task execution with authenticated providers
 */

test.describe("VibeKit Authentication Integration", () => {
	test.beforeEach(async ({ page }) => {
		// Reset mock server state
		await page.request.post("http://localhost:3002/test/reset");

		// Navigate to main chat interface
		await page.goto("/");
		await expect(page).toHaveTitle(/Solomon Codes/);
	});

	test("should show authentication prompts for unauthenticated providers", async ({
		page,
	}) => {
		// Select Claude agent without authentication
		const agentSelector = page.locator('[data-testid="agent-selector"]');
		await agentSelector.click();

		const claudeOption = page.locator('[data-testid="agent-option-claude"]');
		await claudeOption.click();

		// Try to submit a task
		const taskInput = page.locator('[data-testid="task-input"]');
		const submitButton = page.locator('[data-testid="submit-task"]');

		await taskInput.fill("Hello, test task");
		await submitButton.click();

		// Should show authentication requirement
		const authPrompt = page.locator('[data-testid="auth-required-prompt"]');
		await expect(authPrompt).toContainText("Claude authentication required");

		// Should show link to settings
		const settingsLink = authPrompt.locator('a[href="/settings"]');
		await expect(settingsLink).toBeVisible();
	});

	test("should use Claude tokens when authenticated", async ({
		page,
		context,
	}) => {
		// First authenticate Claude via settings
		await page.goto("/settings");

		// Complete Claude OAuth flow
		const claudeSection = page.locator('[data-testid="claude-auth-section"]');
		const connectButton = claudeSection.locator(
			'button:has-text("Connect Claude")',
		);
		await connectButton.click();

		const [oauthPage] = await Promise.all([context.waitForEvent("page")]);

		await oauthPage.locator('button:has-text("Approve")').click();
		await page.waitForURL(/\/settings/);

		// Wait for connected state
		const statusIndicator = claudeSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Go back to main chat interface
		await page.goto("/");

		// Select Claude agent
		const agentSelector = page.locator('[data-testid="agent-selector"]');
		await agentSelector.click();

		const claudeOption = page.locator('[data-testid="agent-option-claude"]');
		await claudeOption.click();

		// Should show as authenticated
		const authStatus = page.locator('[data-testid="agent-auth-status"]');
		await expect(authStatus).toContainText("Authenticated");

		// Submit a task
		const taskInput = page.locator('[data-testid="task-input"]');
		const submitButton = page.locator('[data-testid="submit-task"]');

		await taskInput.fill("Test task with authenticated Claude");
		await submitButton.click();

		// Should proceed without auth prompts
		const taskProgress = page.locator('[data-testid="task-progress"]');
		await expect(taskProgress).toBeVisible();

		// Should not show authentication errors
		const authError = page.locator('[data-testid="auth-error"]');
		await expect(authError).not.toBeVisible();
	});

	test("should use OpenAI API key when provided", async ({ page }) => {
		// Navigate to settings and add OpenAI key
		await page.goto("/settings");

		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');
		const validateButton = openaiSection.locator(
			'button:has-text("Validate Key")',
		);

		await apiKeyInput.fill("sk-test-valid-key-123456789");
		await validateButton.click();

		// Wait for connected state
		const statusIndicator = openaiSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Go to main interface
		await page.goto("/");

		// Select OpenAI-based agent
		const agentSelector = page.locator('[data-testid="agent-selector"]');
		await agentSelector.click();

		const openaiOption = page.locator('[data-testid="agent-option-opencode"]');
		await openaiOption.click();

		// Should show authenticated status
		const authStatus = page.locator('[data-testid="agent-auth-status"]');
		await expect(authStatus).toContainText("Authenticated");

		// Submit task
		const taskInput = page.locator('[data-testid="task-input"]');
		const submitButton = page.locator('[data-testid="submit-task"]');

		await taskInput.fill("Test task with OpenAI authentication");
		await submitButton.click();

		// Should proceed without auth issues
		const taskProgress = page.locator('[data-testid="task-progress"]');
		await expect(taskProgress).toBeVisible();
	});

	test("should handle mixed authentication states correctly", async ({
		page,
		context,
	}) => {
		// Set up both Claude and OpenAI authentication
		await page.goto("/settings");

		// Authenticate Claude
		const claudeSection = page.locator('[data-testid="claude-auth-section"]');
		const claudeConnectButton = claudeSection.locator(
			'button:has-text("Connect Claude")',
		);
		await claudeConnectButton.click();

		const [oauthPage] = await Promise.all([context.waitForEvent("page")]);

		await oauthPage.locator('button:has-text("Approve")').click();
		await page.waitForURL(/\/settings/);

		// Authenticate OpenAI
		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');
		await apiKeyInput.fill("sk-test-valid-key-123456789");
		await page.locator('button:has-text("Validate Key")').click();

		// Wait for both to be connected
		const claudeStatus = claudeSection.locator('[data-testid="auth-status"]');
		const openaiStatus = openaiSection.locator('[data-testid="auth-status"]');
		await expect(claudeStatus).toContainText("Connected", { timeout: 10000 });
		await expect(openaiStatus).toContainText("Connected", { timeout: 10000 });

		// Go to main interface
		await page.goto("/");

		// Test Claude agent
		const agentSelector = page.locator('[data-testid="agent-selector"]');
		await agentSelector.click();
		await page.locator('[data-testid="agent-option-claude"]').click();

		let authStatus = page.locator('[data-testid="agent-auth-status"]');
		await expect(authStatus).toContainText("Authenticated");

		// Switch to OpenAI agent
		await agentSelector.click();
		await page.locator('[data-testid="agent-option-opencode"]').click();

		authStatus = page.locator('[data-testid="agent-auth-status"]');
		await expect(authStatus).toContainText("Authenticated");

		// Both should work without authentication prompts
		const taskInput = page.locator('[data-testid="task-input"]');
		await taskInput.fill("Test with multiple auth");

		const submitButton = page.locator('[data-testid="submit-task"]');
		await submitButton.click();

		const authError = page.locator('[data-testid="auth-error"]');
		await expect(authError).not.toBeVisible();
	});

	test("should gracefully handle authentication errors during task execution", async ({
		page,
	}) => {
		// Start with valid OpenAI authentication
		await page.goto("/settings");

		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');
		await apiKeyInput.fill("sk-test-valid-key-123456789");
		await page.locator('button:has-text("Validate Key")').click();

		// Wait for connected state
		const statusIndicator = openaiSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Go to main interface and start task
		await page.goto("/");

		const agentSelector = page.locator('[data-testid="agent-selector"]');
		await agentSelector.click();
		await page.locator('[data-testid="agent-option-opencode"]').click();

		// Now invalidate the key on the mock server (simulate expired/revoked key)
		await page.request.post("http://localhost:3002/test/reset");

		// Try to submit task with now-invalid key
		const taskInput = page.locator('[data-testid="task-input"]');
		const submitButton = page.locator('[data-testid="submit-task"]');

		await taskInput.fill("Test task with expired authentication");
		await submitButton.click();

		// Should show authentication error in task execution
		const taskError = page.locator('[data-testid="task-error"]');
		await expect(taskError).toContainText("Authentication failed");

		// Should suggest re-authentication
		const reauthSuggestion = page.locator('[data-testid="reauth-suggestion"]');
		await expect(reauthSuggestion).toContainText(
			"Please check your authentication settings",
		);
	});

	test("should show different auth states for different agent types", async ({
		page,
	}) => {
		// Go to main interface without any authentication
		await page.goto("/");

		const agentSelector = page.locator('[data-testid="agent-selector"]');

		// Check Claude agent - should show unauthenticated
		await agentSelector.click();
		await page.locator('[data-testid="agent-option-claude"]').click();

		let authStatus = page.locator('[data-testid="agent-auth-status"]');
		await expect(authStatus).toContainText("Not authenticated");

		// Check OpenAI agent - should also show unauthenticated
		await agentSelector.click();
		await page.locator('[data-testid="agent-option-opencode"]').click();

		authStatus = page.locator('[data-testid="agent-auth-status"]');
		await expect(authStatus).toContainText("Not authenticated");

		// Local agent should not require authentication
		await agentSelector.click();
		await page.locator('[data-testid="agent-option-local"]').click();

		authStatus = page.locator('[data-testid="agent-auth-status"]');
		await expect(authStatus).toContainText("Local execution");
	});

	test.afterEach(async ({ page }) => {
		// Log mock server interactions for debugging
		const response = await page.request.get(
			"http://localhost:3002/test/interactions",
		);
		const interactions = await response.json();
		console.log(
			"VibeKit integration interactions:",
			JSON.stringify(interactions, null, 2),
		);
	});
});
