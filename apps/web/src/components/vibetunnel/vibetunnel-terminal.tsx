"use client";

import {
	Copy,
	ExternalLink,
	Globe,
	QrCode,
	Terminal,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface TunnelStatus {
	service: string;
	url: string;
	status: "connecting" | "active" | "failed" | "disconnected";
	error?: string;
	qrCode?: string;
	uptime?: number;
	metrics?: {
		requests: number;
		bytesTransferred: number;
	};
}

interface TerminalLine {
	id: string;
	type: "command" | "output" | "error" | "system";
	content: string;
	timestamp: Date;
}

export function VibeTunnelTerminal() {
	const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus[]>([]);
	const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
	const [command, setCommand] = useState("");
	const [isConnected, setIsConnected] = useState(false);
	const [showQR, setShowQR] = useState<{ [key: string]: boolean }>({});
	const terminalRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Connect to VibeTunnel WebSocket
	useEffect(() => {
		connectToVibeTunnel();
	}, [connectToVibeTunnel]);

	const connectToVibeTunnel = () => {
		const ws = new WebSocket(
			`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/vibetunnel/ws`,
		);

		ws.onopen = () => {
			setIsConnected(true);
			addTerminalLine("system", "🌐 Connected to VibeTunnel");
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);

			switch (data.type) {
				case "status:update":
					setTunnelStatus(data.tunnels);
					break;
				case "terminal:output":
					addTerminalLine(data.outputType || "output", data.content);
					break;
				case "tunnel:connected":
					addTerminalLine(
						"system",
						`✅ Tunnel connected: ${data.service} → ${data.url}`,
					);
					toast.success(`Tunnel connected: ${data.service}`);
					break;
				case "tunnel:error":
					addTerminalLine("error", `❌ Tunnel error: ${data.error}`);
					toast.error(`Tunnel error: ${data.error}`);
					break;
			}
		};

		ws.onclose = () => {
			setIsConnected(false);
			addTerminalLine("system", "🔌 Disconnected from VibeTunnel");
			// Attempt reconnection after 3 seconds
			setTimeout(connectToVibeTunnel, 3000);
		};

		ws.onerror = (error) => {
			addTerminalLine("error", `WebSocket error: ${error}`);
		};

		return ws;
	};

	const addTerminalLine = (type: TerminalLine["type"], content: string) => {
		const newLine: TerminalLine = {
			id: `line_${Date.now()}_${Math.random()}`,
			type,
			content,
			timestamp: new Date(),
		};

		setTerminalLines((prev) => [...prev, newLine].slice(-500)); // Keep last 500 lines

		// Auto-scroll to bottom
		setTimeout(() => {
			if (terminalRef.current) {
				terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
			}
		}, 10);
	};

	const executeCommand = async (cmd: string) => {
		if (!cmd.trim()) return;

		addTerminalLine("command", `$ ${cmd}`);
		setCommand("");

		try {
			const response = await fetch("/api/vibetunnel/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ command: cmd }),
			});

			const result = await response.json();

			if (result.success) {
				addTerminalLine("output", result.output);
			} else {
				addTerminalLine("error", result.error || "Command failed");
			}
		} catch (error) {
			addTerminalLine("error", `Failed to execute command: ${error}`);
		}
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Copied to clipboard!");
		} catch (_error) {
			toast.error("Failed to copy");
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "active":
				return "bg-green-500";
			case "connecting":
				return "bg-yellow-500";
			case "failed":
				return "bg-red-500";
			case "disconnected":
				return "bg-gray-500";
			default:
				return "bg-gray-400";
		}
	};

	const formatUptime = (ms?: number) => {
		if (!ms) return "N/A";
		const minutes = Math.floor(ms / 60000);
		const hours = Math.floor(minutes / 60);
		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		}
		return `${minutes}m`;
	};

	const formatBytes = (bytes?: number) => {
		if (!bytes) return "0 B";
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
	};

	const getLineClass = (type: TerminalLine["type"]) => {
		switch (type) {
			case "command":
				return "text-blue-400 font-bold";
			case "error":
				return "text-red-400";
			case "system":
				return "text-yellow-400";
			default:
				return "text-gray-300";
		}
	};

	return (
		<Card className="flex h-full flex-col">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Terminal className="h-5 w-5" />
						VibeTunnel Terminal
					</CardTitle>
					<div className="flex items-center gap-2">
						{isConnected ? (
							<Badge variant="outline" className="gap-1">
								<Wifi className="h-3 w-3" />
								Connected
							</Badge>
						) : (
							<Badge variant="destructive" className="gap-1">
								<WifiOff className="h-3 w-3" />
								Disconnected
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>

			<CardContent className="flex-1 overflow-hidden">
				<Tabs defaultValue="terminal" className="flex h-full flex-col">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="terminal">Terminal</TabsTrigger>
						<TabsTrigger value="tunnels">Active Tunnels</TabsTrigger>
					</TabsList>

					<TabsContent
						value="terminal"
						className="flex flex-1 flex-col overflow-hidden"
					>
						<div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-black p-4 font-mono text-sm">
							<ScrollArea className="flex-1" ref={terminalRef}>
								<div className="space-y-1">
									{terminalLines.map((line) => (
										<div
											key={line.id}
											className={cn("break-all", getLineClass(line.type))}
										>
											<span className="mr-2 text-gray-500 text-xs">
												[{line.timestamp.toLocaleTimeString()}]
											</span>
											{line.content}
										</div>
									))}
								</div>
							</ScrollArea>

							<div className="mt-4 flex gap-2">
								<Input
									ref={inputRef}
									value={command}
									onChange={(e) => setCommand(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											executeCommand(command);
										}
									}}
									placeholder="Enter command..."
									className="border-gray-700 bg-gray-900 font-mono text-white"
								/>
								<Button
									size="sm"
									onClick={() => executeCommand(command)}
									disabled={!command.trim()}
								>
									Run
								</Button>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="tunnels" className="flex-1 overflow-hidden">
						<ScrollArea className="h-full">
							<div className="space-y-4">
								{tunnelStatus.map((tunnel) => (
									<Card key={tunnel.service} className="p-4">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="mb-2 flex items-center gap-2">
													<div
														className={cn(
															"h-2 w-2 rounded-full",
															getStatusColor(tunnel.status),
														)}
													/>
													<span className="font-semibold">
														{tunnel.service}
													</span>
													<Badge variant="outline" className="text-xs">
														{tunnel.status}
													</Badge>
												</div>

												{tunnel.url && (
													<div className="mb-2 flex items-center gap-2">
														<Globe className="h-4 w-4 text-muted-foreground" />
														<code className="rounded bg-secondary px-2 py-1 text-xs">
															{tunnel.url}
														</code>
														<Button
															size="sm"
															variant="ghost"
															onClick={() => copyToClipboard(tunnel.url)}
														>
															<Copy className="h-3 w-3" />
														</Button>
														<Button
															size="sm"
															variant="ghost"
															onClick={() => window.open(tunnel.url, "_blank")}
														>
															<ExternalLink className="h-3 w-3" />
														</Button>
														<Button
															size="sm"
															variant="ghost"
															onClick={() =>
																setShowQR((prev) => ({
																	...prev,
																	[tunnel.service]: !prev[tunnel.service],
																}))
															}
														>
															<QrCode className="h-3 w-3" />
														</Button>
													</div>
												)}

												{tunnel.uptime && (
													<div className="space-x-4 text-muted-foreground text-xs">
														<span>Uptime: {formatUptime(tunnel.uptime)}</span>
														{tunnel.metrics && (
															<>
																<span>Requests: {tunnel.metrics.requests}</span>
																<span>
																	Data:{" "}
																	{formatBytes(tunnel.metrics.bytesTransferred)}
																</span>
															</>
														)}
													</div>
												)}

												{tunnel.error && (
													<div className="mt-2 text-red-500 text-xs">
														Error: {tunnel.error}
													</div>
												)}
											</div>

											{showQR[tunnel.service] && tunnel.qrCode && (
												<div className="ml-4">
													<img
														src={tunnel.qrCode}
														alt={`QR Code for ${tunnel.service}`}
														className="h-32 w-32"
													/>
												</div>
											)}
										</div>
									</Card>
								))}

								{tunnelStatus.length === 0 && (
									<div className="py-8 text-center text-muted-foreground">
										No active tunnels
									</div>
								)}
							</div>
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
