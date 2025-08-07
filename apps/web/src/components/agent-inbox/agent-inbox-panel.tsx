"use client";

import {
	AlertCircle,
	CheckCircle,
	Clock,
	Mail,
	RefreshCw,
	Trash2,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface InboxMessage {
	id: string;
	from: string;
	to: string;
	type: string;
	priority: "critical" | "high" | "normal" | "low";
	status: "pending" | "processing" | "completed" | "failed" | "dead";
	content: unknown;
	timestamp: string;
	retryCount?: number;
	error?: string;
}

interface InboxStats {
	queueSize: number;
	processingCount: number;
	deadLetterCount: number;
	handlers: string[];
}

export function AgentInboxPanel() {
	const [messages, setMessages] = useState<InboxMessage[]>([]);
	const [deadLetters, setDeadLetters] = useState<InboxMessage[]>([]);
	const [stats, setStats] = useState<InboxStats>({
		queueSize: 0,
		processingCount: 0,
		deadLetterCount: 0,
		handlers: [],
	});
	const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(
		null,
	);
	const [activeTab, setActiveTab] = useState("active");

	const updateMessage = useCallback((message: InboxMessage) => {
		setMessages((prev) => {
			const index = prev.findIndex((m) => m.id === message.id);
			if (index >= 0) {
				const updated = [...prev];
				updated[index] = message;
				return updated;
			}
			return [message, ...prev].slice(0, 100); // Keep last 100 messages
		});
	}, []);

	// Connect to inbox WebSocket
	useEffect(() => {
		const ws = new WebSocket(
			`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/inbox/ws`,
		);

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);

			switch (data.type) {
				case "message:update":
					updateMessage(data.message);
					break;
				case "stats:update":
					setStats(data.stats);
					break;
				case "deadletter:update":
					setDeadLetters(data.deadLetters);
					break;
			}
		};

		return () => ws.close();
	}, [updateMessage]);

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "critical":
				return "text-red-500";
			case "high":
				return "text-orange-500";
			case "normal":
				return "text-blue-500";
			case "low":
				return "text-gray-500";
			default:
				return "text-gray-400";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "pending":
				return <Clock className="h-4 w-4" />;
			case "processing":
				return <RefreshCw className="h-4 w-4 animate-spin" />;
			case "completed":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "failed":
				return <XCircle className="h-4 w-4 text-red-500" />;
			case "dead":
				return <AlertCircle className="h-4 w-4 text-gray-500" />;
			default:
				return null;
		}
	};

	const formatTimestamp = (timestamp: string) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString();
	};

	const retryDeadLetters = async () => {
		try {
			const response = await fetch("/api/inbox/retry-dead-letters", {
				method: "POST",
			});
			if (response.ok) {
				console.log("Retrying dead letters...");
			}
		} catch (error) {
			console.error("Failed to retry dead letters:", error);
		}
	};

	const clearDeadLetters = async () => {
		try {
			const response = await fetch("/api/inbox/clear-dead-letters", {
				method: "POST",
			});
			if (response.ok) {
				setDeadLetters([]);
			}
		} catch (error) {
			console.error("Failed to clear dead letters:", error);
		}
	};

	return (
		<Card className="flex h-full flex-col">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Mail className="h-5 w-5" />
						Agent Inbox
					</CardTitle>
					<div className="flex gap-2">
						<Badge variant="outline">Queue: {stats.queueSize}</Badge>
						<Badge variant="outline" className="animate-pulse">
							Processing: {stats.processingCount}
						</Badge>
						{stats.deadLetterCount > 0 && (
							<Badge variant="destructive">Dead: {stats.deadLetterCount}</Badge>
						)}
					</div>
				</div>
			</CardHeader>

			<CardContent className="flex-1 overflow-hidden">
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex h-full flex-col"
				>
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="active">Active Messages</TabsTrigger>
						<TabsTrigger value="dead">Dead Letters</TabsTrigger>
						<TabsTrigger value="handlers">Handlers</TabsTrigger>
					</TabsList>

					<TabsContent value="active" className="flex-1 overflow-hidden">
						<ScrollArea className="h-full">
							<div className="space-y-2">
								{messages.map((message) => (
									<button
										key={message.id}
										type="button"
										className={cn(
											"w-full cursor-pointer rounded-lg border p-3 text-left transition-colors",
											selectedMessage?.id === message.id
												? "bg-secondary"
												: "hover:bg-secondary/50",
										)}
										onClick={() => setSelectedMessage(message)}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												{getStatusIcon(message.status)}
												<span className="font-mono text-xs">
													{message.id.slice(0, 8)}
												</span>
												<Badge
													className={getPriorityColor(message.priority)}
													variant="outline"
												>
													{message.priority}
												</Badge>
											</div>
											<span className="text-muted-foreground text-xs">
												{formatTimestamp(message.timestamp)}
											</span>
										</div>

										<div className="mt-2 flex items-center gap-2 text-sm">
											<span className="text-muted-foreground">From:</span>
											<Badge variant="secondary">{message.from}</Badge>
											<span className="text-muted-foreground">→</span>
											<Badge variant="secondary">{message.to}</Badge>
										</div>

										{message.error && (
											<div className="mt-2 text-red-500 text-xs">
												Error: {message.error}
											</div>
										)}
									</button>
								))}
							</div>
						</ScrollArea>
					</TabsContent>

					<TabsContent value="dead" className="flex-1 overflow-hidden">
						<div className="flex h-full flex-col">
							<div className="mb-3 flex gap-2">
								<Button
									size="sm"
									onClick={retryDeadLetters}
									disabled={deadLetters.length === 0}
								>
									<RefreshCw className="mr-1 h-4 w-4" />
									Retry All
								</Button>
								<Button
									size="sm"
									variant="destructive"
									onClick={clearDeadLetters}
									disabled={deadLetters.length === 0}
								>
									<Trash2 className="mr-1 h-4 w-4" />
									Clear All
								</Button>
							</div>

							<ScrollArea className="flex-1">
								<div className="space-y-2">
									{deadLetters.map((message) => (
										<div
											key={message.id}
											className="rounded-lg border border-destructive/50 bg-destructive/10 p-3"
										>
											<div className="flex items-center justify-between">
												<span className="font-mono text-xs">
													{message.id.slice(0, 8)}
												</span>
												<span className="text-muted-foreground text-xs">
													{formatTimestamp(message.timestamp)}
												</span>
											</div>

											<div className="mt-2 text-sm">
												<span className="text-muted-foreground">
													Failed after {message.retryCount} retries
												</span>
											</div>

											{message.error && (
												<div className="mt-2 text-red-500 text-xs">
													{message.error}
												</div>
											)}
										</div>
									))}

									{deadLetters.length === 0 && (
										<div className="py-8 text-center text-muted-foreground">
											No dead letters
										</div>
									)}
								</div>
							</ScrollArea>
						</div>
					</TabsContent>

					<TabsContent value="handlers" className="flex-1 overflow-hidden">
						<div className="space-y-3">
							<div className="text-muted-foreground text-sm">
								Registered message handlers:
							</div>
							{stats.handlers.map((handler) => (
								<div
									key={handler}
									className="flex items-center gap-2 rounded-lg border p-2"
								>
									<div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
									<span className="font-mono text-sm">{handler}</span>
								</div>
							))}

							{stats.handlers.length === 0 && (
								<div className="py-8 text-center text-muted-foreground">
									No handlers registered
								</div>
							)}
						</div>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
