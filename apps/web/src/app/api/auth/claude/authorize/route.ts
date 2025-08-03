import { type NextRequest, NextResponse } from "next/server";
import {
	buildAuthorizationURL,
	ClaudeAuthError,
	generatePKCEChallenge,
	getErrorMessage,
} from "@/lib/auth/claude-config";
import { createContextLogger } from "@/lib/logging/factory";

const logger = createContextLogger("claude-auth-authorize");

/**
 * Generate OAuth authorization URL with PKCE challenge
 * GET /api/auth/claude/authorize
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
	try {
		logger.debug("Generating Claude OAuth authorization URL");

		// Generate PKCE challenge and state
		const pkce = await generatePKCEChallenge();

		// Build authorization URL
		const authUrl = buildAuthorizationURL(pkce);

		logger.debug("Claude OAuth authorization URL generated successfully", {
			state: pkce.state,
			hasCodeChallenge: !!pkce.codeChallenge,
		});

		// Return authorization URL and verifier for client
		return NextResponse.json({
			success: true,
			data: {
				url: authUrl,
				verifier: pkce.codeVerifier,
				state: pkce.state,
			},
		});
	} catch (error) {
		logger.error("Failed to generate Claude OAuth authorization URL", {
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{
				success: false,
				error: {
					type: ClaudeAuthError.OAUTH_FAILED,
					message: getErrorMessage(ClaudeAuthError.OAUTH_FAILED),
				},
			},
			{ status: 500 },
		);
	}
}
