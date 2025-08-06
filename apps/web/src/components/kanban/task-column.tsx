"use client";

import { useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { MoreVertical, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/stores/tasks";
import { TaskCard } from "./task-card";

interface ColumnConfig {
	id: TaskStatus;
	title: string;
	description: string;
	color: string;
	headerColor: string;
}

interface TaskColumnProps {
	column: ColumnConfig;
	tasks: Task[];
	onAddTask?: () => void;
}

export function TaskColumn({ column, tasks, onAddTask }: TaskColumnProps) {
	const { setNodeRef, isOver } = useDroppable({
		id: column.id,
	});

	const sortableIds = tasks.map((task) => task.id);

	return (
		<div
			className={cn(
				"flex h-full w-80 flex-col rounded-lg border-2 transition-colors",
				column.color,
				isOver && "ring-2 ring-blue-400 ring-opacity-50",
			)}
		>
			{/* Column Header */}
			<div
				className={cn(
					"flex items-center justify-between rounded-t-lg border-b p-4",
					column.headerColor,
				)}
			>
				<div className="flex items-center gap-3">
					<h3 className="font-semibold text-sm">{column.title}</h3>
					<Badge variant="secondary" className="px-2 py-1 text-xs">
						{tasks.length}
					</Badge>
				</div>

				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={onAddTask}
					>
						<Plus className="h-3 w-3" />
					</Button>
					<Button variant="ghost" size="sm" className="h-6 w-6 p-0">
						<MoreVertical className="h-3 w-3" />
					</Button>
				</div>
			</div>

			{/* Column Description */}
			<div className="border-b px-4 py-2">
				<p className="text-muted-foreground text-xs">{column.description}</p>
			</div>

			{/* Tasks Container */}
			<div ref={setNodeRef} className="flex-1 space-y-3 overflow-y-auto p-4">
				<SortableContext
					items={sortableIds}
					strategy={verticalListSortingStrategy}
				>
					{tasks.length === 0 ? (
						<div className="flex h-32 flex-col items-center justify-center text-center">
							<div className="text-muted-foreground text-sm">No tasks yet</div>
							<div className="mt-1 text-muted-foreground text-xs">
								Drop tasks here or click + to add
							</div>
						</div>
					) : (
						tasks.map((task) => <TaskCard key={task.id} task={task} />)
					)}
				</SortableContext>
			</div>

			{/* Column Footer */}
			<div className="rounded-b-lg border-t bg-muted/30 p-3">
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<span>{tasks.length} tasks</span>
					{tasks.length > 0 && (
						<div className="flex items-center gap-2">
							<div className="flex items-center gap-1">
								<div className="h-2 w-2 rounded-full bg-green-500" />
								<span>
									{
										tasks.filter((t) =>
											t.testResults?.every((tr) => tr.status === "passed"),
										).length
									}{" "}
									tested
								</span>
							</div>
							<div className="flex items-center gap-1">
								<div className="h-2 w-2 rounded-full bg-blue-500" />
								<span>
									{tasks.filter((t) => t.reviewStatus === "approved").length}{" "}
									approved
								</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
