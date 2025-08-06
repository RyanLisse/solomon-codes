"use client";

import { Plus, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { useProjectStore } from "@/stores/projects";
import { type Task, type TaskPriority, useTaskStore } from "@/stores/tasks";

interface CreateTaskDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId?: string;
}

const PRIORITY_OPTIONS: {
	value: TaskPriority;
	label: string;
	color: string;
}[] = [
	{ value: "low", label: "Low", color: "bg-gray-100 text-gray-700" },
	{ value: "medium", label: "Medium", color: "bg-blue-100 text-blue-700" },
	{ value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
	{ value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
];

const MODE_OPTIONS = [
	{ value: "code", label: "Code Task", description: "AI will write code" },
	{ value: "ask", label: "Ask Task", description: "AI will provide guidance" },
];

export function CreateTaskDialog({
	open,
	onOpenChange,
	projectId,
}: CreateTaskDialogProps) {
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		priority: "medium" as TaskPriority,
		mode: "code" as "code" | "ask",
		labels: [] as string[],
		estimatedTime: "",
	});

	const [newLabel, setNewLabel] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const { addTask } = useTaskStore();
	const { getProjectById } = useProjectStore();

	const currentProject = projectId ? getProjectById(projectId) : null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!projectId || !currentProject) return;

		setIsSubmitting(true);

		try {
			const task: Omit<
				Task,
				| "id"
				| "createdAt"
				| "updatedAt"
				| "isArchived"
				| "versions"
				| "reviewStatus"
			> = {
				title: formData.title,
				description: formData.description,
				projectId,
				priority: formData.priority,
				mode: formData.mode,
				labels: formData.labels,
				estimatedTime: formData.estimatedTime
					? Number.parseInt(formData.estimatedTime)
					: undefined,
				messages: [],
				status: "IN_PROGRESS",
				branch: `task/${formData.title.toLowerCase().replace(/\s+/g, "-")}`,
				sessionId: crypto.randomUUID(),
				repository: currentProject.repositoryUrl,
				statusMessage: "Task created and ready for execution",
				hasChanges: false,
			};

			addTask(task);

			// Reset form
			setFormData({
				title: "",
				description: "",
				priority: "medium",
				mode: "code",
				labels: [],
				estimatedTime: "",
			});

			onOpenChange(false);
		} catch (error) {
			console.error("Failed to create task:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const addLabel = () => {
		if (newLabel.trim() && !formData.labels.includes(newLabel.trim())) {
			setFormData((prev) => ({
				...prev,
				labels: [...prev.labels, newLabel.trim()],
			}));
			setNewLabel("");
		}
	};

	const removeLabel = (labelToRemove: string) => {
		setFormData((prev) => ({
			...prev,
			labels: prev.labels.filter((label) => label !== labelToRemove),
		}));
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && e.target === e.currentTarget) {
			e.preventDefault();
			addLabel();
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Create New Task</DialogTitle>
					<DialogDescription>
						{currentProject ? (
							<>
								Create a new task for <strong>{currentProject.name}</strong>
							</>
						) : (
							"Create a new task"
						)}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-6">
					{/* Title */}
					<div className="space-y-2">
						<Label htmlFor="title">Title *</Label>
						<Input
							id="title"
							value={formData.title}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, title: e.target.value }))
							}
							placeholder="Describe what needs to be done..."
							required
						/>
					</div>

					{/* Description */}
					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={formData.description}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									description: e.target.value,
								}))
							}
							placeholder="Provide more details about the task..."
							rows={3}
						/>
					</div>

					{/* Mode and Priority Row */}
					<div className="grid grid-cols-2 gap-4">
						{/* Mode */}
						<div className="space-y-2">
							<Label>Task Mode *</Label>
							<Select
								value={formData.mode}
								onValueChange={(value: "code" | "ask") =>
									setFormData((prev) => ({ ...prev, mode: value }))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{MODE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											<div>
												<div className="font-medium">{option.label}</div>
												<div className="text-muted-foreground text-xs">
													{option.description}
												</div>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Priority */}
						<div className="space-y-2">
							<Label>Priority</Label>
							<Select
								value={formData.priority}
								onValueChange={(value: TaskPriority) =>
									setFormData((prev) => ({ ...prev, priority: value }))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PRIORITY_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											<div className="flex items-center gap-2">
												<div
													className={`h-2 w-2 rounded-full ${option.color}`}
												/>
												{option.label}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Labels */}
					<div className="space-y-2">
						<Label>Labels</Label>

						{/* Existing Labels */}
						{formData.labels.length > 0 && (
							<div className="mb-2 flex flex-wrap gap-2">
								{formData.labels.map((label) => (
									<Badge
										key={label}
										variant="secondary"
										className="flex items-center gap-1 px-2 py-1"
									>
										{label}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
											onClick={() => removeLabel(label)}
										>
											<X className="h-2 w-2" />
										</Button>
									</Badge>
								))}
							</div>
						)}

						{/* Add Label Input */}
						<div className="flex gap-2">
							<Input
								value={newLabel}
								onChange={(e) => setNewLabel(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder="Add a label..."
								className="flex-1"
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addLabel}
								disabled={!newLabel.trim()}
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* Estimated Time */}
					<div className="space-y-2">
						<Label htmlFor="estimatedTime">Estimated Time (hours)</Label>
						<Input
							id="estimatedTime"
							type="number"
							value={formData.estimatedTime}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									estimatedTime: e.target.value,
								}))
							}
							placeholder="e.g., 2"
							min="0"
							step="0.5"
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!formData.title.trim() || !projectId || isSubmitting}
						>
							{isSubmitting ? "Creating..." : "Create Task"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
