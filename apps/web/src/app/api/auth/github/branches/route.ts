import { type NextRequest, NextResponse } from "next/server";

class HttpError extends Error {
	constructor(
		message: string,
		public status: number,
		public response: Record<string, unknown>,
	) {
		super(message);
		this.name = "HttpError";
	}
}

interface GitHubBranch {
	name: string;
	commit: {
		sha: string;
		url: string;
	};
	protected: boolean;
}

function validateAuthentication(request: NextRequest) {
	const accessToken = request.cookies.get("github_access_token")?.value;
	if (!accessToken) {
		throw new HttpError("Not authenticated", 401, {
			error: "Not authenticated",
		});
	}
	return accessToken;
}

function validateRepositoryParams(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const owner = searchParams.get("owner");
	const repo = searchParams.get("repo");

	if (!owner || !repo) {
		throw new HttpError("Owner and repo parameters are required", 400, {
			error: "Owner and repo parameters are required",
		});
	}

	return { owner, repo };
}

async function fetchRepositoryInfo(
	owner: string,
	repo: string,
	accessToken: string,
) {
	const repoResponse = await fetch(
		`https://api.github.com/repos/${owner}/${repo}`,
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/vnd.github.v3+json",
			},
		},
	);

	if (!repoResponse.ok) {
		if (repoResponse.status === 404) {
			throw new HttpError("Repository not found", 404, {
				error: "Repository not found",
			});
		}
		throw new Error(`Failed to fetch repository: ${repoResponse.statusText}`);
	}

	const repoData = await repoResponse.json();
	return repoData.default_branch;
}

async function fetchBranches(owner: string, repo: string, accessToken: string) {
	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/branches`,
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/vnd.github.v3+json",
			},
		},
	);

	if (!response.ok) {
		if (response.status === 404) {
			throw new HttpError("Repository not found", 404, {
				error: "Repository not found",
			});
		}
		throw new Error(`Failed to fetch branches: ${response.statusText}`);
	}

	return await response.json();
}

function formatBranchesResponse(
	branches: GitHubBranch[],
	defaultBranch: string,
) {
	return {
		branches: branches.map((branch: GitHubBranch) => ({
			name: branch.name,
			commit: {
				sha: branch.commit.sha,
				url: branch.commit.url,
			},
			protected: branch.protected || false,
			isDefault: branch.name === defaultBranch,
		})),
	};
}

export async function GET(request: NextRequest) {
	try {
		// Validate and extract request data
		const accessToken = validateAuthentication(request);
		const { owner, repo } = validateRepositoryParams(request);

		// Fetch repository and branch data
		const defaultBranch = await fetchRepositoryInfo(owner, repo, accessToken);
		const branches = await fetchBranches(owner, repo, accessToken);

		// Return formatted response
		return NextResponse.json(formatBranchesResponse(branches, defaultBranch));
	} catch (error: unknown) {
		// Handle validation and API errors
		if (error instanceof HttpError) {
			return NextResponse.json(error.response, { status: error.status });
		}

		// Handle unexpected errors
		console.error("Error fetching branches:", error);
		return NextResponse.json(
			{ error: "Failed to fetch branches" },
			{ status: 500 },
		);
	}
}
