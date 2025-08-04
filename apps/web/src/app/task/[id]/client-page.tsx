"use client";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { Bot, Loader, Terminal, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchRealtimeSubscriptionToken } from "@/app/actions/inngest";
import { Markdown } from "@/components/markdown";
import { StreamingIndicator } from "@/components/streaming-indicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextShimmer } from "@/components/ui/text-shimmer";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTask, useTaskCacheUpdater } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import type { Task } from "@/stores/tasks";
import MessageInput from "./_components/message-input";
import TaskNavbar from "./_components/navbar";

interface Props {
	id: string;
}

interface StreamingMessage {
	role: "user" | "assistant";
	type: string;
	data: Record<string, unknown> & {
		text?: string;
		isStreaming?: boolean;
		streamId?: string;
		chunkIndex?: number;
		totalChunks?: number;
	};
}

interface IncomingMessage {
	role: "user" | "assistant";
	type: string;
	data: Record<string, unknown> & {
		text?: string;
		isStreaming?: boolean;
		streamId?: string;
		chunkIndex?: number;
		totalChunks?: number;
		call_id?: string;
		action?: {
			command?: string[];
		};
		output?: string;
	};
}

// Type guard to check if a message has streaming properties
// Helper function to check if value is object
function isObject(value: unknown): boolean {
	return typeof value === "object" && value !== null;
}

// Helper function to check if object has required properties
function hasRequiredProperties(obj: Record<string, unknown>): boolean {
	return "type" in obj && "data" in obj;
}

// Helper function to check if data is valid object
function hasValidDataObject(data: unknown): boolean {
	return typeof data === "object" && data !== null;
}

// Helper function to check basic message structure
function hasBasicMessageStructure(message: unknown): boolean {
	if (!isObject(message)) return false;
	const obj = message as Record<string, unknown>;
	if (!hasRequiredProperties(obj)) return false;
	return hasValidDataObject(obj.data);
}

// Helper function to check if message type is "message"
function isMessageType(message: IncomingMessage): boolean {
	return message.type === "message";
}

// Helper function to check streaming properties
function hasStreamingProperties(data: Record<string, unknown>): boolean {
	return (
		"isStreaming" in data &&
		data.isStreaming === true &&
		"streamId" in data &&
		typeof data.streamId === "string"
	);
}

function isStreamingMessage(message: unknown): message is IncomingMessage & {
	data: { isStreaming: true; streamId: string };
} {
	if (!hasBasicMessageStructure(message)) return false;
	const msg = message as IncomingMessage;
	return isMessageType(msg) && hasStreamingProperties(msg.data);
}

// Helper function to check completed stream properties
function hasCompletedStreamProperties(data: Record<string, unknown>): boolean {
	return (
		"streamId" in data &&
		typeof data.streamId === "string" &&
		(!("isStreaming" in data) || data.isStreaming === false)
	);
}

// Type guard to check if a message is a completed stream
function isCompletedStreamMessage(
	message: unknown,
): message is IncomingMessage & {
	data: { streamId: string; isStreaming: false };
} {
	if (!hasBasicMessageStructure(message)) return false;
	const msg = message as IncomingMessage;
	return isMessageType(msg) && hasCompletedStreamProperties(msg.data);
}

// Helper function to check message role
function hasValidRole(message: Record<string, unknown>): boolean {
	return (
		"role" in message &&
		(message.role === "user" || message.role === "assistant")
	);
}

// Helper function to check message format
function hasValidFormat(message: Record<string, unknown>): boolean {
	return (
		"type" in message &&
		"data" in message &&
		typeof message.type === "string" &&
		typeof message.data === "object"
	);
}

// Type guard to check if message is a valid incoming message
function isValidIncomingMessage(message: unknown): message is IncomingMessage {
	if (!hasBasicMessageStructure(message)) return false;
	const msg = message as Record<string, unknown>;
	return hasValidRole(msg) && hasValidFormat(msg);
}

