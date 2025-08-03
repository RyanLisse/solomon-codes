/**
 * OpenAI API Key Validation E2E Tests
 *
 * London School TDD Outside-In Testing
 * - Tests user behavior from the outside-in
 * - Focuses on API validation interactions and collaborations
 * - Uses mocks to control external API responses
 * - Verifies behavior through interaction testing
 */
import { expect, test } from "@playwright/test";
import { MockCoordinator } from "../utils/mock-coordinator";

test.describe("OpenAI API Key Validation Flow", () => {
	let mockCoordinator: MockCoordinator;

	test.beforeEach(async ({ page }) => {
		mockCoordinator = new MockCoordinator(page);

		// Initialize clean test environment
		await mockCoordinator.initialize({
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

	test("User successfully validates OpenAI API key and sees connected state", async ({
		page,
	}) => {
		// GIVEN: User is on the settings page with no OpenAI key configured
		await page.goto("/settings");

		// Verify initial state - no validation status shown
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).not.toBeVisible();
		await expect(
			page.locator('[data-testid="openai-api-key-input"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-testid="openai-test-button"]'),
		).toBeVisible();

		// WHEN: User enters valid API key and tests it
		const validApiKey = "sk-test-valid-key-123456789";
		const contracts = mockCoordinator.getContracts();

		// Enter API key
		await page.fill('[data-testid="openai-api-key-input"]', validApiKey);

		// Test the API key
		await page.click('[data-testid="openai-test-button"]');

		// Wait for validation to complete
		await contracts.openaiValidation.waitForValidationResult("valid");

		// THEN: User sees validated state and proper interactions occurred

		// Verify UI shows validation success
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toContainText("API key is valid");
		await expect(
			page.locator('[data-testid="openai-save-button"]'),
		).toBeVisible();

		// Verify API validation contract interactions (London School: behavior verification)
		const validationCall =
			await contracts.openaiValidation.verifyValidationRequest(validApiKey);

		// Verify validation request details
		expect(validationCall.type).toBe("validate");
		expect(validationCall.apiKey).toContain("sk-test-valid");
		expect(validationCall.headers.authorization).toBe(`Bearer ${validApiKey}`);

		// Verify no localStorage interaction yet (key not saved until user clicks save)
		let storedKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey).toBeNull();

		// WHEN: User saves the validated key
		await page.click('[data-testid="openai-save-button"]');

		// THEN: Key is stored in localStorage
		storedKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey).toBe(validApiKey);
	});

	test("User receives error for invalid API key format", async ({ page }) => {
		// GIVEN: User is on the settings page
		await page.goto("/settings");

		const contracts = mockCoordinator.getContracts();
		const testKeys = contracts.openaiValidation.generateTestKeys();

		// WHEN: User enters API key with invalid format
		await page.fill(
			'[data-testid="openai-api-key-input"]',
			testKeys.invalidFormat,
		);
		await page.click('[data-testid="openai-test-button"]');

		// Wait for validation to complete
		await contracts.openaiValidation.waitForValidationResult("invalid");

		// THEN: User sees validation error
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toContainText("Invalid API key");
		await expect(
			page.locator('[data-testid="openai-save-button"]'),
		).not.toBeVisible();

		// Verify API validation was attempted
		await contracts.openaiValidation.verifyValidationInteractions(1);

		// Verify no key storage occurred
		const storedKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey).toBeNull();
	});

	test("User receives error for invalid API key that fails authentication", async ({
		page,
	}) => {
		// GIVEN: User is on the settings page
		await page.goto("/settings");

		const contracts = mockCoordinator.getContracts();
		const testKeys = contracts.openaiValidation.generateTestKeys();

		// WHEN: User enters properly formatted but invalid API key
		await page.fill(
			'[data-testid="openai-api-key-input"]',
			testKeys.invalidKey,
		);
		await page.click('[data-testid="openai-test-button"]');

		// Wait for validation to complete
		await contracts.openaiValidation.waitForValidationResult("invalid");

		// THEN: User sees validation error
		await expect(
			page.locator('[data-testid="openai-validation-status"]'),
		).toContainText("Invalid API key");

		// Verify API validation interaction occurred
		const validationCall =
			await contracts.openaiValidation.verifyValidationRequest(
				testKeys.invalidKey,
			);
		expect(validationCall.type).toBe("validate");

		// Verify no key storage occurred
		const storedKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey).toBeNull();
	});

	test("Test button is disabled when API key input is empty", async ({
		page,
	}) => {
		// GIVEN: User is on the settings page
		await page.goto("/settings");

		// THEN: Test button should be disabled initially
		await expect(
			page.locator('[data-testid="openai-test-button"]'),
		).toBeDisabled();

		// WHEN: User enters some text
		await page.fill('[data-testid="openai-api-key-input"]', "sk-some-key");

		// THEN: Test button becomes enabled
		await expect(
			page.locator('[data-testid="openai-test-button"]'),
		).toBeEnabled();

		// WHEN: User clears the input
		await page.fill('[data-testid="openai-api-key-input"]', "");

		// THEN: Test button becomes disabled again
		await expect(
			page.locator('[data-testid="openai-test-button"]'),
		).toBeDisabled();
	});

	test("API key validation handles various key format edge cases", async ({
		page,
	}) => {
		// GIVEN: User is on the settings page
		await page.goto("/settings");

		const contracts = mockCoordinator.getContracts();
		const testKeys = contracts.openaiValidation.generateTestKeys();

		// Test cases for different key formats
		const testCases = [
			{ key: testKeys.tooShort, expectValid: false, description: "too short" },
			{
				key: testKeys.wrongPrefix,
				expectValid: false,
				description: "wrong prefix",
			},
			{ key: testKeys.empty, expectValid: false, description: "empty string" },
		];

		for (const testCase of testCases) {
			// WHEN: User enters test key
			await page.fill('[data-testid="openai-api-key-input"]', testCase.key);

			if (testCase.key.trim()) {
				await page.click('[data-testid="openai-test-button"]');

				// THEN: Validation should fail for invalid formats
				if (!testCase.expectValid) {
					await contracts.openaiValidation.waitForValidationResult("invalid");
					await expect(
						page.locator('[data-testid="openai-validation-status"]'),
					).toContainText("Invalid API key");
				}
			} else {
				// Empty key should keep test button disabled
				await expect(
					page.locator('[data-testid="openai-test-button"]'),
				).toBeDisabled();
			}

			// Clear for next test
			await page.fill('[data-testid="openai-api-key-input"]', "");
		}
	});

	test("Multiple validation attempts track interactions correctly", async ({
		page,
	}) => {
		// GIVEN: User is on the settings page
		await page.goto("/settings");

		const contracts = mockCoordinator.getContracts();
		const testKeys = contracts.openaiValidation.generateTestKeys();

		// WHEN: User tests multiple keys

		// First attempt with invalid key
		await page.fill(
			'[data-testid="openai-api-key-input"]',
			testKeys.invalidKey,
		);
		await page.click('[data-testid="openai-test-button"]');
		await contracts.openaiValidation.waitForValidationResult("invalid");

		// Second attempt with valid key
		await page.fill('[data-testid="openai-api-key-input"]', testKeys.valid);
		await page.click('[data-testid="openai-test-button"]');
		await contracts.openaiValidation.waitForValidationResult("valid");

		// THEN: Both validation attempts are tracked
		await contracts.openaiValidation.verifyValidationInteractions(2);

		// Verify the valid key can be saved
		await expect(
			page.locator('[data-testid="openai-save-button"]'),
		).toBeVisible();
		await page.click('[data-testid="openai-save-button"]');

		// Verify localStorage interaction
		await contracts.openaiValidation.verifyLocalStorageInteraction(
			testKeys.valid,
		);
	});

	test("UI properly handles loading states during validation", async ({
		page,
	}) => {
		// GIVEN: User is on the settings page
		await page.goto("/settings");

		const validApiKey = "sk-test-valid-key-123456789";

		// WHEN: User enters API key and starts validation
		await page.fill('[data-testid="openai-api-key-input"]', validApiKey);

		// Click test button and immediately check for loading state
		await page.click('[data-testid="openai-test-button"]');

		// THEN: Loading state should be shown (button text changes)
		await expect(
			page.locator('[data-testid="openai-test-button"]'),
		).toContainText("Testing...");
		await expect(
			page.locator('[data-testid="openai-test-button"]'),
		).toBeDisabled();

		// Wait for validation to complete
		const contracts = mockCoordinator.getContracts();
		await contracts.openaiValidation.waitForValidationResult("valid");

		// Loading state should be cleared
		await expect(
			page.locator('[data-testid="openai-test-button"]'),
		).toContainText("Test");
		await expect(
			page.locator('[data-testid="openai-test-button"]'),
		).toBeEnabled();
	});
});
