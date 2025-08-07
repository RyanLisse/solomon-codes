import { CircleUser, MessageSquare, Mic, Square } from "lucide-react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Markdown } from "@/components/markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Task, TaskMessage } from "@/lib/database/types";
import { cn } from "@/lib/utils";

// Extended Message type for UI
interface Message extends TaskMessage {
	id: string;
	timestamp: string;
}

// Dynamic imports for heavy components
const VoiceInterface = dynamic(
	() =>
		import("@/components/voice/voice-first-interface").then((mod) => ({
			default: mod.VoiceFirstInterface,
		})),
	{
		ssr: false,
		loading: () => <Skeleton className="h-10 w-10 rounded-full" />,
	},
);

interface ClientPageProps {
	task: Task;
	messages: Message[];
	onSendMessage: (content: string) => void;
	onUpdateTask: (updates: Partial<Task>) => void;
	isLoading: boolean;
}

function formatTimestamp(timestamp: string): string {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function MessageBubble({ message, task }: { message: Message; task?: Task }) {
	const isAssistant = message.role === "assistant";
	const isUser = message.role === "user";

	return (
		<div
			className={cn(
				"flex max-w-[85%] gap-3",
				isAssistant ? "self-start" : "flex-row-reverse self-end",
			)}
		>
			<Avatar className="h-8 w-8 shrink-0">
				<AvatarFallback className="bg-muted">
					{isAssistant ? "AI" : <CircleUser className="h-4 w-4" />}
				</AvatarFallback>
			</Avatar>

			<div
				className={cn(
					"max-w-full break-words rounded-2xl px-4 py-3",
					isAssistant
						? "border border-border bg-card"
						: "bg-primary text-primary-foreground",
				)}
			>
				{isAssistant ? (
					<div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden">
						<Markdown>{String(message.data?.text || "")}</Markdown>
					</div>
				) : (
					<p className="break-words text-sm leading-relaxed">
						{String(message.data?.text || "")}
					</p>
				)}
			</div>
			{isUser && (
				<div className="mt-1 text-right text-muted-foreground text-xs">
					{formatTimestamp(message.timestamp)}
				</div>
			)}
		</div>
	);
}

export default function ClientPage({
	task,
	messages,
	onSendMessage,
	onUpdateTask,
	isLoading,
}: ClientPageProps) {
	const handleSendMessage = (content: string) => {
		onSendMessage(content);
	};

	const handleUpdateTask = (updates: Partial<Task>) => {
		onUpdateTask(updates);
	};

	return (
		<div className="mx-auto flex h-screen max-w-4xl flex-col">
			{/* Header */}
			<Card className="rounded-b-none border-b-0">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<h1 className="font-semibold text-xl">{task.title}</h1>
							{task.description && (
								<p className="text-muted-foreground text-sm">
									{task.description}
								</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Badge variant={task.status === "DONE" ? "default" : "secondary"}>
								{task.status}
							</Badge>
							{task.mode && <Badge variant="outline">{task.mode}</Badge>}
						</div>
					</div>
				</CardHeader>
			</Card>

			{/* Messages */}
			<Card className="flex-1 overflow-hidden rounded-none border-b-0">
				<CardContent className="h-full p-0">
					<ScrollArea className="h-full">
						<div className="flex flex-col gap-4 p-6">
							{messages.length === 0 ? (
								<div className="flex h-64 flex-col items-center justify-center text-center">
									<MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
									<h3 className="mb-2 font-medium text-lg">No messages yet</h3>
									<p className="max-w-md text-muted-foreground text-sm">
										Start a conversation to work on this task. You can type a
										message or use voice input.
									</p>
								</div>
							) : (
								messages.map((message) => (
									<MessageBubble
										key={message.id}
										message={message}
										task={task}
									/>
								))
							)}
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Input Area */}
			<Card className="rounded-t-none">
				<CardContent className="p-4">
					<div className="flex items-center gap-2">
						<Suspense fallback={<Skeleton className="h-10 flex-1" />}>
							<div className="flex-1">
								<p className="text-muted-foreground text-sm">
									Voice interface will be loaded here
								</p>
							</div>
						</Suspense>
						<Button
							onClick={() => handleSendMessage("Test message")}
							disabled={isLoading}
						>
							Send
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
