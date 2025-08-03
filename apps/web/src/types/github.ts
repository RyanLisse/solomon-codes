/**
 * GitHub integration types
 */

// GitHub API types
export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	description?: string;
	private: boolean;
	html_url: string;
	clone_url: string;
	ssh_url: string;
	default_branch: string;
	language?: string;
	topics: string[];
	stargazers_count: number;
	watchers_count: number;
	forks_count: number;
	open_issues_count: number;
	created_at: string;
	updated_at: string;
	pushed_at: string;
	owner: GitHubUser;
	permissions?: {
		admin: boolean;
		maintain: boolean;
		push: boolean;
		triage: boolean;
		pull: boolean;
	};
}

export interface GitHubUser {
	id: number;
	login: string;
	name?: string;
	email?: string;
	avatar_url: string;
	html_url: string;
	type: "User" | "Organization";
	site_admin: boolean;
}

export interface GitHubBranch {
	name: string;
	commit: {
		sha: string;
		url: string;
	};
	protected: boolean;
	isDefault?: boolean;
}

export interface GitHubCommit {
	sha: string;
	url: string;
	html_url: string;
	author: GitHubUser;
	committer: GitHubUser;
	message: string;
	tree: {
		sha: string;
		url: string;
	};
	parents: Array<{
		sha: string;
		url: string;
	}>;
	stats?: {
		additions: number;
		deletions: number;
		total: number;
	};
	files?: GitHubFileChange[];
}

export interface GitHubFileChange {
	filename: string;
	status:
		| "added"
		| "removed"
		| "modified"
		| "renamed"
		| "copied"
		| "changed"
		| "unchanged";
	additions: number;
	deletions: number;
	changes: number;
	blob_url: string;
	raw_url: string;
	contents_url: string;
	patch?: string;
	previous_filename?: string;
}

export interface GitHubPullRequest {
	id: number;
	number: number;
	title: string;
	body?: string;
	state: "open" | "closed" | "draft";
	user: GitHubUser;
	head: {
		ref: string;
		sha: string;
		repo: GitHubRepository;
	};
	base: {
		ref: string;
		sha: string;
		repo: GitHubRepository;
	};
	merged: boolean;
	mergeable?: boolean;
	mergeable_state: string;
	merged_by?: GitHubUser;
	comments: number;
	review_comments: number;
	commits: number;
	additions: number;
	deletions: number;
	changed_files: number;
	created_at: string;
	updated_at: string;
	closed_at?: string;
	merged_at?: string;
	html_url: string;
	diff_url: string;
	patch_url: string;
}

export interface GitHubIssue {
	id: number;
	number: number;
	title: string;
	body?: string;
	state: "open" | "closed";
	user: GitHubUser;
	assignee?: GitHubUser;
	assignees: GitHubUser[];
	labels: GitHubLabel[];
	milestone?: GitHubMilestone;
	comments: number;
	created_at: string;
	updated_at: string;
	closed_at?: string;
	closed_by?: GitHubUser;
	html_url: string;
	pull_request?: {
		url: string;
		html_url: string;
		diff_url: string;
		patch_url: string;
	};
}

export interface GitHubLabel {
	id: number;
	name: string;
	description?: string;
	color: string;
	default: boolean;
}

export interface GitHubMilestone {
	id: number;
	number: number;
	title: string;
	description?: string;
	state: "open" | "closed";
	creator: GitHubUser;
	open_issues: number;
	closed_issues: number;
	created_at: string;
	updated_at: string;
	closed_at?: string;
	due_on?: string;
	html_url: string;
}

export interface GitHubWorkflow {
	id: number;
	name: string;
	path: string;
	state:
		| "active"
		| "deleted"
		| "disabled_fork"
		| "disabled_inactivity"
		| "disabled_manually";
	created_at: string;
	updated_at: string;
	url: string;
	html_url: string;
	badge_url: string;
}

export interface GitHubWorkflowRun {
	id: number;
	name?: string;
	head_branch: string;
	head_sha: string;
	path: string;
	display_title: string;
	run_number: number;
	event: string;
	status: "queued" | "in_progress" | "completed";
	conclusion?:
		| "success"
		| "failure"
		| "neutral"
		| "cancelled"
		| "skipped"
		| "timed_out"
		| "action_required";
	workflow_id: number;
	check_suite_id: number;
	check_suite_node_id: string;
	url: string;
	html_url: string;
	pull_requests: Array<{
		id: number;
		number: number;
		url: string;
		head: {
			ref: string;
			sha: string;
			repo: {
				id: number;
				name: string;
				url: string;
			};
		};
		base: {
			ref: string;
			sha: string;
			repo: {
				id: number;
				name: string;
				url: string;
			};
		};
	}>;
	created_at: string;
	updated_at: string;
	actor: GitHubUser;
	run_attempt: number;
	referenced_workflows?: GitHubReferencedWorkflow[];
	run_started_at: string;
	triggering_actor: GitHubUser;
	jobs_url: string;
	logs_url: string;
	check_suite_url: string;
	artifacts_url: string;
	cancel_url: string;
	rerun_url: string;
	previous_attempt_url?: string;
	workflow_url: string;
	head_commit: GitHubCommit;
	repository: GitHubRepository;
	head_repository: GitHubRepository;
}

export interface GitHubReferencedWorkflow {
	path: string;
	sha: string;
	ref?: string;
}

// GitHub webhook types
export interface GitHubWebhookPayload {
	action: string;
	number?: number;
	pull_request?: GitHubPullRequest;
	issue?: GitHubIssue;
	repository: GitHubRepository;
	sender: GitHubUser;
	organization?: GitHubOrganization;
}

export interface GitHubOrganization {
	id: number;
	login: string;
	url: string;
	repos_url: string;
	events_url: string;
	hooks_url: string;
	issues_url: string;
	members_url: string;
	public_members_url: string;
	avatar_url: string;
	description?: string;
	gravatar_id?: string;
	name?: string;
	company?: string;
	blog?: string;
	location?: string;
	email?: string;
	twitter_username?: string;
	type: "Organization";
	html_url: string;
}

// Application-specific GitHub types
export interface RepositoryData {
	owner: string;
	repo: string;
	defaultBranch: string;
	branches: GitHubBranch[];
	lastUpdated: string;
}

export interface GitHubAuthConfig {
	clientId: string;
	clientSecret: string;
	scope: string[];
	redirectUri: string;
}

export interface GitHubApiError {
	message: string;
	documentation_url: string;
	status: number;
	errors?: Array<{
		resource: string;
		field: string;
		code: string;
		message?: string;
	}>;
}

export interface GitHubRateLimit {
	limit: number;
	remaining: number;
	reset: number;
	used: number;
	resource: string;
}

// Repository analysis types
export interface RepositoryAnalysis {
	repository: GitHubRepository;
	languages: Record<string, number>;
	contributors: GitHubUser[];
	recentCommits: GitHubCommit[];
	openIssues: GitHubIssue[];
	openPullRequests: GitHubPullRequest[];
	codeQuality?: {
		score: number;
		issues: string[];
		suggestions: string[];
	};
	security?: {
		vulnerabilities: number;
		alerts: string[];
	};
}
