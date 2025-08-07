/**
 * Agent Authentication Test Double
 * TDD London School approach for Agent Inbox authentication
 */

import { expect } from "vitest";

export interface AgentCredentials {
	agentId: string;
	token: string;
	permissions: string[];
	expiresAt: string;
}

export interface AuthenticationResult {
	success: boolean;
	agentId?: string;
	permissions?: string[];
	error?: string;
	expiresAt?: string;
}

export interface AgentAuthenticationCapabilities {
	authenticate(token: string): Promise<AuthenticationResult>;
	authorize(agentId: string, permission: string): Promise<boolean>;
	generateToken(agentId: string, permissions: string[]): Promise<string>;
	revokeToken(token: string): Promise<void>;
	refreshToken(token: string): Promise<string>;
	validateToken(token: string): Promise<boolean>;
	getAgentPermissions(agentId: string): string[];
	isTokenExpired(token: string): boolean;
}

export class AgentAuthenticationDouble
	implements AgentAuthenticationCapabilities
{
	private readonly validTokens: Map<string, AgentCredentials> = new Map();
	private readonly revokedTokens: Set<string> = new Set();

	// Test helpers for controlling behavior
	public shouldFailAuthentication = false;
	public shouldFailAuthorization = false;
	public shouldFailTokenGeneration = false;
	public authenticationLog: string[] = [];
	public authorizationLog: {
		agentId: string;
		permission: string;
		result: boolean;
	}[] = [];
	public tokenGenerationLog: {
		agentId: string;
		permissions: string[];
		token: string;
	}[] = [];
	public simulateDelay = 0;

	constructor() {
		// Pre-populate with test tokens for convenience
		this.addTestToken(
			"agent-001",
			["read", "write", "execute"],
			"test-token-001",
		);
		this.addTestToken("agent-002", ["read", "write"], "test-token-002");
		this.addTestToken(
			"queen-001",
			["read", "write", "execute", "admin"],
			"queen-token-001",
		);
	}

	async authenticate(token: string): Promise<AuthenticationResult> {
		this.authenticationLog.push(token);

		if (this.simulateDelay > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.simulateDelay));
		}

		if (this.shouldFailAuthentication) {
			return {
				success: false,
				error: "Simulated authentication failure",
			};
		}

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
		if (this.simulateDelay > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.simulateDelay));
		}

		if (this.shouldFailAuthorization) {
			this.authorizationLog.push({ agentId, permission, result: false });
			return false;
		}

		// Find agent's credentials
		const agentCredentials = Array.from(this.validTokens.values()).find(
			(cred) => cred.agentId === agentId,
		);

		if (!agentCredentials) {
			this.authorizationLog.push({ agentId, permission, result: false });
			return false;
		}

		const hasPermission =
			agentCredentials.permissions.includes(permission) ||
			agentCredentials.permissions.includes("admin");

		this.authorizationLog.push({ agentId, permission, result: hasPermission });
		return hasPermission;
	}

	async generateToken(agentId: string, permissions: string[]): Promise<string> {
		if (this.simulateDelay > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.simulateDelay));
		}

		if (this.shouldFailTokenGeneration) {
			throw new Error("Simulated token generation failure");
		}

		const token = `token-${agentId}-${Date.now()}`;
		const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

		const credentials: AgentCredentials = {
			agentId,
			token,
			permissions: [...permissions],
			expiresAt,
		};

		this.validTokens.set(token, credentials);
		this.tokenGenerationLog.push({ agentId, permissions, token });

		return token;
	}

	async revokeToken(token: string): Promise<void> {
		if (this.simulateDelay > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.simulateDelay));
		}

		this.revokedTokens.add(token);
		this.validTokens.delete(token);
	}

	async refreshToken(token: string): Promise<string> {
		const credentials = this.validTokens.get(token);
		if (!credentials) {
			throw new Error("Token not found");
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
			(cred) => cred.agentId === agentId,
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

	// Test helper methods
	addTestToken(agentId: string, permissions: string[], token: string): void {
		const credentials: AgentCredentials = {
			agentId,
			token,
			permissions,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};
		this.validTokens.set(token, credentials);
	}

	addExpiredToken(agentId: string, permissions: string[], token: string): void {
		const credentials: AgentCredentials = {
			agentId,
			token,
			permissions,
			expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
		};
		this.validTokens.set(token, credentials);
	}

	getValidTokens(): Map<string, AgentCredentials> {
		return new Map(this.validTokens);
	}

	getRevokedTokens(): Set<string> {
		return new Set(this.revokedTokens);
	}

	getAuthenticationLog(): string[] {
		return [...this.authenticationLog];
	}

	getAuthorizationLog(): {
		agentId: string;
		permission: string;
		result: boolean;
	}[] {
		return [...this.authorizationLog];
	}

	getTokenGenerationLog(): {
		agentId: string;
		permissions: string[];
		token: string;
	}[] {
		return [...this.tokenGenerationLog];
	}

	clearLogs(): void {
		this.authenticationLog = [];
		this.authorizationLog = [];
		this.tokenGenerationLog = [];
	}

	resetState(): void {
		this.validTokens.clear();
		this.revokedTokens.clear();
		this.clearLogs();
		this.shouldFailAuthentication = false;
		this.shouldFailAuthorization = false;
		this.shouldFailTokenGeneration = false;
		this.simulateDelay = 0;

		// Re-add test tokens
		this.addTestToken(
			"agent-001",
			["read", "write", "execute"],
			"test-token-001",
		);
		this.addTestToken("agent-002", ["read", "write"], "test-token-002");
		this.addTestToken(
			"queen-001",
			["read", "write", "execute", "admin"],
			"queen-token-001",
		);
	}
}

// Helper functions for test setup
export function createAgentAuthenticationDouble(
	options: Partial<{
		shouldFailAuthentication: boolean;
		shouldFailAuthorization: boolean;
		shouldFailTokenGeneration: boolean;
		simulateDelay: number;
	}> = {},
): AgentAuthenticationDouble {
	const double = new AgentAuthenticationDouble();

	if (options.shouldFailAuthentication) {
		double.shouldFailAuthentication = true;
	}
	if (options.shouldFailAuthorization) {
		double.shouldFailAuthorization = true;
	}
	if (options.shouldFailTokenGeneration) {
		double.shouldFailTokenGeneration = true;
	}
	if (options.simulateDelay) {
		double.simulateDelay = options.simulateDelay;
	}

	return double;
}

export function expectAgentAuthentication(auth: AgentAuthenticationDouble) {
	return {
		toHaveAuthenticated: (token: string) => {
			expect(auth.getAuthenticationLog()).toContain(token);
		},

		toHaveAuthorized: (
			agentId: string,
			permission: string,
			result: boolean,
		) => {
			const authorizationLog = auth.getAuthorizationLog();
			const matchingEntry = authorizationLog.find(
				(entry) =>
					entry.agentId === agentId &&
					entry.permission === permission &&
					entry.result === result,
			);
			expect(matchingEntry).toBeDefined();
		},

		toHaveGeneratedToken: (agentId: string, permissions: string[]) => {
			const tokenLog = auth.getTokenGenerationLog();
			const matchingEntry = tokenLog.find((entry) => {
				const entryPermissions = [...entry.permissions].sort((a, b) =>
					a.localeCompare(b),
				);
				const expectedPermissions = [...permissions].sort((a, b) =>
					a.localeCompare(b),
				);
				return (
					entry.agentId === agentId &&
					JSON.stringify(entryPermissions) ===
						JSON.stringify(expectedPermissions)
				);
			});
			expect(matchingEntry).toBeDefined();
		},

		toHaveValidToken: (token: string) => {
			const validTokens = auth.getValidTokens();
			expect(validTokens.has(token)).toBe(true);
		},

		toHaveRevokedToken: (token: string) => {
			const revokedTokens = auth.getRevokedTokens();
			expect(revokedTokens.has(token)).toBe(true);
		},

		toHavePermissions: (agentId: string, permissions: string[]) => {
			const agentPermissions = [...auth.getAgentPermissions(agentId)].sort(
				(a, b) => a.localeCompare(b),
			);
			const expectedPermissions = [...permissions].sort((a, b) =>
				a.localeCompare(b),
			);
			expect(agentPermissions).toEqual(expectedPermissions);
		},
	};
}
