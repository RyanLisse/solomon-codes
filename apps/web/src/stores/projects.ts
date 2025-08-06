import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Project {
	id: string;
	name: string;
	description: string;
	repositoryUrl: string;
	repositoryPath: string;
	setupScript?: string;
	devServerScript?: string;
	buildScript?: string;
	testScript?: string;
	environmentVariables: Record<string, string>;
	configFiles: ConfigFile[];
	labels: string[];
	createdAt: string;
	updatedAt: string;
	lastActivity: string;
	taskCount: number;
	completedTaskCount: number;
	status: "active" | "archived" | "error";
}

export interface ConfigFile {
	source: string;
	destination: string;
	template: boolean;
	variables: Record<string, string>;
}

export interface Worktree {
	id: string;
	taskId: string;
	versionId: string;
	projectId: string;
	path: string;
	branch: string;
	status:
		| "creating"
		| "ready"
		| "executing"
		| "completed"
		| "error"
		| "cleanup";
	setupCompleted: boolean;
	dependenciesInstalled: boolean;
	configurationApplied: boolean;
	createdAt: string;
	lastActivity: string;
	diskUsage: number;
}

interface ProjectStore {
	projects: Project[];
	worktrees: Worktree[];
	activeProject: string | null;

	// Project management
	createProject: (
		project: Omit<
			Project,
			"id" | "createdAt" | "updatedAt" | "taskCount" | "completedTaskCount"
		>,
	) => Project;
	updateProject: (id: string, updates: Partial<Project>) => void;
	deleteProject: (id: string) => void;
	setActiveProject: (id: string) => void;
	getProjectById: (id: string) => Project | undefined;
	getActiveProjects: () => Project[];
	getArchivedProjects: () => Project[];

	// Worktree management
	createWorktree: (
		worktree: Omit<Worktree, "id" | "createdAt" | "lastActivity">,
	) => Worktree;
	updateWorktree: (id: string, updates: Partial<Worktree>) => void;
	deleteWorktree: (id: string) => void;
	getWorktreeById: (id: string) => Worktree | undefined;
	getWorktreesByProject: (projectId: string) => Worktree[];
	getWorktreesByTask: (taskId: string) => Worktree[];
	cleanupWorktrees: (projectId?: string) => void;

	// Statistics
	updateProjectStats: (projectId: string) => void;
	getProjectStats: (projectId: string) => {
		taskCount: number;
		completedTaskCount: number;
		activeWorktrees: number;
		diskUsage: number;
	};
}

export const useProjectStore = create<ProjectStore>()(
	persist(
		(set, get) => ({
			projects: [],
			worktrees: [],
			activeProject: null,

			// Project management
			createProject: (project) => {
				const now = new Date().toISOString();
				const id = crypto.randomUUID();
				const newProject: Project = {
					...project,
					id,
					createdAt: now,
					updatedAt: now,
					lastActivity: now,
					taskCount: 0,
					completedTaskCount: 0,
				};

				set((state) => ({
					projects: [...state.projects, newProject],
				}));

				return newProject;
			},

			updateProject: (id, updates) => {
				set((state) => ({
					projects: state.projects.map((project) =>
						project.id === id
							? {
									...project,
									...updates,
									updatedAt: new Date().toISOString(),
									lastActivity: new Date().toISOString(),
								}
							: project,
					),
				}));
			},

			deleteProject: (id) => {
				set((state) => ({
					projects: state.projects.filter((project) => project.id !== id),
					worktrees: state.worktrees.filter(
						(worktree) => worktree.projectId !== id,
					),
					activeProject:
						state.activeProject === id ? null : state.activeProject,
				}));
			},

			setActiveProject: (id) => {
				set({ activeProject: id });
			},

			getProjectById: (id) =>
				get().projects.find((project) => project.id === id),

			getActiveProjects: () =>
				get().projects.filter((project) => project.status === "active"),

			getArchivedProjects: () =>
				get().projects.filter((project) => project.status === "archived"),

			// Worktree management
			createWorktree: (worktree) => {
				const now = new Date().toISOString();
				const id = crypto.randomUUID();
				const newWorktree: Worktree = {
					...worktree,
					id,
					createdAt: now,
					lastActivity: now,
				};

				set((state) => ({
					worktrees: [...state.worktrees, newWorktree],
				}));

				return newWorktree;
			},

			updateWorktree: (id, updates) => {
				set((state) => ({
					worktrees: state.worktrees.map((worktree) =>
						worktree.id === id
							? {
									...worktree,
									...updates,
									lastActivity: new Date().toISOString(),
								}
							: worktree,
					),
				}));
			},

			deleteWorktree: (id) => {
				set((state) => ({
					worktrees: state.worktrees.filter((worktree) => worktree.id !== id),
				}));
			},

			getWorktreeById: (id) =>
				get().worktrees.find((worktree) => worktree.id === id),

			getWorktreesByProject: (projectId) =>
				get().worktrees.filter((worktree) => worktree.projectId === projectId),

			getWorktreesByTask: (taskId) =>
				get().worktrees.filter((worktree) => worktree.taskId === taskId),

			cleanupWorktrees: (projectId) => {
				set((state) => ({
					worktrees: projectId
						? state.worktrees.filter(
								(worktree) =>
									worktree.projectId !== projectId ||
									worktree.status === "executing" ||
									worktree.status === "ready",
							)
						: state.worktrees.filter(
								(worktree) =>
									worktree.status === "executing" ||
									worktree.status === "ready",
							),
				}));
			},

			// Statistics
			updateProjectStats: (projectId) => {
				const project = get().getProjectById(projectId);
				if (!project) return;

				// This would typically fetch from task store
				// For now, we'll just update the last activity
				get().updateProject(projectId, {
					lastActivity: new Date().toISOString(),
				});
			},

			getProjectStats: (projectId) => {
				const project = get().getProjectById(projectId);
				const worktrees = get().getWorktreesByProject(projectId);

				return {
					taskCount: project?.taskCount || 0,
					completedTaskCount: project?.completedTaskCount || 0,
					activeWorktrees: worktrees.filter(
						(w) => w.status === "executing" || w.status === "ready",
					).length,
					diskUsage: worktrees.reduce((total, w) => total + w.diskUsage, 0),
				};
			},
		}),
		{
			name: "project-store",
		},
	),
);
