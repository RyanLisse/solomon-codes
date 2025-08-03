/**
 * Mock Coordinator for E2E Authentication Tests
 *
 * London School TDD Mock Coordination
 * - Orchestrates multiple mock contracts for complex scenarios
 * - Provides unified interface for test setup and verification
 * - Enables swarm-like coordination between different mock services
 */
import type { Page } from "@playwright/test";
import { ClaudeOAuthContract } from "../contracts/claude-oauth.contract";
import { OpenAIValidationContract } from "../contracts/openai-validation.contract";

export interface MockCoordinatorConfig {
	claudeOAuth?: {
		enabled: boolean;
		mockResponses?: "success" | "failure" | "custom";
	};
	openaiValidation?: {
		enabled: boolean;
		validKeys?: string[];
		mockResponses?: "success" | "failure" | "custom";
	};
	localStorage?: {
		clearOnStart?: boolean;
		initialData?: Record<string, string>;
	};
}

export interface TestScenario {
	name: string;
	description: string;
	setup: () => Promise<void>;
	execute: () => Promise<void>;
	verify: () => Promise<void>;
	cleanup: () => Promise<void>;
}

/**
 * Mock Coordinator
 * Orchestrates multiple authentication flows and their interactions
 */
export class MockCoordinator {
	private claudeOAuth: ClaudeOAuthContract;
	private openaiValidation: OpenAIValidationContract;

	constructor(private page: Page) {
		this.claudeOAuth = new ClaudeOAuthContract(page);
		this.openaiValidation = new OpenAIValidationContract(page);
	}

	/**
	 * Initialize mock environment with configuration
	 */
	async initialize(config: MockCoordinatorConfig = {}) {
		console.log("🎭 Initializing mock coordinator...");

		// Reset all mock services
		await this.claudeOAuth.reset();
		await this.openaiValidation.reset();

		// Setup localStorage
		if (config.localStorage?.clearOnStart !== false) {
			await this.page.evaluate(() => localStorage.clear());
		}

		if (config.localStorage?.initialData) {
			for (const [key, value] of Object.entries(
				config.localStorage.initialData,
			)) {
				await this.page.evaluate(
					([k, v]) => localStorage.setItem(k, v),
					[key, value],
				);
			}
		}

		// Setup OpenAI validation
		if (config.openaiValidation?.enabled) {
			if (config.openaiValidation.validKeys) {
				await this.openaiValidation.setupValidKeys(
					config.openaiValidation.validKeys,
				);
			}
		}

		console.log("✅ Mock coordinator initialized");
	}

	/**
	 * Create a test scenario for Claude OAuth flow
	 */
	createClaudeOAuthScenario(): TestScenario {
		return {
			name: "Claude OAuth Authentication",
			description:
				"User completes Claude OAuth flow and sees authenticated state",

			setup: async () => {
				await this.claudeOAuth.reset();
				await this.page.evaluate(() => localStorage.clear());
			},

			execute: async () => {
				// Navigate to settings page
				await this.page.goto("/settings");

				// Setup OAuth popup handler
				const oauthHandler = await this.claudeOAuth.simulateOAuthApproval();

				// Click Claude OAuth button
				await this.page.click('[data-testid="claude-oauth-button"]');

				// Handle OAuth popup
				await oauthHandler.approve();

				// Wait for flow completion
				await this.claudeOAuth.waitForOAuthCompletion();
			},

			verify: async () => {
				// Verify OAuth interactions occurred
				await this.claudeOAuth.verifyInteractions({
					authorizeCalls: 1,
					tokenCalls: 1,
				});

				// Verify UI shows authenticated state
				await this.page.waitForSelector(
					'[data-testid="claude-auth-status"]:has-text("Connected")',
				);

				// Verify token storage
				const storedTokens = await this.page.evaluate(() =>
					localStorage.getItem("claude_tokens"),
				);
				expect(storedTokens).toBeTruthy();
			},

			cleanup: async () => {
				await this.claudeOAuth.reset();
				await this.page.evaluate(() => localStorage.clear());
			},
		};
	}

