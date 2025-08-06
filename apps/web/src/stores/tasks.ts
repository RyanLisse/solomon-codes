// stores/useTaskStore.ts

// import type { PullRequestResponse } from "@vibe-kit/sdk";
// Temporary stub type while VibeKit is disabled
type PullRequestResponse = {
	url?: string;
	html_url?: string;
	number?: number;
	title?: string;
	state?: string;
};

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TaskStatus = "IN_PROGRESS" | "DONE" | "MERGED";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ReviewStatus =
	| "pending"
	| "approved"
	| "rejected"
	| "needs_changes";

export interface TaskVersion {
	id: string;
	taskId: string;
	worktreeId: string;
	approach: string;
	filesChanged: string[];
	linesAdded: number;
	linesRemoved: number;
	testsPassed: number;
	testsFailed: number;
	codeQualityScore: number;
	executionTime: number;
	createdAt: string;
	status: "generating" | "completed" | "failed" | "selected";
}

export interface TestResult {
	suite: string;
	test: string;
	status: "passed" | "failed" | "skipped";
	duration: number;
	error?: string;
	output?: string;
}

export interface Task {
	id: string;
	title: string;
	description: string;
	messages: {
		role: "user" | "assistant";
		type: string;
		data: Record<string, unknown>;
	}[];
	status: TaskStatus;
	branch: string;
	sessionId: string;
	repository: string;
	createdAt: string;
	updatedAt: string;
	statusMessage?: string;
	isArchived: boolean;
	mode: "code" | "ask";
	hasChanges: boolean;
	pullRequest?: PullRequestResponse;
	useLocalSandbox?: boolean;

	// Enhanced properties
	projectId: string;
	labels: string[];
	priority: TaskPriority;
	estimatedTime?: number;
	actualTime?: number;
	versions: TaskVersion[];
	selectedVersionId?: string;
	worktreeId?: string;
	reviewStatus: ReviewStatus;
	testResults?: TestResult[];
	codeQualityScore?: number;
}

interface TaskStore {
	tasks: Task[];

	// Basic task operations
	addTask: (
		task: Omit<
			Task,
			| "id"
			| "createdAt"
			| "updatedAt"
			| "isArchived"
			| "versions"
			| "reviewStatus"
		>,
	) => Task;
	updateTask: (
		id: string,
		updates: Partial<Omit<Task, "id" | "createdAt">>,
	) => void;
	setTasks: (tasks: Task[]) => void;
	removeTask: (id: string) => void;
	archiveTask: (id: string) => void;
	unarchiveTask: (id: string) => void;
	clear: () => void;

	// Query methods
	getTasks: () => Task[];
	getActiveTasks: () => Task[];
	getArchivedTasks: () => Task[];
	getTaskById: (id: string) => Task | undefined;
	getTasksByStatus: (status: TaskStatus) => Task[];
	getTasksBySessionId: (sessionId: string) => Task[];

	// Enhanced query methods
	getTasksByProject: (projectId: string) => Task[];
	getTasksByLabel: (label: string) => Task[];
	getTasksByPriority: (priority: TaskPriority) => Task[];
	getTasksByReviewStatus: (reviewStatus: ReviewStatus) => Task[];
	filterTasks: (filters: {
		projectId?: string;
		labels?: string[];
		priority?: TaskPriority;
		status?: TaskStatus;
		reviewStatus?: ReviewStatus;
		dateRange?: { start: string; end: string };
	}) => Task[];

	// Version management
	addTaskVersion: (
		taskId: string,
		version: Omit<TaskVersion, "id" | "createdAt">,
	) => TaskVersion;
	updateTaskVersion: (
		taskId: string,
		versionId: string,
		updates: Partial<TaskVersion>,
	) => void;
	selectTaskVersion: (taskId: string, versionId: string) => void;
	getTaskVersions: (taskId: string) => TaskVersion[];
	getSelectedVersion: (taskId: string) => TaskVersion | undefined;

	// Statistics and analytics
	getProjectStats: (projectId: string) => {
		total: number;
		completed: number;
		inProgress: number;
		averageCompletionTime: number;
		successRate: number;
	};
	getTaskMetrics: (taskId: string) => {
		versionsGenerated: number;
		averageQualityScore: number;
		totalExecutionTime: number;
		testSuccessRate: number;
	};
}

