import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInterface } from "./chat-interface";

// Mock the repository data hook
vi.mock("@/hooks/use-repository-data", () => ({
	useRepositoryData: vi.fn(() => ({
		tasks: [],
		repositories: [
			{
				id: 1,
				full_name: "test/repo",
				default_branch: "main",
			},
		],
		isLoading: false,
		error: null,
		refreshTasks: vi.fn(),
		isAuthenticated: true,
		currentRepository: {
			id: 1,
			full_name: "test/repo",
			default_branch: "main",
		},
		setCurrentRepository: vi.fn(),
	})),
}));

// Mock the GitHub hooks
vi.mock("@/hooks/use-github", () => ({
	useGitHubAuthStatus: vi.fn(() => ({ data: { isAuthenticated: true } })),
	useGitHubAuthRefresh: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
	useGitHubBranches: vi.fn(() => ({
		data: {
			branches: [
				{
					name: "main",
					isDefault: true,
					commit: { sha: "abc123" },
					protected: false,
				},
				{
					name: "feature",
					isDefault: false,
					commit: { sha: "def456" },
					protected: false,
				},
			],
		},
		isLoading: false,
		error: null,
	})),
}));

// Mock the VibeKit action
vi.mock("@/app/actions/vibekit", () => ({
	generateCodeAction: vi.fn(() => Promise.resolve({ success: true })),
}));

// Mock the MicrophoneButton component
vi.mock("./voice/microphone-button", () => ({
	MicrophoneButton: vi.fn(
		({
			onStartRecording,
			onStopRecording,
			_onTranscription,
			_onError,
			isRecording,
			_isProcessing,
			_isDisabled,
			_size,
			_className,
		}) => (
			<button
				type="button"
				data-testid="microphone-button"
				onClick={() => {
					if (isRecording) {
						onStopRecording?.();
					} else {
						onStartRecording?.();
					}
				}}
				disabled={_isDisabled}
				className={_className}
				aria-label={isRecording ? "Stop recording" : "Start recording"}
			>
				{isRecording ? "Recording..." : "🎤"}
			</button>
		),
	),
}));

// Mock fetch for GitHub auth
global.fetch = vi.fn();

// Mock window methods
Object.defineProperty(window, "open", {
	writable: true,
	value: vi.fn(() => ({
		close: vi.fn(),
		closed: false,
	})),
});

Object.defineProperty(window, "addEventListener", {
	writable: true,
	value: vi.fn(),
});

Object.defineProperty(window, "removeEventListener", {
	writable: true,
	value: vi.fn(),
});

const createTestQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

const renderWithQueryClient = (component: React.ReactElement) => {
	const queryClient = createTestQueryClient();
	return render(
		<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
	);
};

