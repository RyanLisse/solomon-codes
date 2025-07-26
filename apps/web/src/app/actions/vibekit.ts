"use server";

// TEMPORARY FIX: Commenting out @vibe-kit/sdk to resolve @dagger.io/dagger dependency conflict
// import { VibeKit, type VibeKitConfig } from "@vibe-kit/sdk";
import { cookies } from "next/headers";
import type { Task } from "@/stores/tasks";

// Import the stub type from tasks store
type PullRequestResponse = {
	url?: string;
	html_url?: string;
	number?: number;
	title?: string;
	state?: string;
};

// Temporary stub types to maintain functionality
type VibeKitConfig = {
	agent?: {
		type: string;
		model?: {
			apiKey?: string;
		};
	};
	environment?: {
		e2b?: {
			apiKey?: string;
		};
	};
	github?: {
		token?: string;
		repository?: string;
	};
	sessionId?: string;
	telemetry?: {
		isEnabled?: boolean;
		endpoint?: string;
		serviceName?: string;
		serviceVersion?: string;
		headers?: Record<string, unknown>;
		timeout?: number;
		samplingRatio?: number;
		resourceAttributes?: Record<string, string>;
	};
};

class VibeKit {
	constructor(_config: VibeKitConfig) {
		console.warn("VibeKit temporarily disabled due to dependency conflict");
	}

	async createPullRequest() {
		throw new Error(
			"VibeKit temporarily disabled due to @dagger.io/dagger dependency conflict with @opentelemetry/core",
		);
	}
}

export const createPullRequestAction = async ({
	task,
}: {
	task: Task;
}): Promise<PullRequestResponse | undefined> => {
	const cookieStore = await cookies();
	const githubToken = cookieStore.get("github_access_token")?.value;

	if (!githubToken) {
		throw new Error("No GitHub token found. Please authenticate first.");
	}

	const config: VibeKitConfig = {
		agent: {
			type: "codex",
			model: {
				apiKey: process.env.OPENAI_API_KEY,
			},
		},
		environment: {
			e2b: {
				apiKey: process.env.E2B_API_KEY,
			},
		},
		github: {
			token: githubToken,
			repository: task.repository,
		},
		sessionId: task.sessionId,
		telemetry: {
			isEnabled: process.env.NODE_ENV === "production",
			endpoint:
				process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
				"http://localhost:4318/v1/traces",
			serviceName: "solomon-codes-web",
			serviceVersion: "1.0.0",
			headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
				? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
				: {},
			timeout: 5000,
			samplingRatio: Number.parseFloat(
				process.env.OTEL_SAMPLING_RATIO || "1.0",
			),
			resourceAttributes: {
				environment: process.env.NODE_ENV || "development",
				"service.instance.id": process.env.HOSTNAME || "unknown",
			},
		},
	};

	const vibekit = new VibeKit(config);

	try {
		const pr = await vibekit.createPullRequest();
		return pr as unknown as PullRequestResponse;
	} catch (error) {
		console.warn("VibeKit disabled, returning undefined for PR:", error);
		return undefined;
	}
};
