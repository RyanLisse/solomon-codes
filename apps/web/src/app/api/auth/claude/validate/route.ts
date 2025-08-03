import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	ClaudeAuthError,
	getErrorMessage,
	isValidClaudeAPIKey,
} from "@/lib/auth/claude-config";
import type { ClaudeUser } from "@/lib/auth/claude-token-store";
import { createContextLogger } from "@/lib/logging/factory";

const logger = createContextLogger("claude-auth-validate");

// Request validation schema
const ValidateAPIKeySchema = z.object({
	apiKey: z.string().min(1, "API key is required"),
});

/**
 * Validate Claude API key
 * POST /api/auth/claude/validate
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		logger.debug("Received Claude API key validation request");

		// Validate request body
		const validation = ValidateAPIKeySchema.safeParse(body);
		if (!validation.success) {
			logger.error("Invalid API key validation request", {
				errors: validation.error.issues,
			});
			return NextResponse.json(
				{
					success: false,
					error: {
						type: ClaudeAuthError.API_KEY_INVALID,
						message: "Invalid request parameters",
						details: validation.error.issues,
					},
				},
				{ status: 400 },
			);
		}

		const { apiKey } = validation.data;

		// Validate API key format
		if (!isValidClaudeAPIKey(apiKey)) {
			logger.error("Invalid Claude API key format");
			return NextResponse.json(
				{
					success: false,
					error: {
						type: ClaudeAuthError.API_KEY_INVALID,
						message: getErrorMessage(ClaudeAuthError.API_KEY_INVALID),
					},
				},
				{ status: 400 },
			);
		}

		// Test API key functionality
		const validationResponse = await testAPIKeyFunctionality(apiKey);

		if (!validationResponse.success) {
			return NextResponse.json(validationResponse, { status: 401 });
		}

		logger.debug("Claude API key validation successful", {
			userId: validationResponse.data.user?.id,
		});

		return NextResponse.json({
			success: true,
			data: {
				valid: true,
				user: validationResponse.data.user,
			},
		});
	} catch (error) {
		logger.error("Claude API key validation failed", {
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{
				success: false,
				error: {
					type: ClaudeAuthError.API_KEY_INVALID,
					message: getErrorMessage(ClaudeAuthError.API_KEY_INVALID),
				},
			},
			{ status: 500 },
		);
	}
}

/**
 * Test API key functionality with Claude API
 */
async function testAPIKeyFunctionality(
	apiKey: string,
): Promise<
	| { success: true; data: { user?: ClaudeUser } }
	| { success: false; error: { type: ClaudeAuthError; message: string } }
> {
	try {
		// Test API key with a simple API call
		const response = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: "claude-3-haiku-20240307",
				max_tokens: 1,
				messages: [
					{
						role: "user",
						content: "test",
					},
				],
			}),
		});

		if (!response.ok) {
			const errorData = await response.text();
			logger.error("API key validation HTTP error", {
				status: response.status,
				statusText: response.statusText,
				error: errorData,
			});

			// Handle specific error cases
			if (response.status === 401) {
				return {
					success: false,
					error: {
						type: ClaudeAuthError.API_KEY_INVALID,
						message: "Invalid API key or insufficient permissions",
					},
				};
			}

			if (response.status === 429) {
				return {
					success: false,
					error: {
						type: ClaudeAuthError.API_KEY_INVALID,
						message: "API key rate limit exceeded",
					},
				};
			}

			return {
				success: false,
				error: {
					type: ClaudeAuthError.API_KEY_INVALID,
					message: getErrorMessage(ClaudeAuthError.API_KEY_INVALID),
				},
			};
		}

		// API key is valid, create mock user data
		// Note: API keys don't provide user profile data like OAuth
		const mockUser: ClaudeUser = {
			id: `api_key_${apiKey.slice(-8)}`, // Use last 8 chars for ID
			email: "api-key-user@example.com",
			name: "API Key User",
			subscription: "pro", // Assume pro for API key users
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		return { success: true, data: { user: mockUser } };
	} catch (error) {
		logger.error("API key validation network error", {
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
