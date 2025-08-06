"use client";
import { HardDrive, Split } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	SandboxSelector,
	useSandboxPreference,
} from "@/components/sandbox-selector";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { useCreateTask } from "@/hooks/use-tasks";
import { useEnvironmentStore } from "@/stores/environments";

export default function TaskForm() {
	const { environments } = useEnvironmentStore();
	const createTask = useCreateTask();
	const { branches, fetchBranches } = useGitHubAuth();
	const { useLocal } = useSandboxPreference();
	const [selectedBranch, setSelectedBranch] = useState<string>(
		branches.find((branch) => branch.isDefault)?.name || "",
	);
	const [selectedEnvironment, setSelectedEnvironment] = useState<string>(
		environments[0]?.id || "",
	);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [value, setValue] = useState("");

	const adjustHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "100px"; // Reset to min height
			textarea.style.height = `${Math.max(100, textarea.scrollHeight)}px`;
		}
	}, []);

	const findRepositoryForEnvironment = useCallback(() => {
		const environment = environments.find(
			(env) => env.id === selectedEnvironment,
		);
		return environment?.githubRepository || "";
	}, [environments, selectedEnvironment]);

	const createTaskObject = useCallback(
		(mode: "code" | "ask") => {
			return {
				title: value,
				hasChanges: false,
				description: "",
				messages: [],
				status: "IN_PROGRESS" as const,
				branch: selectedBranch,
				sessionId: "",
				repository: findRepositoryForEnvironment(),
				mode,
				useLocalSandbox: useLocal,
				// Required properties for Task interface
				projectId: "default", // Default project ID
				labels: [], // Empty labels array
				priority: "medium" as const, // Default priority
				versions: [], // Empty versions array
				reviewStatus: "pending" as const, // Default review status
			};
		},
		[value, selectedBranch, findRepositoryForEnvironment, useLocal],
	);

	const handleAddTask = async (mode: "code" | "ask") => {
		if (!value) return;

		try {
			const task = createTaskObject(mode);
			await createTask.mutateAsync({ task });
			setValue("");
		} catch (error) {
			console.error("Failed to create task:", error);
			// Error handling could be improved with toast notifications
		}
	};

	useEffect(() => {
		adjustHeight();
	}, [adjustHeight]);

	// Set initial environment when environments load
	useEffect(() => {
		if (environments.length > 0 && !selectedEnvironment) {
			setSelectedEnvironment(environments[0].id);
		}
	}, [environments, selectedEnvironment]);

	// Fetch branches when environment changes and set default branch
	useEffect(() => {
		const environment = environments.find(
			(env) => env.id === selectedEnvironment,
		);

		if (environment?.githubRepository) {
			fetchBranches(environment.githubRepository);
		}
	}, [selectedEnvironment, environments, fetchBranches]);

	// Set default branch when branches are loaded
	useEffect(() => {
		const defaultBranch = branches.find((branch) => branch.isDefault);
		if (defaultBranch) {
			setSelectedBranch(defaultBranch.name);
		}
	}, [branches]);

	return (
		<div className="mx-auto mt-14 flex w-full max-w-3xl flex-col gap-y-10">
			<h1 className="text-center font-bold text-4xl">
				Ready to ship something new?
			</h1>
			<div className="rounded-lg bg-muted p-0.5">
				<div className="flex flex-col gap-y-2 rounded-lg border bg-background p-4">
					<textarea
						ref={textareaRef}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						placeholder="Describe a task you want to ship..."
						aria-label="Task description"
						className="min-h-[100px] w-full resize-none overflow-hidden border-none p-0 focus:border-transparent focus:outline-none"
					/>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-x-2">
							<SandboxSelector className="mr-2" />
							{environments.length > 0 ? (
								<Select
									onValueChange={(value) => setSelectedEnvironment(value)}
									value={selectedEnvironment || ""}
								>
									<SelectTrigger>
										<HardDrive />
										<SelectValue placeholder="Choose a repository" />
									</SelectTrigger>
									<SelectContent>
										{environments.map((environment) => (
											<SelectItem key={environment.id} value={environment.id}>
												<div className="flex w-full">
													<span className="max-w-[150px] truncate">
														{environment.githubRepository}
													</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<Link passHref href="/environments">
									<Button className="rounded-lg" variant="outline">
										<HardDrive />
										Create an environment
									</Button>
								</Link>
							)}
							{selectedEnvironment && (
								<Select
									onValueChange={(value) => setSelectedBranch(value)}
									value={selectedBranch}
								>
									<SelectTrigger>
										<Split />
										<SelectValue placeholder="Branch..." />
									</SelectTrigger>
									<SelectContent>
										{branches.map((branch) => (
											<SelectItem key={branch.name} value={branch.name}>
												<div className="flex w-full">
													<span>{branch.name}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
						{value && (
							<div className="flex items-center gap-x-2">
								<Button variant="outline" onClick={() => handleAddTask("ask")}>
									Ask
								</Button>
								<Button onClick={() => handleAddTask("code")}>Code</Button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
