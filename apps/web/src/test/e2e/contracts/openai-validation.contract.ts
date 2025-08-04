/**
 * OpenAI API Validation Mock Contract
 *
 * London School TDD Contract Definition
 * - Defines expected interactions for OpenAI API key validation
 * - Provides verification methods for API validation behavior
 * - Encapsulates validation rules and mock responses
 */
import { expect, type Page } from "@playwright/test";

export interface OpenAIValidationInteraction {
	type: "validate";
	timestamp: number;
	apiKey: string;
	headers: Record<string, string>;
}

export interface OpenAIValidationResult {
	valid: boolean;
	error?: string;
	models?: Array<{
		id: string;
		object: string;
		created: number;
		owned_by: string;
	}>;
}

/**
 * OpenAI API Validation Mock Contract
 * Defines the expected behavior and interactions for OpenAI API key validation
 */
export class OpenAIValidationContract {
	constructor(private page: Page) {}

	/**
	 * Mock API key validation request
	 * Verifies that the application validates API keys correctly
	 */
	async expectValidationRequest(apiKey: string) {
		return {
			withApiKey: apiKey,
			expectSuccess: () => this.expectSuccessfulValidation(apiKey),
			expectFailure: (
				reason: "invalid_format" | "invalid_key" | "network_error",
			) => this.expectFailedValidation(apiKey, reason),
		};
	}

	/**
	 * Expect successful API key validation
	 */
	private async expectSuccessfulValidation(apiKey: string) {
		// Add the key to valid keys in mock server
		await this.page.request.post(
			"http://localhost:3002/test/openai/add-valid-key",
			{
				data: { key: apiKey },
			},
		);

		return {
			returnsModels: () => ({
				object: "list",
				data: [
					{
						id: "gpt-4",
						object: "model",
						created: 1687882411,
						owned_by: "openai",
					},
					{
						id: "gpt-3.5-turbo",
						object: "model",
						created: 1677610602,
						owned_by: "openai",
					},
				],
			}),
		};
	}

	/**
	 * Expect failed API key validation
	 */
	private async expectFailedValidation(
		_apiKey: string,
		reason: "invalid_format" | "invalid_key" | "network_error",
	) {
		const errorResponses = {
			invalid_format: {
				error: {
					message: "Invalid API key provided.",
					type: "invalid_request_error",
					param: null,
					code: "invalid_api_key",
				},
			},
			invalid_key: {
				error: {
					message: "Incorrect API key provided.",
					type: "invalid_request_error",
					param: null,
					code: "invalid_api_key",
				},
			},
			network_error: {
				error: {
					message: "Network error occurred.",
					type: "network_error",
					param: null,
					code: "network_error",
				},
			},
		} as const;

		return {
			returnsError: () => errorResponses[reason],
		};
	}

	/**
	 * Verify API key format validation
	 */
	async verifyKeyFormatValidation(
		testCases: Array<{
			key: string;
			shouldBeValid: boolean;
			description: string;
		}>,
	) {
		for (const testCase of testCases) {
			if (testCase.shouldBeValid) {
				expect(this.isValidKeyFormat(testCase.key), testCase.description).toBe(
					true,
				);
			} else {
				expect(this.isValidKeyFormat(testCase.key), testCase.description).toBe(
					false,
				);
			}
		}
	}

	/**
	 * Check if API key format is valid (matches OpenAI pattern)
	 */
	private isValidKeyFormat(apiKey: string): boolean {
		return /^sk-[A-Za-z0-9]{48,}$/.test(apiKey);
	}

	/**
	 * Verify validation interactions occurred as expected
	 */
	async verifyValidationInteractions(expectedCalls: number) {
		const response = await this.page.request.get(
			"http://localhost:3002/test/interactions",
		);
		const interactions = await response.json();

		const validationCalls = interactions.openaiValidation || [];
		expect(validationCalls.length, "OpenAI validation calls").toBe(
			expectedCalls,
		);

		return validationCalls;
	}

	/**
	 * Verify specific validation request details
	 */
	async verifyValidationRequest(expectedApiKey: string, callIndex = 0) {
		const validationCalls = await this.verifyValidationInteractions(
			callIndex + 1,
		);
		const validationCall = validationCalls[callIndex];

		expect(validationCall.type, "Validation call type").toBe("validate");
		expect(validationCall.apiKey, "API key in validation call").toContain(
			expectedApiKey.substring(0, 10),
		);
		expect(validationCall.headers.authorization, "Authorization header").toBe(
			`Bearer ${expectedApiKey}`,
		);

		return validationCall;
	}

	/**
	 * Setup mock server with predefined valid keys
	 */
	async setupValidKeys(validKeys: string[]) {
		for (const key of validKeys) {
			await this.page.request.post(
				"http://localhost:3002/test/openai/add-valid-key",
				{
					data: { key },
				},
			);
		}
	}

	/**
	 * Reset mock state for clean test isolation
	 */
	async reset() {
		await this.page.request.post("http://localhost:3002/test/reset");
	}

	/**
	 * Simulate UI interactions for API key entry
	 */
	async simulateKeyEntry(apiKey: string) {
		return {
			fillInput: async () => {
				await this.page.fill('[data-testid="openai-api-key-input"]', apiKey);
			},
			clickTest: async () => {
				await this.page.click('[data-testid="openai-test-button"]');
			},
			clickSave: async () => {
				await this.page.click('[data-testid="openai-save-button"]');
			},
			complete: async () => {
				await this.page.fill('[data-testid="openai-api-key-input"]', apiKey);
				await this.page.click('[data-testid="openai-test-button"]');

				// Wait for validation to complete
				await this.page.waitForSelector(
					'[data-testid="openai-validation-status"]',
					{
						timeout: 5000,
					},
				);
			},
		};
	}

	/**
	 * Wait for validation completion and verify result
	 */
	async waitForValidationResult(expectedResult: "valid" | "invalid") {
		if (expectedResult === "valid") {
			await this.page.waitForSelector(
				'[data-testid="openai-validation-status"]:has-text("API key is valid")',
				{
					timeout: 10000,
				},
			);
		} else {
			await this.page.waitForSelector(
				'[data-testid="openai-validation-status"]:has-text("Invalid API key")',
				{
					timeout: 10000,
				},
			);
		}
	}

	/**
	 * Verify localStorage interaction for API key storage
	 */
	async verifyLocalStorageInteraction(expectedKey: string) {
		const storedKey = await this.page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedKey, "Stored API key in localStorage").toBe(expectedKey);
	}

	/**
	 * Generate test API keys for different scenarios
	 */
	generateTestKeys() {
		return {
			valid: "sk-test-valid-key-123456789",
			invalidFormat: "invalid-key-format",
			invalidKey: "sk-invalid-key-that-wont-work-123456789",
			tooShort: "sk-short",
			wrongPrefix: "ak-wrong-prefix-123456789",
			empty: "",
		};
	}
}
