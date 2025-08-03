import { GitHubAuth, type GitHubRepository } from "./github";

export interface RepositoryTask {
	id: string;
	title: string;
	status: "completed" | "failed" | "running";
	timeAgo: string;
	repository: string;
	branch?: string;
	addedLines?: number;
	removedLines?: number;
	commitSha?: string;
	url?: string;
}

export interface GitHubCommit {
	sha: string;
	commit: {
		message: string;
		author: {
			name: string;
			email: string;
			date: string;
		};
	};
	stats?: {
		additions: number;
		deletions: number;
		total: number;
	};
	html_url: string;
}

export class RepositoryService {
	private githubAuth: GitHubAuth;

	constructor() {
		this.githubAuth = new GitHubAuth();
	}

	// Get user repositories
	async getUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
		return this.githubAuth.getUserRepositories(accessToken);
	}

	// Get recent commits from a repository as tasks
	async getRepositoryTasks(
		accessToken: string,
		owner: string,
		repo: string,
		limit = 10,
	): Promise<RepositoryTask[]> {
		try {
			// Fetch recent commits
			const response = await fetch(
				`https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch commits: ${response.statusText}`);
			}

			const commits = await response.json();

			// Convert commits to tasks
			const tasks: RepositoryTask[] = await Promise.all(
				commits.map(async (commit: GitHubCommit, _index: number) => {
					// Get detailed commit info with stats
					const commitDetails = await this.getCommitDetails(
						accessToken,
						owner,
						repo,
						commit.sha,
					);

					return {
						id: commit.sha,
						title: this.truncateMessage(commit.commit.message),
						status: this.inferStatusFromMessage(commit.commit.message),
						timeAgo: this.formatTimeAgo(new Date(commit.commit.author.date)),
						repository: `${owner}/${repo}`,
						commitSha: commit.sha,
						addedLines: commitDetails?.stats?.additions,
						removedLines: commitDetails?.stats?.deletions,
						url: commit.html_url,
					};
				}),
			);

			return tasks;
		} catch (error) {
			console.error("Error fetching repository tasks:", error);
			return [];
		}
	}

	// Get detailed commit information including stats
	private async getCommitDetails(
		accessToken: string,
		owner: string,
		repo: string,
		sha: string,
	): Promise<GitHubCommit | null> {
		try {
			const response = await fetch(
				`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);

			if (!response.ok) {
				return null;
			}

			return response.json();
		} catch (error) {
			console.error("Error fetching commit details:", error);
			return null;
		}
	}

	// Get all tasks from multiple repositories
	async getAllRepositoryTasks(
		accessToken: string,
		repositories: GitHubRepository[],
		limit = 5,
	): Promise<RepositoryTask[]> {
		const allTasks: RepositoryTask[] = [];

		// Fetch tasks from each repository
		for (const repo of repositories.slice(0, 10)) {
			// Limit to first 10 repos
			const [owner, repoName] = repo.full_name.split("/");
			const tasks = await this.getRepositoryTasks(
				accessToken,
				owner,
				repoName,
				limit,
			);
			allTasks.push(...tasks);
		}

		// Sort by date (most recent first)
		return allTasks.sort((a, b) => {
			const timeA = this.parseTimeAgo(a.timeAgo);
			const timeB = this.parseTimeAgo(b.timeAgo);
			return timeA - timeB;
		});
	}

	// Helper function to truncate commit messages
	private truncateMessage(message: string): string {
		const firstLine = message.split("\n")[0];
		return firstLine.length > 80
			? `${firstLine.substring(0, 77)}...`
			: firstLine;
	}

	// Infer task status from commit message
	private inferStatusFromMessage(
		message: string,
	): "completed" | "failed" | "running" {
		const lowerMessage = message.toLowerCase();

		// Check for work in progress first
		if (
			lowerMessage.includes("wip") ||
			lowerMessage.includes("work in progress")
		) {
			return "running";
		}

		// Check for completion keywords that override failure keywords
		const hasCompletionKeywords =
			lowerMessage.includes("fix") ||
			lowerMessage.includes("resolve") ||
			lowerMessage.includes("complete");

		// Check for failure keywords
		const hasFailureKeywords =
			lowerMessage.includes("fail") ||
			lowerMessage.includes("error") ||
			lowerMessage.includes("bug");

		// If both completion and failure keywords are present, prioritize completion
		// unless there are specific failure indicators
		if (hasCompletionKeywords && hasFailureKeywords) {
			// "fix: still failing" should be failed, "fix: resolve bug" should be completed
			if (lowerMessage.includes("still") && lowerMessage.includes("fail")) {
				return "failed";
			}
			return "completed";
		}

		// Only failure keywords
		if (hasFailureKeywords) {
			return "failed";
		}

		// Only completion keywords
		if (hasCompletionKeywords) {
			return "completed";
		}

		// Default to completed for regular commits
		return "completed";
	}

	// Format time ago
	private formatTimeAgo(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const minutes = Math.floor(diff / (1000 * 60));

		if (days > 0) {
			return `${days} day${days > 1 ? "s" : ""} ago`;
		}
		if (hours > 0) {
			return `${hours} hour${hours > 1 ? "s" : ""} ago`;
		}
		return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
	}

	// Parse time ago string back to number for sorting
	private parseTimeAgo(timeAgo: string): number {
		const match = timeAgo.match(/(\d+)\s+(minute|hour|day)/);
		if (!match) return 0;

		const value = Number.parseInt(match[1]);
		const unit = match[2];

		switch (unit) {
			case "minute":
				return value;
			case "hour":
				return value * 60;
			case "day":
				return value * 60 * 24;
			default:
				return 0;
		}
	}
}

export const repositoryService = new RepositoryService();
