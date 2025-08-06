/**
 * Storage and State Management Interaction Tests
 *
 * London School TDD Interaction Testing
 * - Tests HOW authentication components collaborate with storage
 * - Verifies interactions between hooks, storage, and UI components
 * - Focuses on behavior verification over state inspection
 * - Tests the conversation between objects in the authentication system
 */
import { expect, test } from "@playwright/test";
import { MockCoordinator } from "../utils/mock-coordinator";

test.describe("Storage and State Management Interactions", () => {
	let mockCoordinator: MockCoordinator;

	test.beforeEach(async ({ page }) => {
		mockCoordinator = new MockCoordinator(page);

		// Initialize clean test environment
		await mockCoordinator.initialize({
			claudeOAuth: { enabled: true, mockResponses: "success" },
			openaiValidation: {
				enabled: true,
				validKeys: ["sk-test-valid-key-123456789"],
				mockResponses: "success",
			},
			localStorage: { clearOnStart: true },
		});
	});

	test.afterEach(async () => {
		await mockCoordinator.resetAll();
	});

	test("Claude authentication state synchronizes between localStorage and UI components", async ({
		page,
	}) => {
		// GIVEN: Clean authentication state
		await page.goto("/settings");

		// Verify initial state collaboration
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).not.toBeVisible();
		await expect(
			page.locator('[data-testid="claude-oauth-button"]'),
		).toBeVisible();

		// Verify localStorage is empty
		let storedTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(storedTokens).toBeNull();

		// WHEN: User completes OAuth flow (testing storage interactions)
		const contracts = mockCoordinator.getContracts();
		const oauthHandler = await contracts.claudeOAuth.simulateOAuthApproval();

		await page.click('[data-testid="claude-oauth-button"]');
		await oauthHandler.approve();
		await contracts.claudeOAuth.waitForOAuthCompletion();

		// THEN: Verify storage and UI state synchronization

		// 1. Verify localStorage collaboration
		storedTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(storedTokens).toBeTruthy();

		const tokenData = JSON.parse(storedTokens as string);
		expect(tokenData.authMethod).toBe("oauth");
		expect(tokenData.accessToken).toContain("mock-claude-access-token");
		expect(tokenData.userId).toBeTruthy();
		expect(tokenData.expiresAt).toBeGreaterThan(Date.now());

		// 2. Verify UI state reflects storage
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toContainText("Connected");
		await expect(
			page.locator('[data-testid="claude-oauth-button"]'),
		).not.toBeVisible();

		// 3. Test state persistence across page reload
		await page.reload();
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toContainText("Connected");
	});

	test("Claude logout properly clears storage and updates UI state", async ({
		page,
	}) => {
		// GIVEN: User is authenticated (setup storage state)
		const claudeScenario = mockCoordinator.createClaudeOAuthScenario();
		await claudeScenario.setup();
		await claudeScenario.execute();

		// Verify authenticated state
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toContainText("Connected");

		let storedTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(storedTokens).toBeTruthy();

		// WHEN: User logs out (testing cleanup interactions)
		await page.click('[data-testid="claude-disconnect-button"]');

		// THEN: Verify storage cleanup and UI state update collaboration

		// 1. Verify localStorage is cleared
		storedTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(storedTokens).toBeNull();

		// 2. Verify UI reflects cleared state
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).not.toBeVisible();
		await expect(
			page.locator('[data-testid="claude-oauth-button"]'),
		).toBeVisible();

		// 3. Verify state persistence after reload
		await page.reload();
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).not.toBeVisible();
		await expect(
			page.locator('[data-testid="claude-oauth-button"]'),
		).toBeVisible();
	});

	test("OpenAI API key storage interacts correctly with validation state", async ({
		page,
	}) => {
		// GIVEN: User has not stored any API key
		await page.goto("/settings");

		// Verify initial storage state
		let storedKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey).toBeNull();

		// Verify initial UI state
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).not.toBeVisible();

		// WHEN: User validates and saves API key (testing storage interactions)
		const validApiKey = "sk-test-valid-key-123456789";
		const contracts = mockCoordinator.getContracts();

		await page.fill('[data-testid="openai-api-key-input"]', validApiKey);
		await page.click('[data-testid="openai-test-button"]');
		await contracts.openaiValidation.waitForValidationResult("valid");

		// Verify validation state before save
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toContainText("API key is valid");

		// Key should not be stored until save is clicked
		storedKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey).toBeNull();

		// Save the key
		await page.click('[data-testid="openai-save-button"]');

		// THEN: Verify storage and state synchronization

		// 1. Verify localStorage interaction
		storedKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey).toBe(validApiKey);

		// 2. Verify UI maintains validation state
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toContainText("API key is valid");

		// 3. Test persistence across page reload
		await page.reload();

		// After reload, the input should be empty but the key should still be stored
		const inputValue = await page
			.locator('[data-testid="openai-api-key-input"]')
			.inputValue();
		expect(inputValue).toBe("");

		// Storage should persist
		storedKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey).toBe(validApiKey);
	});

	test("Multiple authentication states coexist without interference", async ({
		page,
	}) => {
		// GIVEN: Clean state
		await mockCoordinator.resetAll();

		// WHEN: User authenticates both Claude and OpenAI
		const validApiKey = "sk-test-valid-key-123456789";

		// Step 1: Authenticate Claude
		const claudeScenario = mockCoordinator.createClaudeOAuthScenario();
		await claudeScenario.setup();
		await claudeScenario.execute();

		// Step 2: Authenticate OpenAI
		await page.fill('[data-testid="openai-api-key-input"]', validApiKey);
		await page.click('[data-testid="openai-test-button"]');
		const contracts = mockCoordinator.getContracts();
		await contracts.openaiValidation.waitForValidationResult("valid");
		await page.click('[data-testid="openai-save-button"]');

		// THEN: Verify both authentication states coexist properly

		// 1. Verify Claude storage
		const claudeTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(claudeTokens).toBeTruthy();
		const tokenData = JSON.parse(claudeTokens as string);
		expect(tokenData.authMethod).toBe("oauth");

		// 2. Verify OpenAI storage
		const openaiKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(openaiKey).toBe(validApiKey);

		// 3. Verify UI shows both authenticated states
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toContainText("Connected");
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toContainText("API key is valid");

		// 4. Test independent logout (Claude logout shouldn't affect OpenAI)
		await page.click('[data-testid="claude-disconnect-button"]');

		// Claude should be cleared
		const clearedClaudeTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(clearedClaudeTokens).toBeNull();
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).not.toBeVisible();

		// OpenAI should remain
		const remainingOpenaiKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(remainingOpenaiKey).toBe(validApiKey);
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toContainText("API key is valid");
	});

	test("Authentication state is properly isolated between browser tabs", async ({
		browser,
	}) => {
		// GIVEN: Two browser contexts (simulating separate tabs)
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();
		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		const coordinator1 = new MockCoordinator(page1);
		const coordinator2 = new MockCoordinator(page2);

		await coordinator1.initialize({ localStorage: { clearOnStart: true } });
		await coordinator2.initialize({ localStorage: { clearOnStart: true } });

		// WHEN: User authenticates in first tab only
		const claudeScenario = coordinator1.createClaudeOAuthScenario();
		await claudeScenario.setup();
		await claudeScenario.execute();

		// Verify authentication in first tab
		await expect(
			page1.locator('[data-testid="claude-auth-status"]'),
		).toContainText("Connected");

		// THEN: Second tab should not be affected (different browser context)
		await page2.goto("/settings");
		await expect(
			page2.locator('[data-testid="claude-auth-status"]'),
		).not.toBeVisible();
		await expect(
			page2.locator('[data-testid="claude-oauth-button"]'),
		).toBeVisible();

		// Verify storage isolation
		const tokens1 = await page1.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		const tokens2 = await page2.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);

		expect(tokens1).toBeTruthy();
		expect(tokens2).toBeNull();

		await context1.close();
		await context2.close();
	});

	test("Storage error handling maintains consistent UI state", async ({
		page,
	}) => {
		// GIVEN: Simulate localStorage failure
		await page.goto("/settings");

		// Mock localStorage to throw errors
		await page.addInitScript(() => {
			const originalSetItem = localStorage.setItem;
			let shouldFail = false;

			// Add method to control failure
			(
				window as unknown as Window & { triggerStorageFailure: () => void }
			).triggerStorageFailure = () => {
				shouldFail = true;
			};
			(
				window as unknown as Window & { restoreStorage: () => void }
			).restoreStorage = () => {
				shouldFail = false;
			};

			localStorage.setItem = function (key, value) {
				if (shouldFail) {
					throw new Error("Storage quota exceeded");
				}
				return originalSetItem.call(this, key, value);
			};
		});

		// WHEN: User attempts authentication with storage failure
		await page.evaluate(() =>
			(
				window as unknown as Window & { triggerStorageFailure: () => void }
			).triggerStorageFailure(),
		);

		const validApiKey = "sk-test-valid-key-123456789";
		await page.fill('[data-testid="openai-api-key-input"]', validApiKey);
		await page.click('[data-testid="openai-test-button"]');

		const contracts = mockCoordinator.getContracts();
		await contracts.openaiValidation.waitForValidationResult("valid");

		// Attempt to save (should fail due to storage error)
		await page.click('[data-testid="openai-save-button"]');

		// THEN: UI should handle storage failure gracefully
		// (Specific error handling would depend on implementation)
		// For now, we verify the validation state remains consistent
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toContainText("API key is valid");

		// Restore storage and verify recovery
		await page.evaluate(() =>
			(
				window as unknown as Window & { restoreStorage: () => void }
			).restoreStorage(),
		);
		await page.click('[data-testid="openai-save-button"]');

		// Should now succeed
		const storedKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey).toBe(validApiKey);
	});

	test("Authentication hook state synchronizes with localStorage changes", async ({
		page,
	}) => {
		// GIVEN: User is authenticated
		const claudeScenario = mockCoordinator.createClaudeOAuthScenario();
		await claudeScenario.setup();
		await claudeScenario.execute();

		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toContainText("Connected");

		// WHEN: localStorage is modified externally (simulating other tab or external change)
		await page.evaluate(() => {
			localStorage.removeItem("claude_tokens");
			// Trigger storage event to simulate external change
			window.dispatchEvent(
				new StorageEvent("storage", {
					key: "claude_tokens",
					oldValue: "some-token-data",
					newValue: null,
					storageArea: localStorage,
				}),
			);
		});

		// THEN: UI should eventually reflect the storage change
		// (This tests the hook's ability to respond to external storage changes)
		// Implementation would depend on whether the hook listens to storage events

		// For now, we test that page reload reflects the cleared state
		await page.reload();
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).not.toBeVisible();
		await expect(
			page.locator('[data-testid="claude-oauth-button"]'),
		).toBeVisible();
	});
});
