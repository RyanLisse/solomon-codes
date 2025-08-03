import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLogger } from "@/lib/logging";

const logger = createLogger({ serviceName: "openai-auth-validate" });

/**
 * Validation schema for OpenAI API key request
 */
const validateRequestSchema = z.object({
	apiKey: z.string().min(1, "API key is required"),
});

/**
 * OpenAI API key format validation
 * OpenAI API keys follow the pattern: sk-...
 */
function isValidOpenAIKeyFormat(apiKey: string): boolean {
	return /^sk-[A-Za-z0-9]{48,}$/.test(apiKey);
}

/**
 * Test OpenAI API key by making a simple API call
 */
async function testOpenAIApiKey(
	apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
	try {
		// Use mock server in test mode
		const isTestMode =
			process.env.NODE_ENV === "test" || process.env.TEST_MODE === "true";
		const baseUrl = isTestMode
			? "http://localhost:3002"
			: "https://api.openai.com";

		const response = await fetch(`${baseUrl}/v1/models`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
		});

		if (response.ok) {
			const data = await response.json();
			// Check if we got a valid models response
			if (data && Array.isArray(data.data)) {
				return { valid: true };
			}
		}

		// Handle specific error cases
		if (response.status === 401) {
			return { valid: false, error: "Invalid API key" };
		}

		if (response.status === 429) {
			return { valid: false, error: "Rate limit exceeded" };
		}

		return { valid: false, error: `API error: ${response.status}` };
	} catch (error) {
		logger.error("OpenAI API key validation failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Network error",
		};
	}
}

/**
 * POST /api/auth/openai/validate
 * Validate OpenAI API key
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { apiKey } = validateRequestSchema.parse(body);

		logger.debug("Validating OpenAI API key", {
			keyPrefix: `${apiKey.substring(0, 7)}...`,
		});

		// Check format first
		if (!isValidOpenAIKeyFormat(apiKey)) {
			logger.warn("Invalid OpenAI API key format", {
				keyPrefix: `${apiKey.substring(0, 7)}...`,
			});

			return NextResponse.json(
				{
					success: false,
					error: {
						code: "INVALID_FORMAT",
						message:
							"Invalid API key format. OpenAI keys should start with 'sk-'",
					},
				},
				{ status: 400 },
			);
		}

		// Test the API key with OpenAI
		const testResult = await testOpenAIApiKey(apiKey);

		if (!testResult.valid) {
			logger.warn("OpenAI API key validation failed", {
				keyPrefix: `${apiKey.substring(0, 7)}...`,
				error: testResult.error,
			});

			return NextResponse.json(
				{
					success: false,
					error: {
						code: "INVALID_KEY",
						message: testResult.error || "Invalid API key",
					},
				},
				{ status: 401 },
			);
		}

		logger.info("OpenAI API key validated successfully", {
			keyPrefix: `${apiKey.substring(0, 7)}...`,
		});

		return NextResponse.json({
			success: true,
			data: {
				valid: true,
				provider: "openai",
				// Mock user data - in real implementation, you might fetch user info
				user: {
					id: "openai-user",
					provider: "openai",
					authenticated_at: new Date().toISOString(),
				},
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			logger.warn("Invalid request payload for OpenAI validation", {
				errors: error.issues,
			});

			return NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid request data",
						details: error.issues,
					},
				},
				{ status: 400 },
			);
		}

		logger.error("OpenAI API key validation error", {
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to validate API key",
				},
			},
			{ status: 500 },
		);
	}
}

/**
 * GET /api/auth/openai/validate
 * Check if OpenAI authentication is configured
 */
export async function GET() {
	return NextResponse.json({
		success: true,
		data: {
			configured: !!process.env.OPENAI_API_KEY,
			endpoint: "https://api.openai.com/v1",
		},
	});
}
