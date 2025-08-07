/**
 * Agent Authentication Implementation
 * Token-based security system for Agent Inbox
 */

import type {
	AgentAuthenticationCapabilities,
	AgentCredentials,
	AuthenticationResult,
} from "../../tests/test-doubles/integrations/agent-inbox/agent-authentication.double";

export interface AgentAuthenticationConfig {
	tokenExpirationMs?: number;
	maxTokensPerAgent?: number;
	secretKey?: string;
	enableRefreshTokens?: boolean;
	enableRoleBasedPermissions?: boolean;
}

export class AgentInboxAuthentication
	implements AgentAuthenticationCapabilities
{
	private readonly validTokens: Map<string, AgentCredentials> = new Map();
	private readonly revokedTokens: Set<string> = new Set();
	private readonly config: Required<AgentAuthenticationConfig>;
	private readonly tokenCounter: Map<string, number> = new Map();

	constructor(config: AgentAuthenticationConfig = {}) {
		this.config = {
			tokenExpirationMs: config.tokenExpirationMs || 24 * 60 * 60 * 1000, // 24 hours
			maxTokensPerAgent: config.maxTokensPerAgent || 5,
			secretKey: config.secretKey || "default-secret-key",
			enableRefreshTokens: config.enableRefreshTokens || true,
			enableRoleBasedPermissions: config.enableRoleBasedPermissions || true,
		};

		// Start token cleanup routine
		this.startTokenCleanupRoutine();
	}

	async authenticate(token: string): Promise<AuthenticationResult> {
		// Check if token is revoked
		if (this.revokedTokens.has(token)) {
			return {
				success: false,
				error: "Token has been revoked",
			};
		}

		// Check if token exists and is valid
		const credentials = this.validTokens.get(token);
		if (!credentials) {
			return {
				success: false,
				error: "Invalid token",
			};
		}

		// Check if token is expired
		if (this.isTokenExpired(token)) {
			// Automatically revoke expired token
			await this.revokeToken(token);
			return {
				success: false,
				error: "Token has expired",
			};
		}

		return {
			success: true,
			agentId: credentials.agentId,
			permissions: [...credentials.permissions],
			expiresAt: credentials.expiresAt,
		};
	}

	async authorize(agentId: string, permission: string): Promise<boolean> {
		// Find agent's credentials
		const agentCredentials = Array.from(this.validTokens.values()).find(
			(cred) => cred.agentId === agentId && !this.isTokenExpired(cred.token),
		);

		if (!agentCredentials) {
			return false;
		}

		// Check permission hierarchy
		const hasPermission = this.checkPermissionHierarchy(
			agentCredentials.permissions,
			permission,
		);

		return hasPermission;
	}

	async generateToken(agentId: string, permissions: string[]): Promise<string> {
		// Check token limit per agent
		const currentTokenCount = this.tokenCounter.get(agentId) || 0;
		if (currentTokenCount >= this.config.maxTokensPerAgent) {
			throw new Error(`Maximum token limit reached for agent: ${agentId}`);
		}

		// Validate permissions
		this.validatePermissions(permissions);

		// Generate secure token
		const token = this.generateSecureToken(agentId, permissions);
		const expiresAt = new Date(
			Date.now() + this.config.tokenExpirationMs,
		).toISOString();

		const credentials: AgentCredentials = {
			agentId,
			token,
			permissions: [...permissions],
			expiresAt,
		};

		this.validTokens.set(token, credentials);
		this.tokenCounter.set(agentId, currentTokenCount + 1);

		return token;
	}

	async revokeToken(token: string): Promise<void> {
		const credentials = this.validTokens.get(token);

		if (credentials) {
			// Update token counter
			const currentCount = this.tokenCounter.get(credentials.agentId) || 0;
			this.tokenCounter.set(credentials.agentId, Math.max(0, currentCount - 1));
		}

		this.revokedTokens.add(token);
		this.validTokens.delete(token);
	}

	async refreshToken(token: string): Promise<string> {
		if (!this.config.enableRefreshTokens) {
			throw new Error("Token refresh is disabled");
		}

		const credentials = this.validTokens.get(token);
		if (!credentials) {
			throw new Error("Token not found");
		}

		if (this.revokedTokens.has(token)) {
			throw new Error("Cannot refresh revoked token");
		}

		// Check if token is close to expiration (within 1 hour)
		const expirationTime = new Date(credentials.expiresAt).getTime();
		const currentTime = Date.now();
		const oneHour = 60 * 60 * 1000;

		if (expirationTime - currentTime > oneHour) {
			throw new Error("Token refresh not needed yet");
		}

		// Revoke old token
		await this.revokeToken(token);

		// Generate new token with same permissions
		return await this.generateToken(
			credentials.agentId,
			credentials.permissions,
		);
	}

	async validateToken(token: string): Promise<boolean> {
		const authResult = await this.authenticate(token);
		return authResult.success;
	}

	getAgentPermissions(agentId: string): string[] {
		const agentCredentials = Array.from(this.validTokens.values()).find(
			(cred) => cred.agentId === agentId && !this.isTokenExpired(cred.token),
		);

		return agentCredentials ? [...agentCredentials.permissions] : [];
	}

	isTokenExpired(token: string): boolean {
		const credentials = this.validTokens.get(token);
		if (!credentials) {
			return true;
		}

		return new Date() > new Date(credentials.expiresAt);
	}

	// Additional management methods
	async revokeAllTokensForAgent(agentId: string): Promise<number> {
		let revokedCount = 0;
		const tokensToRevoke: string[] = [];

		// Find all tokens for the agent
		for (const [token, credentials] of this.validTokens) {
			if (credentials.agentId === agentId) {
				tokensToRevoke.push(token);
			}
		}

		// Revoke all found tokens
		for (const token of tokensToRevoke) {
			await this.revokeToken(token);
			revokedCount++;
		}

		return revokedCount;
	}

	async cleanupExpiredTokens(): Promise<number> {
		let cleanedCount = 0;
		const expiredTokens: string[] = [];

		// Find expired tokens
		for (const [token] of this.validTokens) {
			if (this.isTokenExpired(token)) {
				expiredTokens.push(token);
			}
		}

		// Revoke expired tokens
		for (const token of expiredTokens) {
			await this.revokeToken(token);
			cleanedCount++;
		}

		return cleanedCount;
	}

	getTokenStatistics(): {
		totalTokens: number;
		expiredTokens: number;
		revokedTokens: number;
		activeTokens: number;
		tokensPerAgent: Record<string, number>;
	} {
		const totalTokens = this.validTokens.size + this.revokedTokens.size;
		const expiredTokens = Array.from(this.validTokens.keys()).filter((token) =>
			this.isTokenExpired(token),
		).length;
		const revokedTokens = this.revokedTokens.size;
		const activeTokens = this.validTokens.size - expiredTokens;

		const tokensPerAgent: Record<string, number> = {};
		for (const credentials of this.validTokens.values()) {
			if (!this.isTokenExpired(credentials.token)) {
				tokensPerAgent[credentials.agentId] =
					(tokensPerAgent[credentials.agentId] || 0) + 1;
			}
		}

		return {
			totalTokens,
			expiredTokens,
			revokedTokens,
			activeTokens,
			tokensPerAgent,
		};
	}

	private validatePermissions(permissions: string[]): void {
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

		for (const permission of permissions) {
			if (!validPermissions.includes(permission)) {
				throw new Error(`Invalid permission: ${permission}`);
			}
		}
	}

	private checkPermissionHierarchy(
		userPermissions: string[],
		requiredPermission: string,
	): boolean {
		// Admin permission grants all access
		if (userPermissions.includes("admin")) {
			return true;
		}

		// Direct permission check
		if (userPermissions.includes(requiredPermission)) {
			return true;
		}

		// Check permission hierarchy
		const permissionHierarchy: Record<string, string[]> = {
			write: ["read"],
			execute: ["read", "write"],
			delete: ["read", "write"],
			admin: [
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
			],
		};

		const hierarchicalPermissions =
			permissionHierarchy[requiredPermission] || [];
		return userPermissions.some((permission) =>
			hierarchicalPermissions.includes(permission),
		);
	}

	private generateSecureToken(agentId: string, permissions: string[]): string {
		// In a real implementation, this would use proper cryptographic functions
		// For now, we'll create a deterministic but unique token
		const timestamp = Date.now().toString();
		const sortedPermissions = [...permissions].sort((a, b) =>
			a.localeCompare(b),
		);
		const permissionHash = sortedPermissions.join("|");
		const tokenData = `${agentId}:${permissionHash}:${timestamp}`;

		// Simple hash function (replace with proper crypto in production)
		let hash = 0;
		for (let i = 0; i < tokenData.length; i++) {
			const char = tokenData.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}

		return `token_${agentId}_${Math.abs(hash).toString(16)}_${timestamp}`;
	}

	private startTokenCleanupRoutine(): void {
		// Run cleanup every hour
		setInterval(
			async () => {
				try {
					const cleaned = await this.cleanupExpiredTokens();
					if (cleaned > 0) {
						console.debug(`Cleaned up ${cleaned} expired tokens`);
					}
				} catch (error) {
					console.error("Error in token cleanup routine:", error);
				}
			},
			60 * 60 * 1000,
		); // 1 hour
	}
}

// Factory function for creating Agent Inbox authentication
export function createAgentInboxAuthentication(
	config?: AgentAuthenticationConfig,
): AgentInboxAuthentication {
	return new AgentInboxAuthentication(config);
}
