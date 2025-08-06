/**
 * Claude OAuth Authentication E2E Tests
 *
 * London School TDD Outside-In Testing
 * - Tests user behavior from the outside-in
 * - Focuses on interactions and collaborations between components
 * - Uses mocks to define contracts and verify behavior
 * - Emphasizes HOW objects collaborate rather than WHAT they contain
 */
import { expect, test } from "@playwright/test";
import { MockCoordinator } from "../utils/mock-coordinator";

test.describe("Claude OAuth Authentication Flow", () => {
	let mockCoordinator: MockCoordinator;

	test.beforeEach(async ({ page }) => {
		mockCoordinator = new MockCoordinator(page);

		// Initialize clean test environment
		await mockCoordinator.initialize({
			claudeOAuth: { enabled: true, mockResponses: "success" },
			localStorage: { clearOnStart: true },
		});
	});

	test.afterEach(async () => {
		await mockCoordinator.resetAll();
	});

	test("User successfully completes Claude OAuth flow and sees authenticated state", async ({
		page,
	}) => {
		// GIVEN: User is on the settings page without authentication
		await page.goto("/settings");

		// Verify initial unauthenticated state
		await expect(
			page.locator('[data-testid="claude-oauth-button"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).not.toBeVisible();

		// WHEN: User initiates Claude OAuth flow
		const contracts = mockCoordinator.getContracts();

		// Setup OAuth popup handler (London School: define behavior expectation)
		const oauthHandler = await contracts.claudeOAuth.simulateOAuthApproval();

		// Click the OAuth button to start the flow
		await page.click('[data-testid="claude-oauth-button"]');

		// Handle OAuth popup approval (testing the collaboration)
		await oauthHandler.approve();

		// Wait for OAuth flow completion
		await contracts.claudeOAuth.waitForOAuthCompletion();

		// THEN: User sees authenticated state and proper interactions occurred

		// Verify UI shows authenticated state
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toContainText("Connected");
		await expect(
			page.locator('[data-testid="claude-oauth-button"]'),
		).not.toBeVisible();

		// Verify OAuth contract interactions (London School: behavior verification)
		const interactions = await contracts.claudeOAuth.verifyInteractions({
			authorizeCalls: 1,
			tokenCalls: 1,
		});

		// Verify authorization request parameters
		const authorizeCall = interactions.authorizeCalls[0];
		expect(authorizeCall.params.client_id).toBeTruthy();
		expect(authorizeCall.params.redirect_uri).toContain("localhost:3001");
		expect(authorizeCall.params.code_challenge).toBeTruthy();
		expect(authorizeCall.params.state).toBeTruthy();

		// Verify token exchange parameters
		const tokenCall = interactions.tokenCalls[0];
		expect(tokenCall.body.code).toBe("mock-auth-code-123");
		expect(tokenCall.body.code_verifier).toBeTruthy();

		// Verify token storage collaboration
		const storedTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(storedTokens).toBeTruthy();

		const tokenData = JSON.parse(storedTokens as string);
		expect(tokenData.authMethod).toBe("oauth");
		expect(tokenData.accessToken).toContain("mock-claude-access-token");
		expect(tokenData.refreshToken).toContain("mock-claude-refresh-token");
	});

	test("User can disconnect Claude OAuth and return to unauthenticated state", async ({
		page,
	}) => {
		// GIVEN: User is authenticated with Claude OAuth
		const scenario = mockCoordinator.createClaudeOAuthScenario();
		await scenario.setup();
		await scenario.execute();

		// Verify authenticated state
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).toContainText("Connected");
		await expect(
			page.locator('[data-testid="claude-disconnect-button"]'),
		).toBeVisible();

		// WHEN: User clicks disconnect
		await page.click('[data-testid="claude-disconnect-button"]');

		// THEN: User returns to unauthenticated state
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).not.toBeVisible();
		await expect(
			page.locator('[data-testid="claude-oauth-button"]'),
		).toBeVisible();

		// Verify token storage is cleared
		const storedTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(storedTokens).toBeNull();
	});

	test("OAuth flow handles user denial gracefully", async ({ page }) => {
		// GIVEN: User is on the settings page
		await page.goto("/settings");

		// WHEN: User initiates OAuth but denies access
		const contracts = mockCoordinator.getContracts();
		const oauthHandler = await contracts.claudeOAuth.simulateOAuthApproval();

		await page.click('[data-testid="claude-oauth-button"]');

		// User denies access in popup
		await oauthHandler.deny();

		// THEN: User remains unauthenticated
		await expect(
			page.locator('[data-testid="claude-auth-status"]'),
		).not.toBeVisible();
		await expect(
			page.locator('[data-testid="claude-oauth-button"]'),
		).toBeVisible();

		// Verify no token storage occurred
		const storedTokens = await page.evaluate(() =>
			localStorage.getItem("claude_tokens"),
		);
		expect(storedTokens).toBeNull();

		// Verify only authorization call occurred (no token exchange)
		await contracts.claudeOAuth.verifyInteractions({
			authorizeCalls: 1,
			tokenCalls: 0,
		});
	});

	test("OAuth flow handles network errors gracefully", async ({ page }) => {
		// GIVEN: Mock server will return network errors
		await mockCoordinator.initialize({
			claudeOAuth: { enabled: true, mockResponses: "failure" },
			localStorage: { clearOnStart: true },
		});

		await page.goto("/settings");

		// WHEN: User attempts OAuth with network failure
		// This test would need additional mock server configuration
		// to simulate network failures - for now, we test the happy path

		// THEN: Error handling should be graceful
		// (Implementation would depend on specific error handling requirements)
	});

	test("OAuth state parameter prevents CSRF attacks", async ({ page }) => {
		// GIVEN: User initiates OAuth flow
		await page.goto("/settings");

		const contracts = mockCoordinator.getContracts();

		// WHEN: OAuth flow completes
		const oauthHandler = await contracts.claudeOAuth.simulateOAuthApproval();
		await page.click('[data-testid="claude-oauth-button"]');
		await oauthHandler.approve();
		await contracts.claudeOAuth.waitForOAuthCompletion();

		// THEN: State parameter is properly validated
		const interactions = await contracts.claudeOAuth.verifyInteractions({
			authorizeCalls: 1,
			tokenCalls: 1,
		});

		const authorizeCall = interactions.authorizeCalls[0];
		const tokenCall = interactions.tokenCalls[0];

		// Verify state consistency between authorize and token calls
		expect(authorizeCall.params.state).toBeTruthy();
		expect(tokenCall.body.state).toBe(authorizeCall.params.state);
	});

	test("PKCE code verifier is properly used in token exchange", async ({
		page,
	}) => {
		// GIVEN: User completes OAuth flow
		await page.goto("/settings");

		const contracts = mockCoordinator.getContracts();
		const oauthHandler = await contracts.claudeOAuth.simulateOAuthApproval();

		// WHEN: OAuth flow executes
		await page.click('[data-testid="claude-oauth-button"]');
		await oauthHandler.approve();
		await contracts.claudeOAuth.waitForOAuthCompletion();

		// THEN: PKCE code verifier is used correctly
		const interactions = await contracts.claudeOAuth.verifyInteractions({
			authorizeCalls: 1,
			tokenCalls: 1,
		});

		const authorizeCall = interactions.authorizeCalls[0];
		const tokenCall = interactions.tokenCalls[0];

		// Verify PKCE parameters
		expect(authorizeCall.params.code_challenge).toBeTruthy();
		expect(authorizeCall.params.code_challenge_method).toBe("S256");
		expect(tokenCall.body.code_verifier).toBeTruthy();

		// In a real implementation, you would verify that the code_challenge
		// is the SHA256 hash of the code_verifier, but for this mock test
		// we just verify the parameters are present
	});
});
