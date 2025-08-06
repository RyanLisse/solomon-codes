"use server";

import { createE2BProvider } from "@vibe-kit/e2b";
import { VibeKit } from "@vibe-kit/sdk";
import { cookies } from "next/headers";
import { claudeTokenStore } from "@/lib/auth/claude-token-store";
import { secureConfig } from "@/lib/config/secure";
import { createLogger } from "@/lib/logging";
import {
	instrumentGitHubOperation,
	instrumentVibeKitCodeGeneration,
} from "@/lib/observability/custom-spans";
import type { Task } from "@/stores/tasks";

const logger = createLogger({ serviceName: "vibekit-actions" });

// Import the stub type from tasks store
type PullRequestResponse = {
	url?: string;
	html_url?: string;
	number?: number;
	title?: string;
	state?: string;
};

type VibeKitGenerateCodeResult = {
	sandboxId?: string;
	code?: string;
	files?: Array<{ path: string; content: string }>;
	output?: string;
	error?: string;
};

/**
 * Create appropriate sandbox provider based on preferences
 */
async function createSandboxProvider(
	config: ReturnType<typeof secureConfig.getConfig>,
	_githubToken: string,
	useLocal = false,
) {
	const isDevelopment = config.app.environment === "development";
	const hasDockerAccess =
		process.env.DOCKER_HOST || process.platform !== "win32";

	// Use Dagger for local development when requested and possible
	if (useLocal && isDevelopment && hasDockerAccess) {
		logger.info("Using Dagger local sandbox for VibeKit execution");
		try {
			// Dynamic import to avoid build-time dependency issues
			const { createLocalProvider } = await import("@vibe-kit/dagger");
			return createLocalProvider({
				preferRegistryImages: true,
			});
		} catch (error) {
			logger.warn("Failed to load Dagger provider, falling back to E2B", {
				error: error instanceof Error ? error.message : String(error),
			});
			// Fall through to E2B
		}
	}

	// Use E2B for cloud execution
	logger.info("Using E2B cloud sandbox for VibeKit execution");
	return createE2BProvider({
		apiKey: config.e2b.apiKey,
		templateId: "vibekit-codex",
	});
}

/**
 * Create VibeKit instance with hybrid sandbox integration
 */
async function createVibeKitInstance(
	githubToken: string,
	task: Task,
	useLocal = false,
	agentConfig?: {
		type: string;
		provider: string;
		model: string;
		openaiApiKey?: string;
	},
): Promise<VibeKit> {
	// Get secure configuration
	const config = secureConfig.getConfig();

	// Create appropriate sandbox provider
	const sandboxProvider = await createSandboxProvider(
		config,
		githubToken,
		useLocal,
	);

	// Configure agent based on provided config or default to codex
	const agent: {
		type: "codex" | "claude" | "opencode" | "gemini" | "grok";
		provider:
			| "openai"
			| "anthropic"
			| "openrouter"
			| "azure"
			| "gemini"
			| "google"
			| "ollama"
			| "mistral"
			| "deepseek"
			| "xai"
			| "groq"
			| "arceeai";
		apiKey: string;
		model: string;
	} = agentConfig
		? {
				type: getVibeKitAgentType(agentConfig.type),
				provider: getVibeKitProvider(agentConfig.provider),
				apiKey: await getApiKeyForProviderWithClientData(
					config,
					agentConfig.provider,
					agentConfig.openaiApiKey,
				),
				model: agentConfig.model,
			}
		: {
				type: "codex" as const,
				provider: "openai" as const,
				apiKey: config.openai.apiKey,
				model: "gpt-4",
			};

	// Prepare secrets for sandbox environment
	const secrets = {
		// AI Provider API Keys
		OPENAI_API_KEY: config.openai.apiKey,
		E2B_API_KEY: config.e2b.apiKey,
		BROWSERBASE_API_KEY: config.browserbase.apiKey,
		ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
		GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || "",
		XAI_API_KEY: process.env.XAI_API_KEY || "",

		// GitHub integration
		GITHUB_TOKEN: githubToken,
		GITHUB_REPOSITORY: task.repository || "",
		GITHUB_BRANCH: task.branch || "main",

		// Other useful environment variables
		NODE_ENV: process.env.NODE_ENV || "development",
		TASK_ID: task.id,
		TASK_MODE: task.mode,
	};

	// Configure VibeKit with chosen provider, GitHub integration, secrets, and telemetry
	const vibekit = new VibeKit()
		.withAgent(agent)
		.withSandbox(sandboxProvider)
		.withGithub({
			token: githubToken,
			repository: task.repository || "SolomonCodes/main-solver-bot",
		})
		.withSecrets(secrets)
		.withTelemetry({
			enabled:
				process.env.NODE_ENV === "production" ||
				process.env.NEXT_OTEL_VERBOSE === "1",
		});

	return vibekit;
}

/**
 * Map CLI agent types to VibeKit agent types
 */
