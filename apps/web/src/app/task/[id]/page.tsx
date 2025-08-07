"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Task } from "@/lib/database/types";
import ClientPage from "./client-page";

// Force dynamic rendering - disable static generation
export const dynamic = "force-dynamic";

// Extended Message type for UI
interface Message {
	id: string;
	role: "user" | "assistant";
	type: string;
	data: Record<string, unknown>;
	timestamp: string;
}

export default function TaskPage() {
	const [isMounted, setIsMounted] = useState(false);
	const [task, setTask] = useState<Task | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const params = useParams();
	const id = params?.id as string;

	useEffect(() => {
		setIsMounted(true);
		// Initialize with mock task data
		if (id) {
			const now = new Date();
			setTask({
				id,
				title: `Task ${id}`,
				description: "Sample task description",
				messages: [],
				status: "IN_PROGRESS",
				branch: "main",
				sessionId: `session-${Date.now()}`,
				repository: "solomon_codes",
				mode: "code",
				createdAt: now,
				updatedAt: now,
				statusMessage: null,
				isArchived: false,
				hasChanges: false,
				pullRequest: null,
				userId: "user-1",
				priority: "medium",
				embedding: null,
				metadata: {},
			});
		}
	}, [id]);

	const handleSendMessage = (content: string) => {
		setIsLoading(true);
		const userMessage: Message = {
			id: Date.now().toString(),
			role: "user",
			type: "text",
			data: { text: content },
			timestamp: new Date().toISOString(),
		};

		setMessages((prev) => [...prev, userMessage]);

		// Simulate assistant response
		setTimeout(() => {
			const assistantMessage: Message = {
				id: (Date.now() + 1).toString(),
				role: "assistant",
				type: "text",
				data: {
					text: `I received your message: "${content}". How can I help you with this task?`,
				},
				timestamp: new Date().toISOString(),
			};
			setMessages((prev) => [...prev, assistantMessage]);
			setIsLoading(false);
		}, 1000);
	};

	const handleUpdateTask = (updates: Partial<Task>) => {
		if (task) {
			setTask({ ...task, ...updates, updatedAt: new Date() });
		}
	};

	if (!isMounted) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-current border-e-transparent border-solid align-[-0.125em] text-surface motion-reduce:animate-[spin_1.5s_linear_infinite]" />
			</div>
		);
	}

	if (!task) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<h1 className="font-bold text-2xl text-muted-foreground">
						Task not found
					</h1>
					<p className="text-muted-foreground">
						The requested task could not be loaded.
					</p>
				</div>
			</div>
		);
	}

	return (
		<ClientPage
			task={task}
			messages={messages}
			onSendMessage={handleSendMessage}
			onUpdateTask={handleUpdateTask}
			isLoading={isLoading}
		/>
	);
}