	/**
	 * Create a test scenario for OpenAI API key validation
	 */
	createOpenAIValidationScenario(
		apiKey = "sk-test-valid-key-123456789",
	): TestScenario {
		return {
			name: "OpenAI API Key Validation",
			description: "User enters valid OpenAI API key and sees validated state",

			setup: async () => {
				await this.openaiValidation.reset();
				await this.openaiValidation.setupValidKeys([apiKey]);
				await this.page.evaluate(() => localStorage.clear());
			},

			execute: async () => {
				// Navigate to settings page
				await this.page.goto("/settings");

				// Enter API key and validate
				const keyEntry = await this.openaiValidation.simulateKeyEntry(apiKey);
				await keyEntry.complete();

				// Wait for validation result
				await this.openaiValidation.waitForValidationResult("valid");
			},

			verify: async () => {
				// Verify validation interactions
				await this.openaiValidation.verifyValidationInteractions(1);

				// Verify validation request details
				await this.openaiValidation.verifyValidationRequest(apiKey);

				// Verify UI shows validated state
				await this.page.waitForSelector(
					'[data-testid="openai-validation-status"]:has-text("API key is valid")',
				);

				// Verify localStorage interaction
				await this.openaiValidation.verifyLocalStorageInteraction(apiKey);
			},

			cleanup: async () => {
				await this.openaiValidation.reset();
				await this.page.evaluate(() => localStorage.clear());
			},
		};
	}

	/**
	 * Create a combined scenario testing both authentication flows
	 */
	createCombinedAuthScenario(): TestScenario {
		const claudeScenario = this.createClaudeOAuthScenario();
		const openaiScenario = this.createOpenAIValidationScenario();

		return {
			name: "Combined Authentication Flow",
			description: "User completes both Claude OAuth and OpenAI validation",

			setup: async () => {
				await claudeScenario.setup();
				await openaiScenario.setup();
			},

			execute: async () => {
				// Execute Claude OAuth first
				await claudeScenario.execute();

				// Then execute OpenAI validation
				const keyEntry = await this.openaiValidation.simulateKeyEntry(
					"sk-test-valid-key-123456789",
				);
				await keyEntry.complete();
				await this.openaiValidation.waitForValidationResult("valid");
			},

			verify: async () => {
				// Verify both flows completed
				await claudeScenario.verify();
				await this.openaiValidation.verifyValidationInteractions(1);

				// Verify both authentication states are shown
				await this.page.waitForSelector(
					'[data-testid="claude-auth-status"]:has-text("Connected")',
				);
				await this.page.waitForSelector(
					'[data-testid="openai-validation-status"]:has-text("API key is valid")',
				);
			},

			cleanup: async () => {
				await claudeScenario.cleanup();
				await openaiScenario.cleanup();
			},
		};
	}

	/**
	 * Execute a test scenario with proper error handling
	 */
	async executeScenario(scenario: TestScenario) {
		console.log(`🎬 Executing scenario: ${scenario.name}`);
		console.log(`📝 Description: ${scenario.description}`);

		try {
			await scenario.setup();
			console.log("✅ Setup complete");

			await scenario.execute();
			console.log("✅ Execution complete");

			await scenario.verify();
			console.log("✅ Verification complete");
		} finally {
			await scenario.cleanup();
			console.log("✅ Cleanup complete");
		}
	}

	/**
	 * Get mock contracts for direct access
	 */
	getContracts() {
		return {
			claudeOAuth: this.claudeOAuth,
			openaiValidation: this.openaiValidation,
		};
	}

	/**
	 * Verify all mock interactions across services
	 */
	async verifyAllInteractions() {
		const mockInteractions = await this.page.request.get(
			"http://localhost:3002/test/interactions",
		);
		const interactions = await mockInteractions.json();

		return {
			claudeOAuth: interactions.claudeOAuth || [],
			openaiValidation: interactions.openaiValidation || [],
			summary: {
				totalCalls:
					(interactions.claudeOAuth?.length || 0) +
					(interactions.openaiValidation?.length || 0),
				claudeCalls: interactions.claudeOAuth?.length || 0,
				openaiCalls: interactions.openaiValidation?.length || 0,
				tokensIssued: interactions.tokensIssued || 0,
			},
		};
	}

	/**
	 * Reset all mock state
	 */
	async resetAll() {
		await this.claudeOAuth.reset();
		await this.openaiValidation.reset();
		await this.page.evaluate(() => localStorage.clear());
	}
}
