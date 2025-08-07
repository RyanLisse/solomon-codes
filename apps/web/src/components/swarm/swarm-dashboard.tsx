"use client";

import {
	Activity,
	Brain,
	ChevronRight,
	MessageSquare,
	Mic,
	Network,
	Settings,
	Terminal,
	Users,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AgentInboxPanel } from "../agent-inbox/agent-inbox-panel";
import { VibeTunnelTerminal } from "../vibetunnel/vibetunnel-terminal";
import { VoiceFirstInterface } from "../voice/voice-first-interface";

interface SwarmMetrics {
	activeAgents: number;
	totalTasks: number;
	completedTasks: number;
	avgResponseTime: number;
	consensusRate: number;
	cacheHitRate: number;
}

interface AgentStatus {
	id: string;
	type: string;
	status: "idle" | "busy" | "error";
	currentTask?: string;
	performance: number;
}

export function SwarmDashboard() {
	const [activeTab, setActiveTab] = useState("overview");
	const [metrics, setMetrics] = useState<SwarmMetrics>({
		activeAgents: 0,
		totalTasks: 0,
		completedTasks: 0,
		avgResponseTime: 0,
		consensusRate: 0,
		cacheHitRate: 0,
	});
	const [agents, setAgents] = useState<AgentStatus[]>([]);
	const [topology, setTopology] = useState<
		"hierarchical" | "mesh" | "ring" | "star"
	>("hierarchical");
	const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);

	// Connect to swarm monitoring WebSocket
	useEffect(() => {
		const ws = new WebSocket(
			`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/swarm/monitor`,
		);

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);

			switch (data.type) {
				case "metrics:update":
					setMetrics(data.metrics);
					break;
				case "agents:update":
					setAgents(data.agents);
					break;
				case "topology:change":
					setTopology(data.topology);
					break;
			}
		};

		return () => ws.close();
	}, []);

	const getTopologyIcon = () => {
		switch (topology) {
			case "hierarchical":
				return "🏛️";
			case "mesh":
				return "🕸️";
			case "ring":
				return "⭕";
			case "star":
				return "⭐";
			default:
				return "🔷";
		}
	};

	const getAgentStatusColor = (status: string) => {
		switch (status) {
			case "idle":
				return "bg-gray-500";
			case "busy":
				return "bg-yellow-500";
			case "error":
				return "bg-red-500";
			default:
				return "bg-gray-400";
		}
	};

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="border-b p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Brain className="h-8 w-8 text-primary" />
						<div>
							<h1 className="font-bold text-2xl">
								LangGraph Swarm Control Center
							</h1>
							<p className="text-muted-foreground text-sm">
								Phase 3: VibeTunnel • Agent Inbox • Voice Integration
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Badge variant="outline" className="gap-1">
							{getTopologyIcon()} {topology}
						</Badge>
						<Button size="sm" variant="outline">
							<Settings className="mr-1 h-4 w-4" />
							Configure
						</Button>
					</div>
				</div>
			</div>

			{/* Metrics Bar */}
			<div className="border-b bg-secondary/20 p-4">
				<div className="grid grid-cols-6 gap-4">
					<Card className="p-3">
						<div className="flex items-center justify-between">
							<Users className="h-4 w-4 text-muted-foreground" />
							<span className="font-bold text-2xl">{metrics.activeAgents}</span>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">Active Agents</p>
					</Card>

					<Card className="p-3">
						<div className="flex items-center justify-between">
							<Activity className="h-4 w-4 text-muted-foreground" />
							<span className="font-bold text-2xl">{metrics.totalTasks}</span>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">Total Tasks</p>
					</Card>

					<Card className="p-3">
						<div className="flex items-center justify-between">
							<Zap className="h-4 w-4 text-muted-foreground" />
							<span className="font-bold text-2xl">
								{metrics.avgResponseTime}ms
							</span>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">Avg Response</p>
					</Card>

					<Card className="p-3">
						<div className="flex items-center justify-between">
							<Network className="h-4 w-4 text-muted-foreground" />
							<span className="font-bold text-2xl">
								{(metrics.consensusRate * 100).toFixed(0)}%
							</span>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">Consensus Rate</p>
					</Card>

					<Card className="p-3">
						<div className="flex items-center justify-between">
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
							<span className="font-bold text-2xl">
								{(metrics.cacheHitRate * 100).toFixed(0)}%
							</span>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">Cache Hit Rate</p>
					</Card>

					<Card className="p-3">
						<div className="flex items-center justify-between">
							<Progress
								value={(metrics.completedTasks / metrics.totalTasks) * 100}
								className="h-2"
							/>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">
							{metrics.completedTasks}/{metrics.totalTasks} Completed
						</p>
					</Card>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 overflow-hidden p-4">
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex h-full flex-col"
				>
					<TabsList className="grid w-full grid-cols-5">
						<TabsTrigger value="overview">
							<Brain className="mr-1 h-4 w-4" />
							Overview
						</TabsTrigger>
						<TabsTrigger value="inbox">
							<MessageSquare className="mr-1 h-4 w-4" />
							Agent Inbox
						</TabsTrigger>
						<TabsTrigger value="terminal">
							<Terminal className="mr-1 h-4 w-4" />
							VibeTunnel
						</TabsTrigger>
						<TabsTrigger value="voice">
							<Mic className="mr-1 h-4 w-4" />
							Voice Control
						</TabsTrigger>
						<TabsTrigger value="agents">
							<Users className="mr-1 h-4 w-4" />
							Agents
						</TabsTrigger>
					</TabsList>

					<TabsContent value="overview" className="flex-1 overflow-hidden">
						<div className="grid h-full grid-cols-2 gap-4">
							{/* Swarm Visualization */}
							<Card className="h-full">
								<CardHeader>
									<CardTitle>Swarm Topology</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="flex h-full items-center justify-center">
										<div className="text-center">
											<div className="mb-4 text-6xl">{getTopologyIcon()}</div>
											<h3 className="font-semibold text-lg capitalize">
												{topology} Topology
											</h3>
											<p className="mt-2 text-muted-foreground text-sm">
												{agents.length} agents active
											</p>
											<div className="mt-4 flex justify-center gap-2">
												{["hierarchical", "mesh", "ring", "star"].map((t) => (
													<Button
														key={t}
														size="sm"
														variant={topology === t ? "default" : "outline"}
														onClick={() => setTopology(t as any)}
													>
														{t}
													</Button>
												))}
											</div>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Quick Actions */}
							<Card className="h-full">
								<CardHeader>
									<CardTitle>Quick Actions</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<Button className="w-full justify-start" variant="outline">
										<Brain className="mr-2 h-4 w-4" />
										Spawn New Agent
									</Button>
									<Button className="w-full justify-start" variant="outline">
										<MessageSquare className="mr-2 h-4 w-4" />
										Send Broadcast Message
									</Button>
									<Button className="w-full justify-start" variant="outline">
										<Terminal className="mr-2 h-4 w-4" />
										Open VibeTunnel
									</Button>
									<Button
										className="w-full justify-start"
										variant="outline"
										onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
									>
										<Mic className="mr-2 h-4 w-4" />
										{isVoiceEnabled ? "Disable" : "Enable"} Voice Control
									</Button>
									<Button className="w-full justify-start" variant="outline">
										<Network className="mr-2 h-4 w-4" />
										Rebuild Consensus
									</Button>
									<Button className="w-full justify-start" variant="outline">
										<Activity className="mr-2 h-4 w-4" />
										View Performance Metrics
									</Button>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="inbox" className="flex-1 overflow-hidden">
						<AgentInboxPanel />
					</TabsContent>

					<TabsContent value="terminal" className="flex-1 overflow-hidden">
						<VibeTunnelTerminal />
					</TabsContent>

					<TabsContent value="voice" className="flex-1 overflow-hidden">
						<Card className="h-full">
							<CardHeader>
								<CardTitle>Voice Control System</CardTitle>
							</CardHeader>
							<CardContent className="h-full">
								<VoiceFirstInterface
									onTextInput={(text) => console.log("Text input:", text)}
									onVoiceMessage={(message, isUser) =>
										console.log("Voice message:", message, isUser)
									}
									enableLettaIntegration={true}
									showAgentStatus={true}
									sessionId={`session_${Date.now()}`}
									userId="user_swarm"
								/>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="agents" className="flex-1 overflow-hidden">
						<Card className="h-full">
							<CardHeader>
								<CardTitle>Active Agents</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{agents.map((agent) => (
										<div
											key={agent.id}
											className="flex items-center justify-between rounded-lg border p-3"
										>
											<div className="flex items-center gap-3">
												<div
													className={cn(
														"h-2 w-2 rounded-full",
														getAgentStatusColor(agent.status),
													)}
												/>
												<div>
													<p className="font-semibold">{agent.type}</p>
													<p className="text-muted-foreground text-xs">
														{agent.id}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-2">
												{agent.currentTask && (
													<Badge variant="outline" className="text-xs">
														{agent.currentTask}
													</Badge>
												)}
												<Progress
													value={agent.performance}
													className="h-2 w-20"
												/>
												<span className="text-muted-foreground text-xs">
													{agent.performance}%
												</span>
											</div>
										</div>
									))}

									{agents.length === 0 && (
										<div className="py-8 text-center text-muted-foreground">
											No active agents. Spawn agents to begin.
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
