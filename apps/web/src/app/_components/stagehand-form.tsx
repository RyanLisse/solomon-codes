"use client";

// React 19 compatibility layer - temporarily disable for working solution
// import "@/types/react-19-compat";

import { Eye, Globe, Play, Settings } from "lucide-react";
// Properly typed components for React 19 compatibility
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	createStagehandSession,
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

type UIComponent<T = Record<string, unknown>> = React.ComponentType<T>;

const TypedLabel = Label as UIComponent<React.ComponentProps<typeof Label>>;
const TypedSelect = Select as UIComponent<React.ComponentProps<typeof Select>>;
const TypedSelectTrigger = SelectTrigger as UIComponent<
	React.ComponentProps<typeof SelectTrigger>
>;
const TypedSelectContent = SelectContent as UIComponent<
	React.ComponentProps<typeof SelectContent>
>;
const TypedSelectItem = SelectItem as UIComponent<
	React.ComponentProps<typeof SelectItem>
>;
const TypedSelectValue = SelectValue as UIComponent<
	React.ComponentProps<typeof SelectValue>
>;
const TypedDialog = Dialog as UIComponent<React.ComponentProps<typeof Dialog>>;
const TypedDialogTrigger = DialogTrigger as UIComponent<
	React.ComponentProps<typeof DialogTrigger>
>;
const TypedDialogContent = DialogContent as UIComponent<
	React.ComponentProps<typeof DialogContent>
>;
const TypedDialogHeader = DialogHeader as UIComponent<
	React.ComponentProps<"div">
>;
const TypedDialogTitle = DialogTitle as UIComponent<
	React.ComponentProps<typeof DialogTitle>
>;
const TypedCheckbox = Checkbox as UIComponent<
	React.ComponentProps<typeof Checkbox>
>;

import type {
	AutomationTask,
	ExtractedData,
	ObservationData,
	SessionConfig,
} from "@/types/stagehand";

interface AutomationResult {
	success: boolean;
	data?: ExtractedData | ObservationData;
	error?: string;
	sessionId?: string;
	logs?: string[];
}

function LogsDisplay({
	logs,
	title = "Logs",
}: {
	logs: string[];
	title?: string;
}) {
	if (!logs || logs.length === 0) {
		return null;
	}

	return (
		<div>
			<h4 className="mb-2 font-medium">{title}</h4>
			<div className="space-y-1">
				{logs.map((log, index) => (
					<div
						key={`log-${index}-${log.slice(0, 20)}`}
						className="text-muted-foreground text-sm"
					>
						{log}
					</div>
				))}
			</div>
		</div>
	);
}

function UrlInput({
	url,
	setUrl,
}: {
	url: string;
	setUrl: (url: string) => void;
}) {
	const isValidUrl = (url: string) => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	};

	return (
		<div className="space-y-2">
			<TypedLabel htmlFor="url">Website URL</TypedLabel>
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
				<p className="text-destructive text-sm">Please enter a valid URL</p>
			)}
		</div>
	);
}

function ModeSelection({
	mode,
	setMode,
}: {
	mode: "action" | "observe";
	setMode: (mode: "action" | "observe") => void;
}) {
	return (
		<div className="space-y-2">
			<TypedLabel>Automation Mode</TypedLabel>
			<TypedSelect
				value={mode}
				onValueChange={(value: string) =>
					setMode(value as "action" | "observe")
				}
			>
				<TypedSelectTrigger>
					<TypedSelectValue />
				</TypedSelectTrigger>
				<TypedSelectContent>
					<TypedSelectItem value="action">
						<div className="flex items-center gap-2">
							<Play className="h-4 w-4" />
							Action - Perform interactions
						</div>
					</TypedSelectItem>
					<TypedSelectItem value="observe">
						<div className="flex items-center gap-2">
							<Eye className="h-4 w-4" />
							Observe - Analyze page elements
						</div>
					</TypedSelectItem>
				</TypedSelectContent>
			</TypedSelect>
		</div>
	);
}

function InstructionsInput({
	instructions,
	setInstructions,
	mode,
	textareaRef,
}: {
	instructions: string;
	setInstructions: (instructions: string) => void;
	mode: "action" | "observe";
	textareaRef: { current: HTMLTextAreaElement | null };
}) {
	return (
		<div className="space-y-2">
			<TypedLabel htmlFor="instructions">
				{mode === "action" ? "Instructions" : "What to observe"}
			</TypedLabel>
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
	);
}

function SubmitButton({
	onSubmit,
	disabled: _disabled,
	mode,
	isLoading,
	url,
	instructions,
}: {
	onSubmit: () => Promise<void>;
	disabled?: boolean;
	mode: "action" | "observe";
	isLoading: boolean;
	url: string;
	instructions: string;
}) {
	const isValidUrl = (url: string) => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	};

	const isButtonDisabled =
		!url || !instructions || !isValidUrl(url) || isLoading;

	return (
		<Button onClick={onSubmit} disabled={isButtonDisabled} className="w-full">
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
	);
}

