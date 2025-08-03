"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Types
interface GitHubBranch {
	name: string;
	commit: {
		sha: string;
		url: string;
	};
	protected: boolean;
	isDefault: boolean;
}

interface GitHubAuthStatus {
	isAuthenticated: boolean;
	user: {
		id: number;
		login: string;
		avatar_url: string;
		name?: string;
	} | null;
	accessToken: string | null;
}

// Query Keys
export const GITHUB_KEYS = {
	all: ["github"] as const,
	auth: () => [...GITHUB_KEYS.all, "auth"] as const,
	repos: () => [...GITHUB_KEYS.all, "repos"] as const,
	branches: (owner: string, repo: string) =>
		[...GITHUB_KEYS.all, "branches", owner, repo] as const,
} as const;

// Auth Status Hook
export function useGitHubAuthStatus() {
	return useQuery({
		queryKey: GITHUB_KEYS.auth(),
		queryFn: async (): Promise<GitHubAuthStatus> => {
			const response = await fetch("/api/auth/github/status");
			if (!response.ok) {
				throw new Error("Failed to check auth status");
			}
			return response.json();
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
		gcTime: 1000 * 60 * 10, // 10 minutes
		retry: false, // Don't retry auth checks
	});
}

// Repositories Hook
export function useGitHubRepositories() {
	const { data: authStatus } = useGitHubAuthStatus();

	return useQuery({
		queryKey: GITHUB_KEYS.repos(),
		queryFn: async () => {
			const response = await fetch("/api/auth/github/repositories");
			if (!response.ok) {
				throw new Error("Failed to fetch repositories");
			}
			return response.json();
		},
		enabled: !!authStatus?.isAuthenticated,
		staleTime: 1000 * 60 * 10, // 10 minutes
		gcTime: 1000 * 60 * 30, // 30 minutes
	});
}

// Branches Hook
export function useGitHubBranches(owner: string, repo: string) {
	const { data: authStatus } = useGitHubAuthStatus();

	return useQuery({
		queryKey: GITHUB_KEYS.branches(owner, repo),
		queryFn: async (): Promise<{ branches: GitHubBranch[] }> => {
			const response = await fetch(
				`/api/auth/github/branches?owner=${owner}&repo=${repo}`,
			);
			if (!response.ok) {
				throw new Error("Failed to fetch branches");
			}
			return response.json();
		},
		enabled: !!authStatus?.isAuthenticated && !!owner && !!repo,
		staleTime: 1000 * 60 * 5, // 5 minutes
		gcTime: 1000 * 60 * 15, // 15 minutes
	});
}

// Auth Mutation (for handling OAuth flow completion)
export function useGitHubAuthRefresh() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			// Just trigger a refetch of auth status
			const response = await fetch("/api/auth/github/status");
			if (!response.ok) {
				throw new Error("Failed to refresh auth status");
			}
			return response.json();
		},
		onSuccess: () => {
			// Invalidate all GitHub queries to refetch with new auth state
			queryClient.invalidateQueries({ queryKey: GITHUB_KEYS.all });
		},
	});
}

// Utility hook for auth-dependent operations
export function useGitHubUtils() {
	const queryClient = useQueryClient();

	const invalidateAuth = () => {
		queryClient.invalidateQueries({ queryKey: GITHUB_KEYS.auth() });
	};

	const invalidateRepos = () => {
		queryClient.invalidateQueries({ queryKey: GITHUB_KEYS.repos() });
	};

	const invalidateBranches = (owner: string, repo: string) => {
		queryClient.invalidateQueries({
			queryKey: GITHUB_KEYS.branches(owner, repo),
		});
	};

	return {
		invalidateAuth,
		invalidateRepos,
		invalidateBranches,
	};
}
