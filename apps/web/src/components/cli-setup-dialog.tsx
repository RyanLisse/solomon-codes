"use client";

import {
	AlertCircle,
	CheckCircle,
	Download,
	Eye,
	EyeOff,
	Key,
	Settings,
	Terminal,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type InstallationStatus =
	| "not-checked"
	| "checking"
	| "installed"
	| "not-installed"
	| "error";

interface CLIAgent {
	id: string;
	name: string;
	provider: string;
	description: string;
	installCommand: string;
	configKey: string;
	apiKeyLabel: string;
	apiKeyPlaceholder: string;
	docsUrl: string;
}

const cliAgents: CLIAgent[] = [
	{
		id: "claude-code",
		name: "Claude Code",
		provider: "Anthropic",
		description: "Official Claude CLI for code assistance",
		installCommand: "npm install -g @anthropics/claude-cli",
		configKey: "ANTHROPIC_API_KEY",
		apiKeyLabel: "Anthropic API Key",
		apiKeyPlaceholder: "sk-ant-api03-...",
		docsUrl: "https://docs.anthropic.com/claude/reference/cli",
	},
	{
		id: "gemini-cli",
		name: "Gemini CLI",
		provider: "Google",
		description: "Google's Gemini command-line interface",
		installCommand: "npm install -g @google-ai/generative-ai-cli",
		configKey: "GOOGLE_API_KEY",
		apiKeyLabel: "Google AI API Key",
		apiKeyPlaceholder: "AIza...",
		docsUrl: "https://ai.google.dev/docs/gemini_api_overview",
	},
	{
		id: "opencode",
		name: "OpenCode",
		provider: "OpenAI",
		description: "OpenAI-powered code generation CLI",
		installCommand: "npm install -g opencode-cli",
		configKey: "OPENAI_API_KEY",
		apiKeyLabel: "OpenAI API Key",
		apiKeyPlaceholder: "sk-...",
		docsUrl: "https://platform.openai.com/docs/api-reference",
	},
	{
		id: "grok-cli",
		name: "Grok CLI",
		provider: "xAI",
		description: "xAI's Grok command-line interface",
		installCommand: "npm install -g @xai/grok-cli",
		configKey: "XAI_API_KEY",
		apiKeyLabel: "xAI API Key",
		apiKeyPlaceholder: "xai-...",
		docsUrl: "https://docs.x.ai/api",
	},
];

interface Prerequisites {
	nodejs: { status: InstallationStatus; version?: string };
	docker: { status: InstallationStatus; version?: string };
	git: { status: InstallationStatus; version?: string };
	vibekit: { status: InstallationStatus; version?: string };
}

export function CLISetupDialog() {
	const [open, setOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("prerequisites");
	const [prerequisites, setPrerequisites] = useState<Prerequisites>({
		nodejs: { status: "not-checked" },
		docker: { status: "not-checked" },
		git: { status: "not-checked" },
		vibekit: { status: "not-checked" },
	});
	const [cliStatuses, setCLIStatuses] = useState<
		Record<string, InstallationStatus>
	>({});
	const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
	const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
	const [, setIsChecking] = useState(false);

	// Check prerequisites
	const checkPrerequisites = useCallback(async () => {
		setIsChecking(true);

		// Simulate checking prerequisites (in real app, this would call actual system commands)
		const checks = [
			{ key: "nodejs", command: "node --version" },
			{ key: "docker", command: "docker --version" },
			{ key: "git", command: "git --version" },
			{ key: "vibekit", command: "vibekit --version" },
		];

		for (const check of checks) {
			setPrerequisites((prev) => ({
				...prev,
				[check.key]: { status: "checking" },
			}));

			// Simulate API call delay
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Mock results (in real app, execute actual commands)
			const mockResults = {
				nodejs: { status: "installed" as const, version: "v20.11.0" },
				docker: { status: "installed" as const, version: "25.0.3" },
				git: { status: "installed" as const, version: "2.42.0" },
				vibekit: { status: "not-installed" as const },
			};

			setPrerequisites((prev) => ({
				...prev,
				[check.key]: mockResults[check.key as keyof typeof mockResults],
			}));
		}

		setIsChecking(false);
	}, []);

	// Check CLI agent installations
	const checkCLIAgent = async (agentId: string) => {
		setCLIStatuses((prev) => ({ ...prev, [agentId]: "checking" }));

		// Simulate checking CLI installation
		await new Promise((resolve) => setTimeout(resolve, 800));

		// Mock result (in real app, check actual installation)
		const isInstalled = Math.random() > 0.5;
		setCLIStatuses((prev) => ({
			...prev,
			[agentId]: isInstalled ? "installed" : "not-installed",
		}));
	};

	// Install CLI agent
	const installCLIAgent = async (agent: CLIAgent) => {
		setCLIStatuses((prev) => ({ ...prev, [agent.id]: "checking" }));

		// Simulate installation
		await new Promise((resolve) => setTimeout(resolve, 2000));

		setCLIStatuses((prev) => ({ ...prev, [agent.id]: "installed" }));
	};

	// Save API key
	const saveApiKey = (agentId: string, key: string) => {
		setApiKeys((prev) => ({ ...prev, [agentId]: key }));
		// In real app, save to secure storage
	};

	// Get status icon
	const getStatusIcon = (status: InstallationStatus) => {
		switch (status) {
			case "installed":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "not-installed":
				return <XCircle className="h-4 w-4 text-red-500" />;
			case "checking":
				return (
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
				);
			case "error":
				return <AlertCircle className="h-4 w-4 text-amber-500" />;
			default:
				return <AlertCircle className="h-4 w-4 text-gray-400" />;
		}
	};

	// Check prerequisites on open
	useEffect(() => {
		if (open) {
			checkPrerequisites();
		}
	}, [open, checkPrerequisites]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="h-8 px-3">
					<Settings className="mr-2 h-4 w-4" />
					CLI Setup
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
				<DialogHeader>
					<DialogTitle>VibeKit CLI Setup</DialogTitle>
					<DialogDescription>
						Configure CLI agents and API keys for code generation
					</DialogDescription>
				</DialogHeader>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="prerequisites">Prerequisites</TabsTrigger>
						<TabsTrigger value="cli-agents">CLI Agents</TabsTrigger>
						<TabsTrigger value="api-keys">API Keys</TabsTrigger>
					</TabsList>

					<div className="max-h-[60vh] overflow-y-auto">
						<TabsContent value="prerequisites" className="space-y-4">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Terminal className="h-5 w-5" />
										System Requirements
									</CardTitle>
									<CardDescription>
										Ensure all prerequisites are installed before setting up CLI
										agents
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{Object.entries(prerequisites).map(
										([key, { status, version }]) => (
											<div
												key={key}
												className="flex items-center justify-between rounded-lg border p-3"
											>
												<div className="flex items-center gap-3">
													{getStatusIcon(status)}
													<div>
														<p className="font-medium capitalize">
															{key === "nodejs" ? "Node.js" : key}
														</p>
														{version && (
															<p className="text-muted-foreground text-sm">
																{version}
															</p>
														)}
													</div>
												</div>
												<div className="flex items-center gap-2">
													{status === "installed" && (
														<Badge
															variant="secondary"
															className="text-green-600"
														>
															Installed
														</Badge>
													)}
													{status === "not-installed" && (
														<Badge variant="destructive">Not Installed</Badge>
													)}
													{status === "checking" && (
														<Badge variant="outline">Checking...</Badge>
													)}
												</div>
											</div>
										),
									)}

									<div className="space-y-2 pt-4">
										<h4 className="font-medium">Installation Commands:</h4>
										<div className="space-y-1 rounded-lg bg-muted p-3 font-mono text-sm">
											<div># Install Node.js (if needed)</div>
											<div>
												curl -fsSL
												https://nodejs.org/dist/v20.11.0/node-v20.11.0.pkg
											</div>
											<div className="pt-2"># Install VibeKit CLI</div>
											<div>npm install -g @vibe-kit/cli</div>
											<div className="pt-2"># Verify Docker is running</div>
											<div>docker info</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="cli-agents" className="space-y-4">
							<div className="grid gap-4">
								{cliAgents.map((agent) => (
									<Card key={agent.id}>
										<CardHeader>
											<div className="flex items-center justify-between">
												<div>
													<CardTitle className="flex items-center gap-2">
														{agent.name}
														<Badge variant="outline">{agent.provider}</Badge>
													</CardTitle>
													<CardDescription>{agent.description}</CardDescription>
												</div>
												<div className="flex items-center gap-2">
													{getStatusIcon(
														cliStatuses[agent.id] || "not-checked",
													)}
													{cliStatuses[agent.id] === "installed" ? (
														<Badge
															variant="secondary"
															className="text-green-600"
														>
															Installed
														</Badge>
													) : cliStatuses[agent.id] === "not-installed" ? (
														<Button
															size="sm"
															onClick={() => installCLIAgent(agent)}
															disabled={cliStatuses[agent.id] === "checking"}
														>
															<Download className="mr-2 h-4 w-4" />
															Install
														</Button>
													) : (
														<Button
															size="sm"
															variant="outline"
															onClick={() => checkCLIAgent(agent.id)}
															disabled={cliStatuses[agent.id] === "checking"}
														>
															Check
														</Button>
													)}
												</div>
											</div>
										</CardHeader>
										<CardContent>
											<div className="rounded-lg bg-muted p-3">
												<code className="text-sm">{agent.installCommand}</code>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</TabsContent>

						<TabsContent value="api-keys" className="space-y-4">
							<div className="grid gap-4">
								{cliAgents.map((agent) => (
									<Card key={agent.id}>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Key className="h-4 w-4" />
												{agent.name} Configuration
											</CardTitle>
											<CardDescription>
												Configure API key for {agent.provider}
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="space-y-2">
												<Label htmlFor={`api-key-${agent.id}`}>
													{agent.apiKeyLabel}
												</Label>
												<div className="flex gap-2">
													<div className="relative flex-1">
														<Input
															id={`api-key-${agent.id}`}
															type={showApiKeys[agent.id] ? "text" : "password"}
															placeholder={agent.apiKeyPlaceholder}
															value={apiKeys[agent.id] || ""}
															onChange={(e) =>
																saveApiKey(agent.id, e.target.value)
															}
														/>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
															onClick={() =>
																setShowApiKeys((prev) => ({
																	...prev,
																	[agent.id]: !prev[agent.id],
																}))
															}
														>
															{showApiKeys[agent.id] ? (
																<EyeOff className="h-4 w-4" />
															) : (
																<Eye className="h-4 w-4" />
															)}
														</Button>
													</div>
													<Button
														variant="outline"
														size="sm"
														onClick={() => window.open(agent.docsUrl, "_blank")}
													>
														Get Key
													</Button>
												</div>
											</div>

											<div className="flex items-center gap-2">
												{apiKeys[agent.id] ? (
													<>
														<CheckCircle className="h-4 w-4 text-green-500" />
														<span className="text-green-600 text-sm">
															API key configured
														</span>
													</>
												) : (
													<>
														<AlertCircle className="h-4 w-4 text-amber-500" />
														<span className="text-muted-foreground text-sm">
															API key required
														</span>
													</>
												)}
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</TabsContent>
					</div>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
