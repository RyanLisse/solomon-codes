"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { BarChart3, Filter, Plus, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/projects";
import { type Task, type TaskStatus, useTaskStore } from "@/stores/tasks";
import { CreateTaskDialog } from "./create-task-dialog";
import { TaskCard } from "./task-card";
import { TaskColumn } from "./task-column";
import { TaskFilters } from "./task-filters";

interface KanbanBoardProps {
	projectId?: string;
	className?: string;
}

const COLUMN_CONFIG = [
	{
		id: "IN_PROGRESS" as TaskStatus,
		title: "In Progress",
		description: "Currently being worked on",
		color: "bg-blue-50 border-blue-200",
		headerColor: "bg-blue-100",
	},
	{
		id: "DONE" as TaskStatus,
		title: "Done",
		description: "Completed tasks ready for review",
		color: "bg-green-50 border-green-200",
		headerColor: "bg-green-100",
	},
	{
		id: "MERGED" as TaskStatus,
		title: "Merged",
		description: "Successfully integrated",
		color: "bg-purple-50 border-purple-200",
		headerColor: "bg-purple-100",
	},
];

interface KanbanTaskFilters {
	projectId?: string;
	labels?: string[];
	priority?: "low" | "medium" | "high" | "urgent";
	reviewStatus?: "pending" | "approved" | "rejected" | "needs_changes";
	dateRange?: { start: string; end: string };
}

export function KanbanBoard({ projectId, className }: KanbanBoardProps) {
	const [activeTask, setActiveTask] = useState<Task | null>(null);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [filters, setFilters] = useState<KanbanTaskFilters>({});

	const { updateTask, filterTasks } = useTaskStore();
	const { projects, activeProject } = useProjectStore();

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	// Get current project
	const currentProject = useMemo(() => {
		const id = projectId || activeProject;
		return id ? projects.find((p) => p.id === id) : null;
	}, [projectId, activeProject, projects]);

	// Filter and organize tasks
	const filteredTasks = useMemo(() => {
		const baseFilters = {
			...filters,
			projectId: projectId || activeProject || undefined,
		};

		return filterTasks(baseFilters).filter((task) => !task.isArchived);
	}, [filters, projectId, activeProject, filterTasks]);

	const tasksByStatus = useMemo(() => {
		return COLUMN_CONFIG.reduce(
			(acc, column) => {
				acc[column.id] = filteredTasks.filter(
					(task) => task.status === column.id,
				);
				return acc;
			},
			{} as Record<TaskStatus, Task[]>,
		);
	}, [filteredTasks]);

	const handleDragStart = (event: DragStartEvent) => {
		const { active } = event;
		const task = filteredTasks.find((t) => t.id === active.id);
		setActiveTask(task || null);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveTask(null);

		if (!over) return;

		const activeTask = filteredTasks.find((t) => t.id === active.id);
		if (!activeTask) return;

		// Handle column change
		if (over.id !== activeTask.status) {
			updateTask(activeTask.id, {
				status: over.id as TaskStatus,
			});
		}
	};

	const handleDragOver = (_event: DragOverEvent) => {
		// Handle reordering within columns if needed
	};

	const getTaskStats = () => {
		const total = filteredTasks.length;
		const completed = tasksByStatus.DONE.length + tasksByStatus.MERGED.length;
		const inProgress = tasksByStatus.IN_PROGRESS.length;

		return { total, completed, inProgress };
	};

	const stats = getTaskStats();

	if (!currentProject && (projectId || activeProject)) {
		return (
			<div className={cn("flex h-64 items-center justify-center", className)}>
				<div className="text-center">
					<p className="text-muted-foreground">Project not found</p>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("flex h-full flex-col", className)}>
			{/* Header */}
			<div className="flex items-center justify-between border-b p-4">
				<div className="flex items-center gap-4">
					<div>
						<h1 className="font-bold text-2xl">
							{currentProject?.name || "All Tasks"}
						</h1>
						{currentProject?.description && (
							<p className="text-muted-foreground text-sm">
								{currentProject.description}
							</p>
						)}
					</div>

					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						<span>{stats.total} total</span>
						<span>•</span>
						<span>{stats.inProgress} in progress</span>
						<span>•</span>
						<span>{stats.completed} completed</span>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowFilters(!showFilters)}
					>
						<Filter className="mr-2 h-4 w-4" />
						Filters
					</Button>

					<Button variant="outline" size="sm">
						<BarChart3 className="mr-2 h-4 w-4" />
						Analytics
					</Button>

					<Button variant="outline" size="sm">
						<Settings className="mr-2 h-4 w-4" />
						Settings
					</Button>

					<Button
						onClick={() => setShowCreateDialog(true)}
						disabled={!currentProject}
					>
						<Plus className="mr-2 h-4 w-4" />
						New Task
					</Button>
				</div>
			</div>

			{/* Filters */}
			{showFilters && (
				<div className="border-b bg-muted/30 p-4">
					<TaskFilters
						filters={filters}
						onFiltersChange={setFilters}
						projectId={currentProject?.id}
					/>
				</div>
			)}

			{/* Kanban Board */}
			<div className="flex-1 overflow-hidden">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					onDragOver={handleDragOver}
					modifiers={[restrictToVerticalAxis]}
				>
					<div className="flex h-full gap-6 overflow-x-auto p-6">
						{COLUMN_CONFIG.map((column) => (
							<TaskColumn
								key={column.id}
								column={column}
								tasks={tasksByStatus[column.id]}
							/>
						))}
					</div>

					<DragOverlay>
						{activeTask ? <TaskCard task={activeTask} isDragOverlay /> : null}
					</DragOverlay>
				</DndContext>
			</div>

			{/* Create Task Dialog */}
			<CreateTaskDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				projectId={currentProject?.id}
			/>
		</div>
	);
}
