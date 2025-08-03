import {
	channel,
	type Realtime,
	realtimeMiddleware,
	topic,
} from "@inngest/realtime";
// Temporarily disabled due to OpenTelemetry compatibility issues
// import { VibeKit } from "@vibe-kit/sdk";
import { Inngest } from "inngest";
import { createServiceLogger } from "./logging/factory";
import { getMockOrRealData } from "./mock/manager";
import { mockApiResponses } from "./mock/providers";

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
function* _chunkText(
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
function _createChunkPublisher(
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
	publish: Realtime.PublishFn,
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
		const { task, sessionId, prompt } = event.data;

		const result = await step.run("generate-code", async () => {
			const logger = createServiceLogger("inngest-vibekit");

			// Use mock data manager to handle VibeKit responses
			const result = await getMockOrRealData(
				// Mock implementation
				async () => {
					logger.info("Using mock VibeKit response", { taskId: task.id });
					return {
						stdout:
							"Task completed successfully (using mock data for development)",
						sandboxId: sessionId || "mock-session",
					};
				},
				// Real implementation with VibeKit E2B integration
				async () => {
					logger.info("Using real VibeKit with E2B sandbox", {
						taskId: task.id,
					});

					try {
						// Dynamic import to avoid circular dependencies
						const { generateCodeAction } = await import(
							"@/app/actions/vibekit"
						);

						const vibekitResult = await generateCodeAction({
							task,
							prompt: prompt || task.title,
							useLocal: task.useLocalSandbox || false,
						});

						logger.info("VibeKit execution completed", {
							taskId: task.id,
							sessionId: vibekitResult.sessionId,
						});

						return {
							stdout: JSON.stringify(vibekitResult.result),
							sandboxId: vibekitResult.sessionId,
						};
					} catch (error) {
						logger.error("VibeKit execution failed, falling back to mock", {
							taskId: task.id,
							error: error instanceof Error ? error.message : String(error),
						});

						// Fallback to mock data if VibeKit fails
						return (
							mockApiResponses?.vibekit?.response || {
								stdout: "Task completed with fallback (VibeKit error)",
								sandboxId: sessionId || "mock-session",
							}
						);
					}
				},
				"vibekit-task-execution",
			);

			return result;
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
