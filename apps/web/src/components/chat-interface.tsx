"use client";

import {
	Archive,
	Bot,
	BrainCircuit,
	CheckSquare,
	GitBranch,
	Github,
	RefreshCw,
	Sparkles,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { generateCodeAction } from "@/app/actions/vibekit";
import { Button } from "@/components/ui/button";
import { OpenCodeIcon } from "@/components/ui/opencode-icon";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	useGitHubAuthRefresh,
	useGitHubAuthStatus,
	useGitHubBranches,
} from "@/hooks/use-github";
import { useRepositoryData } from "@/hooks/use-repository-data";
import type { RepositoryTask } from "@/lib/repository-service";
import { cn } from "@/lib/utils";
import type { Task } from "@/stores/tasks";
import { MicrophoneButton } from "./voice/microphone-button";
import type { VoiceError } from "./voice/types";

// Use RepositoryTask type instead of local Task interface

const agents = [
	{
		id: "claude-code",
		name: "Claude Code",
		icon: Bot,
		color: "#D97706",
		models: [
			{ id: "claude-3-5-sonnet", name: "Sonnet" },
			{ id: "claude-3-opus", name: "Opus" },
		],
	},
	{
		id: "gemini-cli",
		name: "Gemini CLI",
		icon: Sparkles,
		color: "#4285F4",
		models: [
			{ id: "gemini-pro", name: "Gemini Pro" },
			{ id: "gemini-flash", name: "Gemini Flash" },
		],
	},
	{
		id: "openai-cli",
		name: "OpenAI CLI",
		icon: BrainCircuit,
		color: "#412991",
		models: [
			{ id: "gpt-4", name: "GPT-4" },
			{ id: "gpt-4-turbo", name: "GPT-4 Turbo" },
		],
	},
	{
		id: "opencode",
		name: "OpenCode",
		icon: OpenCodeIcon,
		color: "#000000",
		models: [
			{ id: "gpt-4-opencode", name: "GPT-4" },
			{ id: "claude-opencode", name: "Claude" },
		],
	},
	{
		id: "grok-cli",
		name: "Grok CLI",
		icon: Zap,
		color: "#000000",
		models: [
			{ id: "grok-2", name: "Grok-2" },
			{ id: "grok-mini", name: "Grok Mini" },
		],
	},
];

interface GitHubBranch {
	name: string;
	commit: {
		sha: string;
		url: string;
	};
	protected: boolean;
	isDefault: boolean;
}

interface ChatInterfaceProps {
	isLocalExecution?: boolean;
	onLocalExecutionChange?: (value: boolean) => void;
}

