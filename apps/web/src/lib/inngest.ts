import { channel, realtimeMiddleware, topic } from "@inngest/realtime";
// TEMPORARY FIX: Commenting out @vibe-kit/sdk to resolve @dagger.io/dagger dependency conflict
// import { VibeKit, type VibeKitConfig } from "@vibe-kit/sdk";
import { Inngest } from "inngest";

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

	async setSession(_sessionId: string) {
		console.warn("VibeKit setSession temporarily disabled");
	}

	async generateCode(_options: {
		prompt?: string;
		mode?: string;
		callbacks?: {
			onUpdate?: (message: string) => void;
		};
	}) {
		throw new Error(
			"VibeKit temporarily disabled due to @dagger.io/dagger dependency conflict with @opentelemetry/core",
		);
	}

	async pause() {
		console.warn("VibeKit pause temporarily disabled");
	}
}

// Create a client to send and receive events
export const inngest = new Inngest({
	id: "clonedex",
	middleware: [realtimeMiddleware()],
});

export const taskChannel = channel("tasks")
	.addTopic(
		topic("status").type<{
			taskId: string;
			status: "IN_PROGRESS" | "DONE" | "MERGED";
			sessionId: string;
		}>(),
	)
	.addTopic(
		topic("update").type<{
			taskId: string;
			message: Record<string, unknown>;
		}>(),
	);

// Helper function to simulate streaming by chunking text
function* chunkText(
	text: string,
	chunkSize = 10,
): Generator<string, void, unknown> {
	const words = text.split(" ");
	for (let i = 0; i < words.length; i += chunkSize) {
		yield words.slice(i, i + chunkSize).join(" ") +
			(i + chunkSize < words.length ? " " : "");
	}
}

// Helper function to publish streaming chunks
function createChunkPublisher(
	taskId: string,
	parsedMessage: {
		type?: string;
		role?: string;
		data?: {
			id?: string;
			text?: string;
			[key: string]: unknown;
		};
		[key: string]: unknown;
	},
	messageId: string,
	publish: (event: unknown) => void,
	accumulatedTextRef: { value: string },
) {
	return (chunk: string, index: number, totalChunks: number) => {
		accumulatedTextRef.value += chunk;
		const messageUpdate = {
			taskId,
			message: {
				...parsedMessage,
				data: {
					...parsedMessage.data,
					id: messageId,
					text: accumulatedTextRef.value,
					isStreaming: index < totalChunks - 1,
					streamId: messageId,
					chunkIndex: index,
					totalChunks,
				},
			},
		};

		setTimeout(() => {
			publish(taskChannel().update(messageUpdate));
		}, index * 50);
	};
}

export const createTask = inngest.createFunction(
	{ id: "create-task" },
	{ event: "clonedex/create.task" },
	async ({ event, step, publish }) => {
		const { task, token, sessionId, prompt } = event.data;
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
				token,
				repository: task.repository,
			},
			telemetry: {
				isEnabled: process.env.NODE_ENV === "production",
				endpoint:
					process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
					"http://localhost:4318/v1/traces",
				serviceName: "solomon-codes-inngest",
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
					"inngest.function": "create-task",
				},
			},
		};

		const result = await step.run("generate-code", async () => {
			const vibekit = new VibeKit(config);

			if (sessionId) {
				await vibekit.setSession(sessionId);
			}

			const response = await vibekit.generateCode({
				prompt: prompt || task.title,
				mode: task.mode,
				callbacks: {
					onUpdate(message) {
						try {
							const parsedMessage = JSON.parse(message);

							// For assistant messages, implement streaming
							if (
								parsedMessage.type === "message" &&
								parsedMessage.role === "assistant"
							) {
								const messageId = parsedMessage.data?.id || crypto.randomUUID();
								const fullText = parsedMessage.data?.text || "";

								// Stream the message in chunks
								const accumulatedTextRef = { value: "" };
								const chunks = Array.from(chunkText(fullText, 5)); // 5 words per chunk
								const publishChunk = createChunkPublisher(
									task.id,
									parsedMessage,
									messageId,
									publish,
									accumulatedTextRef,
								);

								chunks.forEach((chunk, index) => {
									publishChunk(chunk, index, chunks.length);
								});
							} else {
								// Non-message updates (like git operations, etc.)
								publish(
									taskChannel().update({
										taskId: task.id,
										message: parsedMessage,
									}),
								);
							}
						} catch {
							// If it's not JSON, it might be raw streaming output
							// Create a streaming message for it
							const streamId = `stream-${Date.now()}`;
							publish(
								taskChannel().update({
									taskId: task.id,
									message: {
										type: "message",
										role: "assistant",
										data: {
											text: message,
											isStreaming: true,
											streamId: streamId,
											raw: true,
										},
									},
								}),
							);
						}
					},
				},
			});

			await vibekit.pause();

			return response;
		});

		if (result && typeof result === "object" && "stdout" in result) {
			const typedResult = result as { stdout: string; sandboxId: string };
			const lines = typedResult.stdout.trim().split("\n");
			const parsedLines = lines.map((line) => JSON.parse(line));
			await publish(
				taskChannel().status({
					taskId: task.id,
					status: "DONE",
					sessionId: typedResult.sandboxId,
				}),
			);

			return { message: parsedLines };
		}
		return { message: result };
	},
);

let app: Inngest | undefined;

export const getInngestApp = () => {
	if (!app) {
		app = new Inngest({
			id: typeof window !== "undefined" ? "client" : "server",
			middleware: [realtimeMiddleware()],
		});
	}
	return app;
};
