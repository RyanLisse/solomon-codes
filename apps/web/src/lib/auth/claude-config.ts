"use client";

import { generateChallenge } from "pkce-challenge";

/**
 * Claude OAuth 2.0 configuration constants
 */
export const CLAUDE_OAUTH_CONFIG = {
	CLIENT_ID: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
	AUTHORIZE_URL: "https://claude.ai/oauth/authorize",
	TOKEN_URL: "https://console.anthropic.com/v1/oauth/token",
	REDIRECT_URI: "https://console.anthropic.com/oauth/code/callback",
	SCOPES: "org:create_api_key user:profile user:inference",
	RESPONSE_TYPE: "code",
	CODE_CHALLENGE_METHOD: "S256",
} as const;

/**
 * Get OAuth URLs (with mock server support in test mode)
 */
export function getOAuthUrls() {
	const isTestMode =
		typeof window !== "undefined" &&
		(window.location.hostname === "localhost" ||
			process.env.NODE_ENV === "test");

	if (isTestMode) {
		return {
			AUTHORIZE_URL: "http://localhost:3002/oauth2/authorize",
			TOKEN_URL: "http://localhost:3002/oauth2/token",
			USER_INFO_URL: "http://localhost:3002/v1/me",
			REDIRECT_URI: "http://localhost:3001/oauth/code/callback",
		};
	}

	return {
		AUTHORIZE_URL: CLAUDE_OAUTH_CONFIG.AUTHORIZE_URL,
		TOKEN_URL: CLAUDE_OAUTH_CONFIG.TOKEN_URL,
		USER_INFO_URL: "https://console.anthropic.com/v1/me",
		REDIRECT_URI: CLAUDE_OAUTH_CONFIG.REDIRECT_URI,
	};
}

/**
 * OAuth error types for Claude authentication
 */
export enum ClaudeAuthError {
	OAUTH_FAILED = "oauth_failed",
	TOKEN_EXCHANGE_FAILED = "token_exchange_failed",
	TOKEN_REFRESH_FAILED = "token_refresh_failed",
	API_KEY_INVALID = "api_key_invalid",
	NETWORK_ERROR = "network_error",
	STORAGE_ERROR = "storage_error",
	POPUP_BLOCKED = "popup_blocked",
	INVALID_STATE = "invalid_state",
	INVALID_CODE = "invalid_code",
	EXPIRED_TOKEN = "expired_token",
}

/**
 * Token response from Claude OAuth
 */
export interface TokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: "Bearer";
	scope: string;
}

/**
 * PKCE challenge data structure
 */
export interface PKCEChallenge {
	codeChallenge: string;
	codeVerifier: string;
	state: string;
}

/**
 * OAuth authorization URL parameters
 */
export interface AuthorizationParams {
	client_id: string;
	redirect_uri: string;
	response_type: string;
	scope: string;
	code_challenge: string;
	code_challenge_method: string;
	state: string;
}

/**
 * Generate PKCE challenge for OAuth flow
 */
export async function generatePKCEChallenge(): Promise<PKCEChallenge> {
	const codeVerifier = generateRandomString(128);
	const challenge = await generateChallenge(codeVerifier);
	const state = generateRandomString(32);

	return {
		codeChallenge: challenge,
		codeVerifier: codeVerifier,
		state,
	};
}

/**
 * Generate random string for state parameter
 */
function generateRandomString(length: number): string {
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/**
 * Build OAuth authorization URL with PKCE
 */
export function buildAuthorizationURL(pkce: PKCEChallenge): string {
	const urls = getOAuthUrls();

	const params: AuthorizationParams = {
		client_id: CLAUDE_OAUTH_CONFIG.CLIENT_ID,
		redirect_uri: urls.REDIRECT_URI,
		response_type: CLAUDE_OAUTH_CONFIG.RESPONSE_TYPE,
		scope: CLAUDE_OAUTH_CONFIG.SCOPES,
		code_challenge: pkce.codeChallenge,
		code_challenge_method: CLAUDE_OAUTH_CONFIG.CODE_CHALLENGE_METHOD,
		state: pkce.state,
	};

	const searchParams = new URLSearchParams(
		params as unknown as Record<string, string>,
	);
	return `${urls.AUTHORIZE_URL}?${searchParams.toString()}`;
}

/**
 * Parse authorization code from callback URL
 */
export function parseAuthorizationCallback(url: string): {
	code?: string;
	state?: string;
	error?: string;
	error_description?: string;
} {
	const urlObj = new URL(url);
	const params = urlObj.searchParams;

	return {
		code: params.get("code") || undefined,
		state: params.get("state") || undefined,
		error: params.get("error") || undefined,
		error_description: params.get("error_description") || undefined,
	};
}

/**
 * Validate state parameter to prevent CSRF attacks
 */
export function validateState(
	receivedState: string,
	expectedState: string,
): boolean {
	return receivedState === expectedState;
}

/**
 * API key validation pattern for Claude
 */
export const CLAUDE_API_KEY_PATTERN = /^sk-ant-api\d{2}-[\w-]{95}$/;

/**
 * Validate Claude API key format
 */
export function isValidClaudeAPIKey(apiKey: string): boolean {
	return CLAUDE_API_KEY_PATTERN.test(apiKey);
}

/**
 * Error message mapping for user-friendly errors
 */
export const ERROR_MESSAGES: Record<ClaudeAuthError, string> = {
	[ClaudeAuthError.OAUTH_FAILED]:
		"OAuth authentication failed. Please try again.",
	[ClaudeAuthError.TOKEN_EXCHANGE_FAILED]:
		"Failed to exchange authorization code for tokens.",
	[ClaudeAuthError.TOKEN_REFRESH_FAILED]:
		"Token refresh failed. Please sign in again.",
	[ClaudeAuthError.API_KEY_INVALID]:
		"Invalid API key format. Please check your key.",
	[ClaudeAuthError.NETWORK_ERROR]:
		"Network error occurred. Please check your connection.",
	[ClaudeAuthError.STORAGE_ERROR]:
		"Failed to store authentication data securely.",
	[ClaudeAuthError.POPUP_BLOCKED]:
		"Popup was blocked. Please allow popups and try again.",
	[ClaudeAuthError.INVALID_STATE]:
		"Invalid state parameter. Security check failed.",
	[ClaudeAuthError.INVALID_CODE]: "Invalid authorization code received.",
	[ClaudeAuthError.EXPIRED_TOKEN]: "Authentication token has expired.",
};

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: ClaudeAuthError): string {
	return ERROR_MESSAGES[error] || "An unexpected error occurred.";
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: ClaudeAuthError): boolean {
	const retryableErrors = [
		ClaudeAuthError.NETWORK_ERROR,
		ClaudeAuthError.TOKEN_REFRESH_FAILED,
		ClaudeAuthError.POPUP_BLOCKED,
	];
	return retryableErrors.includes(error);
}