export function ChatInterface({
	isLocalExecution = true,
	onLocalExecutionChange: _onLocalExecutionChange,
}: ChatInterfaceProps = {}) {
	const [activeTab, setActiveTab] = useState<"tasks" | "archive">("tasks");
	const [taskDescription, setTaskDescription] = useState("");
	const [selectedAgent, setSelectedAgent] = useState("claude-code");
	const [selectedModel, setSelectedModel] = useState("claude-3-5-sonnet");
	// Local execution is now controlled by parent component
	const [selectedBranch, setSelectedBranch] = useState<string>("main");

	// Voice interface state
	const [isRecording, setIsRecording] = useState(false);
	const [isProcessingVoice, setIsProcessingVoice] = useState(false);
	const [_voiceTranscript, setVoiceTranscript] = useState("");
	const [_voiceError, setVoiceError] = useState<VoiceError | null>(null);

	// Use real repository data
	const {
		tasks,
		repositories,
		isLoading,
		error,
		refreshTasks,
		isAuthenticated,
		currentRepository,
		setCurrentRepository,
	} = useRepositoryData();

	// GitHub TanStack Query hooks
	const { data: _authStatus } = useGitHubAuthStatus();
	const authRefreshMutation = useGitHubAuthRefresh();

	// Fetch branches using TanStack Query
	const [owner, repoName] = currentRepository?.full_name.split("/") || ["", ""];
	const {
		data: branchesData,
		isLoading: loadingBranches,
		error: _branchesError,
	} = useGitHubBranches(owner, repoName);

	const branches = useMemo(
		() => branchesData?.branches || [],
		[branchesData?.branches],
	);

	// Separate tasks into recent and older
	const recentTasks = tasks.slice(0, 5);
	const olderTasks = tasks.slice(5);

	// Loading state for code generation
	const [isGeneratingCode, setIsGeneratingCode] = useState(false);

	// Set default branch when branches data changes
	useEffect(() => {
		if (branches.length > 0) {
			const defaultBranch = branches.find(
				(branch: GitHubBranch) => branch.isDefault,
			);
			if (defaultBranch && selectedBranch !== defaultBranch.name) {
				setSelectedBranch(defaultBranch.name);
			}
		}
	}, [branches, selectedBranch]);

	// Handle code generation
	const handleCodeGeneration = async () => {
		if (!taskDescription.trim()) return;

		setIsGeneratingCode(true);
		try {
			// Create a task from the description
			const task: Task = {
				id: Date.now().toString(),
				title: taskDescription,
				description: taskDescription,
				messages: [],
				mode: "code" as const,
				repository:
					currentRepository?.full_name || "SolomonCodes/main-solver-bot",
				branch: selectedBranch || currentRepository?.default_branch || "main",
				status: "IN_PROGRESS" as const,
				sessionId: Date.now().toString(),
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				isArchived: false,
				hasChanges: false,
				// Required properties for Task interface
				projectId: "default",
				labels: [],
				priority: "medium" as const,
				versions: [],
				reviewStatus: "pending" as const,
			};

			// Get agent and model configuration
			const selectedAgentInfo = agents.find((a) => a.id === selectedAgent);

			// Get OpenAI API key from localStorage if using OpenAI-based agents
			let openaiApiKey: string | undefined;
			if (selectedAgent === "opencode" || selectedAgent === "openai-cli") {
				openaiApiKey = localStorage.getItem("openai_api_key") || undefined;
			}

			const agentConfig = {
				type: selectedAgent,
				provider: selectedAgentInfo?.name || "Claude Code",
				model: selectedModel,
				isLocal: isLocalExecution ?? true,
				openaiApiKey,
			};

			// Generate code using VibeKit
			const result = await generateCodeAction({
				task,
				prompt: taskDescription,
				agentConfig,
			});

			console.log("Code generation result:", result);
			// Handle the result (show in UI, create new task, etc.)
		} catch (error) {
			console.error("Code generation failed:", error);
			// Show error in UI
		} finally {
			setIsGeneratingCode(false);
		}
	};

	// Voice interface handlers
	const handleStartRecording = () => {
		setIsRecording(true);
		setVoiceError(null);
		setVoiceTranscript("");
	};

	const handleStopRecording = () => {
		setIsRecording(false);
	};

	const handleVoiceTranscription = (transcript: string, isInterim: boolean) => {
		setVoiceTranscript(transcript);
		if (!isInterim) {
			// Final transcription - update task description
			setTaskDescription(transcript);
			setIsProcessingVoice(false);
		}
	};

	const handleVoiceError = (error: VoiceError) => {
		setVoiceError(error);
		setIsRecording(false);
		setIsProcessingVoice(false);
		console.error("Voice error:", error);
	};

	return (
		<div className="flex h-full flex-col">
			{/* Main Content */}
			<main className="flex flex-1 flex-col items-center justify-start px-8 py-16">
				{/* Hero Section */}
				<div className="mb-16 w-full max-w-2xl text-center">
					<h2 className="mb-12 font-semibold text-4xl text-foreground">
						What are we coding next?
					</h2>

					{/* Task Input Card */}
					<div className="relative w-full rounded-2xl border border-border bg-card">
						<Textarea
							placeholder="Add a new feature that allows users to..."
							value={taskDescription}
							onChange={(e) => setTaskDescription(e.target.value)}
							className="min-h-[140px] w-full resize-none border-0 bg-transparent p-6 pb-16 text-lg placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus-visible:ring-0"
							data-testid="task-input"
						/>

						{/* Input Actions - Bottom Row */}
						<div className="absolute right-4 bottom-4 left-4 flex items-center justify-between">
							<div className="flex items-center gap-3">
								{/* Agent Selection Combobox */}
								<Select value={selectedAgent} onValueChange={setSelectedAgent}>
									<SelectTrigger
										className="h-8 w-auto border-0 bg-transparent px-3 text-muted-foreground text-sm"
										data-testid="agent-selector"
									>
										<div className="flex items-center gap-2">
											{(() => {
												const selectedAgentInfo = agents.find(
													(a) => a.id === selectedAgent,
												);
												if (selectedAgentInfo) {
													const IconComponent = selectedAgentInfo.icon;
													return (
														<>
															<IconComponent
																size={16}
																className="text-muted-foreground"
															/>
															<span>{selectedAgentInfo.name}</span>
														</>
													);
												}
												return <SelectValue />;
											})()}
										</div>
									</SelectTrigger>
									<SelectContent>
										{agents.map((agent) => {
											const IconComponent = agent.icon;
											return (
												<SelectItem
													key={agent.id}
													value={agent.id}
													data-testid={`agent-option-${agent.id}`}
												>
													<div className="flex items-center gap-2">
														<IconComponent size={16} />
														<span>{agent.name}</span>
													</div>
												</SelectItem>
											);
										})}
									</SelectContent>
								</Select>

								{/* Model Selection Combobox */}
								<Select value={selectedModel} onValueChange={setSelectedModel}>
									<SelectTrigger className="h-8 w-auto border-0 bg-transparent px-3 text-muted-foreground text-sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(() => {
											const selectedAgentInfo = agents.find(
												(a) => a.id === selectedAgent,
											);
											return (
												selectedAgentInfo?.models.map((model) => (
													<SelectItem key={model.id} value={model.id}>
														<span>{model.name}</span>
													</SelectItem>
												)) || []
											);
										})()}
									</SelectContent>
								</Select>
							</div>

							<div className="flex items-center gap-2">
								<MicrophoneButton
									onStartRecording={handleStartRecording}
									onStopRecording={handleStopRecording}
									onTranscription={handleVoiceTranscription}
									onError={handleVoiceError}
									isRecording={isRecording}
									isProcessing={isProcessingVoice}
									isDisabled={false}
									size="sm"
									className="text-muted-foreground hover:bg-muted"
								/>
								<Button
									size="sm"
									variant="outline"
									className="h-8 px-4 text-sm"
								>
									Ask
								</Button>
								<Button
									size="sm"
									className="h-8 px-4 text-sm"
									onClick={handleCodeGeneration}
									disabled={isGeneratingCode || !taskDescription.trim()}
									data-testid="code-generation-button"
								>
									{isGeneratingCode ? "Generating..." : "Code"}
								</Button>
							</div>
						</div>
					</div>

					{/* Repository Selection - Separate Row */}
					<div className="mt-4 flex items-center justify-center gap-4 text-muted-foreground text-sm">
						{/* Repository Selector */}
						<div className="flex items-center gap-2">
							<Github size={16} className="text-muted-foreground" />
							{isAuthenticated && currentRepository ? (
								<Select
									value={currentRepository.full_name}
									onValueChange={(value) => {
										const repo = repositories.find(
											(r) => r.full_name === value,
										);
										setCurrentRepository(repo || null);
									}}
								>
									<SelectTrigger className="h-8 w-auto border-0 bg-transparent px-3 text-muted-foreground text-sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{repositories.map((repo) => (
											<SelectItem key={repo.id} value={repo.full_name}>
												<span>{repo.full_name}</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<Select>
									<SelectTrigger className="pointer-events-none h-8 w-auto border-0 bg-transparent px-3 text-muted-foreground text-sm opacity-50">
										<div className="flex items-center gap-2">
											<span>SolomonCodes/main-solver-bot</span>
										</div>
									</SelectTrigger>
								</Select>
							)}
						</div>

						{/* Branch Selector */}
						<div className="flex items-center gap-2">
							<Select value={selectedBranch} onValueChange={setSelectedBranch}>
								<SelectTrigger
									className={`h-8 w-auto border-0 bg-transparent px-3 text-muted-foreground text-sm ${
										!isAuthenticated || !currentRepository || loadingBranches
											? "pointer-events-none opacity-50"
											: ""
									}`}
								>
									<div className="flex items-center gap-2">
										<GitBranch className="h-4 w-4" />
										<span>
											{loadingBranches ? "Loading..." : selectedBranch}
										</span>
									</div>
								</SelectTrigger>
								<SelectContent>
									{branches.map((branch) => (
										<SelectItem key={branch.name} value={branch.name}>
											<div className="flex items-center gap-2">
												<GitBranch className="h-4 w-4" />
												<span>{branch.name}</span>
												{branch.isDefault && (
													<span className="rounded bg-blue-100 px-1 text-blue-700 text-xs">
														default
													</span>
												)}
											</div>
										</SelectItem>
									))}
									{branches.length === 0 && !loadingBranches && (
										<SelectItem
											value="main"
											className="pointer-events-none opacity-50"
										>
											<div className="flex items-center gap-2">
												<GitBranch className="h-4 w-4" />
												<span>No branches found</span>
											</div>
										</SelectItem>
									)}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{/* Tasks Section */}
				<div className="w-full max-w-4xl">
					{/* Tabs */}
					<div className="mb-8 flex items-center justify-center gap-8">
						<button
							type="button"
							onClick={() => setActiveTab("tasks")}
							className={cn(
								"flex items-center gap-2 border-b-2 pb-3 font-medium text-lg transition-colors",
								activeTab === "tasks"
									? "border-foreground text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
						>
							<CheckSquare className="h-5 w-5" />
							Tasks
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("archive")}
							className={cn(
								"flex items-center gap-2 border-b-2 pb-3 font-medium text-lg transition-colors",
								activeTab === "archive"
									? "border-foreground text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
						>
							<Archive className="h-5 w-5" />
							Archive
						</button>
					</div>

					{/* Tasks Content */}
					{activeTab === "tasks" && (
						<div className="space-y-8">
							{isLoading ? (
								<div className="flex items-center justify-center py-12">
									<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
									<span className="ml-2 text-muted-foreground">
										Loading tasks...
									</span>
								</div>
							) : error ? (
								<div className="py-12 text-center">
									<p className="mb-4 text-destructive">{error}</p>
									<Button onClick={refreshTasks} variant="outline">
										<RefreshCw className="mr-2 h-4 w-4" />
										Retry
									</Button>
								</div>
							) : !isAuthenticated ? (
								<div className="py-12 text-center">
									<p className="mb-4 text-muted-foreground">
										Connect your GitHub account to see real repository tasks
									</p>
									<Button
										onClick={async () => {
											try {
												const response = await fetch("/api/auth/github/url");
												const data = await response.json();
												if (data.url) {
													// Open in popup instead of redirect
													const popup = window.open(
														data.url,
														"github-auth",
														`width=600,height=700,left=${window.screen.width / 2 - 300},top=${window.screen.height / 2 - 350}`,
													);

													// Listen for auth success message
													const handleMessage = (event: MessageEvent) => {
														if (event.data.type === "GITHUB_AUTH_SUCCESS") {
															window.removeEventListener(
																"message",
																handleMessage,
															);
															popup?.close();
															// Refresh auth status using TanStack Query
															authRefreshMutation.mutate();
														}
													};

													window.addEventListener("message", handleMessage);

													// Clean up if popup is closed manually
													const checkClosed = setInterval(() => {
														if (popup?.closed) {
															clearInterval(checkClosed);
															window.removeEventListener(
																"message",
																handleMessage,
															);
														}
													}, 1000);
												}
											} catch (error) {
												console.error("Failed to get GitHub auth URL:", error);
											}
										}}
										variant="outline"
										disabled={authRefreshMutation.isPending}
									>
										{authRefreshMutation.isPending
											? "Connecting..."
											: "Connect GitHub"}
									</Button>
								</div>
							) : tasks.length === 0 ? (
								<p className="py-12 text-center text-lg text-muted-foreground">
									No active tasks yet.
								</p>
							) : (
								<>
									{/* Recent Tasks */}
									{recentTasks.length > 0 && (
										<div>
											<div className="mb-6 flex items-center justify-between">
												<h3 className="font-medium text-foreground text-lg">
													Recent
												</h3>
												<Button
													onClick={refreshTasks}
													variant="ghost"
													size="sm"
												>
													<RefreshCw className="h-4 w-4" />
												</Button>
											</div>
											<div className="space-y-4">
												{recentTasks.map((task) => (
													<TaskItem key={task.id} task={task} />
												))}
											</div>
										</div>
									)}

									{/* Older Tasks */}
									{olderTasks.length > 0 && (
										<div>
											<h3 className="mb-6 font-medium text-foreground text-lg">
												Older
											</h3>
											<div className="space-y-4">
												{olderTasks.map((task) => (
													<TaskItem key={task.id} task={task} />
												))}
											</div>
										</div>
									)}
								</>
							)}
						</div>
					)}

					{activeTab === "archive" && (
						<div>
							<p className="py-12 text-center text-lg text-muted-foreground">
								No archived tasks yet.
							</p>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}

function TaskItem({ task }: { task: RepositoryTask }) {
	const getStatusBadge = () => {
		switch (task.status) {
			case "completed":
				return (
					<span className="rounded border border-green-500/20 bg-green-500/10 px-2 py-1 font-medium text-green-500 text-xs">
						Merged
					</span>
				);
			case "failed":
				return (
					<span className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 font-medium text-red-500 text-xs">
						Closed
					</span>
				);
			case "running":
				return (
					<span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 font-medium text-blue-500 text-xs">
						Open
					</span>
				);
			default:
				return (
					<span className="rounded border border-gray-500/20 bg-gray-500/10 px-2 py-1 font-medium text-gray-500 text-xs">
						Draft
					</span>
				);
		}
	};

	const TaskContent = () => (
		<div className="w-full">
			<div className="mb-3 flex items-start justify-between">
				<p className="flex-1 pr-4 font-medium text-base text-foreground leading-relaxed">
					{task.title}
				</p>
				<div className="flex flex-shrink-0 items-center gap-3">
					{getStatusBadge()}
					{(task.addedLines || task.removedLines) && (
						<div className="flex items-center gap-1 font-medium text-sm">
							{task.addedLines && (
								<span className="text-green-600">+{task.addedLines}</span>
							)}
							{task.removedLines && (
								<span className="text-red-600">-{task.removedLines}</span>
							)}
						</div>
					)}
				</div>
			</div>
			<div className="flex items-center gap-3 text-muted-foreground text-sm">
				<span>{task.timeAgo}</span>
				<span>•</span>
				<span>{task.repository}</span>
				{task.commitSha && (
					<>
						<span>•</span>
						<span className="font-mono text-xs">
							{task.commitSha.substring(0, 7)}
						</span>
					</>
				)}
			</div>
		</div>
	);

	if (task.url) {
		return (
			<a
				href={task.url}
				target="_blank"
				rel="noopener noreferrer"
				className="group block cursor-pointer rounded-lg border border-border bg-card p-4 transition-all hover:border-muted-foreground hover:shadow-sm"
			>
				<TaskContent />
			</a>
		);
	}

	return (
		<div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-muted-foreground hover:shadow-sm">
			<TaskContent />
		</div>
	);
}
