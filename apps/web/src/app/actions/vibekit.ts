"use server";

import { VibeKit } from "@vibe-kit/sdk";
import { createE2BProvider } from "@vibe-kit/e2b";
import { cookies } from "next/headers";
import type { Task } from "@/stores/tasks";
import { secureConfig } from "@/lib/config/secure";
import { createContextLogger } from "@/lib/logging/factory";

const logger = createContextLogger("vibekit-actions");

// Import the stub type from tasks store
type PullRequestResponse = {
  url?: string;
  html_url?: string;
  number?: number;
  title?: string;
  state?: string;
};

/**
 * Create appropriate sandbox provider based on preferences
 */
async function createSandboxProvider(config: any, githubToken: string, useLocal: boolean = false) {
  const isDevelopment = config.app.environment === "development";
  const hasDockerAccess = process.env.DOCKER_HOST || process.platform !== "win32";
  
  // Use Dagger for local development when requested and possible
  if (useLocal && isDevelopment && hasDockerAccess) {
    logger.info("Using Dagger local sandbox for VibeKit execution");
    try {
      // Dynamic import to avoid build-time dependency issues
      const { createLocalProvider } = await import("@vibe-kit/dagger");
      return createLocalProvider({
        githubToken,
        preferRegistryImages: true,
      });
    } catch (error) {
      logger.warn("Failed to load Dagger provider, falling back to E2B", { error: error.message });
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
async function createVibeKitInstance(githubToken: string, task: Task, useLocal: boolean = false): Promise<VibeKit> {
  // Get secure configuration
  const config = secureConfig.getConfig();
  
  // Create appropriate sandbox provider
  const sandboxProvider = await createSandboxProvider(config, githubToken, useLocal);

  // Configure VibeKit with chosen provider
  const vibekit = new VibeKit()
    .withAgent({
      type: "codex",
      provider: "openai",
      apiKey: config.openai.apiKey,
      model: "gpt-4",
    })
    .withSandbox(sandboxProvider);

  return vibekit;
}

/**
 * Generate code using VibeKit with hybrid sandbox
 */
export const generateCodeAction = async ({
  task,
  prompt,
  useLocal = false,
}: {
  task: Task;
  prompt?: string;
  useLocal?: boolean;
}): Promise<{ result: any; sessionId: string }> => {
  const cookieStore = await cookies();
  const githubToken = cookieStore.get("github_access_token")?.value;

  if (!githubToken) {
    throw new Error("No GitHub token found. Please authenticate first.");
  }

  try {
    const vibekit = await createVibeKitInstance(githubToken, task, useLocal);

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
  } catch (error) {
    logger.error("VibeKit code generation failed", { error: error.message, taskId: task.id });
    throw new Error("Failed to generate code with VibeKit");
  }
};

/**
 * Create pull request using VibeKit
 */
export const createPullRequestAction = async ({
  task,
  useLocal = false,
}: {
  task: Task;
  useLocal?: boolean;
}): Promise<PullRequestResponse | undefined> => {
  const cookieStore = await cookies();
  const githubToken = cookieStore.get("github_access_token")?.value;

  if (!githubToken) {
    throw new Error("No GitHub token found. Please authenticate first.");
  }

  try {
    const vibekit = await createVibeKitInstance(githubToken, task, useLocal);

    // Set session if exists
    if (task.sessionId) {
      await vibekit.setSession(task.sessionId);
    }

    const pr = await vibekit.createPullRequest();
    return pr as unknown as PullRequestResponse;
  } catch (error) {
    logger.error("VibeKit PR creation failed", { error: error.message, taskId: task.id });
    throw new Error("Failed to create pull request with VibeKit");
  }
};
