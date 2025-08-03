import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	CLAUDE_OAUTH_CONFIG,
	ClaudeAuthError,
	getErrorMessage,
	type TokenResponse,
	validateState,
} from "@/lib/auth/claude-config";
import type { ClaudeUser } from "@/lib/auth/claude-token-store";
import { createContextLogger } from "@/lib/logging/factory";

const logger = createContextLogger("claude-auth-token");

// Request validation schema
const TokenExchangeSchema = z.object({
	code: z.string().min(1, "Authorization code is required"),
	verifier: z.string().min(1, "Code verifier is required"),
	state: z.string().min(1, "State parameter is required"),
	expectedState: z.string().min(1, "Expected state is required"),
});

/**
 * Exchange authorization code for access and refresh tokens
 * POST /api/auth/claude/token
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		logger.debug("Received Claude OAuth token exchange request", {
			hasCode: !!body.code,
			hasVerifier: !!body.verifier,
			hasState: !!body.state,
		});

		// Validate request body
		const validation = TokenExchangeSchema.safeParse(body);
		if (!validation.success) {
			logger.error("Invalid token exchange request", {
				errors: validation.error.issues,
			});
			return NextResponse.json(
				{
					success: false,
					error: {
						type: ClaudeAuthError.INVALID_CODE,
						message: "Invalid request parameters",
						details: validation.error.issues,
					},
				},
				{ status: 400 },
			);
		}

		const { code, verifier, state, expectedState } = validation.data;

		// Validate state parameter to prevent CSRF
		if (!validateState(state, expectedState)) {
			logger.error("State validation failed", { receivedState: state });
			return NextResponse.json(
				{
					success: false,
					error: {
						type: ClaudeAuthError.INVALID_STATE,
						message: getErrorMessage(ClaudeAuthError.INVALID_STATE),
					},
				},
				{ status: 400 },
			);
		}

		// Exchange code for tokens
		const tokenResponse = await exchangeCodeForTokens(code, verifier);

		if (!tokenResponse.success) {
			return NextResponse.json(tokenResponse, { status: 400 });
		}

		// Get user profile
		const userResponse = await getUserProfile(tokenResponse.data.access_token);

		if (!userResponse.success) {
			return NextResponse.json(userResponse, { status: 400 });
		}

		// Calculate expiration time
		const expiresAt = Date.now() + tokenResponse.data.expires_in * 1000;

		logger.debug("Claude OAuth token exchange successful", {
			userId: userResponse.data.id,
			expiresAt: new Date(expiresAt).toISOString(),
		});

		// Return tokens and user data
		return NextResponse.json({
			success: true,
			data: {
				accessToken: tokenResponse.data.access_token,
				refreshToken: tokenResponse.data.refresh_token,
				expiresAt,
				user: userResponse.data,
			},
		});
	} catch (error) {
		logger.error("Claude OAuth token exchange failed", {
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{
				success: false,
				error: {
					type: ClaudeAuthError.TOKEN_EXCHANGE_FAILED,
					message: getErrorMessage(ClaudeAuthError.TOKEN_EXCHANGE_FAILED),
				},
			},
			{ status: 500 },
		);
	}
}

/**
 * Exchange authorization code for tokens with Claude API
 */
async function exchangeCodeForTokens(
	code: string,
	codeVerifier: string,
): Promise<
	| { success: true; data: TokenResponse }
	| { success: false; error: { type: ClaudeAuthError; message: string } }
> {
	try {
		const response = await fetch(CLAUDE_OAUTH_CONFIG.TOKEN_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: CLAUDE_OAUTH_CONFIG.CLIENT_ID,
				code,
				redirect_uri: CLAUDE_OAUTH_CONFIG.REDIRECT_URI,
				code_verifier: codeVerifier,
			}),
		});

		if (!response.ok) {
			const errorData = await response.text();
			logger.error("Token exchange HTTP error", {
				status: response.status,
				statusText: response.statusText,
				error: errorData,
			});

			return {
				success: false,
				error: {
					type: ClaudeAuthError.TOKEN_EXCHANGE_FAILED,
					message: getErrorMessage(ClaudeAuthError.TOKEN_EXCHANGE_FAILED),
				},
			};
		}

		const tokens: TokenResponse = await response.json();
		return { success: true, data: tokens };
	} catch (error) {
		logger.error("Token exchange network error", {
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			success: false,
			error: {
				type: ClaudeAuthError.NETWORK_ERROR,
				message: getErrorMessage(ClaudeAuthError.NETWORK_ERROR),
			},
		};
	}
}

/**
 * Get user profile from Claude API
 */
async function getUserProfile(
	accessToken: string,
): Promise<
	| { success: true; data: ClaudeUser }
	| { success: false; error: { type: ClaudeAuthError; message: string } }
> {
	try {
		const response = await fetch("https://api.anthropic.com/v1/auth/user", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorData = await response.text();
			logger.error("User profile fetch HTTP error", {
				status: response.status,
				statusText: response.statusText,
				error: errorData,
			});

			return {
				success: false,
				error: {
					type: ClaudeAuthError.TOKEN_EXCHANGE_FAILED,
					message: "Failed to fetch user profile",
				},
			};
		}

		const user: ClaudeUser = await response.json();
		return { success: true, data: user };
	} catch (error) {
		logger.error("User profile fetch network error", {
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			success: false,
			error: {
				type: ClaudeAuthError.NETWORK_ERROR,
				message: getErrorMessage(ClaudeAuthError.NETWORK_ERROR),
			},
		};
	}
}