// Loading state component
function TaskLoadingState({ id }: { id: string }) {
	return (
		<div className="flex h-screen flex-col">
			<TaskNavbar id={id} />
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<Loader className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
					<h2 className="mt-4 font-semibold text-lg">Loading task...</h2>
					<p className="text-muted-foreground">
						Please wait while we fetch your task.
					</p>
				</div>
			</div>
		</div>
	);
}

// Error state component
function TaskErrorState({ id }: { id: string }) {
	return (
		<div className="flex h-screen flex-col">
			<TaskNavbar id={id} />
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<h2 className="font-semibold text-lg">Error loading task</h2>
					<p className="text-muted-foreground">
						There was an error loading the task. Please try again.
					</p>
				</div>
			</div>
		</div>
	);
}

// Not found state component
function TaskNotFoundState({ id }: { id: string }) {
	return (
		<div className="flex h-screen flex-col">
			<TaskNavbar id={id} />
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<h2 className="font-semibold text-lg">Task not found</h2>
					<p className="text-muted-foreground">
						The task with ID {id} could not be found.
					</p>
				</div>
			</div>
		</div>
	);
}

// Message bubble component
function MessageBubble({
	message,
	index,
	task,
}: {
	message: IncomingMessage;
	index: number;
	task: Task;
}) {
	const isAssistant = message.role === "assistant";

	return (
		<div
			key={
				(message.data as { id?: string })?.id ||
				`message-${index}-${message.role}` ||
				index
			}
			className={cn(
				"flex animate-in gap-3 duration-300",
				isAssistant
					? "slide-in-from-left justify-start"
					: "slide-in-from-right justify-end",
			)}
		>
			{isAssistant && (
				<div className="flex-shrink-0">
					<div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted">
						<Bot className="h-4 w-4 text-muted-foreground" />
					</div>
				</div>
			)}
			<div
				className={cn(
					"max-w-[85%] rounded-2xl px-5 py-3 shadow-sm",
					isAssistant
						? "border border-border bg-card"
						: "bg-primary text-primary-foreground",
				)}
			>
				{isAssistant ? (
					<div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden">
						<Markdown
							repoUrl={
								task?.repository
									? `https://github.com/${task.repository}`
									: undefined
							}
							branch={task?.branch}
						>
							{message.data?.text as string}
						</Markdown>
					</div>
				) : (
					<p className="break-words text-sm leading-relaxed">
						{message.data?.text as string}
					</p>
				)}
			</div>
			{!isAssistant && (
				<div className="flex-shrink-0">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
						<User className="h-4 w-4 text-primary" />
					</div>
				</div>
			)}
		</div>
	);
}

// Streaming message bubble component
function StreamingMessageBubble({
	message,
	task,
}: {
	message: StreamingMessage;
	task: Task;
}) {
	const isAssistant = message.role === "assistant";

	return (
		<div
			key={message.data.streamId as string}
			className={cn(
				"flex animate-in gap-3 duration-300",
				isAssistant
					? "slide-in-from-left justify-start"
					: "slide-in-from-right justify-end",
			)}
		>
			{isAssistant && (
				<div className="flex-shrink-0">
					<div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
						<Bot className="relative z-10 h-4 w-4 text-muted-foreground" />
						<div
							className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent"
							style={{
								animation: "shimmer 2s linear infinite",
								backgroundSize: "200% 100%",
							}}
						/>
					</div>
				</div>
			)}
			<div
				className={cn(
					"max-w-[85%] rounded-2xl px-5 py-3 shadow-sm",
					isAssistant
						? "border border-border bg-card"
						: "bg-primary text-primary-foreground",
				)}
			>
				{isAssistant ? (
					<div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden">
						<Markdown
							repoUrl={
								task?.repository
									? `https://github.com/${task.repository}`
									: undefined
							}
							branch={task?.branch}
						>
							{message.data?.text as string}
						</Markdown>
						{/* Enhanced streaming indicator */}
						<span className="ml-1 inline-flex items-center gap-2">
							<StreamingIndicator size="sm" variant="cursor" />
							{typeof message.data.chunkIndex === "number" &&
								typeof message.data.totalChunks === "number" && (
									<span className="font-mono text-[10px] text-muted-foreground/60">
										{Math.round(
											((message.data.chunkIndex + 1) /
												message.data.totalChunks) *
												100,
										)}
										%
									</span>
								)}
						</span>
					</div>
				) : (
					<p className="break-words text-sm leading-relaxed">
						{message.data?.text as string}
					</p>
				)}
			</div>
			{!isAssistant && (
				<div className="flex-shrink-0">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
						<User className="h-4 w-4 text-primary" />
					</div>
				</div>
			)}
		</div>
	);
}