function ResultsDisplay({ result }: { result: AutomationResult | null }) {
	if (!result) return null;

	return (
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

						<LogsDisplay logs={result.logs || []} title="Execution Logs" />
					</div>
				) : (
					<div className="space-y-4">
						<div>
							<h4 className="mb-2 font-medium text-destructive">
								Error Message
							</h4>
							<p className="text-destructive text-sm">{result.error}</p>
						</div>

						<LogsDisplay logs={result.logs || []} title="Debug Logs" />
					</div>
				)}
			</div>
		</div>
	);
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

	const adjustHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "100px";
			textarea.style.height = `${Math.max(100, textarea.scrollHeight)}px`;
		}
	}, []);

	const parseExtractSchema = (
		schema: string,
	):
		| Record<string, "string" | "number" | "boolean" | "object" | "array">
		| undefined => {
		if (!schema) return undefined;
		try {
			const parsed = JSON.parse(schema) as Record<string, unknown>;
			// Validate the schema structure
			const validSchema: Record<
				string,
				"string" | "number" | "boolean" | "object" | "array"
			> = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (
					typeof value === "string" &&
					["string", "number", "boolean", "object", "array"].includes(value)
				) {
					validSchema[key] = value as
						| "string"
						| "number"
						| "boolean"
						| "object"
						| "array";
				}
			}
			return Object.keys(validSchema).length > 0 ? validSchema : undefined;
		} catch {
			throw new Error("Invalid JSON schema format");
		}
	};

	const createSession = async () => {
		const sessionResult = await createStagehandSession(sessionConfig);
		if (!sessionResult.success) {
			throw new Error(sessionResult.error || "Failed to create session");
		}
		return sessionResult.sessionId;
	};

	const executeAutomation = async (
		sessionId: string,
		parsedSchema:
			| Record<string, "string" | "number" | "boolean" | "object" | "array">
			| undefined,
	) => {
		if (mode === "action") {
			const task: AutomationTask = {
				url,
				instructions,
				extractSchema: parsedSchema,
			};
			return await runAutomationTask(task, sessionId);
		}
		return await observePageElements(url, instructions, sessionId);
	};

	const handleSubmit = async () => {
		if (!url || !instructions) return;

		setIsLoading(true);
		setResult(null);

		try {
			const parsedSchema = parseExtractSchema(extractSchema);
			const sessionId = await createSession();
			const response = await executeAutomation(sessionId, parsedSchema);
			setResult(response);
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
					<UrlInput url={url} setUrl={setUrl} />
					<ModeSelection mode={mode} setMode={setMode} />
					<InstructionsInput
						instructions={instructions}
						setInstructions={setInstructions}
						mode={mode}
						textareaRef={textareaRef}
					/>

					{/* Advanced Settings */}
					<TypedDialog open={showAdvanced} onOpenChange={setShowAdvanced}>
						<TypedDialogTrigger asChild>
							<Button variant="outline" className="self-start">
								<Settings className="mr-2 h-4 w-4" />
								Advanced Settings
							</Button>
						</TypedDialogTrigger>
						<TypedDialogContent>
							<TypedDialogHeader>
								<TypedDialogTitle>Advanced Configuration</TypedDialogTitle>
							</TypedDialogHeader>
							<div className="space-y-4">
								{/* Session Config */}
								<div className="space-y-3">
									<h4 className="font-medium">Browser Settings</h4>
									<div className="flex items-center space-x-2">
										<TypedCheckbox
											id="headless"
											checked={sessionConfig.headless}
											onCheckedChange={(checked: boolean) =>
												setSessionConfig((prev) => ({
													...prev,
													headless: !!checked,
												}))
											}
										/>
										<TypedLabel htmlFor="headless">Headless mode</TypedLabel>
									</div>
									<div className="flex items-center space-x-2">
										<TypedCheckbox
											id="logger"
											checked={sessionConfig.logger}
											onCheckedChange={(checked: boolean) =>
												setSessionConfig((prev) => ({
													...prev,
													logger: !!checked,
												}))
											}
										/>
										<TypedLabel htmlFor="logger">Enable logging</TypedLabel>
									</div>
								</div>

								{/* Viewport Size */}
								<div className="space-y-3">
									<h4 className="font-medium">Viewport</h4>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<TypedLabel htmlFor="width">Width</TypedLabel>
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
											<TypedLabel htmlFor="height">Height</TypedLabel>
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
										<TypedLabel htmlFor="schema">
											Data Extraction Schema (JSON)
										</TypedLabel>
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
						</TypedDialogContent>
					</TypedDialog>

					<SubmitButton
						onSubmit={handleSubmit}
						disabled={false}
						mode={mode}
						isLoading={isLoading}
						url={url}
						instructions={instructions}
					/>
				</div>
			</div>

			<ResultsDisplay result={result} />
		</div>
	);
}