function getVibeKitAgentType(
	cliAgent: string,
): "codex" | "claude" | "opencode" | "gemini" | "grok" {
	switch (cliAgent) {
		case "claude-code":
			return "claude";
		case "gemini-cli":
			return "gemini";
		case "opencode":
			return "codex";
		case "grok-cli":
			return "grok";
		default:
			return "codex";
	}
}

/**
 * Map CLI agent providers to VibeKit providers
 */
function getVibeKitProvider(
	cliAgent: string,
):
	| "openai"
	| "anthropic"
	| "openrouter"
	| "azure"
	| "gemini"
	| "google"
	| "ollama"
	| "mistral"
	| "deepseek"
	| "xai"
	| "groq"
	| "arceeai" {
	switch (cliAgent) {
		case "claude-code":
			return "anthropic";
		case "gemini-cli":
			return "google";
		case "opencode":
			return "openai";
		case "grok-cli":
			return "xai";
		default:
			return "openai";
	}
}

/**
 * Get API key for the specified provider with client-side data support
 */
async function getApiKeyForProviderWithClientData(
	config: ReturnType<typeof secureConfig.getConfig>,
	provider: string,
	openaiApiKey?: string,
): Promise<string> {
	switch (provider) {
		case "claude-code": {
			// Use Claude authentication system
			try {
				const tokens = await claudeTokenStore.getTokens();
				if (tokens?.accessToken) {
					logger.debug("Using Claude tokens from authentication system");
					return tokens.accessToken;
				}
			} catch (error) {
				logger.warn(
					"Failed to get Claude tokens, falling back to environment variable",
					{
						error: error instanceof Error ? error.message : String(error),
					},
				);
			}
			// Fallback to environment variable if no tokens
			return process.env.ANTHROPIC_API_KEY || "";
		}
		case "opencode": {
			// Use provided OpenAI API key from client, fallback to config
			if (openaiApiKey?.trim()) {
				logger.debug("Using OpenAI API key from client authentication");
				return openaiApiKey.trim();
			}
			// Fallback to config for backward compatibility
			return config.openai.apiKey;
		}
		case "gemini-cli":
			return process.env.GOOGLE_API_KEY || "";
		case "grok-cli":
			return process.env.XAI_API_KEY || "";
		default:
			return config.openai.apiKey;
	}
}

/**
 * Generate code using VibeKit with hybrid sandbox
 */
export const generateCodeAction = async ({
	task,
	prompt,
	useLocal = false,
	agentConfig,
}: {
	task: Task;
	prompt?: string;
	useLocal?: boolean;
	agentConfig?: {
		type: string;
		provider: string;
		model: string;
		openaiApiKey?: string;
	};
}): Promise<{ result: VibeKitGenerateCodeResult; sessionId: string }> => {
	const cookieStore = await cookies();
	const githubToken = cookieStore.get("github_access_token")?.value;

	if (!githubToken) {
		throw new Error("No GitHub token found. Please authenticate first.");
	}

	try {
		return await instrumentVibeKitCodeGeneration(
			task.id,
			task.mode,
			async () => {
				const vibekit = await createVibeKitInstance(
					githubToken,
					task,
					useLocal,
					agentConfig,
				);

				// Set session if exists
				if (task.sessionId) {
					await vibekit.setSession(task.sessionId);
				}

				// Generate code with VibeKit
				const result = await vibekit.generateCode({
					prompt: prompt || task.title,
					mode: task.mode,
				});

				// Pause session for reuse
				await vibekit.pause();

				return {
					result,
					sessionId: result.sandboxId || task.sessionId,
				};
			},
		);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;

		logger.error("VibeKit code generation failed", {
			error: errorMessage,
			stack: errorStack,
			taskId: task.id,
			useLocal,
			githubTokenExists: !!githubToken,
			agentConfig,
		});

		// Throw more specific error message
		throw new Error(`VibeKit generation failed: ${errorMessage}`);
	}
};

/**
 * Create pull request using VibeKit
 */
export const createPullRequestAction = async ({
	task,
	useLocal = false,
	agentConfig,
}: {
	task: Task;
	useLocal?: boolean;
	agentConfig?: {
		type: string;
		provider: string;
		model: string;
		openaiApiKey?: string;
	};
}): Promise<PullRequestResponse | undefined> => {
	const cookieStore = await cookies();
	const githubToken = cookieStore.get("github_access_token")?.value;

	if (!githubToken) {
		throw new Error("No GitHub token found. Please authenticate first.");
	}

	try {
		return await instrumentGitHubOperation(
			"create_pull_request",
			task.repository || "unknown",
			async () => {
				const vibekit = await createVibeKitInstance(
					githubToken,
					task,
					useLocal,
					agentConfig,
				);

				// Set session if exists
				if (task.sessionId) {
					await vibekit.setSession(task.sessionId);
				}

				const pr = await vibekit.createPullRequest();
				return pr as unknown as PullRequestResponse;
			},
		);
	} catch (error) {
		logger.error("VibeKit PR creation failed", {
			error: error instanceof Error ? error.message : String(error),
			taskId: task.id,
		});
		throw new Error("Failed to create pull request with VibeKit");
	}
};