describe("ChatInterface", () => {
	let mockUseRepositoryData: ReturnType<typeof vi.fn>;
	let mockUseGitHubBranches: ReturnType<typeof vi.fn>;
	let mockGenerateCodeAction: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Setup localStorage mock
		Object.defineProperty(window, "localStorage", {
			value: {
				getItem: vi.fn(() => null),
				setItem: vi.fn(),
				removeItem: vi.fn(),
			},
			writable: true,
		});

		// Get the mocked functions
		mockUseRepositoryData = vi.mocked(
			await import("@/hooks/use-repository-data"),
		).useRepositoryData;
		mockUseGitHubBranches = vi.mocked(
			await import("@/hooks/use-github"),
		).useGitHubBranches;
		mockGenerateCodeAction = vi.mocked(
			await import("@/app/actions/vibekit"),
		).generateCodeAction;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should render the main interface with task input", () => {
		renderWithQueryClient(<ChatInterface />);

		expect(screen.getByText("What are we coding next?")).toBeInTheDocument();
		expect(screen.getByTestId("task-input")).toBeInTheDocument();
		expect(
			screen.getByPlaceholderText(/add a new feature/i),
		).toBeInTheDocument();
	});

	it("should render agent selector with default Claude Code selected", () => {
		renderWithQueryClient(<ChatInterface />);

		const agentSelector = screen.getByTestId("agent-selector");
		expect(agentSelector).toBeInTheDocument();
		expect(agentSelector).toHaveTextContent("Claude Code");
	});

	it("should allow changing the selected agent", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<ChatInterface />);

		const agentSelector = screen.getByTestId("agent-selector");
		await user.click(agentSelector);

		const geminiOption = screen.getByTestId("agent-option-gemini-cli");
		await user.click(geminiOption);

		expect(agentSelector).toHaveTextContent("Gemini CLI");
	});

	it("should handle task description input", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<ChatInterface />);

		const taskInput = screen.getByTestId("task-input");
		await user.type(taskInput, "Create a new React component");

		expect(taskInput).toHaveValue("Create a new React component");
	});

	it("should disable code generation button when input is empty", () => {
		renderWithQueryClient(<ChatInterface />);

		const codeButton = screen.getByTestId("code-generation-button");
		expect(codeButton).toBeDisabled();
	});

	it("should enable code generation button when input has content", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<ChatInterface />);

		const taskInput = screen.getByTestId("task-input");
		await user.type(taskInput, "Create a new component");

		const codeButton = screen.getByTestId("code-generation-button");
		expect(codeButton).not.toBeDisabled();
	});

	it("should call generateCodeAction when code button is clicked", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<ChatInterface />);

		const taskInput = screen.getByTestId("task-input");
		await user.type(taskInput, "Create a new component");

		const codeButton = screen.getByTestId("code-generation-button");
		await user.click(codeButton);

		expect(mockGenerateCodeAction).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "Create a new component",
				agentConfig: expect.objectContaining({
					type: "claude-code",
					model: "claude-3-5-sonnet",
					isLocal: true,
				}),
			}),
		);
	});

	it("should show loading state during code generation", async () => {
		const user = userEvent.setup();
		mockGenerateCodeAction.mockImplementation(
			() => new Promise((resolve) => setTimeout(resolve, 100)),
		);

		renderWithQueryClient(<ChatInterface />);

		const taskInput = screen.getByTestId("task-input");
		await user.type(taskInput, "Create a component");

		const codeButton = screen.getByTestId("code-generation-button");
		await user.click(codeButton);

		expect(codeButton).toHaveTextContent("Generating...");
		expect(codeButton).toBeDisabled();
	});

	it("should render microphone button for voice input", () => {
		renderWithQueryClient(<ChatInterface />);

		const micButton = screen.getByTestId("microphone-button");
		expect(micButton).toBeInTheDocument();
	});

	it("should handle voice recording toggle", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<ChatInterface />);

		const micButton = screen.getByTestId("microphone-button");

		// Start recording
		await user.click(micButton);
		expect(micButton).toHaveTextContent("Recording...");

		// Stop recording
		await user.click(micButton);
		expect(micButton).toHaveTextContent("🎤");
	});

	it("should render tabs for tasks and archive", () => {
		renderWithQueryClient(<ChatInterface />);

		expect(screen.getByRole("button", { name: /tasks/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /archive/i }),
		).toBeInTheDocument();
	});

	it("should switch between tasks and archive tabs", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<ChatInterface />);

		const archiveTab = screen.getByRole("button", { name: /archive/i });
		await user.click(archiveTab);

		expect(screen.getByText("No archived tasks yet.")).toBeInTheDocument();
	});

	it("should display repository and branch selectors", () => {
		renderWithQueryClient(<ChatInterface />);

		// Should show the current repository
		expect(screen.getByText("test/repo")).toBeInTheDocument();

		// Should show branch selector with main selected
		expect(screen.getByText("main")).toBeInTheDocument();
	});

	it("should handle authentication state correctly", () => {
		mockUseRepositoryData.mockReturnValue({
			tasks: [],
			repositories: [],
			isLoading: false,
			error: null,
			refreshTasks: vi.fn(),
			isAuthenticated: false,
			currentRepository: null,
			setCurrentRepository: vi.fn(),
		});

		renderWithQueryClient(<ChatInterface />);

		expect(
			screen.getByText(/connect your github account/i),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /connect github/i }),
		).toBeInTheDocument();
	});

	it("should display loading state for tasks", () => {
		mockUseRepositoryData.mockReturnValue({
			tasks: [],
			repositories: [],
			isLoading: true,
			error: null,
			refreshTasks: vi.fn(),
			isAuthenticated: true,
			currentRepository: null,
			setCurrentRepository: vi.fn(),
		});

		renderWithQueryClient(<ChatInterface />);

		expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
	});

	it("should display error state for tasks", () => {
		const mockRefreshTasks = vi.fn();
		mockUseRepositoryData.mockReturnValue({
			tasks: [],
			repositories: [],
			isLoading: false,
			error: "Failed to load tasks",
			refreshTasks: mockRefreshTasks,
			isAuthenticated: true,
			currentRepository: null,
			setCurrentRepository: vi.fn(),
		});

		renderWithQueryClient(<ChatInterface />);

		expect(screen.getByText("Failed to load tasks")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
	});

	it("should handle branch loading state", () => {
		mockUseGitHubBranches.mockReturnValue({
			data: null,
			isLoading: true,
			error: null,
		});

		renderWithQueryClient(<ChatInterface />);

		expect(screen.getByText("Loading...")).toBeInTheDocument();
	});

	it("should update selected branch when branches are loaded", () => {
		mockUseGitHubBranches.mockReturnValue({
			data: {
				branches: [
					{
						name: "develop",
						isDefault: true,
						commit: { sha: "abc123" },
						protected: false,
					},
				],
			},
			isLoading: false,
			error: null,
		});

		renderWithQueryClient(<ChatInterface />);

		// Should automatically select the default branch
		expect(screen.getByText("develop")).toBeInTheDocument();
	});

	it("should handle GitHub authentication flow", async () => {
		const user = userEvent.setup();
		const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
		mockFetch.mockResolvedValue({
			json: () =>
				Promise.resolve({ url: "https://github.com/login/oauth/authorize" }),
		});

		mockUseRepositoryData.mockReturnValue({
			tasks: [],
			repositories: [],
			isLoading: false,
			error: null,
			refreshTasks: vi.fn(),
			isAuthenticated: false,
			currentRepository: null,
			setCurrentRepository: vi.fn(),
		});

		renderWithQueryClient(<ChatInterface />);

		const connectButton = screen.getByRole("button", {
			name: /connect github/i,
		});
		await user.click(connectButton);

		expect(mockFetch).toHaveBeenCalledWith("/api/auth/github/url");
		expect(window.open).toHaveBeenCalledWith(
			"https://github.com/login/oauth/authorize",
			"github-auth",
			expect.stringContaining("width=600,height=700"),
		);
	});

	it("should display tasks when available", () => {
		const mockTasks = [
			{
				id: "1",
				title: "Test task 1",
				status: "running",
				timeAgo: "2 hours ago",
				repository: "test/repo",
				addedLines: 10,
				removedLines: 5,
				commitSha: "abc123def",
				url: "https://github.com/test/repo/pull/1",
			},
			{
				id: "2",
				title: "Test task 2",
				status: "completed",
				timeAgo: "1 day ago",
				repository: "test/repo",
				addedLines: 20,
				removedLines: 0,
				commitSha: "def456abc",
				url: "https://github.com/test/repo/pull/2",
			},
		];

		mockUseRepositoryData.mockReturnValue({
			tasks: mockTasks,
			repositories: [],
			isLoading: false,
			error: null,
			refreshTasks: vi.fn(),
			isAuthenticated: true,
			currentRepository: {
				id: 1,
				full_name: "test/repo",
				default_branch: "main",
			},
			setCurrentRepository: vi.fn(),
		});

		renderWithQueryClient(<ChatInterface />);

		expect(screen.getByText("Test task 1")).toBeInTheDocument();
		expect(screen.getByText("Test task 2")).toBeInTheDocument();
		expect(screen.getByText("Recent")).toBeInTheDocument();
	});

	it("should have proper accessibility attributes", () => {
		renderWithQueryClient(<ChatInterface />);

		const taskInput = screen.getByTestId("task-input");
		expect(taskInput).toHaveAttribute("placeholder");

		const buttons = screen.getAllByRole("button");
		buttons.forEach((button) => {
			expect(button).toHaveAccessibleName();
		});

		const selects = screen.getAllByRole("combobox");
		selects.forEach((select) => {
			expect(select).toBeInTheDocument();
		});
	});
});