// Task status indicator component
function TaskStatusIndicator({ task }: { task: Task }) {
	return (
		<div className="slide-in-from-left flex animate-in justify-start duration-300">
			<div className="flex gap-3">
				<div className="flex-shrink-0">
					<div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full border border-border bg-muted">
						<Bot className="h-4 w-4 text-muted-foreground" />
					</div>
				</div>
				<div className="rounded-2xl border border-border bg-card px-5 py-3 shadow-sm">
					<div className="flex items-center gap-2">
						<Loader className="h-4 w-4 animate-spin text-muted-foreground" />
						<TextShimmer className="text-sm">
							{task?.statusMessage
								? `${task.statusMessage}`
								: "Working on task..."}
						</TextShimmer>
					</div>
				</div>
			</div>
		</div>
	);
}

// Shell command output component
function ShellCommandOutput({
	message,
	getOutputForCall,
}: {
	message: IncomingMessage;
	getOutputForCall: (callId: string) => string | undefined;
}) {
	const output = getOutputForCall(message.data?.call_id as string);

	return (
		<div key={message.data?.call_id as string} className="flex flex-col">
			<div className="flex items-start gap-x-2">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<p className="-mt-1 max-w-md cursor-help truncate font-medium font-mono text-sm">
								{(
									message.data as {
										action?: { command?: string[] };
									}
								)?.action?.command
									?.slice(1)
									.join(" ")}
							</p>
						</TooltipTrigger>
						<TooltipContent>
							<p className="max-w-sm break-words">
								{(
									message.data as {
										action?: { command?: string[] };
									}
								)?.action?.command
									?.slice(1)
									.join(" ")}
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
			{output && (
				<div className="slide-in-from-bottom mt-3 animate-in duration-300">
					<div className="overflow-hidden rounded-xl border-2 border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md">
						<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
							<Terminal className="size-4 text-muted-foreground" />
							<span className="font-medium text-muted-foreground text-sm">
								Output
							</span>
						</div>
						<ScrollArea className="max-h-[400px]">
							<pre className="whitespace-pre-wrap p-4 font-mono text-muted-foreground text-xs leading-relaxed">
								{(() => {
									try {
										if (!output) {
											return "No output";
										}
										const parsed = JSON.parse(output);
										return parsed.output || output;
									} catch {
										return output || "Failed to parse output";
									}
								})()}
							</pre>
						</ScrollArea>
					</div>
				</div>
			)}
		</div>
	);
}

// Helper function to handle streaming message updates
function handleStreamingMessage(
	message: IncomingMessage,
	setStreamingMessages: React.Dispatch<
		React.SetStateAction<Map<string, StreamingMessage>>
	>,
) {
	const streamId =
		typeof message.data === "object" && message.data
			? (message.data.streamId as string)
			: undefined;

	if (!streamId) {
		return; // Early return if streamId is undefined
	}

	setStreamingMessages((prev) => {
		const newMap = new Map(prev);
		const existingMessage = newMap.get(streamId);

		if (existingMessage) {
			// Append to existing streaming message
			newMap.set(streamId, {
				...existingMessage,
				data: {
					...existingMessage.data,
					text: (existingMessage.data.text || "") + (message.data.text || ""),
					chunkIndex: message.data.chunkIndex,
					totalChunks: message.data.totalChunks,
				},
			});
		} else {
			// New streaming message
			newMap.set(streamId, message as StreamingMessage);
		}

		return newMap;
	});
}

