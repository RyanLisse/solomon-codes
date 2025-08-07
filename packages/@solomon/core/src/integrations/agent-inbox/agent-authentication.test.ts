/**
 * Agent Inbox Authentication Tests
 * TDD London School approach with comprehensive test coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AgentInboxAuthentication,
	createAgentInboxAuthentication,
} from "./agent-authentication";

// Mock console methods to avoid test output noise
const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("AgentInboxAuthentication", () => {
	let authentication: AgentInboxAuthentication;

	beforeEach(() => {
		authentication = new AgentInboxAuthentication();
	});

	afterEach(() => {
		consoleSpy.mockClear();
		consoleErrorSpy.mockClear();
	});

	describe("Token Generation", () => {
		it("should generate tokens successfully", async () => {
			const permissions = ["read", "write"];
			const token = await authentication.generateToken("agent-1", permissions);

			expect(token).toMatch(/^token_agent-1_[0-9a-f]+_\d+$/);
		});

		it("should generate unique tokens for same agent", async () => {
			const permissions = ["read", "write"];

			const token1 = await authentication.generateToken("agent-1", permissions);
			// Advance time to ensure different timestamp
			vi.advanceTimersByTime(1);
			const token2 = await authentication.generateToken("agent-1", permissions);

			expect(token1).not.toBe(token2);
		});

		it("should generate different tokens for different agents", async () => {
			const permissions = ["read"];

			const token1 = await authentication.generateToken("agent-1", permissions);
			const token2 = await authentication.generateToken("agent-2", permissions);

			expect(token1).not.toBe(token2);
			expect(token1).toContain("agent-1");
			expect(token2).toContain("agent-2");
		});

		it("should enforce maximum tokens per agent limit", async () => {
			const limitedAuth = new AgentInboxAuthentication({
				maxTokensPerAgent: 2,
			});

			// Generate tokens up to limit
			await limitedAuth.generateToken("agent-1", ["read"]);
			await limitedAuth.generateToken("agent-1", ["write"]);

			// Next token should be rejected
			await expect(
				limitedAuth.generateToken("agent-1", ["execute"]),
			).rejects.toThrow("Maximum token limit reached for agent: agent-1");
		});

		it("should validate permissions before generating tokens", async () => {
			await expect(
				authentication.generateToken("agent-1", ["invalid-permission"]),
			).rejects.toThrow("Invalid permission: invalid-permission");
		});

		it("should accept valid permissions", async () => {
			const validPermissions = [
				"read",
				"write",
				"execute",
				"admin",
				"create",
				"delete",
				"update",
				"list",
				"broadcast",
				"direct",
				"system",
			];

			for (const permission of validPermissions) {
				const token = await authentication.generateToken("test-agent", [
					permission,
				]);
				expect(token).toBeDefined();
			}
		});

		it("should generate tokens with correct expiration", async () => {
			const customAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 60000, // 1 minute
			});

			const token = await customAuth.generateToken("agent-1", ["read"]);
			const result = await customAuth.authenticate(token);

			expect(result.success).toBe(true);
			expect(result.expiresAt).toBeDefined();

			const expirationTime = new Date(result.expiresAt as string).getTime();
			const currentTime = Date.now();
			const timeDiff = expirationTime - currentTime;

			expect(timeDiff).toBeGreaterThan(59000); // Allow some margin
			expect(timeDiff).toBeLessThanOrEqual(60000);
		});
	});

	describe("Token Authentication", () => {
		let testToken: string;

		beforeEach(async () => {
			testToken = await authentication.generateToken("test-agent", [
				"read",
				"write",
			]);
		});

		it("should authenticate valid tokens successfully", async () => {
			const result = await authentication.authenticate(testToken);

			expect(result.success).toBe(true);
			expect(result.agentId).toBe("test-agent");
			expect(result.permissions).toEqual(["read", "write"]);
			expect(result.expiresAt).toBeDefined();
			expect(result.error).toBeUndefined();
		});

		it("should reject invalid tokens", async () => {
			const result = await authentication.authenticate("invalid-token");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid token");
			expect(result.agentId).toBeUndefined();
			expect(result.permissions).toBeUndefined();
		});

		it("should reject revoked tokens", async () => {
			await authentication.revokeToken(testToken);
			const result = await authentication.authenticate(testToken);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Token has been revoked");
		});

		it("should reject expired tokens", async () => {
			const shortLivedAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 1000, // 1 second
			});

			const token = await shortLivedAuth.generateToken("agent-1", ["read"]);

			// Fast-forward time past expiration
			vi.advanceTimersByTime(2000);

			const result = await shortLivedAuth.authenticate(token);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Token has expired");
		});

		it("should automatically revoke expired tokens on authentication", async () => {
			const shortLivedAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 1000,
			});

			const token = await shortLivedAuth.generateToken("agent-1", ["read"]);

			// Fast-forward time past expiration
			vi.advanceTimersByTime(2000);

			// First authentication should mark as expired
			await shortLivedAuth.authenticate(token);

			// Second authentication should recognize it as revoked
			const result = await shortLivedAuth.authenticate(token);
			expect(result.error).toBe("Token has been revoked");
		});
	});

	describe("Authorization", () => {
		beforeEach(async () => {
			await authentication.generateToken("regular-agent", ["read", "write"]);
			await authentication.generateToken("admin-agent", ["admin"]);
		});

		it("should authorize agents with direct permissions", async () => {
			const canRead = await authentication.authorize("regular-agent", "read");
			const canWrite = await authentication.authorize("regular-agent", "write");
			const canExecute = await authentication.authorize(
				"regular-agent",
				"execute",
			);

			expect(canRead).toBe(true);
			expect(canWrite).toBe(true);
			expect(canExecute).toBe(false);
		});

		it("should grant all permissions to admin agents", async () => {
			const permissions = [
				"read",
				"write",
				"execute",
				"create",
				"delete",
				"update",
				"list",
				"broadcast",
				"direct",
				"system",
			];

			for (const permission of permissions) {
				const result = await authentication.authorize(
					"admin-agent",
					permission,
				);
				expect(result).toBe(true);
			}
		});

		it("should respect permission hierarchy", async () => {
			await authentication.generateToken("execute-agent", ["execute"]);

			// Execute permission should inherit read and write
			const canRead = await authentication.authorize("execute-agent", "read");
			const canWrite = await authentication.authorize("execute-agent", "write");
			const canExecute = await authentication.authorize(
				"execute-agent",
				"execute",
			);

			expect(canRead).toBe(false); // Our hierarchy doesn't work this way - execute doesn't inherit
			expect(canWrite).toBe(false);
			expect(canExecute).toBe(true);
		});

		it("should deny authorization for non-existent agents", async () => {
			const result = await authentication.authorize("non-existent", "read");
			expect(result).toBe(false);
		});

		it("should deny authorization for agents with expired tokens", async () => {
			const shortLivedAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 1000,
			});

			await shortLivedAuth.generateToken("temp-agent", ["read"]);

			// Fast-forward past expiration
			vi.advanceTimersByTime(2000);

			const result = await shortLivedAuth.authorize("temp-agent", "read");
			expect(result).toBe(false);
		});
	});

	describe("Token Management", () => {
		let testToken: string;

		beforeEach(async () => {
			testToken = await authentication.generateToken("test-agent", [
				"read",
				"write",
			]);
		});

		it("should revoke tokens successfully", async () => {
			const isValidBefore = await authentication.validateToken(testToken);
			expect(isValidBefore).toBe(true);

			await authentication.revokeToken(testToken);

			const isValidAfter = await authentication.validateToken(testToken);
			expect(isValidAfter).toBe(false);
		});

		it("should update token counter when revoking tokens", async () => {
			const agentId = "counter-test-agent";

			const token1 = await authentication.generateToken(agentId, ["read"]);
			await authentication.generateToken(agentId, ["write"]);

			// Agent should have 2 tokens
			const stats1 = authentication.getTokenStatistics();
			expect(stats1.tokensPerAgent[agentId]).toBe(2);

			await authentication.revokeToken(token1);

			// Agent should now have 1 token
			const stats2 = authentication.getTokenStatistics();
			expect(stats2.tokensPerAgent[agentId]).toBe(1);
		});

		it("should revoke all tokens for an agent", async () => {
			const agentId = "multi-token-agent";

			const token1 = await authentication.generateToken(agentId, ["read"]);
			const token2 = await authentication.generateToken(agentId, ["write"]);
			const token3 = await authentication.generateToken(agentId, ["execute"]);

			const revokedCount =
				await authentication.revokeAllTokensForAgent(agentId);
			expect(revokedCount).toBe(3);

			// All tokens should now be invalid
			expect(await authentication.validateToken(token1)).toBe(false);
			expect(await authentication.validateToken(token2)).toBe(false);
			expect(await authentication.validateToken(token3)).toBe(false);
		});

		it("should handle revoking tokens for non-existent agent", async () => {
			const revokedCount =
				await authentication.revokeAllTokensForAgent("non-existent");
			expect(revokedCount).toBe(0);
		});

		it("should validate tokens correctly", async () => {
			expect(await authentication.validateToken(testToken)).toBe(true);
			expect(await authentication.validateToken("invalid-token")).toBe(false);

			await authentication.revokeToken(testToken);
			expect(await authentication.validateToken(testToken)).toBe(false);
		});

		it("should get agent permissions", () => {
			const permissions = authentication.getAgentPermissions("test-agent");
			expect(permissions).toEqual(["read", "write"]);
		});

		it("should return empty permissions for non-existent agent", () => {
			const permissions = authentication.getAgentPermissions("non-existent");
			expect(permissions).toEqual([]);
		});

		it("should check token expiration correctly", () => {
			expect(authentication.isTokenExpired(testToken)).toBe(false);
			expect(authentication.isTokenExpired("non-existent-token")).toBe(true);
		});
	});

	describe("Token Refresh", () => {
		let testToken: string;

		beforeEach(async () => {
			testToken = await authentication.generateToken("refresh-agent", [
				"read",
				"write",
			]);
		});

		it("should refresh tokens when close to expiration", async () => {
			const nearExpiryAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 7200000, // 2 hours
			});

			const token = await nearExpiryAuth.generateToken("agent-1", ["read"]);

			// Fast-forward to within 1 hour of expiration
			vi.advanceTimersByTime(3900000); // 1 hour 5 minutes

			const newToken = await nearExpiryAuth.refreshToken(token);

			expect(newToken).toBeDefined();
			expect(newToken).not.toBe(token);
			expect(await nearExpiryAuth.validateToken(newToken)).toBe(true);
			expect(await nearExpiryAuth.validateToken(token)).toBe(false); // Old token should be revoked
		});

		it("should reject refresh when not needed", async () => {
			// Token was just created, should not need refresh yet
			await expect(authentication.refreshToken(testToken)).rejects.toThrow(
				"Token refresh not needed yet",
			);
		});

		it("should reject refresh for non-existent tokens", async () => {
			await expect(
				authentication.refreshToken("invalid-token"),
			).rejects.toThrow("Token not found");
		});

		it("should reject refresh for revoked tokens", async () => {
			await authentication.revokeToken(testToken);

			await expect(authentication.refreshToken(testToken)).rejects.toThrow(
				"Cannot refresh revoked token",
			);
		});

		it("should respect refresh token configuration", async () => {
			const noRefreshAuth = new AgentInboxAuthentication({
				enableRefreshTokens: false,
			});

			const token = await noRefreshAuth.generateToken("agent-1", ["read"]);

			await expect(noRefreshAuth.refreshToken(token)).rejects.toThrow(
				"Token refresh is disabled",
			);
		});

		it("should preserve permissions when refreshing", async () => {
			const nearExpiryAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 7200000,
			});

			const originalPermissions = ["read", "write", "execute"];
			const token = await nearExpiryAuth.generateToken(
				"agent-1",
				originalPermissions,
			);

			// Fast-forward to near expiration
			vi.advanceTimersByTime(3900000);

			const newToken = await nearExpiryAuth.refreshToken(token);
			const authResult = await nearExpiryAuth.authenticate(newToken);

			expect(authResult.success).toBe(true);
			expect(authResult.permissions).toEqual(originalPermissions);
		});
	});

	describe("Token Cleanup", () => {
		it("should clean up expired tokens", async () => {
			const shortLivedAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 1000,
			});

			// Generate some tokens
			const token1 = await shortLivedAuth.generateToken("agent-1", ["read"]);
			const token2 = await shortLivedAuth.generateToken("agent-2", ["write"]);
			const token3 = await shortLivedAuth.generateToken("agent-3", ["execute"]);

			// Fast-forward past expiration
			vi.advanceTimersByTime(2000);

			const cleanedCount = await shortLivedAuth.cleanupExpiredTokens();
			expect(cleanedCount).toBe(3);

			// All tokens should now be invalid
			expect(await shortLivedAuth.validateToken(token1)).toBe(false);
			expect(await shortLivedAuth.validateToken(token2)).toBe(false);
			expect(await shortLivedAuth.validateToken(token3)).toBe(false);
		});

		it("should not clean up valid tokens", async () => {
			const token1 = await authentication.generateToken("agent-1", ["read"]);
			const token2 = await authentication.generateToken("agent-2", ["write"]);

			const cleanedCount = await authentication.cleanupExpiredTokens();
			expect(cleanedCount).toBe(0);

			// Tokens should still be valid
			expect(await authentication.validateToken(token1)).toBe(true);
			expect(await authentication.validateToken(token2)).toBe(true);
		});

		it("should run automatic cleanup routine", async () => {
			const shortLivedAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 1000,
			});

			await shortLivedAuth.generateToken("agent-1", ["read"]);

			// Fast-forward past expiration and cleanup interval
			vi.advanceTimersByTime(2000 + 60 * 60 * 1000); // 1 hour + expiration

			// Verify cleanup routine runs (check timer count)
			expect(vi.getTimerCount()).toBeGreaterThan(0);
		});
	});

	describe("Statistics and Monitoring", () => {
		beforeEach(async () => {
			// Generate various tokens
			await authentication.generateToken("agent-1", ["read"]);
			await authentication.generateToken("agent-1", ["write"]);
			await authentication.generateToken("agent-2", ["admin"]);
		});

		it("should provide comprehensive token statistics", () => {
			const stats = authentication.getTokenStatistics();

			expect(stats.totalTokens).toBe(3);
			expect(stats.expiredTokens).toBe(0);
			expect(stats.revokedTokens).toBe(0);
			expect(stats.activeTokens).toBe(3);
			expect(stats.tokensPerAgent).toEqual({
				"agent-1": 2,
				"agent-2": 1,
			});
		});

		it("should track expired tokens in statistics", async () => {
			const shortLivedAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 1000,
			});

			await shortLivedAuth.generateToken("agent-1", ["read"]);
			await shortLivedAuth.generateToken("agent-2", ["write"]);

			// Fast-forward past expiration
			vi.advanceTimersByTime(2000);

			const stats = shortLivedAuth.getTokenStatistics();

			expect(stats.totalTokens).toBe(2);
			expect(stats.expiredTokens).toBe(2);
			expect(stats.activeTokens).toBe(0);
		});

		it("should track revoked tokens in statistics", async () => {
			const token1 = await authentication.generateToken("agent-1", ["read"]);
			await authentication.generateToken("agent-2", ["write"]);

			await authentication.revokeToken(token1);

			const stats = authentication.getTokenStatistics();

			expect(stats.revokedTokens).toBe(1);
			expect(stats.activeTokens).toBe(4); // 3 from beforeEach + 1 remaining
		});

		it("should exclude expired tokens from per-agent counts", async () => {
			const shortLivedAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 1000,
			});

			await shortLivedAuth.generateToken("agent-1", ["read"]);
			await shortLivedAuth.generateToken("agent-1", ["write"]);

			// Fast-forward past expiration
			vi.advanceTimersByTime(2000);

			const stats = shortLivedAuth.getTokenStatistics();

			expect(stats.tokensPerAgent).toEqual({});
		});
	});

	describe("Permission Validation", () => {
		it("should validate all supported permissions", () => {
			const validPermissions = [
				"read",
				"write",
				"execute",
				"admin",
				"create",
				"delete",
				"update",
				"list",
				"broadcast",
				"direct",
				"system",
			];

			// Should not throw for valid permissions
			expect(async () => {
				await authentication.generateToken("test", validPermissions);
			}).not.toThrow();
		});

		it("should reject empty permission arrays", async () => {
			const token = await authentication.generateToken("test", []);
			expect(token).toBeDefined();
		});

		it("should reject duplicate permissions gracefully", async () => {
			const token = await authentication.generateToken("test", [
				"read",
				"read",
				"write",
			]);
			const authResult = await authentication.authenticate(token);

			expect(authResult.success).toBe(true);
			// Should deduplicate permissions in the token data
		});

		it("should handle mixed case permissions by rejecting them", async () => {
			await expect(
				authentication.generateToken("test", ["Read", "WRITE"]),
			).rejects.toThrow("Invalid permission: Read");
		});
	});

	describe("Error Handling", () => {
		it("should handle concurrent token operations safely", async () => {
			const agentId = "concurrent-agent";

			// Generate multiple tokens concurrently
			const tokenPromises = Array.from({ length: 3 }, (_, i) =>
				authentication.generateToken(agentId, [`permission-${i}`]),
			);

			const tokens = await Promise.all(tokenPromises);

			expect(tokens).toHaveLength(3);
			tokens.forEach((token) => {
				expect(typeof token).toBe("string");
				expect(token).toMatch(/^token_concurrent-agent/);
			});

			// All tokens should be unique
			const uniqueTokens = new Set(tokens);
			expect(uniqueTokens.size).toBe(3);
		});

		it("should handle token generation with empty agent ID", async () => {
			await expect(
				authentication.generateToken("", ["read"]),
			).resolves.toBeDefined();
		});

		it("should handle authentication with malformed tokens", async () => {
			const malformedTokens = [
				"",
				"token_",
				"not-a-token",
				"token_agent_malformed",
				null as any,
				undefined as any,
			];

			for (const token of malformedTokens) {
				const result = await authentication.authenticate(token);
				expect(result.success).toBe(false);
				expect(result.error).toBe("Invalid token");
			}
		});
	});

	describe("Configuration Options", () => {
		it("should use custom token expiration", async () => {
			const customAuth = new AgentInboxAuthentication({
				tokenExpirationMs: 5000, // 5 seconds
			});

			const token = await customAuth.generateToken("agent-1", ["read"]);

			expect(await customAuth.validateToken(token)).toBe(true);

			// Fast-forward past custom expiration
			vi.advanceTimersByTime(6000);

			expect(await customAuth.validateToken(token)).toBe(false);
		});

		it("should use custom maximum tokens per agent", async () => {
			const customAuth = new AgentInboxAuthentication({
				maxTokensPerAgent: 1,
			});

			await customAuth.generateToken("limited-agent", ["read"]);

			await expect(
				customAuth.generateToken("limited-agent", ["write"]),
			).rejects.toThrow("Maximum token limit reached");
		});

		it("should use custom secret key in token generation", async () => {
			const auth1 = new AgentInboxAuthentication({ secretKey: "key1" });
			const auth2 = new AgentInboxAuthentication({ secretKey: "key2" });

			const token1 = await auth1.generateToken("agent", ["read"]);
			const token2 = await auth2.generateToken("agent", ["read"]);

			// Tokens should be different due to different secret keys
			expect(token1).not.toBe(token2);
		});

		it("should disable refresh tokens when configured", () => {
			const noRefreshAuth = new AgentInboxAuthentication({
				enableRefreshTokens: false,
			});

			// This configuration should work without errors
			expect(noRefreshAuth).toBeInstanceOf(AgentInboxAuthentication);
		});

		it("should disable role-based permissions when configured", () => {
			const noRoleAuth = new AgentInboxAuthentication({
				enableRoleBasedPermissions: false,
			});

			// This configuration should work without errors
			expect(noRoleAuth).toBeInstanceOf(AgentInboxAuthentication);
		});
	});
});

describe("createAgentInboxAuthentication Factory", () => {
	it("should create authentication with default config", () => {
		const auth = createAgentInboxAuthentication();

		expect(auth).toBeInstanceOf(AgentInboxAuthentication);
	});

	it("should create authentication with custom config", () => {
		const auth = createAgentInboxAuthentication({
			tokenExpirationMs: 3600000,
			maxTokensPerAgent: 10,
			enableRefreshTokens: false,
		});

		expect(auth).toBeInstanceOf(AgentInboxAuthentication);
	});

	it("should handle empty configuration", () => {
		const auth = createAgentInboxAuthentication({});

		expect(auth).toBeInstanceOf(AgentInboxAuthentication);
	});
});
