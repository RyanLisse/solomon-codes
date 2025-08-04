/**
 * Unit tests for RepositoryService
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubRepository } from "./github";
import { RepositoryService, type RepositoryTask } from "./repository-service";

// Interface to access private methods for testing
interface RepositoryServiceForTesting {
	getUserRepositories(accessToken: string): Promise<GitHubRepository[]>;
	getRepositoryTasks(
		accessToken: string,
		owner: string,
		repo: string,
		limit?: number,
	): Promise<RepositoryTask[]>;
	getAllRepositoryTasks(
		accessToken: string,
		repositories: GitHubRepository[],
		limit?: number,
	): Promise<RepositoryTask[]>;
	truncateMessage(message: string): string;
	inferStatusFromMessage(message: string): "completed" | "failed" | "running";
	formatTimeAgo(date: Date): string;
	parseTimeAgo(timeAgo: string): number;
}

// Mock the GitHubAuth class
vi.mock("./github", () => ({
	GitHubAuth: class MockGitHubAuth {
		async getUserRepositories(_accessToken: string) {
			return [
				{
					id: 1,
					name: "test-repo",
					full_name: "user/test-repo",
					description: "A test repository",
					private: false,
					html_url: "https://github.com/user/test-repo",
				},
			];
		}
	},
}));

describe("RepositoryService", () => {
	let service: RepositoryServiceForTesting;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		service = new RepositoryService() as unknown as RepositoryServiceForTesting;
		mockFetch = vi.fn();
		global.fetch = mockFetch;
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
		mockFetch.mockClear();
	});

	describe("getUserRepositories", () => {
		it("should return user repositories", async () => {
			const accessToken = "test-token";
			const repositories = await service.getUserRepositories(accessToken);

			expect(repositories).toHaveLength(1);
			expect(repositories[0].name).toBe("test-repo");
			expect(repositories[0].full_name).toBe("user/test-repo");
		});
	});

	describe("getRepositoryTasks", () => {
		const setupSuccessfulMocks = () => {
			// Mock commits API response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve([
						{
							sha: "abc123",
							commit: {
								message: "fix: resolve authentication issue",
								author: {
									name: "John Doe",
									email: "john@example.com",
									date: "2024-01-15T10:00:00Z",
								},
							},
							html_url: "https://github.com/user/repo/commit/abc123",
						},
						{
							sha: "def456",
							commit: {
								message: "feat: add new feature\n\nDetailed description here",
								author: {
									name: "Jane Smith",
									email: "jane@example.com",
									date: "2024-01-15T08:00:00Z",
								},
							},
							html_url: "https://github.com/user/repo/commit/def456",
						},
					]),
			});

			// Mock commit details API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							sha: "abc123",
							stats: {
								additions: 10,
								deletions: 5,
								total: 15,
							},
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							sha: "def456",
							stats: {
								additions: 25,
								deletions: 2,
								total: 27,
							},
						}),
				});
		};

		it("should fetch and convert commits to tasks", async () => {
			setupSuccessfulMocks();
			const tasks = await service.getRepositoryTasks(
				"token",
				"user",
				"repo",
				2,
			);

			expect(tasks).toHaveLength(2);

			// Check first task
			expect(tasks[0]).toEqual({
				id: "abc123",
				title: "fix: resolve authentication issue",
				status: "completed", // Should infer "completed" from "fix"
				timeAgo: "2 hours ago",
				repository: "user/repo",
				commitSha: "abc123",
				addedLines: 10,
				removedLines: 5,
				url: "https://github.com/user/repo/commit/abc123",
			});

			// Check second task
			expect(tasks[1]).toEqual({
				id: "def456",
				title: "feat: add new feature", // Should truncate after first line
				status: "completed",
				timeAgo: "4 hours ago",
				repository: "user/repo",
				commitSha: "def456",
				addedLines: 25,
				removedLines: 2,
				url: "https://github.com/user/repo/commit/def456",
			});

			// Verify API calls
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.github.com/repos/user/repo/commits?per_page=2",
				{
					headers: {
						Authorization: "Bearer token",
						Accept: "application/vnd.github.v3+json",
					},
				},
			);
		});

		it("should handle API errors gracefully", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				statusText: "Not Found",
			});

			const tasks = await service.getRepositoryTasks(
				"token",
				"user",
				"nonexistent",
				10,
			);

			expect(tasks).toEqual([]);
		});

		it("should handle fetch errors gracefully", async () => {
			mockFetch.mockClear();
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			const tasks = await service.getRepositoryTasks(
				"token",
				"user",
				"repo",
				10,
			);

			expect(tasks).toEqual([]);
		});

		it("should handle missing commit details gracefully", async () => {
			mockFetch.mockClear();
			// Mock commits API response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve([
						{
							sha: "abc123",
							commit: {
								message: "test commit",
								author: {
									name: "John Doe",
									email: "john@example.com",
									date: "2024-01-15T10:00:00Z",
								},
							},
							html_url: "https://github.com/user/repo/commit/abc123",
						},
					]),
			});

			// Mock commit details API to fail
			mockFetch.mockResolvedValueOnce({
				ok: false,
				statusText: "Not Found",
			});

			const tasks = await service.getRepositoryTasks(
				"token",
				"user",
				"repo",
				1,
			);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].addedLines).toBeUndefined();
			expect(tasks[0].removedLines).toBeUndefined();
		});
	});

	describe("getAllRepositoryTasks", () => {
		const mockRepositories: GitHubRepository[] = [
			{ id: 1, name: "repo1", full_name: "user/repo1" },
			{ id: 2, name: "repo2", full_name: "user/repo2" },
		] as GitHubRepository[];

		beforeEach(() => {
			// Spy on getRepositoryTasks method
			vi.spyOn(service, "getRepositoryTasks").mockImplementation(
				async (_accessToken: string, owner: string, repo: string) => {
					if (repo === "repo1") {
						return [
							{
								id: "commit1",
								title: "Commit 1",
								status: "completed",
								timeAgo: "1 hour ago",
								repository: `${owner}/${repo}`,
							} as RepositoryTask,
						];
					}
					if (repo === "repo2") {
						return [
							{
								id: "commit2",
								title: "Commit 2",
								status: "failed",
								timeAgo: "30 minutes ago",
								repository: `${owner}/${repo}`,
							} as RepositoryTask,
						];
					}
					return [];
				},
			);
		});

		it("should fetch tasks from multiple repositories", async () => {
			const allTasks = await service.getAllRepositoryTasks(
				"token",
				mockRepositories,
				5,
			);

			expect(allTasks).toHaveLength(2);
			expect(service.getRepositoryTasks).toHaveBeenCalledTimes(2);
			expect(service.getRepositoryTasks).toHaveBeenCalledWith(
				"token",
				"user",
				"repo1",
				5,
			);
			expect(service.getRepositoryTasks).toHaveBeenCalledWith(
				"token",
				"user",
				"repo2",
				5,
			);
		});

		it("should sort tasks by time (most recent first)", async () => {
			const allTasks = await service.getAllRepositoryTasks(
				"token",
				mockRepositories,
				5,
			);

			// Should be sorted with most recent first (30 minutes vs 1 hour)
			expect(allTasks[0].timeAgo).toBe("30 minutes ago");
			expect(allTasks[1].timeAgo).toBe("1 hour ago");
		});

		it("should limit to first 10 repositories", async () => {
			const manyRepos: GitHubRepository[] = Array.from(
				{ length: 15 },
				(_, i) => ({
					id: i + 1,
					name: `repo${i + 1}`,
					full_name: `user/repo${i + 1}`,
				}),
			) as GitHubRepository[];

			await service.getAllRepositoryTasks("token", manyRepos, 5);

			// Should only call getRepositoryTasks for first 10 repos
			expect(service.getRepositoryTasks).toHaveBeenCalledTimes(10);
		});
	});

	describe("truncateMessage", () => {
		it("should truncate long commit messages", () => {
			const longMessage = "a".repeat(100);
			const result = service.truncateMessage(longMessage);

			expect(result).toBe(`${"a".repeat(77)}...`);
			expect(result.length).toBe(80);
		});

		it("should not truncate short messages", () => {
			const shortMessage = "Short commit message";
			const result = service.truncateMessage(shortMessage);

			expect(result).toBe(shortMessage);
		});

		it("should only use first line of multiline messages", () => {
			const multilineMessage = "First line\nSecond line\nThird line";
			const result = service.truncateMessage(multilineMessage);

			expect(result).toBe("First line");
		});
	});

	describe("inferStatusFromMessage", () => {
		const testCases = [
			// Completed status
			{ message: "fix: resolve bug", expected: "completed" },
			{ message: "Fix authentication issue", expected: "completed" },
			{ message: "resolve merge conflict", expected: "completed" },
			{ message: "Complete user registration", expected: "completed" },

			// Failed status
			{ message: "fix: still failing tests", expected: "failed" },
			{ message: "Error in deployment", expected: "failed" },
			{ message: "Bug in payment system", expected: "failed" },

			// Running status
			{ message: "WIP: user authentication", expected: "running" },
			{ message: "work in progress on API", expected: "running" },

			// Default status
			{ message: "Add new feature", expected: "completed" },
			{ message: "Update documentation", expected: "completed" },
		];

		testCases.forEach(({ message, expected }) => {
			it(`should infer "${expected}" status from message: "${message}"`, () => {
				const result = service.inferStatusFromMessage(message);
				expect(result).toBe(expected);
			});
		});
	});

	describe("formatTimeAgo", () => {
		it("should format minutes ago", () => {
			const date = new Date("2024-01-15T11:45:00Z"); // 15 minutes ago
			const result = service.formatTimeAgo(date);
			expect(result).toBe("15 minutes ago");
		});

		it("should format single minute ago", () => {
			const date = new Date("2024-01-15T11:59:00Z"); // 1 minute ago
			const result = service.formatTimeAgo(date);
			expect(result).toBe("1 minute ago");
		});

		it("should format hours ago", () => {
			const date = new Date("2024-01-15T09:00:00Z"); // 3 hours ago
			const result = service.formatTimeAgo(date);
			expect(result).toBe("3 hours ago");
		});

		it("should format single hour ago", () => {
			const date = new Date("2024-01-15T11:00:00Z"); // 1 hour ago
			const result = service.formatTimeAgo(date);
			expect(result).toBe("1 hour ago");
		});

		it("should format days ago", () => {
			const date = new Date("2024-01-13T12:00:00Z"); // 2 days ago
			const result = service.formatTimeAgo(date);
			expect(result).toBe("2 days ago");
		});

		it("should format single day ago", () => {
			const date = new Date("2024-01-14T12:00:00Z"); // 1 day ago
			const result = service.formatTimeAgo(date);
			expect(result).toBe("1 day ago");
		});
	});

	describe("parseTimeAgo", () => {
		it("should parse minutes correctly", () => {
			const result = service.parseTimeAgo("15 minutes ago");
			expect(result).toBe(15);
		});

		it("should parse hours correctly", () => {
			const result = service.parseTimeAgo("3 hours ago");
			expect(result).toBe(180); // 3 * 60
		});

		it("should parse days correctly", () => {
			const result = service.parseTimeAgo("2 days ago");
			expect(result).toBe(2880); // 2 * 60 * 24
		});

		it("should handle invalid format", () => {
			const result = service.parseTimeAgo("invalid format");
			expect(result).toBe(0);
		});

		it("should handle unknown units", () => {
			const result = service.parseTimeAgo("5 weeks ago");
			expect(result).toBe(0);
		});
	});
});
