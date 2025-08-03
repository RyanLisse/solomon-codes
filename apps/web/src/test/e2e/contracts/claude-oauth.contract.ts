/**
 * Claude OAuth Mock Contract
 *
 * London School TDD Contract Definition
 * - Defines expected interactions for Claude OAuth flow
 * - Provides verification methods for behavior testing
 * - Encapsulates mock expectations and responses
 */
import { expect, type Page } from "@playwright/test";

export interface ClaudeOAuthInteraction {
	type: "authorize" | "token" | "user_info";
	timestamp: number;
	params?: Record<string, string | number | boolean>;
	body?: Record<string, string | number | boolean>;
}

export interface ClaudeTokenData {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: string;
	scope: string;
}

export interface ClaudeUser {
	id: string;
	email: string;
	name: string;
	subscription: string;
	created_at: string;
	updated_at: string;
}

/**
 * Claude OAuth Mock Contract
 * Defines the expected behavior and interactions for Claude OAuth flow
 */
export class ClaudeOAuthContract {
	constructor(private page: Page) {}

	/**
	 * Mock the authorization initiation
	 * Verifies that the application starts OAuth flow correctly
	 */
	async expectAuthorizationRequest(expectedParams: {
		client_id?: string;
		redirect_uri?: string;
		code_challenge?: string;
		state?: string;
	}) {
		// This will be verified by checking the mock server logs
		return {
			withClientId: (clientId: string) => ({
				...expectedParams,
				client_id: clientId,
			}),
			withRedirectUri: (uri: string) => ({
				...expectedParams,
				redirect_uri: uri,
			}),
			withCodeChallenge: (challenge: string) => ({
				...expectedParams,
				code_challenge: challenge,
			}),
			withState: (state: string) => ({ ...expectedParams, state }),
		};
	}

	/**
	 * Mock the token exchange
	 * Verifies that the application exchanges authorization code for tokens
	 */
	async expectTokenExchange(expectedBody: {
		code?: string;
		client_id?: string;
		code_verifier?: string;
	}) {
		return {
			withCode: (code: string) => ({ ...expectedBody, code }),
			withClientId: (clientId: string) => ({
				...expectedBody,
				client_id: clientId,
			}),
			withCodeVerifier: (verifier: string) => ({
				...expectedBody,
				code_verifier: verifier,
			}),
		};
	}

	/**
	 * Mock user info retrieval
	 * Verifies that the application fetches user data with valid token
	 */
	async expectUserInfoRequest(expectedToken: string) {
		return {
			withBearerToken: expectedToken,
			returnsUser: (userData: ClaudeUser) => userData,
		};
	}

	/**
	 * Verify OAuth interactions occurred as expected
	 */
	async verifyInteractions(expectedInteractions: {
		authorizeCalls: number;
		tokenCalls: number;
		userInfoCalls?: number;
	}) {
		const response = await this.page.request.get(
			"http://localhost:3002/test/interactions",
		);
		const interactions = await response.json();

		const claudeOAuth = interactions.claudeOAuth || [];

		const authorizeCalls = claudeOAuth.filter(
			(i: ClaudeOAuthInteraction) => i.type === "authorize",
		).length;
		const tokenCalls = claudeOAuth.filter(
			(i: ClaudeOAuthInteraction) => i.type === "token",
		).length;
		const userInfoCalls = claudeOAuth.filter(
			(i: ClaudeOAuthInteraction) => i.type === "user_info",
		).length;

		expect(authorizeCalls, "Authorization calls").toBe(
			expectedInteractions.authorizeCalls,
		);
		expect(tokenCalls, "Token exchange calls").toBe(
			expectedInteractions.tokenCalls,
		);

		if (expectedInteractions.userInfoCalls !== undefined) {
			expect(userInfoCalls, "User info calls").toBe(
				expectedInteractions.userInfoCalls,
			);
		}

		return {
			authorizeCalls: claudeOAuth.filter(
				(i: ClaudeOAuthInteraction) => i.type === "authorize",
			),
			tokenCalls: claudeOAuth.filter(
				(i: ClaudeOAuthInteraction) => i.type === "token",
			),
			userInfoCalls: claudeOAuth.filter(
				(i: ClaudeOAuthInteraction) => i.type === "user_info",
			),
		};
	}

	/**
	 * Verify specific authorization parameters
	 */
	async verifyAuthorizationParams(expectedParams: Record<string, string>) {
		const interactions = await this.verifyInteractions({
			authorizeCalls: 1,
			tokenCalls: 0,
		});
		const authorizeCall = interactions.authorizeCalls[0];

		for (const [key, expectedValue] of Object.entries(expectedParams)) {
			expect(authorizeCall.params[key], `Authorization parameter ${key}`).toBe(
				expectedValue,
			);
		}
	}

	/**
	 * Verify token exchange body
	 */
	async verifyTokenExchangeBody(expectedBody: Record<string, string>) {
		const interactions = await this.verifyInteractions({
			authorizeCalls: 1,
			tokenCalls: 1,
		});
		const tokenCall = interactions.tokenCalls[0];

		for (const [key, expectedValue] of Object.entries(expectedBody)) {
			expect(tokenCall.body[key], `Token exchange parameter ${key}`).toBe(
				expectedValue,
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
	 * Simulate OAuth approval in popup
	 * This method handles the OAuth popup interaction
	 */
	async simulateOAuthApproval() {
		// Wait for popup to appear and interact with it
		const popupPromise = this.page.waitForEvent("popup");

		// This will be called when the OAuth button is clicked in the actual test
		return {
			approve: async () => {
				const popup = await popupPromise;
				await popup.waitForLoadState();
				await popup.click('button:has-text("Approve")');
				await popup.waitForEvent("close");
			},
			deny: async () => {
				const popup = await popupPromise;
				await popup.waitForLoadState();
				await popup.click('button:has-text("Deny")');
				await popup.waitForEvent("close");
			},
		};
	}

	/**
	 * Wait for OAuth flow completion
	 */
	async waitForOAuthCompletion() {
		// Wait for the authentication state to update in the UI
		await this.page.waitForSelector(
			'[data-testid="claude-auth-status"]:has-text("Connected")',
			{
				timeout: 10000,
			},
		);
	}
}
