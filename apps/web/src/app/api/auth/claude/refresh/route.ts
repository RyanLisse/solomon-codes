import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	CLAUDE_OAUTH_CONFIG,
	ClaudeAuthError,
	getErrorMessage,
	type TokenResponse,
} from "@/lib/auth/claude-config";
import { createContextLogger } from "@/lib/logging/factory";

const logger = createContextLogger("claude-auth-refresh");

// Request validation schema
const RefreshTokenSchema = z.object({
	refreshToken: z.string().min(1, "Refresh token is required"),
});

/**
 * Refresh expired access token using refresh token
 * POST /api/auth/claude/refresh
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		logger.debug("Received Claude OAuth token refresh request");

		// Validate request body
		const validation = RefreshTokenSchema.safeParse(body);
		if (!validation.success) {
			logger.error("Invalid token refresh request", {
				errors: validation.error.issues,
			});
			return NextResponse.json(
				{
					success: false,
					error: {
						type: ClaudeAuthError.TOKEN_REFRESH_FAILED,
						message: "Invalid refresh token",
						details: validation.error.issues,
					},
				},
				{ status: 400 },
			);
		}

		const { refreshToken } = validation.data;

		// Refresh tokens with Claude API
		const tokenResponse = await refreshAccessToken(refreshToken);

		if (!tokenResponse.success) {
			return NextResponse.json(tokenResponse, { status: 401 });
		}

		// Calculate new expiration time
		const expiresAt = Date.now() + tokenResponse.data.expires_in * 1000;

		logger.debug("Claude OAuth token refresh successful", {
			expiresAt: new Date(expiresAt).toISOString(),
		});

		// Return new tokens
		return NextResponse.json({
			success: true,
			data: {
				accessToken: tokenResponse.data.access_token,
				refreshToken: tokenResponse.data.refresh_token,
				expiresAt,
			},
		});
	} catch (error) {
		logger.error("Claude OAuth token refresh failed", {
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{
				success: false,
				error: {
					type: ClaudeAuthError.TOKEN_REFRESH_FAILED,
					message: getErrorMessage(ClaudeAuthError.TOKEN_REFRESH_FAILED),
				},
			},
			{ status: 500 },
		);
	}
}

/**
 * Refresh access token with Claude API
 */
async function refreshAccessToken(
	refreshToken: string,
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
				grant_type: "refresh_token",
				client_id: CLAUDE_OAUTH_CONFIG.CLIENT_ID,
				refresh_token: refreshToken,
			}),
		});

		if (!response.ok) {
			const errorData = await response.text();
			logger.error("Token refresh HTTP error", {
				status: response.status,
				statusText: response.statusText,
				error: errorData,
			});

			// Handle specific error cases
			if (response.status === 401) {
				return {
					success: false,
					error: {
						type: ClaudeAuthError.EXPIRED_TOKEN,
						message: getErrorMessage(ClaudeAuthError.EXPIRED_TOKEN),
					},
				};
			}

			return {
				success: false,
				error: {
					type: ClaudeAuthError.TOKEN_REFRESH_FAILED,
					message: getErrorMessage(ClaudeAuthError.TOKEN_REFRESH_FAILED),
				},
			};
		}

		const tokens: TokenResponse = await response.json();
		return { success: true, data: tokens };
	} catch (error) {
		logger.error("Token refresh network error", {
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
