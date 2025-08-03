/**
 * Chat Interface VibeKit Integration E2E Tests
 *
 * London School TDD Integration Testing
 * - Tests end-to-end user workflow from authentication to agent usage
 * - Verifies collaboration between authentication, storage, and VibeKit
 * - Uses mocks to control external dependencies while testing real interactions
 * - Focuses on behavior verification across component boundaries
 */
import { expect, test } from "@playwright/test";
import { MockCoordinator } from "../utils/mock-coordinator";

test.describe("Chat Interface VibeKit Integration", () => {
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
			claudeOAuth: { enabled: true, mockResponses: "success" },
			localStorage: { clearOnStart: true },
		});
	});

	test.afterEach(async () => {
		await mockCoordinator.resetAll();
	});

	test("User authenticates OpenAI key and successfully uses it for code generation", async ({
		page,
	}) => {
		// GIVEN: User completes OpenAI authentication flow
		const validApiKey = "sk-test-valid-key-123456789";
		const contracts = mockCoordinator.getContracts();

		// Step 1: Authenticate OpenAI API key
		await page.goto("/settings");
		await page.fill('[data-testid="openai-api-key-input"]', validApiKey);
		await page.click('[data-testid="openai-test-button"]');
		await contracts.openaiValidation.waitForValidationResult("valid");
		await page.click('[data-testid="openai-save-button"]');

		// Verify key is stored
		await contracts.openaiValidation.verifyLocalStorageInteraction(validApiKey);

		// WHEN: User navigates to chat interface and selects OpenAI agent
		await page.goto("/");

		// Verify chat interface is loaded
		await expect(page.locator('[data-testid="task-input"]')).toBeVisible();
		await expect(page.locator('[data-testid="agent-selector"]')).toBeVisible();

		// Select OpenAI CLI agent
		await page.click('[data-testid="agent-selector"]');
		await page.click('[data-testid="agent-option-openai-cli"]');

		// Verify OpenAI agent is selected
		await expect(page.locator('[data-testid="agent-selector"]')).toContainText(
			"OpenAI CLI",
		);

		// Enter task description
		const taskDescription =
			"Create a simple React component for user authentication";
		await page.fill('[data-testid="task-input"]', taskDescription);

		// THEN: Code generation button should be enabled (API key is available)
		await expect(
			page.locator('[data-testid="code-generation-button"]'),
		).toBeEnabled();

		// Mock VibeKit action to verify API key usage
		await page.route("**/actions/vibekit", async (route) => {
			const request = route.request();
			const postData = request.postData();

			// Verify that the request includes the stored API key
			expect(postData).toContain(validApiKey);
			expect(postData).toContain("openai-cli");
			expect(postData).toContain(taskDescription);

			// Mock successful response
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					success: true,
					taskId: "mock-task-123",
					message: "Code generation started",
				}),
			});
		});

		// Trigger code generation
		await page.click('[data-testid="code-generation-button"]');

		// Verify button shows loading state
		await expect(
			page.locator('[data-testid="code-generation-button"]'),
		).toContainText("Generating...");
		await expect(
			page.locator('[data-testid="code-generation-button"]'),
		).toBeDisabled();
	});

	test("User without OpenAI authentication cannot use OpenAI agents effectively", async ({
		page,
	}) => {
		// GIVEN: User has not authenticated OpenAI (no API key stored)
		await page.goto("/");

		// WHEN: User selects OpenAI agent without authentication
		await page.click('[data-testid="agent-selector"]');
		await page.click('[data-testid="agent-option-openai-cli"]');

		// Enter task description
		await page.fill('[data-testid="task-input"]', "Create a React component");

		// THEN: Code generation should still be possible (button enabled)
		// but the backend will handle the missing API key appropriately
		await expect(
			page.locator('[data-testid="code-generation-button"]'),
		).toBeEnabled();

		// Mock VibeKit action to verify no API key is passed
		await page.route("**/actions/vibekit", async (route) => {
			const request = route.request();
			const postData = request.postData();

			// Verify that no OpenAI API key is included
			expect(postData).not.toContain("sk-");
			expect(postData).toContain("openai-cli");

			// Mock error response due to missing API key
			await route.fulfill({
				status: 400,
				contentType: "application/json",
				body: JSON.stringify({
					success: false,
					error: "OpenAI API key required for this agent",
				}),
			});
		});

		// Trigger code generation
		await page.click('[data-testid="code-generation-button"]');

		// The frontend should handle the error gracefully
		// (specific error handling implementation would be tested here)
	});

	test("User can switch between Claude and OpenAI agents with proper authentication", async ({
		page,
	}) => {
		// GIVEN: User has authenticated both Claude and OpenAI
		const validApiKey = "sk-test-valid-key-123456789";

		// Setup OpenAI authentication
		const openaiScenario =
			mockCoordinator.createOpenAIValidationScenario(validApiKey);
		await openaiScenario.setup();
		await openaiScenario.execute();

		// Setup Claude authentication
		const claudeScenario = mockCoordinator.createClaudeOAuthScenario();
		await claudeScenario.setup();
		await claudeScenario.execute();

		// WHEN: User navigates to chat interface
		await page.goto("/");

		// Test switching between agents
		const taskDescription = "Implement user authentication";
		await page.fill('[data-testid="task-input"]', taskDescription);

		// Test OpenAI agent selection
		await page.click('[data-testid="agent-selector"]');
		await page.click('[data-testid="agent-option-openai-cli"]');
		await expect(page.locator('[data-testid="agent-selector"]')).toContainText(
			"OpenAI CLI",
		);

		// Test Claude agent selection
		await page.click('[data-testid="agent-selector"]');
		await page.click('[data-testid="agent-option-claude-code"]');
		await expect(page.locator('[data-testid="agent-selector"]')).toContainText(
			"Claude Code",
		);

		// Test OpenCode agent selection (requires OpenAI key)
		await page.click('[data-testid="agent-selector"]');
		await page.click('[data-testid="agent-option-opencode"]');
		await expect(page.locator('[data-testid="agent-selector"]')).toContainText(
			"OpenCode",
		);

		// THEN: All agent selections should work and code generation should be enabled
		await expect(
			page.locator('[data-testid="code-generation-button"]'),
		).toBeEnabled();
	});

	test("Agent selection persists across page navigation", async ({ page }) => {
		// GIVEN: User selects an agent
		await page.goto("/");
		await page.click('[data-testid="agent-selector"]');
		await page.click('[data-testid="agent-option-openai-cli"]');
		await expect(page.locator('[data-testid="agent-selector"]')).toContainText(
			"OpenAI CLI",
		);

		// WHEN: User navigates away and back
		await page.goto("/settings");
		await page.goto("/");

		// THEN: Agent selection should persist
		await expect(page.locator('[data-testid="agent-selector"]')).toContainText(
			"OpenAI CLI",
		);
	});

	test("Task input and agent configuration are properly coordinated for VibeKit", async ({
		page,
	}) => {
		// GIVEN: User has OpenAI authentication and selects specific model
		const validApiKey = "sk-test-valid-key-123456789";
		const openaiScenario =
			mockCoordinator.createOpenAIValidationScenario(validApiKey);
		await openaiScenario.setup();
		await openaiScenario.execute();

		await page.goto("/");

		// WHEN: User configures specific agent and model
		await page.click('[data-testid="agent-selector"]');
		await page.click('[data-testid="agent-option-opencode"]');

		// Note: Model selection would need additional test data attributes
		// For now, we test the basic coordination

		const taskDescription = "Build a REST API with Express.js";
		await page.fill('[data-testid="task-input"]', taskDescription);

		// Mock VibeKit to verify coordination
		await page.route("**/actions/vibekit", async (route) => {
			const request = route.request();
			const postData = request.postData();
			const requestData = JSON.parse(postData || "{}");

			// Verify task coordination
			expect(requestData.task?.title).toBe(taskDescription);
			expect(requestData.prompt).toBe(taskDescription);

			// Verify agent configuration coordination
			expect(requestData.agentConfig?.type).toBe("opencode");
			expect(requestData.agentConfig?.openaiApiKey).toBe(validApiKey);
			expect(requestData.agentConfig?.isLocal).toBe(true);

			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ success: true, taskId: "test-123" }),
			});
		});

		// THEN: Code generation properly coordinates all components
		await page.click('[data-testid="code-generation-button"]');
	});

	test("LocalStorage interactions are properly isolated between different agent types", async ({
		page,
	}) => {
		// GIVEN: User authenticates OpenAI
		const validApiKey = "sk-test-valid-key-123456789";
		const openaiScenario =
			mockCoordinator.createOpenAIValidationScenario(validApiKey);
		await openaiScenario.setup();
		await openaiScenario.execute();

		// WHEN: User uses different agent types
		await page.goto("/");

		// Test OpenAI-based agent
		await page.click('[data-testid="agent-selector"]');
		await page.click('[data-testid="agent-option-openai-cli"]');

		// Verify OpenAI key is accessible
		const storedOpenAIKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(storedOpenAIKey).toBe(validApiKey);

		// Test Claude-based agent (should not interfere with OpenAI storage)
		await page.click('[data-testid="agent-selector"]');
		await page.click('[data-testid="agent-option-claude-code"]');

		// THEN: OpenAI key should still be available for OpenAI agents
		const stillStoredKey = await page.evaluate(() =>
			localStorage.getItem("openai_api_key"),
		);
		expect(stillStoredKey).toBe(validApiKey);

		// Claude tokens should be separate (null if not authenticated)
		const claudeTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(claudeTokens).toBeNull();
	});
});