// Helper function to handle completed stream messages
function handleCompletedStreamMessage(
	message: IncomingMessage,
	streamingMessages: Map<string, StreamingMessage>,
	setStreamingMessages: React.Dispatch<
		React.SetStateAction<Map<string, StreamingMessage>>
	>,
	task: Task | null,
	id: string,
	updateTaskInCache: (taskId: string, updates: Partial<Task>) => void,
) {
	const streamId =
		typeof message.data === "object" && message.data
			? (message.data.streamId as string)
			: undefined;

	if (!streamId) {
		return; // Early return if streamId is undefined
	}

	const streamingMessage = streamingMessages.get(streamId);

	if (streamingMessage && task) {
		updateTaskInCache(id, {
			messages: [
				...task.messages,
				{
					...streamingMessage,
					data: {
						...streamingMessage.data,
						text: message.data.text || streamingMessage.data.text,
						isStreaming: false,
					},
				},
			],
		});

		setStreamingMessages((prev) => {
			const newMap = new Map(prev);
			newMap.delete(streamId);
			return newMap;
		});
	}
}

// Helper function to handle regular messages
function handleRegularMessage(
	message: IncomingMessage,
	task: Task | null,
	id: string,
	updateTaskInCache: (taskId: string, updates: Partial<Task>) => void,
) {
	if (task) {
		updateTaskInCache(id, {
			messages: [...task.messages, message],
		});
	}
}

// Hook for managing streaming message updates
function useStreamingMessageHandler(
	id: string,
	task: Task | null,
	streamingMessages: Map<string, StreamingMessage>,
	setStreamingMessages: React.Dispatch<
		React.SetStateAction<Map<string, StreamingMessage>>
	>,
	updateTaskInCache: (taskId: string, updates: Partial<Task>) => void,
) {
	const { latestData } = useInngestSubscription({
		refreshToken: fetchRealtimeSubscriptionToken,
		bufferInterval: 0,
		enabled: true,
	});

	useEffect(() => {
		if (latestData?.channel !== "tasks" || latestData.topic !== "update") {
			return;
		}

		const { taskId, message } = latestData.data;
		if (taskId !== id || !message || !isValidIncomingMessage(message)) {
			return;
		}

		if (isStreamingMessage(message)) {
			handleStreamingMessage(message, setStreamingMessages);
		} else if (isCompletedStreamMessage(message)) {
			handleCompletedStreamMessage(
				message,
				streamingMessages,
				setStreamingMessages,
				task,
				id,
				updateTaskInCache,
			);
		} else {
			handleRegularMessage(message, task, id, updateTaskInCache);
		}
	}, [
		latestData,
		id,
		task,
		streamingMessages,
		updateTaskInCache,
		setStreamingMessages,
	]);
}

// Helper function to get output for shell call
function useGetOutputForCall(task: Task | null | undefined) {
	return (callId: string): string | undefined => {
		const outputMessage = task?.messages.find(
			(message) =>
				message.type === "local_shell_call_output" &&
				message.data?.call_id === callId,
		);
		return outputMessage?.data?.output as string | undefined;
	};
}

// Custom hook for auto-scroll functionality
function useAutoScroll(
	chatScrollAreaRef: React.RefObject<HTMLDivElement | null>,
) {
	useEffect(() => {
		if (chatScrollAreaRef.current) {
			const viewport = chatScrollAreaRef.current.querySelector(
				"[data-radix-scroll-area-viewport]",
			);
			if (viewport) {
				viewport.scrollTo({
					top: viewport.scrollHeight,
					behavior: "smooth",
				});
			}
		}
	}, [chatScrollAreaRef]);
}

// Custom hook for task updates
function useTaskUpdates(
	task: Task | null,
	updateTaskInCache: (taskId: string, updates: Partial<Task>) => void,
) {
	useEffect(() => {
		if (task?.hasChanges) {
			updateTaskInCache(task.id, {
				hasChanges: false,
			});
		}
	}, [task, updateTaskInCache]);
}

