"use client";

import { useCallback, useEffect, useState } from "react";
import type { GitHubBranch, GitHubRepository, GitHubUser } from "@/lib/github";
import { createClientLogger } from "@/lib/logging/client";

const logger = createClientLogger("github-auth-hook");

// Define CookieStore interface if not available
interface CookieStore {
	delete: (name: string) => Promise<void>;
}

// Extend Window interface to include cookieStore
interface WindowWithCookieStore extends Omit<Window, "cookieStore"> {
	cookieStore?: CookieStore;
}

// Helper function to safely delete cookies
const deleteCookie = (name: string): void => {
	// Check if Cookie Store API is available
	if (typeof window !== "undefined" && "cookieStore" in window) {
		// Use Cookie Store API for modern browsers
		const windowWithCookieStore = window as WindowWithCookieStore;
		windowWithCookieStore.cookieStore?.delete(name).catch(() => {
			// Fallback to document.cookie if Cookie Store API fails
			// biome-ignore lint/suspicious/noDocumentCookie: Necessary fallback for browsers without Cookie Store API
			document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
		});
	} else {
		// Fallback to document.cookie for older browsers
		// biome-ignore lint/suspicious/noDocumentCookie: Necessary fallback for older browsers
		document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
	}
};

interface UseGitHubAuthReturn {
	isAuthenticated: boolean;
	user: GitHubUser | null;
	repositories: GitHubRepository[];
	branches: GitHubBranch[];
	isLoading: boolean;
	error: string | null;
	login: () => Promise<void>;
	logout: () => void;
	fetchRepositories: () => Promise<void>;
	fetchBranches: (repositoryName: string) => Promise<void>;
}

export function useGitHubAuth(): UseGitHubAuthReturn {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [user, setUser] = useState<GitHubUser | null>(null);
	const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
	const [branches, setBranches] = useState<GitHubBranch[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [branchesCache, setBranchesCache] = useState<
		Map<string, GitHubBranch[]>
	>(new Map());

	// Check authentication status on mount
	useEffect(() => {
		const abortController = new AbortController();

		const checkAuth = async () => {
			try {
				setIsLoading(true);
				const userCookie = document.cookie
					.split("; ")
					.find((row) => row.startsWith("github_user="));

				if (userCookie) {
					const userData = JSON.parse(
						decodeURIComponent(userCookie.split("=")[1]),
					);

					// Verify the access token is still valid by making a test API call
					const response = await fetch("/api/auth/github/repositories", {
						signal: abortController.signal,
					});

					if (response.ok) {
						setUser(userData);
						setIsAuthenticated(true);
					} else {
						// Token is invalid, clear cookies and auth state
						deleteCookie("github_access_token");
						deleteCookie("github_user");
						setIsAuthenticated(false);
						setUser(null);
					}
				} else {
					setIsAuthenticated(false);
					setUser(null);
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					// Ignore abort errors
					return;
				}
				logger.error("Error checking GitHub auth status", {
					error: error instanceof Error ? error.message : String(error),
				});
				setIsAuthenticated(false);
				setUser(null);
			} finally {
				if (!abortController.signal.aborted) {
					setIsLoading(false);
				}
			}
		};

		checkAuth();

		return () => {
			abortController.abort("Component unmounted");
		};
	}, []);

	// Helper function to handle auth success
	const handleAuthSuccess = useCallback(() => {
		const userCookie = document.cookie
			.split("; ")
			.find((row) => row.startsWith("github_user="));

		if (!userCookie) {
			return;
		}

		try {
			const userData = JSON.parse(decodeURIComponent(userCookie.split("=")[1]));
			setUser(userData);
			setIsAuthenticated(true);
			setIsLoading(false);
		} catch (error) {
			logger.error("Error parsing GitHub user data", {
				error: error instanceof Error ? error.message : String(error),
			});
			setIsAuthenticated(false);
			setUser(null);
			setIsLoading(false);
		}
	}, []);

	// Listen for auth success from popup
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "GITHUB_AUTH_SUCCESS") {
				// Wait a bit for cookies to be set, then check auth status
				setTimeout(handleAuthSuccess, 1000);
			}
		};

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [handleAuthSuccess]);

	const login = async (): Promise<void> => {
		try {
			setIsLoading(true);
			setError(null);

			// Get the auth URL from our API
			const response = await fetch("/api/auth/github/url");
			const { url } = await response.json();

			// Open popup window for OAuth (centered on screen)
			const width = 600;
			const height = 700;
			const left = (window.screen.width - width) / 2;
			const top = (window.screen.height - height) / 2;

			const popup = window.open(
				url,
				"github-oauth",
				`width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
			);

			// Check if popup was blocked
			if (!popup) {
				throw new Error("Popup blocked. Please allow popups for this site.");
			}

			// Wait for popup to close
			const checkClosed = setInterval(() => {
				if (popup.closed) {
					clearInterval(checkClosed);
					setIsLoading(false);
				}
			}, 1000);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "Authentication failed",
			);
			setIsLoading(false);
		}
	};

	const logout = (): void => {
		// Clear cookies
		deleteCookie("github_access_token");
		deleteCookie("github_user");

		setIsAuthenticated(false);
		setUser(null);
		setRepositories([]);
		setBranches([]);
		setBranchesCache(new Map()); // Clear cache on logout
	};

	const fetchRepositories = async (): Promise<void> => {
		if (!isAuthenticated) return;
		logger.debug("Fetching GitHub repositories", { isAuthenticated });

		try {
			setIsLoading(true);
			setError(null);

			const response = await fetch("/api/auth/github/repositories");

			if (!response.ok) {
				throw new Error("Failed to fetch repositories");
			}

			const data = await response.json();
			setRepositories(data.repositories || []);
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				// Ignore abort errors
				return;
			}
			setError(
				error instanceof Error ? error.message : "Failed to fetch repositories",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const fetchBranches = useCallback(
		async (repositoryName: string): Promise<void> => {
			try {
				setError(null);

				// Check cache first
				const cachedBranches = branchesCache.get(repositoryName);
				if (cachedBranches) {
					setBranches(cachedBranches);
					return;
				}

				setIsLoading(true);

				// Parse repository name to extract owner and repo
				// Repository name should be in format "owner/repo"
				const [owner, repo] = repositoryName.split("/");

				if (!owner || !repo) {
					throw new Error('Repository name must be in format "owner/repo"');
				}

				const response = await fetch(
					`/api/auth/github/branches?owner=${encodeURIComponent(
						owner,
					)}&repo=${encodeURIComponent(repo)}`,
				);

				if (!response.ok) {
					throw new Error("Failed to fetch branches");
				}

				const data = await response.json();
				const fetchedBranches = data.branches || [];

				// Update cache and state
				setBranchesCache((prev) =>
					new Map(prev).set(repositoryName, fetchedBranches),
				);
				setBranches(fetchedBranches);
			} catch (error) {
				setError(
					error instanceof Error ? error.message : "Failed to fetch branches",
				);
			} finally {
				setIsLoading(false);
			}
		},
		[branchesCache],
	);

	return {
		isAuthenticated,
		user,
		repositories,
		branches,
		isLoading,
		error,
		login,
		logout,
		fetchRepositories,
		fetchBranches,
	};
}
