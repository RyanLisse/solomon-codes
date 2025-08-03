import { useCallback, useEffect, useState } from "react";
import type { GitHubRepository } from "@/lib/github";
import {
	type RepositoryTask,
	repositoryService,
} from "@/lib/repository-service";

export interface UseRepositoryDataReturn {
	tasks: RepositoryTask[];
	repositories: GitHubRepository[];
	isLoading: boolean;
	error: string | null;
	refreshTasks: () => Promise<void>;
	isAuthenticated: boolean;
	currentRepository: GitHubRepository | null;
	setCurrentRepository: (repo: GitHubRepository | null) => void;
}

export function useRepositoryData(): UseRepositoryDataReturn {
	const [tasks, setTasks] = useState<RepositoryTask[]>([]);
	const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [currentRepository, setCurrentRepository] =
		useState<GitHubRepository | null>(null);

	// Check for stored access token via API
	const getAccessToken = useCallback(async (): Promise<string | null> => {
		if (typeof window === "undefined") return null;

		try {
			const response = await fetch("/api/auth/github/status");
			const data = await response.json();
			return data.isAuthenticated ? data.accessToken : null;
		} catch (error) {
			console.error("Failed to check auth status:", error);
			return null;
		}
	}, []);

	// Load repositories and tasks
	const loadRepositoryData = useCallback(async () => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			setIsAuthenticated(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			// Fetch user repositories
			const repos = await repositoryService.getUserRepositories(accessToken);
			setRepositories(repos);
			setIsAuthenticated(true);

			// Set current repository if not set
			if (!currentRepository && repos.length > 0) {
				setCurrentRepository(repos[0]);
			}

			// Fetch tasks from all repositories or current repository
			let allTasks: RepositoryTask[] = [];
			if (currentRepository) {
				const [owner, repoName] = currentRepository.full_name.split("/");
				allTasks = await repositoryService.getRepositoryTasks(
					accessToken,
					owner,
					repoName,
					20,
				);
			} else {
				allTasks = await repositoryService.getAllRepositoryTasks(
					accessToken,
					repos.slice(0, 5),
					5,
				);
			}

			setTasks(allTasks);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load repository data",
			);
			setIsAuthenticated(false);
		} finally {
			setIsLoading(false);
		}
	}, [currentRepository, getAccessToken]);

	// Refresh tasks
	const refreshTasks = async () => {
		await loadRepositoryData();
	};

	// Load data on mount and when current repository changes
	useEffect(() => {
		loadRepositoryData();
	}, [loadRepositoryData]);

	// Check authentication status on mount
	useEffect(() => {
		const checkAuth = async () => {
			const token = await getAccessToken();
			setIsAuthenticated(!!token);
			if (token) {
				loadRepositoryData();
			}
		};
		checkAuth();
	}, [loadRepositoryData, getAccessToken]);

	return {
		tasks,
		repositories,
		isLoading,
		error,
		refreshTasks,
		isAuthenticated,
		currentRepository,
		setCurrentRepository,
	};
}
