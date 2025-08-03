"use client";

import {
	CheckCircle,
	GitBranch,
	Mic,
	Paperclip,
	Plus,
	RotateCcw,
	XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Task {
	id: string;
	title: string;
	status: "completed" | "failed" | "running";
	timeAgo: string;
	repository: string;
	branch?: string;
	addedLines?: number;
	removedLines?: number;
}

interface TaskListProps {
	className?: string;
}

const mockTasks: Task[] = [
	{
		id: "1",
		title:
			"Ensure 100% Test Pass Rate with Parallel Subagent Execution and Cleanup",
		status: "completed",
		timeAgo: "1 day ago",
		repository: "RyanLisse/mexc-sniper-bot",
	},
	{
		id: "2",
		title: "Ensure 100% Test Pass Rate with Parallel Subagent Execution",
		status: "completed",
		timeAgo: "1 day ago",
		repository: "RyanLisse/mexc-sniper-bot",
		addedLines: 2631,
		removedLines: 2593,
	},
	{
		id: "3",
		title:
			"Ensure 100% Test Pass Rate with Parallel Subagent Execution and Cleanup",
		status: "failed",
		timeAgo: "1 day ago",
		repository: "RyanLisse/vibex-app",
		addedLines: 1074,
		removedLines: 1479,
	},
	{
		id: "4",
		title:
			"Ensure 100% Test Pass Rate with Parallel Subagent Execution and Code Clean...",
		status: "failed",
		timeAgo: "1 day ago",
		repository: "RyanLisse/hog-robotrail-rag",
		addedLines: 15464,
		removedLines: 11421,
	},
	{
		id: "5",
		title: "Verify and Implement Missing Task Management Enhancements",
		status: "failed",
		timeAgo: "1 day ago",
		repository: "RyanLisse/vibex-app",
	},
	{
		id: "6",
		title: "Comprehensive Codebase Analysis and Architecture Refactoring",
		status: "failed",
		timeAgo: "5 day ago",
		repository: "RyanLisse/vibex-app",
	},
	{
		id: "7",
		title: "Comprehensive Codebase Analysis and Architecture Refactoring",
		status: "failed",
		timeAgo: "5 day ago",
		repository: "RyanLisse/vibex-app",
	},
];

const olderTasks: Task[] = [
	{
		id: "8",
		title: "Pull specific commit 3e0ef78f-2a44-4ce5-8927-f56480176e5e",
		status: "completed",
		timeAgo: "5 day ago",
		repository: "RyanLisse/vibex-app",
	},
];

export function TaskList({ className }: TaskListProps) {
	return (
		<div className={cn("flex h-full flex-col", className)}>
			{/* Header with Input */}
			<div className="border-b p-6">
				<div className="relative">
					<Input
						placeholder="Analyze test coverage gaps and implement missing unit tests..."
						className="h-12 w-full pr-32 text-sm"
					/>
					<div className="-translate-y-1/2 absolute top-1/2 right-2 flex items-center gap-2">
						<span className="rounded bg-gray-100 px-2 py-1 text-gray-500 text-xs">
							Opus
						</span>
						<Button size="sm" variant="ghost" className="h-8 w-8 p-0">
							<Plus className="h-4 w-4" />
						</Button>
						<Button size="sm" variant="ghost" className="h-8 w-8 p-0">
							<Paperclip className="h-4 w-4" />
						</Button>
						<Button size="sm" variant="ghost" className="h-8 w-8 p-0">
							<Mic className="h-4 w-4" />
						</Button>
						<Button size="sm" variant="ghost" className="h-8 w-8 p-0">
							<RotateCcw className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Repository Info */}
				<div className="mt-4 flex items-center gap-2 text-gray-600 text-sm">
					<GitBranch className="h-4 w-4" />
					<span>RyanLisse/vibex-app</span>
					<GitBranch className="h-4 w-4" />
					<span>main</span>
				</div>
			</div>

			{/* Task List */}
			<div className="flex-1 overflow-auto">
				<div className="p-6">
					{/* Tasks Header */}
					<div className="mb-6 flex items-center justify-between">
						<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
							Tasks
						</h2>
						<span className="text-gray-500 text-sm">Active</span>
					</div>

					{/* This Week Section */}
					<div className="mb-8">
						<h3 className="mb-4 font-medium text-gray-700 text-sm dark:text-gray-300">
							This Week
						</h3>
						<div className="space-y-3">
							{mockTasks.map((task) => (
								<TaskItem key={task.id} task={task} />
							))}
						</div>
					</div>

					{/* Older Section */}
					<div>
						<h3 className="mb-4 font-medium text-gray-700 text-sm dark:text-gray-300">
							Older
						</h3>
						<div className="space-y-3">
							{olderTasks.map((task) => (
								<TaskItem key={task.id} task={task} />
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function TaskItem({ task }: { task: Task }) {
	const getStatusIcon = () => {
		switch (task.status) {
			case "completed":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "failed":
				return <XCircle className="h-4 w-4 text-red-500" />;
			default:
				return <CheckCircle className="h-4 w-4 text-gray-400" />;
		}
	};

	return (
		<div className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
			<div className="mt-0.5">{getStatusIcon()}</div>
			<div className="min-w-0 flex-1">
				<p className="line-clamp-2 font-medium text-gray-900 text-sm dark:text-gray-100">
					{task.title}
				</p>
				<div className="mt-1 flex items-center gap-2 text-gray-500 text-xs">
					<span>{task.timeAgo}</span>
					<span>•</span>
					<span>{task.repository}</span>
				</div>
			</div>
			{(task.addedLines || task.removedLines) && (
				<div className="flex items-center gap-2 text-xs">
					{task.addedLines && (
						<span className="text-green-600">+{task.addedLines}</span>
					)}
					{task.removedLines && (
						<span className="text-red-600">-{task.removedLines}</span>
					)}
				</div>
			)}
		</div>
	);
}