export default function TaskClientPage({ id }: Props) {
	const { data: task, isLoading, error } = useTask(id);
	const { updateTaskInCache } = useTaskCacheUpdater();
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const chatScrollAreaRef = useRef<HTMLDivElement>(null);
	const [_subscriptionEnabled, setSubscriptionEnabled] = useState(true);
	const [streamingMessages, setStreamingMessages] = useState<
		Map<string, StreamingMessage>
	>(new Map());

	const getOutputForCall = useGetOutputForCall(task);

	// Use custom hooks
	useStreamingMessageHandler(
		id,
		task || null,
		streamingMessages,
		setStreamingMessages,
		updateTaskInCache,
	);
	useAutoScroll(chatScrollAreaRef);
	useTaskUpdates(task || null, updateTaskInCache);

	// Cleanup subscription on unmount to prevent stream cancellation errors
	useEffect(() => {
		return () => {
			setSubscriptionEnabled(false);
		};
	}, []);

	// Early returns for different states
	if (isLoading) return <TaskLoadingState id={id} />;
	if (error) return <TaskErrorState id={id} />;
	if (!task) return <TaskNotFoundState id={id} />;

	return (
		<div className="flex h-screen flex-col">
			<TaskNavbar id={id} />
			<div className="flex flex-1 overflow-hidden">
				{/* Sidebar for chat messages */}
				<div className="mx-auto flex h-full w-full max-w-3xl flex-col border-border border-r bg-gradient-to-b from-background to-muted/5">
					<ScrollArea
						ref={chatScrollAreaRef}
						className="scroll-area-custom flex-1 overflow-y-auto"
					>
						<div className="flex flex-col gap-y-6 p-6">
							{/* Initial task message */}
							<div className="slide-in-from-right flex animate-in justify-end duration-300">
								<div className="flex max-w-[85%] gap-3">
									<div className="rounded-2xl bg-primary px-5 py-3 text-primary-foreground shadow-sm">
										<p className="text-sm leading-relaxed">{task?.title}</p>
									</div>
									<div className="flex-shrink-0">
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
											<User className="h-4 w-4 text-primary" />
										</div>
									</div>
								</div>
							</div>
							{/* Render regular messages */}
							{task?.messages
								.filter(
									(message) =>
										(message.role === "assistant" || message.role === "user") &&
										message.type === "message",
								)
								.map((message, index) => (
									<MessageBubble
										key={
											(message.data as { id?: string })?.id ||
											`message-${index}-${message.role}-${message.type}`
										}
										message={message}
										index={index}
										task={task}
									/>
								))}

							{/* Render streaming messages */}
							{Array.from(streamingMessages.values()).map((message) => (
								<StreamingMessageBubble
									key={message.data.streamId as string}
									message={message}
									task={task}
								/>
							))}

							{task?.status === "IN_PROGRESS" &&
								streamingMessages.size === 0 && (
									<TaskStatusIndicator task={task} />
								)}
						</div>
					</ScrollArea>

					{/* Message input component - fixed at bottom */}
					<div className="flex-shrink-0">
						<MessageInput task={task} />
					</div>
				</div>

				{/* Right panel for details */}
				<div className="relative flex-1 bg-gradient-to-br from-muted/50 to-background">
					{/* Fade overlay at the top */}
					<div className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-20 bg-gradient-to-b from-muted/50 to-transparent" />
					<ScrollArea ref={scrollAreaRef} className="scroll-area-custom h-full">
						<div className="mx-auto w-full max-w-4xl px-6 py-10">
							{/* Details content will go here */}
							<div className="flex flex-col gap-y-10">
								{task?.messages.map((message) => {
									if (message.type === "local_shell_call") {
										return (
											<ShellCommandOutput
												key={message.data?.call_id as string}
												message={message}
												getOutputForCall={getOutputForCall}
											/>
										);
									}
									return null;
								})}
							</div>
						</div>
					</ScrollArea>
				</div>
			</div>
		</div>
	);
}
