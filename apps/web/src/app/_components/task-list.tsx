"use client";
import type { UseMutationResult } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Archive, Check, Dot, Loader, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { useArchiveTask, useDeleteTask, useTasks } from "@/hooks/use-tasks";
import type { Task } from "@/stores/tasks";

interface TaskItemProps {
	task: Task;
	archiveTaskMutation: UseMutationResult<Task, Error, string, unknown>;
	deleteTaskMutation: UseMutationResult<string, Error, string, unknown>;
	isArchived?: boolean;
}

function TaskItem({
	task,
	archiveTaskMutation,
	deleteTaskMutation,
	isArchived = false,
}: TaskItemProps) {
	if (isArchived) {
		return (
			<div className="flex items-center justify-between rounded-lg border bg-background p-4">
				<div>
					<h3 className="font-medium text-muted-foreground">{task.title}</h3>
					<p className="text-muted-foreground text-sm">
						Status: {task.status} • Branch: {task.branch}
					</p>
				</div>
				<Button
					variant="outline"
					size="icon"
					onClick={(e) => {
						e.stopPropagation();
						deleteTaskMutation.mutate(task.id);
					}}
					disabled={deleteTaskMutation.isPending}
				>
					{deleteTaskMutation.isPending ? (
						<Loader className="h-4 w-4 animate-spin" />
					) : (
						<Trash2 />
					)}
				</Button>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-between rounded-lg border bg-background p-4 hover:bg-sidebar">
			<Link href={`/task/${task.id}`} className="flex-1">
				<TaskContent task={task} />
			</Link>
			{task.status === "DONE" && (
				<ArchiveButton
					taskId={task.id}
					archiveTaskMutation={archiveTaskMutation}
				/>
			)}
		</div>
	);
}

function TaskContent({ task }: { task: Task }) {
	return (
		<div>
			<div className="flex items-center gap-x-2">
				{task.hasChanges && <div className="size-2 rounded-full bg-blue-500" />}
				<h3 className="font-medium">{task.title}</h3>
			</div>
			{task.status === "IN_PROGRESS" ? (
				<TaskProgressIndicator statusMessage={task.statusMessage} />
			) : (
				<TaskMetadata task={task} />
			)}
		</div>
	);
}

function TaskProgressIndicator({ statusMessage }: { statusMessage?: string }) {
	return (
		<div>
			<TextShimmer className="text-sm">
				{`${statusMessage || "Working on your task"}...`}
			</TextShimmer>
		</div>
	);
}

function TaskMetadata({ task }: { task: Task }) {
	const timeAgo = task.createdAt
		? formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })
		: "Just now";

	return (
		<div className="flex items-center gap-0">
			<p className="text-muted-foreground text-sm">{timeAgo}</p>
			<Dot className="size-4 text-muted-foreground" />
			<p className="text-muted-foreground text-sm">{task.repository}</p>
		</div>
	);
}

function ArchiveButton({
	taskId,
	archiveTaskMutation,
}: {
	taskId: string;
	archiveTaskMutation: UseMutationResult<Task, Error, string, unknown>;
}) {
	return (
		<Button
			variant="outline"
			size="icon"
			onClick={() => archiveTaskMutation.mutate(taskId)}
			disabled={archiveTaskMutation.isPending}
		>
			{archiveTaskMutation.isPending ? (
				<Loader className="h-4 w-4 animate-spin" />
			) : (
				<Archive />
			)}
		</Button>
	);
}

function TaskListContent({
	tasks,
	isLoading,
	isHydrated,
	emptyMessage,
	archiveTaskMutation,
	deleteTaskMutation,
	isArchived = false,
}: {
	tasks: Task[];
	isLoading: boolean;
	isHydrated: boolean;
	emptyMessage: string;
	archiveTaskMutation: UseMutationResult<Task, Error, string, unknown>;
	deleteTaskMutation: UseMutationResult<string, Error, string, unknown>;
	isArchived?: boolean;
}) {
	if (!isHydrated || isLoading) {
		return (
			<div className="flex items-center gap-2 p-2 text-muted-foreground">
				<Loader className="h-4 w-4 animate-spin" />
				{isArchived ? "Loading archived tasks..." : "Loading tasks..."}
			</div>
		);
	}

	if (tasks.length === 0) {
		return <p className="p-2 text-muted-foreground">{emptyMessage}</p>;
	}

	return (
		<>
			{tasks.map((task) => (
				<TaskItem
					key={task.id}
					task={task}
					archiveTaskMutation={archiveTaskMutation}
					deleteTaskMutation={deleteTaskMutation}
					isArchived={isArchived}
				/>
			))}
		</>
	);
}

export default function TaskList() {
	const [isHydrated, setIsHydrated] = useState(false);
	const { data: activeTasks = [], isLoading: activeLoading } = useTasks({
		archived: false,
	});
	const { data: archivedTasks = [], isLoading: archivedLoading } = useTasks({
		archived: true,
	});
	const archiveTaskMutation = useArchiveTask();
	const deleteTaskMutation = useDeleteTask();

	useEffect(() => {
		setIsHydrated(true);
	}, []);

	return (
		<div className="mx-auto w-full max-w-3xl rounded-lg bg-muted p-1">
			<Tabs defaultValue="active">
				<TabsList>
					<TabsTrigger value="active">
						<Check />
						Tasks
					</TabsTrigger>
					<TabsTrigger value="archived">
						<Archive />
						Archive
					</TabsTrigger>
				</TabsList>
				<TabsContent value="active">
					<div className="flex flex-col gap-1">
						<TaskListContent
							tasks={activeTasks}
							isLoading={activeLoading}
							isHydrated={isHydrated}
							emptyMessage="No active tasks yet."
							archiveTaskMutation={archiveTaskMutation}
							deleteTaskMutation={deleteTaskMutation}
						/>
					</div>
				</TabsContent>
				<TabsContent value="archived">
					<div className="flex flex-col gap-1">
						<TaskListContent
							tasks={archivedTasks}
							isLoading={archivedLoading}
							isHydrated={isHydrated}
							emptyMessage="No archived tasks yet."
							archiveTaskMutation={archiveTaskMutation}
							deleteTaskMutation={deleteTaskMutation}
							isArchived={true}
						/>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
