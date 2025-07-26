"use client";

import { Eye, Globe, Play, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AutomationTask, SessionConfig } from "@/app/actions/stagehand";
import {
	observePageElements,
	runAutomationTask,
} from "@/app/actions/stagehand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface AutomationResult {
	success: boolean;
	data?: any;
	error?: string;
	sessionId?: string;
	logs?: string[];
}

export default function StagehandForm() {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [url, setUrl] = useState("https://example.com");
	const [instructions, setInstructions] = useState("");
	const [mode, setMode] = useState<"action" | "observe">("action");
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<AutomationResult | null>(null);

	// Session configuration
	const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
		headless: true,
		viewport: { width: 1280, height: 720 },
		logger: false,
	});

	// Extract schema for data extraction
	const [extractSchema, setExtractSchema] = useState<string>("");
	const [showAdvanced, setShowAdvanced] = useState(false);

	const adjustHeight = () => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "100px";
			textarea.style.height = `${Math.max(100, textarea.scrollHeight)}px`;
		}
	};

	const handleSubmit = async () => {
		if (!url || !instructions) return;

		setIsLoading(true);
		setResult(null);

		try {
			let parsedSchema;
			if (extractSchema) {
				try {
					parsedSchema = JSON.parse(extractSchema);
				} catch (_error) {
					setResult({
						success: false,
						error: "Invalid JSON schema format",
					});
					setIsLoading(false);
					return;
				}
			}

			if (mode === "action") {
				const task: AutomationTask = {
					url,
					instructions,
					extractSchema: parsedSchema,
				};
				const response = await runAutomationTask(task, sessionConfig);
				setResult(response);
			} else {
				const response = await observePageElements(
					url,
					instructions,
					sessionConfig,
				);
				setResult(response);
			}
		} catch (error) {
			setResult({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		adjustHeight();
	}, [adjustHeight]);

	const isValidUrl = (url: string) => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	};

	return (
		<div className="mx-auto mt-8 flex w-full max-w-4xl flex-col gap-y-6">
			<div className="text-center">
				<h1 className="mb-2 font-bold text-4xl">Browser Automation</h1>
				<p className="text-muted-foreground">
					Automate web interactions with AI-powered browser control
				</p>
			</div>

			<div className="rounded-lg bg-muted p-0.5">
				<div className="flex flex-col gap-y-4 rounded-lg border bg-background p-6">
					{/* URL Input */}
					<div className="space-y-2">
						<Label htmlFor="url">Website URL</Label>
						<div className="relative">
							<Globe className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
							<Input
								id="url"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								placeholder="https://example.com"
								className="pl-10"
								type="url"
							/>
						</div>
						{url && !isValidUrl(url) && (
							<p className="text-destructive text-sm">
								Please enter a valid URL
							</p>
						)}
					</div>

					{/* Mode Selection */}
					<div className="space-y-2">
						<Label>Automation Mode</Label>
						<Select
							value={mode}
							onValueChange={(value: "action" | "observe") => setMode(value)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="action">
									<div className="flex items-center gap-2">
										<Play className="h-4 w-4" />
										Action - Perform interactions
									</div>
								</SelectItem>
								<SelectItem value="observe">
									<div className="flex items-center gap-2">
										<Eye className="h-4 w-4" />
										Observe - Analyze page elements
									</div>
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Instructions */}
					<div className="space-y-2">
						<Label htmlFor="instructions">
							{mode === "action" ? "Instructions" : "What to observe"}
						</Label>
						<textarea
							ref={textareaRef}
							id="instructions"
							value={instructions}
							onChange={(e) => setInstructions(e.target.value)}
							placeholder={
								mode === "action"
									? "Click the login button and fill in the form with test data..."
									: "Find all clickable buttons and their text content..."
							}
							className="min-h-[100px] w-full resize-none overflow-hidden rounded-md border p-3 focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>

					{/* Advanced Settings */}
					<Dialog open={showAdvanced} onOpenChange={setShowAdvanced}>
						<DialogTrigger asChild>
							<Button variant="outline" className="self-start">
								<Settings className="mr-2 h-4 w-4" />
								Advanced Settings
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Advanced Configuration</DialogTitle>
							</DialogHeader>
							<div className="space-y-4">
								{/* Session Config */}
								<div className="space-y-3">
									<h4 className="font-medium">Browser Settings</h4>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="headless"
											checked={sessionConfig.headless}
											onCheckedChange={(checked) =>
												setSessionConfig((prev) => ({
													...prev,
													headless: !!checked,
												}))
											}
										/>
										<Label htmlFor="headless">Headless mode</Label>
									</div>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="logger"
											checked={sessionConfig.logger}
											onCheckedChange={(checked) =>
												setSessionConfig((prev) => ({
													...prev,
													logger: !!checked,
												}))
											}
										/>
										<Label htmlFor="logger">Enable logging</Label>
									</div>
								</div>

								{/* Viewport Size */}
								<div className="space-y-3">
									<h4 className="font-medium">Viewport</h4>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<Label htmlFor="width">Width</Label>
											<Input
												id="width"
												type="number"
												value={sessionConfig.viewport?.width || 1280}
												onChange={(e) =>
													setSessionConfig((prev) => ({
														...prev,
														viewport: {
															...prev.viewport,
															width: Number.parseInt(e.target.value) || 1280,
															height: prev.viewport?.height || 720,
														},
													}))
												}
											/>
										</div>
										<div>
											<Label htmlFor="height">Height</Label>
											<Input
												id="height"
												type="number"
												value={sessionConfig.viewport?.height || 720}
												onChange={(e) =>
													setSessionConfig((prev) => ({
														...prev,
														viewport: {
															...prev.viewport,
															width: prev.viewport?.width || 1280,
															height: Number.parseInt(e.target.value) || 720,
														},
													}))
												}
											/>
										</div>
									</div>
								</div>

								{/* Extract Schema */}
								{mode === "action" && (
									<div className="space-y-2">
										<Label htmlFor="schema">
											Data Extraction Schema (JSON)
										</Label>
										<textarea
											id="schema"
											value={extractSchema}
											onChange={(e) => setExtractSchema(e.target.value)}
											placeholder='{"title": "string", "price": "number"}'
											className="h-24 w-full resize-none rounded-md border p-2 font-mono text-sm"
										/>
									</div>
								)}
							</div>
						</DialogContent>
					</Dialog>

					{/* Submit Button */}
					<Button
						onClick={handleSubmit}
						disabled={!url || !instructions || !isValidUrl(url) || isLoading}
						className="w-full"
					>
						{isLoading ? (
							"Loading..."
						) : (
							<>
								{mode === "action" ? (
									<Play className="mr-2 h-4 w-4" />
								) : (
									<Eye className="mr-2 h-4 w-4" />
								)}
								{mode === "action" ? "Run Automation" : "Observe Page"}
							</>
						)}
					</Button>
				</div>
			</div>

			{/* Results */}
			{result && (
				<div className="rounded-lg bg-muted p-0.5">
					<div className="rounded-lg border bg-background p-6">
						<h3 className="mb-4 font-semibold">
							{result.success ? "✅ Success" : "❌ Error"}
						</h3>

						{result.success ? (
							<div className="space-y-4">
								{result.sessionId && (
									<div>
										<h4 className="mb-2 font-medium">Session ID</h4>
										<code className="block rounded bg-muted p-2 text-sm">
											{result.sessionId}
										</code>
									</div>
								)}

								{result.data && (
									<div>
										<h4 className="mb-2 font-medium">Extracted Data</h4>
										<pre className="block overflow-x-auto rounded bg-muted p-3 text-sm">
											{JSON.stringify(result.data, null, 2)}
										</pre>
									</div>
								)}

								{result.logs && result.logs.length > 0 && (
									<div>
										<h4 className="mb-2 font-medium">Execution Logs</h4>
										<div className="space-y-1">
											{result.logs.map((log, index) => (
												<div
													key={index}
													className="text-muted-foreground text-sm"
												>
													{log}
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="space-y-4">
								<div>
									<h4 className="mb-2 font-medium text-destructive">
										Error Message
									</h4>
									<p className="text-destructive text-sm">{result.error}</p>
								</div>

								{result.logs && result.logs.length > 0 && (
									<div>
										<h4 className="mb-2 font-medium">Debug Logs</h4>
										<div className="space-y-1">
											{result.logs.map((log, index) => (
												<div
													key={index}
													className="text-muted-foreground text-sm"
												>
													{log}
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
