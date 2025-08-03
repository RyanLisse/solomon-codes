"use client";

import { createClientLogger } from "@/lib/logging/client";

const logger = createClientLogger("claude-token-store");

/**
 * Token data structure for Claude authentication
 */
export interface ClaudeTokenData {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	authMethod: "oauth" | "api_key";
	userId?: string;
}

/**
 * Claude user profile data
 */
export interface ClaudeUser {
	id: string;
	email: string;
	name: string;
	subscription: "pro" | "max";
	created_at: string;
	updated_at: string;
}

/**
 * Secure token storage utility for Claude authentication
 * Uses Web Crypto API for encryption with localStorage fallback
 */
export class ClaudeTokenStore {
	private static readonly STORAGE_KEY = "claude_auth_tokens";
	private static readonly ENCRYPTION_KEY_NAME = "claude_token_encryption_key";

	/**
	 * Generate or retrieve encryption key for token storage
	 */
	private async getEncryptionKey(): Promise<CryptoKey> {
		try {
			// Try to get existing key from IndexedDB or generate new one
			const keyData = localStorage.getItem(
				ClaudeTokenStore.ENCRYPTION_KEY_NAME,
			);

			if (keyData) {
				// Import existing key
				const keyBuffer = Uint8Array.from(atob(keyData), (c) =>
					c.charCodeAt(0),
				);
				return await crypto.subtle.importKey(
					"raw",
					keyBuffer,
					{ name: "AES-GCM" },
					false,
					["encrypt", "decrypt"],
				);
			}
			// Generate new key
			const key = await crypto.subtle.generateKey(
				{ name: "AES-GCM", length: 256 },
				true,
				["encrypt", "decrypt"],
			);

			// Export and store key
			const exportedKey = await crypto.subtle.exportKey("raw", key);
			const keyString = btoa(
				String.fromCharCode(...new Uint8Array(exportedKey)),
			);
			localStorage.setItem(ClaudeTokenStore.ENCRYPTION_KEY_NAME, keyString);

			return key;
		} catch (error) {
			logger.error("Failed to generate/retrieve encryption key", { error });
			throw new Error("Encryption key generation failed");
		}
	}

	/**
	 * Encrypt token data using Web Crypto API
	 */
	private async encryptTokens(tokens: ClaudeTokenData): Promise<string> {
		try {
			const key = await this.getEncryptionKey();
			const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

			const encodedData = new TextEncoder().encode(JSON.stringify(tokens));

			const encryptedData = await crypto.subtle.encrypt(
				{ name: "AES-GCM", iv },
				key,
				encodedData,
			);

			// Combine IV and encrypted data
			const combined = new Uint8Array(iv.length + encryptedData.byteLength);
			combined.set(iv);
			combined.set(new Uint8Array(encryptedData), iv.length);

			return btoa(String.fromCharCode(...combined));
		} catch (error) {
			logger.error("Token encryption failed", { error });
			throw new Error("Token encryption failed");
		}
	}

	/**
	 * Decrypt token data using Web Crypto API
	 */
	private async decryptTokens(encryptedData: string): Promise<ClaudeTokenData> {
		try {
			const key = await this.getEncryptionKey();
			const combined = Uint8Array.from(atob(encryptedData), (c) =>
				c.charCodeAt(0),
			);

			const iv = combined.slice(0, 12);
			const encrypted = combined.slice(12);

			const decryptedData = await crypto.subtle.decrypt(
				{ name: "AES-GCM", iv },
				key,
				encrypted,
			);

			const decodedData = new TextDecoder().decode(decryptedData);
			return JSON.parse(decodedData) as ClaudeTokenData;
		} catch (error) {
			logger.error("Token decryption failed", { error });
			throw new Error("Token decryption failed");
		}
	}

	/**
	 * Save tokens securely to encrypted localStorage
	 */
	async saveTokens(tokens: ClaudeTokenData): Promise<void> {
		try {
			const encryptedTokens = await this.encryptTokens(tokens);
			localStorage.setItem(ClaudeTokenStore.STORAGE_KEY, encryptedTokens);
			logger.debug("Claude tokens saved successfully", {
				authMethod: tokens.authMethod,
				expiresAt: new Date(tokens.expiresAt).toISOString(),
			});
		} catch (error) {
			logger.error("Failed to save Claude tokens", { error });
			throw new Error("Token storage failed");
		}
	}

	/**
	 * Retrieve and decrypt tokens from localStorage
	 */
	async getTokens(): Promise<ClaudeTokenData | null> {
		try {
			const encryptedData = localStorage.getItem(ClaudeTokenStore.STORAGE_KEY);
			if (!encryptedData) {
				return null;
			}

			const tokens = await this.decryptTokens(encryptedData);
			logger.debug("Claude tokens retrieved successfully", {
				authMethod: tokens.authMethod,
				expiresAt: new Date(tokens.expiresAt).toISOString(),
			});

			return tokens;
		} catch (error) {
			logger.error("Failed to retrieve Claude tokens", { error });
			// Clear corrupted data
			await this.clearTokens();
			return null;
		}
	}

	/**
	 * Clear all stored tokens and encryption keys
	 */
	async clearTokens(): Promise<void> {
		try {
			localStorage.removeItem(ClaudeTokenStore.STORAGE_KEY);
			localStorage.removeItem(ClaudeTokenStore.ENCRYPTION_KEY_NAME);
			logger.debug("Claude tokens cleared successfully");
		} catch (error) {
			logger.error("Failed to clear Claude tokens", { error });
		}
	}

	/**
	 * Check if tokens are expired with 5-minute buffer
	 */
	async isExpired(tokens: ClaudeTokenData): Promise<boolean> {
		const now = Date.now();
		const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
		const isExpired = now >= tokens.expiresAt - bufferTime;

		if (isExpired) {
			logger.debug("Claude tokens are expired or expiring soon", {
				expiresAt: new Date(tokens.expiresAt).toISOString(),
				currentTime: new Date(now).toISOString(),
			});
		}

		return isExpired;
	}

	/**
	 * Check if Web Crypto API is available
	 */
	static isWebCryptoAvailable(): boolean {
		return (
			typeof crypto !== "undefined" &&
			typeof crypto.subtle !== "undefined" &&
			typeof crypto.getRandomValues === "function"
		);
	}
}

/**
 * Global instance of the token store
 */
export const claudeTokenStore = new ClaudeTokenStore();
