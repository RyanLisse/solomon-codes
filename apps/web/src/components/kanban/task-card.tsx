"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow } from "date-fns";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Code,
	FileText,
	GitBranch,
	Layers,
	MessageSquare,
	MoreHorizontal,
	TestTube,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Task } from "@/stores/tasks";

interface TaskCardProps {
	task: Task;
	isDragOverlay?: boolean;
}

const priorityConfig = {
	low: { color: "bg-gray-100 text-gray-700 border-gray-200", icon: "📊" },
	medium: { color: "bg-blue-100 text-blue-700 border-blue-200", icon: "⚡" },
	high: {
		color: "bg-orange-100 text-orange-700 border-orange-200",
		icon: "🔥",
	},
	urgent: { color: "bg-red-100 text-red-700 border-red-200", icon: "🚨" },
};

const reviewStatusConfig = {
	pending: { color: "bg-yellow-100 text-yellow-700", icon: Clock },
	approved: { color: "bg-green-100 text-green-700", icon: CheckCircle2 },
	rejected: { color: "bg-red-100 text-red-700", icon: AlertCircle },
	needs_changes: { color: "bg-orange-100 text-orange-700", icon: AlertCircle },
};

export function TaskCard({ task, isDragOverlay = false }: TaskCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: task.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const priorityStyle = priorityConfig[task.priority] || priorityConfig.medium;
	const reviewStyle =
		reviewStatusConfig[task.reviewStatus] || reviewStatusConfig.pending;
	const ReviewIcon = reviewStyle.icon;

	const getTaskProgress = () => {
		if (task.versions.length === 0) return null;

		const completedVersions = task.versions.filter(
			(v) => v.status === "completed",
		).length;
		const totalVersions = task.versions.length;

		return { completed: completedVersions, total: totalVersions };
	};

	const progress = getTaskProgress();

	return (
		<Card
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={cn(
				"cursor-grab transition-all duration-200 hover:shadow-md active:cursor-grabbing",
				isDragging && "rotate-5 scale-105 opacity-50",
				isDragOverlay && "rotate-5 scale-105 shadow-lg",
			)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						<h3 className="truncate font-medium text-sm leading-tight">
							{task.title}
						</h3>
						{task.description && (
							<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
								{task.description}
							</p>
						)}
					</div>

					<Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0">
						<MoreHorizontal className="h-3 w-3" />
					</Button>
				</div>

				{/* Labels */}
				{task.labels && task.labels.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1">
						{task.labels.slice(0, 3).map((label) => (
							<Badge
								key={label}
								variant="secondary"
								className="h-5 px-1.5 py-0.5 text-xs"
							>
								{label}
							</Badge>
						))}
						{task.labels.length > 3 && (
							<Badge variant="secondary" className="h-5 px-1.5 py-0.5 text-xs">
								+{task.labels.length - 3}
							</Badge>
						)}
					</div>
				)}
			</CardHeader>

			<CardContent className="space-y-3 pt-0">
				{/* Priority and Review Status */}
				<div className="flex items-center justify-between">
					<Badge
						className={cn("border font-medium text-xs", priorityStyle.color)}
						variant="outline"
					>
						{priorityStyle.icon} {task.priority}
					</Badge>

					<div
						className={cn(
							"flex items-center gap-1 rounded-full px-2 py-1 text-xs",
							reviewStyle.color,
						)}
					>
						<ReviewIcon className="h-3 w-3" />
						<span className="capitalize">
							{task.reviewStatus.replace("_", " ")}
						</span>
					</div>
				</div>

				{/* Progress and Versions */}
				{progress && progress.total > 0 && (
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Layers className="h-3 w-3" />
						<span>
							{progress.completed}/{progress.total} versions
						</span>
						{task.selectedVersionId && (
							<Badge variant="outline" className="h-4 px-1 py-0 text-xs">
								Selected
							</Badge>
						)}
					</div>
				)}

				{/* Stats Row */}
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<div className="flex items-center gap-3">
						{/* Branch */}
						<div className="flex items-center gap-1">
							<GitBranch className="h-3 w-3" />
							<span className="max-w-[80px] truncate">{task.branch}</span>
						</div>

						{/* Mode */}
						<div className="flex items-center gap-1">
							{task.mode === "code" ? (
								<Code className="h-3 w-3" />
							) : (
								<FileText className="h-3 w-3" />
							)}
							<span className="capitalize">{task.mode}</span>
						</div>
					</div>

					{/* Messages count */}
					{task.messages.length > 0 && (
						<div className="flex items-center gap-1">
							<MessageSquare className="h-3 w-3" />
							<span>{task.messages.length}</span>
						</div>
					)}
				</div>

				{/* Test Results */}
				{task.testResults && task.testResults.length > 0 && (
					<div className="flex items-center gap-2 text-xs">
						<TestTube className="h-3 w-3 text-muted-foreground" />
						<div className="flex gap-1">
							<span className="text-green-600">
								{task.testResults.filter((t) => t.status === "passed").length}{" "}
								passed
							</span>
							<span className="text-muted-foreground">•</span>
							<span className="text-red-600">
								{task.testResults.filter((t) => t.status === "failed").length}{" "}
								failed
							</span>
						</div>
					</div>
				)}

				{/* Code Quality Score */}
				{task.codeQualityScore && (
					<div className="flex items-center gap-2 text-xs">
						<div className="flex items-center gap-1">
							<div className="h-2 w-2 rounded-full bg-green-500" />
							<span className="text-muted-foreground">Quality:</span>
							<span className="font-medium">
								{(task.codeQualityScore * 100).toFixed(0)}%
							</span>
						</div>
					</div>
				)}

				{/* Time Tracking */}
				<div className="flex items-center justify-between border-t pt-2 text-muted-foreground text-xs">
					<div className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						<span>
							{formatDistanceToNow(new Date(task.createdAt), {
								addSuffix: true,
							})}
						</span>
					</div>

					{/* Assignee Avatar */}
					<Avatar className="h-5 w-5">
						<AvatarFallback className="bg-muted text-xs">
							{task.mode === "code" ? "AI" : "Q"}
						</AvatarFallback>
					</Avatar>
				</div>

				{/* Pull Request Link */}
				{task.pullRequest && (
					<div className="flex items-center gap-1 text-blue-600 text-xs">
						<GitBranch className="h-3 w-3" />
						<a
							href={task.pullRequest.html_url}
							target="_blank"
							rel="noopener noreferrer"
							className="truncate hover:underline"
						>
							PR #{task.pullRequest.number}
						</a>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
