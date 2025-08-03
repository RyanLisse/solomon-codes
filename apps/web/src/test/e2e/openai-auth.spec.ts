import { expect, test } from "@playwright/test";

/**
 * OpenAI Authentication E2E Tests
 *
 * London School TDD approach:
 * - Tests API key validation and storage behavior
 * - Uses mock server to control OpenAI API responses
 * - Verifies interaction between UI and authentication system
 */

test.describe("OpenAI Authentication Flow", () => {
	test.beforeEach(async ({ page }) => {
		// Reset mock server state
		await page.request.post("http://localhost:3002/test/reset");

		// Navigate to settings page
		await page.goto("/settings");
		await expect(page).toHaveTitle(/Settings/);
	});

	test("should show disconnected state initially", async ({ page }) => {
		// Verify initial UI state shows OpenAI as disconnected
		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		await expect(openaiSection).toBeVisible();

		const statusIndicator = openaiSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Disconnected");

		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');
		await expect(apiKeyInput).toBeVisible();
		await expect(apiKeyInput).toBeEmpty();

		const validateButton = openaiSection.locator(
			'button:has-text("Validate Key")',
		);
		await expect(validateButton).toBeVisible();
		await expect(validateButton).toBeDisabled(); // Should be disabled when input is empty
	});

	test("should validate valid API key successfully", async ({ page }) => {
		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');
		const validateButton = openaiSection.locator(
			'button:has-text("Validate Key")',
		);

		// Enter valid API key (matches mock server configuration)
		await apiKeyInput.fill("sk-test-valid-key-123456789");

		// Button should become enabled
		await expect(validateButton).toBeEnabled();

		// Click validate
		await validateButton.click();

		// Should show loading state briefly
		await expect(validateButton).toContainText("Validating...");

		// Should update to connected state
		const statusIndicator = openaiSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Should show success message
		const successMessage = openaiSection.locator(
			'[data-testid="validation-success"]',
		);
		await expect(successMessage).toContainText(
			"API key validated successfully",
		);

		// Button should change to "Update Key"
		const updateButton = openaiSection.locator('button:has-text("Update Key")');
		await expect(updateButton).toBeVisible();

		// Should show disconnect option
		const disconnectButton = openaiSection.locator(
			'button:has-text("Disconnect")',
		);
		await expect(disconnectButton).toBeVisible();
	});

	test("should handle invalid API key gracefully", async ({ page }) => {
		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');
		const validateButton = openaiSection.locator(
			'button:has-text("Validate Key")',
		);

		// Enter invalid API key
		await apiKeyInput.fill("sk-invalid-key-123");
		await validateButton.click();

		// Should show error state
		const statusIndicator = openaiSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Invalid");

		// Should show error message
		const errorMessage = openaiSection.locator(
			'[data-testid="validation-error"]',
		);
		await expect(errorMessage).toContainText("Incorrect API key provided");

		// Should remain in disconnected state
		await expect(statusIndicator).toContainText("Disconnected");
	});

	test("should handle malformed API key", async ({ page }) => {
		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');
		const validateButton = openaiSection.locator(
			'button:has-text("Validate Key")',
		);

		// Enter malformed API key (doesn't start with sk-)
		await apiKeyInput.fill("invalid-format-key");
		await validateButton.click();

		// Should show validation error
		const errorMessage = openaiSection.locator(
			'[data-testid="validation-error"]',
		);
		await expect(errorMessage).toContainText("Invalid API key provided");

		const statusIndicator = openaiSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Invalid");
	});

	test("should update existing API key", async ({ page }) => {
		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');

		// First, validate initial key
		await apiKeyInput.fill("sk-test-valid-key-123456789");
		await page.locator('button:has-text("Validate Key")').click();

		// Wait for connected state
		const statusIndicator = openaiSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Add another valid key to mock server
		await page.request.post("http://localhost:3002/test/openai/add-valid-key", {
			data: { key: "sk-test-updated-key-987654321" },
		});

		// Update to new key
		await apiKeyInput.fill("sk-test-updated-key-987654321");
		const updateButton = openaiSection.locator('button:has-text("Update Key")');
		await updateButton.click();

		// Should validate new key and remain connected
		await expect(updateButton).toContainText("Validating...");
		await expect(statusIndicator).toContainText("Connected");

		// Should show success message for update
		const successMessage = openaiSection.locator(
			'[data-testid="validation-success"]',
		);
		await expect(successMessage).toContainText("API key updated successfully");
	});

	test("should disconnect and clear stored key", async ({ page }) => {
		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');

		// First connect
		await apiKeyInput.fill("sk-test-valid-key-123456789");
		await page.locator('button:has-text("Validate Key")').click();

		// Wait for connected state
		const statusIndicator = openaiSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Click disconnect
		const disconnectButton = openaiSection.locator(
			'button:has-text("Disconnect")',
		);
		await disconnectButton.click();

		// Should return to disconnected state
		await expect(statusIndicator).toContainText("Disconnected");

		// Input should be cleared
		await expect(apiKeyInput).toBeEmpty();

		// Should show validate button again
		const validateButton = openaiSection.locator(
			'button:has-text("Validate Key")',
		);
		await expect(validateButton).toBeVisible();
		await expect(validateButton).toBeDisabled(); // Disabled because input is empty
	});

	test("should persist API key across page reloads", async ({ page }) => {
		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');

		// Validate API key
		await apiKeyInput.fill("sk-test-valid-key-123456789");
		await page.locator('button:has-text("Validate Key")').click();

		// Wait for connected state
		const statusIndicator = openaiSection.locator(
			'[data-testid="auth-status"]',
		);
		await expect(statusIndicator).toContainText("Connected", {
			timeout: 10000,
		});

		// Reload page
		await page.reload();

		// Should restore connected state and key
		await expect(statusIndicator).toContainText("Connected");
		await expect(apiKeyInput).toHaveValue("sk-test-valid-key-123456789");

		// Should show update/disconnect buttons
		const updateButton = openaiSection.locator('button:has-text("Update Key")');
		const disconnectButton = openaiSection.locator(
			'button:has-text("Disconnect")',
		);
		await expect(updateButton).toBeVisible();
		await expect(disconnectButton).toBeVisible();
	});

	test("should validate empty input handling", async ({ page }) => {
		const openaiSection = page.locator('[data-testid="openai-auth-section"]');
		const apiKeyInput = openaiSection.locator('[data-testid="api-key-input"]');
		const validateButton = openaiSection.locator(
			'button:has-text("Validate Key")',
		);

		// Initially button should be disabled
		await expect(validateButton).toBeDisabled();

		// Type something then clear it
		await apiKeyInput.fill("sk-test");
		await expect(validateButton).toBeEnabled();

		await apiKeyInput.clear();
		await expect(validateButton).toBeDisabled();

		// Add whitespace-only input
		await apiKeyInput.fill("   ");
		await expect(validateButton).toBeDisabled(); // Should still be disabled for whitespace
	});

	test.afterEach(async ({ page }) => {
		// Verify mock server interactions
		const response = await page.request.get(
			"http://localhost:3002/test/interactions",
		);
		const interactions = await response.json();

		// Log interactions for debugging
		console.log(
			"OpenAI mock server interactions:",
			JSON.stringify(interactions, null, 2),
		);
	});
});
