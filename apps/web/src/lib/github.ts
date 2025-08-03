export interface GitHubBranch {
	name: string;
	commit: {
		sha: string;
		url: string;
	};
	protected: boolean;
	isDefault: boolean;
}

export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	private: boolean;
	description?: string;
	html_url: string;
	default_branch: string;
	fork: boolean;
	permissions?: {
		admin: boolean;
		push: boolean;
		pull: boolean;
	};
}

export interface GitHubUser {
	id: number;
	login: string;
	avatar_url: string;
	name?: string;
	email?: string;
}

export class GitHubAuth {
	private clientId: string | null = null;
	private clientSecret: string | null = null;
	private redirectUri: string | null = null;

	private ensureInitialized() {
		if (this.clientId && this.clientSecret && this.redirectUri) {
			return;
		}

		const clientId = process.env.GITHUB_CLIENT_ID;
		const clientSecret = process.env.GITHUB_CLIENT_SECRET;

		if (!clientId) {
			throw new Error("GITHUB_CLIENT_ID environment variable is required");
		}

		if (!clientSecret) {
			throw new Error("GITHUB_CLIENT_SECRET environment variable is required");
		}

		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.redirectUri =
			process.env.NODE_ENV === "production"
				? "https://clonedx.vercel.app/api/auth/github/callback"
				: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/api/auth/github/callback`;
	}

	// Generate GitHub OAuth URL
	getAuthUrl(state?: string): string {
		this.ensureInitialized();
		const params = new URLSearchParams({
			client_id: this.clientId || "",
			redirect_uri: this.redirectUri || "",
			scope: "repo user:email",
			state: state || Math.random().toString(36).substring(7),
		});

		return `https://github.com/login/oauth/authorize?${params.toString()}`;
	}

	// Exchange code for access token
	async exchangeCodeForToken(code: string): Promise<string> {
		this.ensureInitialized();
		const response = await fetch(
			"https://github.com/login/oauth/access_token",
			{
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					client_id: this.clientId || "",
					client_secret: this.clientSecret || "",
					code,
				}),
			},
		);

		const data = await response.json();

		if (data.error) {
			throw new Error(`GitHub OAuth error: ${data.error_description}`);
		}

		return data.access_token;
	}

	// Get user information
	async getUser(accessToken: string): Promise<GitHubUser> {
		const response = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/vnd.github.v3+json",
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch user: ${response.statusText}`);
		}

		return response.json();
	}

	// Get user repositories
	async getUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
		const response = await fetch(
			"https://api.github.com/user/repos?sort=updated&per_page=100",
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/vnd.github.v3+json",
				},
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch repositories: ${response.statusText}`);
		}

		return response.json();
	}

	// Create a pull request
	async createPullRequest(
		accessToken: string,
		owner: string,
		repo: string,
		title: string,
		body: string,
		head: string,
		base = "main",
	) {
		const response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/pulls`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/vnd.github.v3+json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title,
					body,
					head,
					base,
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to create pull request: ${response.statusText}`);
		}

		return response.json();
	}
}

export const githubAuth = new GitHubAuth();
