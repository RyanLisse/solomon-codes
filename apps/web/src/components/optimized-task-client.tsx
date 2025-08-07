import { ArrowDown, Bot, User } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Types for the optimized task client
interface TaskMessage {
	id: string;
	role: "user" | "assistant";
	data: {
		text?: string;
		[key: string]: any;
	};
	timestamp: string;
}

interface StreamingMessage {
	id: string;
	data: {
		text: string;
		[key: string]: any;
	};
	timestamp: string;
}

interface Task {
	id: string;
	title: string;
	description?: string;
	status: string;
	priority?: string;
	mode?: string;
}

interface OptimizedTaskClientProps {
	task: Task;
	messages: TaskMessage[];
	streamingMessage?: StreamingMessage;
	onSendMessage: (message: string) => void;
	isStreaming?: boolean;
}

// Memoized message component for performance
const MessageComponent = memo(function MessageComponent({
	message,
}: {
	message: TaskMessage;
}) {
	const isAssistantMessage = message.role === "assistant";
	const isUserMessage = message.role === "user";

	return (
		<div
			className={`mb-4 flex ${isUserMessage ? "justify-end" : "justify-start"}`}
		>
			<div className="flex max-w-[80%] gap-3">
				{isAssistantMessage && (
					<div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
						<Bot className="h-4 w-4" />
					</div>
				)}
				<div
					className={`flex flex-col gap-2 rounded-lg px-3 py-2 ${
						isUserMessage ? "bg-primary text-primary-foreground" : "bg-muted"
					}`}
				>
					{isUserMessage && (
						<div className="flex items-center gap-2">
							<User className="h-4 w-4" />
							<span className="font-medium text-sm">You</span>
							{message.timestamp && (
								<span className="text-xs opacity-70">
									{new Date(message.timestamp).toLocaleTimeString()}
								</span>
							)}
						</div>
					)}
					{isAssistantMessage && message.data?.text && (
						<Markdown content={String(message.data.text)} />
					)}
					{isUserMessage && <div>{message.data?.text}</div>}
				</div>
			</div>
		</div>
	);
});

// Streaming indicator component
const StreamingIndicator = memo(function StreamingIndicator() {
	return (
		<div className="flex items-center gap-1">
			<div className="flex space-x-1">
				<div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]" />
				<div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]" />
				<div className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />
			</div>
			<span className="text-muted-foreground text-xs">
				Assistant is typing...
			</span>
		</div>
	);
});

// Memoized streaming message component
const StreamingMessage = memo(function StreamingMessage({
	message,
}: {
	message: StreamingMessage;
}) {
	return (
		<div className="mb-4 flex justify-start">
			<div className="flex max-w-[80%] gap-3">
				<div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
					<Bot className="h-4 w-4" />
				</div>
				<div className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-2">
					<Markdown content={message.data.text || ""} />
					<StreamingIndicator />
				</div>
			</div>
		</div>
	);
});

// Main optimized task client component
export default function OptimizedTaskClient({
	task,
	messages,
	streamingMessage,
	onSendMessage,
	isStreaming = false,
}: OptimizedTaskClientProps) {
	const [inputMessage, setInputMessage] = useState("");
	const [isAtBottom, setIsAtBottom] = useState(true);

	// Memoized message list to prevent unnecessary rerenders
	const messageList = useMemo(
		() =>
			messages.map((message) => (
				<MessageComponent key={message.id} message={message} />
			)),
		[messages],
	);

	const handleSend = useCallback(() => {
		if (inputMessage.trim() && !isStreaming) {
			onSendMessage(inputMessage.trim());
			setInputMessage("");
		}
	}, [inputMessage, isStreaming, onSendMessage]);

	const handleKeyPress = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const scrollToBottom = useCallback(() => {
		// Scroll to bottom implementation would go here
		setIsAtBottom(true);
	}, []);

	return (
		<div className="flex h-full flex-col">
			{/* Task Header */}
			<div className="border-b bg-background p-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="font-semibold text-lg">{task.title}</h2>
						{task.description && (
							<p className="text-muted-foreground text-sm">
								{task.description}
							</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Badge variant="secondary">{task.status}</Badge>
						{task.priority && <Badge variant="outline">{task.priority}</Badge>}
						{task.mode && <Badge variant="outline">{task.mode}</Badge>}
					</div>
				</div>
			</div>

			{/* Messages Area */}
			<ScrollArea className="flex-1 p-4">
				<div className="space-y-4">
					{messageList}
					{streamingMessage && <StreamingMessage message={streamingMessage} />}
				</div>
			</ScrollArea>

			{/* Scroll to bottom button */}
			{!isAtBottom && (
				<div className="absolute right-4 bottom-20">
					<Button
						size="sm"
						variant="secondary"
						className="rounded-full shadow-lg"
						onClick={scrollToBottom}
					>
						<ArrowDown className="h-4 w-4" />
					</Button>
				</div>
			)}

			<Separator />

			{/* Input Area */}
			<div className="p-4">
				<div className="flex gap-2">
					<textarea
						value={inputMessage}
						onChange={(e) => setInputMessage(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Type your message..."
						className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						rows={1}
						disabled={isStreaming}
					/>
					<Button
						onClick={handleSend}
						disabled={!inputMessage.trim() || isStreaming}
						size="sm"
					>
						Send
					</Button>
				</div>
				{isStreaming && (
					<div className="mt-2 flex items-center gap-2">
						<StreamingIndicator />
					</div>
				)}
			</div>
		</div>
	);
}
