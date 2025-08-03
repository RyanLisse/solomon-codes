"use client";

import { useCallback, useState } from "react";
import {
	ClaudeAuthError,
	getErrorMessage,
	parseAuthorizationCallback,
} from "@/lib/auth/claude-config";
import {
	type ClaudeTokenData,
	type ClaudeUser,
	claudeTokenStore,
} from "@/lib/auth/claude-token-store";
import { createClientLogger } from "@/lib/logging/client";

const logger = createClientLogger("claude-auth-hook");

/**
 * Claude authentication hook return type
 */
export interface UseClaudeAuthReturn {
	isAuthenticated: boolean;
	user: ClaudeUser | null;
	authMethod: "oauth" | "api_key" | null;
	isLoading: boolean;
	error: string | null;
	login: () => Promise<void>;
	loginWithApiKey: (apiKey: string) => Promise<void>;
	logout: () => Promise<void>;
	getAccessToken: () => Promise<string>;
}

/**
 * Hook for managing Claude authentication state
 * Supports both OAuth and API key authentication methods
 */
export function useClaudeAuth(): UseClaudeAuthReturn {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [user, setUser] = useState<ClaudeUser | null>(null);
	const [authMethod, setAuthMethod] = useState<"oauth" | "api_key" | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	/**
	 * Wait for OAuth popup to complete and return authorization result
	 */
	const waitForPopupCallback = useCallback(
		(
			popup: Window,
			_expectedState: string,
		): Promise<{
			code: string;
			state: string;
		}> => {
			return new Promise((resolve, reject) => {
				const checkPopup = () => {
					try {
						if (popup.closed) {
							reject(new Error("Authorization cancelled by user"));
							return;
						}

						// Check if popup has navigated to callback URL
						if (popup.location.href.includes("oauth/code/callback")) {
							const result = parseAuthorizationCallback(popup.location.href);

							popup.close();

							if (result.error) {
								reject(new Error(result.error_description || result.error));
								return;
							}

							if (!result.code || !result.state) {
								reject(new Error("Missing authorization code or state"));
								return;
							}

							resolve({
								code: result.code,
								state: result.state,
							});
							return;
						}

						// Continue checking
						setTimeout(checkPopup, 1000);
					} catch (_popupError) {
						// Popup might be on different domain, continue checking
						setTimeout(checkPopup, 1000);
					}
				};

				checkPopup();
			});
		},
		[],
	);

	/**
	 * Refresh OAuth tokens
	 */
	const refreshTokens = useCallback(async () => {
		const tokens = await claudeTokenStore.getTokens();
		if (!tokens || tokens.authMethod !== "oauth") {
			throw new Error("No OAuth tokens to refresh");
		}

		const response = await fetch("/api/auth/claude/refresh", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				refreshToken: tokens.refreshToken,
			}),
		});

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error?.message || "Token refresh failed");
		}

		// Update stored tokens
		const updatedTokens: ClaudeTokenData = {
			...tokens,
			accessToken: result.data.accessToken,
			refreshToken: result.data.refreshToken,
			expiresAt: result.data.expiresAt,
		};

		await claudeTokenStore.saveTokens(updatedTokens);

		logger.debug("Claude tokens refreshed successfully");
	}, []);

	/**
	 * Check current authentication status from stored tokens
	 * Note: Currently unused but kept for future initialization needs
	 */
	const _checkAuthStatus = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			const tokens = await claudeTokenStore.getTokens();
			if (!tokens) {
				setIsAuthenticated(false);
				setUser(null);
				setAuthMethod(null);
				return;
			}

			// Check if tokens are expired
			const isExpired = await claudeTokenStore.isExpired(tokens);
			if (isExpired && tokens.authMethod === "oauth") {
				// Try to refresh OAuth tokens
				try {
					await refreshTokens();
					return; // refreshTokens will update the state
				} catch (refreshError) {
					logger.error("Token refresh failed during auth check", {
						error: refreshError,
					});
					// Clear invalid tokens and continue as unauthenticated
					await claudeTokenStore.clearTokens();
				}
			}

			if (isExpired && tokens.authMethod === "api_key") {
				// API keys don't expire in the same way, but we should validate them
				logger.debug("API key tokens expired, user needs to re-authenticate");
				await claudeTokenStore.clearTokens();
				setIsAuthenticated(false);
				setUser(null);
				setAuthMethod(null);
				return;
			}

			// Get user data from token (for API keys, this is stored with the token)
			// For OAuth, we could fetch fresh user data, but we'll use stored data for now
			if (tokens.userId) {
				// Mock user data - in real implementation, you might fetch from API
				const userData: ClaudeUser = {
					id: tokens.userId,
					email: "authenticated-user@example.com",
					name: "Claude User",
					subscription: "pro",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};

				setUser(userData);
				setIsAuthenticated(true);
				setAuthMethod(tokens.authMethod);
			}
		} catch (authError) {
			logger.error("Error checking auth status", { error: authError });
			setError("Failed to check authentication status");
			setIsAuthenticated(false);
			setUser(null);
			setAuthMethod(null);
		} finally {
			setIsLoading(false);
		}
	}, [refreshTokens]);

	/**
	 * Initiate OAuth login flow with popup
	 */
	const login = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			// Get authorization URL from API
			const response = await fetch("/api/auth/claude/authorize");
			const result = await response.json();

			if (!result.success) {
				throw new Error(
					result.error?.message || "Failed to get authorization URL",
				);
			}

			const { url, verifier, state } = result.data;

			// Open popup for OAuth authorization
			const popup = window.open(
				url,
				"claude-oauth",
				"width=500,height=600,scrollbars=yes,resizable=yes",
			);

			if (!popup) {
				throw new Error(getErrorMessage(ClaudeAuthError.POPUP_BLOCKED));
			}

			// Wait for popup to complete authorization
			const authResult = await waitForPopupCallback(popup, state);

			// Exchange authorization code for tokens
			const tokenResponse = await fetch("/api/auth/claude/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					code: authResult.code,
					verifier,
					state: authResult.state,
					expectedState: state,
				}),
			});

			const tokenResult = await tokenResponse.json();

			if (!tokenResult.success) {
				throw new Error(
					tokenResult.error?.message || "Failed to exchange tokens",
				);
			}

			// Store tokens securely
			const tokenData: ClaudeTokenData = {
				accessToken: tokenResult.data.accessToken,
				refreshToken: tokenResult.data.refreshToken,
				expiresAt: tokenResult.data.expiresAt,
				authMethod: "oauth",
				userId: tokenResult.data.user.id,
			};

			await claudeTokenStore.saveTokens(tokenData);

			// Update state
			setUser(tokenResult.data.user);
			setIsAuthenticated(true);
			setAuthMethod("oauth");

			logger.debug("Claude OAuth login successful", {
				userId: tokenResult.data.user.id,
			});
		} catch (loginError) {
			logger.error("Claude OAuth login failed", { error: loginError });
			setError(
				loginError instanceof Error ? loginError.message : "Login failed",
			);
		} finally {
			setIsLoading(false);
		}
	}, [waitForPopupCallback]);

	/**
	 * Login with API key
	 */
	const loginWithApiKey = useCallback(async (apiKey: string) => {
		try {
			setIsLoading(true);
			setError(null);

			// Validate API key with server
			const response = await fetch("/api/auth/claude/validate", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ apiKey }),
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error?.message || "Invalid API key");
			}

			// Store API key as "token" (expires far in the future)
			const tokenData: ClaudeTokenData = {
				accessToken: apiKey, // API key acts as access token
				refreshToken: "", // No refresh token for API keys
				expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
				authMethod: "api_key",
				userId: result.data.user?.id,
			};

			await claudeTokenStore.saveTokens(tokenData);

			// Update state
			setUser(result.data.user);
			setIsAuthenticated(true);
			setAuthMethod("api_key");

			logger.debug("Claude API key login successful", {
				userId: result.data.user?.id,
			});
		} catch (apiKeyError) {
			logger.error("Claude API key login failed", { error: apiKeyError });
			setError(
				apiKeyError instanceof Error
					? apiKeyError.message
					: "API key authentication failed",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	/**
	 * Logout and clear all stored data
	 */
	const logout = useCallback(async () => {
		try {
			await claudeTokenStore.clearTokens();
			setIsAuthenticated(false);
			setUser(null);
			setAuthMethod(null);
			setError(null);

			logger.debug("Claude logout successful");
		} catch (logoutError) {
			logger.error("Claude logout error", { error: logoutError });
			// Still clear the state even if storage clearing fails
			setIsAuthenticated(false);
			setUser(null);
			setAuthMethod(null);
		}
	}, []);

	/**
	 * Get valid access token, refreshing if necessary
	 */
	const getAccessToken = useCallback(async (): Promise<string> => {
		const tokens = await claudeTokenStore.getTokens();
		if (!tokens) {
			throw new Error("No authentication tokens found");
		}

		// For API keys, return the key directly
		if (tokens.authMethod === "api_key") {
			return tokens.accessToken;
		}

		// For OAuth, check expiration and refresh if needed
		const isExpired = await claudeTokenStore.isExpired(tokens);
		if (isExpired) {
			await refreshTokens();
			const refreshedTokens = await claudeTokenStore.getTokens();
			if (!refreshedTokens) {
				throw new Error("Failed to refresh tokens");
			}
			return refreshedTokens.accessToken;
		}

		return tokens.accessToken;
	}, [refreshTokens]);

	return {
		isAuthenticated,
		user,
		authMethod,
		isLoading,
		error,
		login,
		loginWithApiKey,
		logout,
		getAccessToken,
	};
}