export const useTaskStore = create<TaskStore>()(
	persist(
		(set, get) => ({
			tasks: [],

			// Basic task operations
			addTask: (task) => {
				const now = new Date().toISOString();
				const id = crypto.randomUUID();
				const newTask: Task = {
					...task,
					id,
					createdAt: now,
					updatedAt: now,
					isArchived: false,
					versions: [],
					reviewStatus: "pending",
				};
				set((state) => ({
					tasks: [...state.tasks, newTask],
				}));
				return newTask;
			},
			updateTask: (id, updates) => {
				set((state) => ({
					tasks: state.tasks.map((task) =>
						task.id === id
							? { ...task, ...updates, updatedAt: new Date().toISOString() }
							: task,
					),
				}));
			},
			setTasks: (tasks) => set(() => ({ tasks })),
			removeTask: (id) => {
				set((state) => ({
					tasks: state.tasks.filter((task) => task.id !== id),
				}));
			},
			archiveTask: (id) => {
				set((state) => ({
					tasks: state.tasks.map((task) =>
						task.id === id
							? {
									...task,
									isArchived: true,
									updatedAt: new Date().toISOString(),
								}
							: task,
					),
				}));
			},
			unarchiveTask: (id) => {
				set((state) => ({
					tasks: state.tasks.map((task) =>
						task.id === id
							? {
									...task,
									isArchived: false,
									updatedAt: new Date().toISOString(),
								}
							: task,
					),
				}));
			},
			clear: () => set({ tasks: [] }),

			// Query methods
			getTasks: () => get().tasks,
			getActiveTasks: () =>
				get()
					.tasks.filter((task) => !task.isArchived)
					.reverse(),
			getArchivedTasks: () => get().tasks.filter((task) => task.isArchived),
			getTaskById: (id) => get().tasks.find((task) => task.id === id),
			getTasksByStatus: (status) =>
				get().tasks.filter((task) => task.status === status),
			getTasksBySessionId: (sessionId) =>
				get().tasks.filter((task) => task.sessionId === sessionId),

			// Enhanced query methods
			getTasksByProject: (projectId) =>
				get().tasks.filter((task) => task.projectId === projectId),
			getTasksByLabel: (label) =>
				get().tasks.filter((task) => task.labels?.includes(label)),
			getTasksByPriority: (priority) =>
				get().tasks.filter((task) => task.priority === priority),
			getTasksByReviewStatus: (reviewStatus) =>
				get().tasks.filter((task) => task.reviewStatus === reviewStatus),
			filterTasks: (filters) => {
				return get().tasks.filter((task) => {
					if (filters.projectId && task.projectId !== filters.projectId)
						return false;
					if (filters.status && task.status !== filters.status) return false;
					if (filters.priority && task.priority !== filters.priority)
						return false;
					if (
						filters.reviewStatus &&
						task.reviewStatus !== filters.reviewStatus
					)
						return false;
					if (
						filters.labels &&
						!filters.labels.some((label) => task.labels?.includes(label))
					)
						return false;
					if (filters.dateRange) {
						const taskDate = new Date(task.createdAt);
						const startDate = new Date(filters.dateRange.start);
						const endDate = new Date(filters.dateRange.end);
						if (taskDate < startDate || taskDate > endDate) return false;
					}
					return true;
				});
			},

			// Version management
			addTaskVersion: (taskId, version) => {
				const id = crypto.randomUUID();
				const now = new Date().toISOString();
				const newVersion: TaskVersion = {
					...version,
					id,
					createdAt: now,
				};

				set((state) => ({
					tasks: state.tasks.map((task) =>
						task.id === taskId
							? {
									...task,
									versions: [...task.versions, newVersion],
									updatedAt: now,
								}
							: task,
					),
				}));

				return newVersion;
			},

			updateTaskVersion: (taskId, versionId, updates) => {
				set((state) => ({
					tasks: state.tasks.map((task) =>
						task.id === taskId
							? {
									...task,
									versions: task.versions.map((version) =>
										version.id === versionId
											? { ...version, ...updates }
											: version,
									),
									updatedAt: new Date().toISOString(),
								}
							: task,
					),
				}));
			},

			selectTaskVersion: (taskId, versionId) => {
				set((state) => ({
					tasks: state.tasks.map((task) =>
						task.id === taskId
							? {
									...task,
									selectedVersionId: versionId,
									versions: task.versions.map((version) => ({
										...version,
										status:
											version.id === versionId
												? ("selected" as const)
												: version.status,
									})),
									updatedAt: new Date().toISOString(),
								}
							: task,
					),
				}));
			},

			getTaskVersions: (taskId) => {
				const task = get().getTaskById(taskId);
				return task?.versions || [];
			},

			getSelectedVersion: (taskId) => {
				const task = get().getTaskById(taskId);
				return task?.versions.find((v) => v.id === task.selectedVersionId);
			},

			// Statistics and analytics
			getProjectStats: (projectId) => {
				const tasks = get().getTasksByProject(projectId);
				const completed = tasks.filter(
					(t) => t.status === "DONE" || t.status === "MERGED",
				);
				const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");

				const completionTimes = completed
					.filter((t) => t.actualTime)
					.map((t) => t.actualTime as number);

				const averageCompletionTime =
					completionTimes.length > 0
						? completionTimes.reduce((sum, time) => sum + time, 0) /
							completionTimes.length
						: 0;

				return {
					total: tasks.length,
					completed: completed.length,
					inProgress: inProgress.length,
					averageCompletionTime,
					successRate: tasks.length > 0 ? completed.length / tasks.length : 0,
				};
			},

			getTaskMetrics: (taskId) => {
				const task = get().getTaskById(taskId);
				if (!task)
					return {
						versionsGenerated: 0,
						averageQualityScore: 0,
						totalExecutionTime: 0,
						testSuccessRate: 0,
					};

				const versions = task.versions;
				const qualityScores = versions
					.filter((v) => v.codeQualityScore > 0)
					.map((v) => v.codeQualityScore);
				const totalTests = versions.reduce(
					(sum, v) => sum + v.testsPassed + v.testsFailed,
					0,
				);
				const passedTests = versions.reduce((sum, v) => sum + v.testsPassed, 0);

				return {
					versionsGenerated: versions.length,
					averageQualityScore:
						qualityScores.length > 0
							? qualityScores.reduce((sum, score) => sum + score, 0) /
								qualityScores.length
							: 0,
					totalExecutionTime: versions.reduce(
						(sum, v) => sum + v.executionTime,
						0,
					),
					testSuccessRate: totalTests > 0 ? passedTests / totalTests : 0,
				};
			},
		}),
		{
			name: "task-store", // key in localStorage
			// Optionally, customize storage or partialize which fields to persist
			// storage: () => sessionStorage, // for sessionStorage instead
		},
	),
);
