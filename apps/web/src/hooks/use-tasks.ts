"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
	createPullRequestAction,
	createTaskAction,
} from "@/app/actions/inngest";
import type { Task } from "@/stores/tasks";

// Query Keys
export const TASK_KEYS = {
	all: ["tasks"] as const,
	lists: () => [...TASK_KEYS.all, "list"] as const,
	list: (filters: Record<string, unknown>) =>
		[...TASK_KEYS.lists(), { filters }] as const,
	details: () => [...TASK_KEYS.all, "detail"] as const,
	detail: (id: string) => [...TASK_KEYS.details(), id] as const,
} as const;

// Types for API operations
interface CreateTaskParams {
	task: Omit<Task, "id" | "createdAt" | "updatedAt" | "isArchived">;
	sessionId?: string;
	prompt?: string;
}

interface UpdateTaskParams {
	id: string;
	updates: Partial<Omit<Task, "id" | "createdAt">>;
}

interface TaskFilters {
	status?: Task["status"];
	archived?: boolean;
	sessionId?: string;
	[key: string]: unknown;
}

// Local storage functions (transitional)
const getTasksFromStorage = (): Task[] => {
	if (typeof window === "undefined") return [];
	try {
		const stored = localStorage.getItem("task-store");
		if (!stored) return [];
		const parsed = JSON.parse(stored);
		return parsed.state?.tasks || [];
	} catch {
		return [];
	}
};

const saveTasksToStorage = (tasks: Task[]): void => {
	if (typeof window === "undefined") return;
	try {
		const stored = localStorage.getItem("task-store");
		const parsed = stored
			? JSON.parse(stored)
			: { state: { tasks: [] }, version: 0 };
		parsed.state.tasks = tasks;
		localStorage.setItem("task-store", JSON.stringify(parsed));
	} catch (error) {
		console.error("Failed to save tasks to storage:", error);
	}
};

// Custom hooks
export function useTasks(filters: TaskFilters = {}) {
	return useQuery({
		queryKey: TASK_KEYS.list(filters),
		queryFn: () => {
			const allTasks = getTasksFromStorage();

			return allTasks.filter((task) => {
				if (filters.status && task.status !== filters.status) return false;
				if (
					filters.archived !== undefined &&
					task.isArchived !== filters.archived
				)
					return false;
				if (filters.sessionId && task.sessionId !== filters.sessionId)
					return false;
				return true;
			});
		},
		staleTime: 1000 * 60, // 1 minute
		gcTime: 1000 * 60 * 5, // 5 minutes
	});
}

export function useTask(id: string) {
	return useQuery({
		queryKey: TASK_KEYS.detail(id),
		queryFn: () => {
			const tasks = getTasksFromStorage();
			return tasks.find((task) => task.id === id) || null;
		},
		enabled: !!id,
		staleTime: 1000 * 30, // 30 seconds for individual tasks
	});
}

export function useCreateTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ task, sessionId, prompt }: CreateTaskParams) => {
			// Generate task with ID and timestamps
			const now = new Date().toISOString();
			const id = crypto.randomUUID();
			const newTask: Task = {
				...task,
				id,
				createdAt: now,
				updatedAt: now,
				isArchived: false,
			};

			// Optimistically update local storage
			const currentTasks = getTasksFromStorage();
			const updatedTasks = [...currentTasks, newTask];
			saveTasksToStorage(updatedTasks);

			// Send to server
			await createTaskAction({ task: newTask, sessionId, prompt });

			return newTask;
		},
		onSuccess: (newTask) => {
			// Invalidate and refetch task lists
			queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });

			// Optimistically add to all relevant queries
			queryClient.setQueryData(TASK_KEYS.detail(newTask.id), newTask);
		},
		onError: (_error, variables) => {
			// Rollback optimistic update
			const currentTasks = getTasksFromStorage();
			const rollbackTasks = currentTasks.filter(
				(task) => !(task.title === variables.task.title && task.createdAt),
			);
			saveTasksToStorage(rollbackTasks);

			// Invalidate queries to refetch from storage
			queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
		},
	});
}

export function useUpdateTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ id, updates }: UpdateTaskParams) => {
			const currentTasks = getTasksFromStorage();
			const taskIndex = currentTasks.findIndex((task) => task.id === id);

			if (taskIndex === -1) {
				throw new Error(`Task with id ${id} not found`);
			}

			const updatedTask = {
				...currentTasks[taskIndex],
				...updates,
				updatedAt: new Date().toISOString(),
			};

			const updatedTasks = [...currentTasks];
			updatedTasks[taskIndex] = updatedTask;

			saveTasksToStorage(updatedTasks);
			return updatedTask;
		},
		onSuccess: (updatedTask) => {
			// Update specific task query
			queryClient.setQueryData(TASK_KEYS.detail(updatedTask.id), updatedTask);

			// Invalidate list queries to trigger refetch
			queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
		},
	});
}

export function useDeleteTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const currentTasks = getTasksFromStorage();
			const filteredTasks = currentTasks.filter((task) => task.id !== id);
			saveTasksToStorage(filteredTasks);
			return id;
		},
		onSuccess: (deletedId) => {
			// Remove from specific task query
			queryClient.removeQueries({ queryKey: TASK_KEYS.detail(deletedId) });

			// Invalidate list queries
			queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
		},
	});
}

export function useArchiveTask() {
	const updateTask = useUpdateTask();

	return useMutation({
		mutationFn: async (id: string) => {
			return updateTask.mutateAsync({
				id,
				updates: { isArchived: true },
			});
		},
	});
}

export function useUnarchiveTask() {
	const updateTask = useUpdateTask();

	return useMutation({
		mutationFn: async (id: string) => {
			return updateTask.mutateAsync({
				id,
				updates: { isArchived: false },
			});
		},
	});
}

export function useCreatePullRequest() {
	return useMutation({
		mutationFn: async (sessionId: string) => {
			await createPullRequestAction({ sessionId });
		},
	});
}

// Utility hook for manual cache updates (useful for real-time updates)
export function useTaskCacheUpdater() {
	const queryClient = useQueryClient();

	const updateTaskInCache = useCallback(
		(taskId: string, updates: Partial<Task>) => {
			// Update specific task
			queryClient.setQueryData(
				TASK_KEYS.detail(taskId),
				(oldData: Task | null) => {
					if (!oldData) return oldData;
					return {
						...oldData,
						...updates,
						updatedAt: new Date().toISOString(),
					};
				},
			);

			// Invalidate list queries to refetch
			queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
		},
		[queryClient],
	);

	const addTaskToCache = useCallback(
		(task: Task) => {
			// Add to specific task query
			queryClient.setQueryData(TASK_KEYS.detail(task.id), task);

			// Invalidate list queries
			queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
		},
		[queryClient],
	);

	const invalidateAllTasks = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
	}, [queryClient]);

	return {
		updateTaskInCache,
		addTaskToCache,
		invalidateAllTasks,
	};
}
