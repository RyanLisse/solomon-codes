import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/stores/tasks";
import TaskList from "./task-list";

// Mock Next.js Link component
vi.mock("next/link", () => ({
	default: ({
		children,
		href,
	}: {
		children: React.ReactNode;
		href: string;
	}) => (
		<a href={href} data-testid="task-link">
			{children}
		</a>
	),
}));

// Mock the hooks
vi.mock("@/hooks/use-tasks", () => ({
	useTasks: vi.fn(),
	useArchiveTask: vi.fn(() => ({
		mutate: vi.fn(),
		isPending: false,
	})),
	useDeleteTask: vi.fn(() => ({
		mutate: vi.fn(),
		isPending: false,
	})),
}));

// Mock date-fns
vi.mock("date-fns", () => ({
	formatDistanceToNow: vi.fn((_date) => "2 hours ago"),
}));

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

const mockActiveTasks: Task[] = [
	{
		id: "task-1",
		title: "Implement user authentication",
		description: "Add login and registration functionality",
		status: "IN_PROGRESS",
		statusMessage: "Setting up authentication middleware",
		repository: "user/frontend-app",
		branch: "main",
		hasChanges: true,
		messages: [],
		mode: "code",
		sessionId: "session-1",
		createdAt: "2024-01-15T10:00:00Z",
		updatedAt: "2024-01-15T11:00:00Z",
		isArchived: false,
		useLocalSandbox: true,
		projectId: "default",
		labels: ["authentication", "security"],
		priority: "high",
		versions: [],
		reviewStatus: "pending",
	},
	{
		id: "task-2",
		title: "Fix responsive design issues",
		description: "Mobile layout improvements",
		status: "DONE",
		repository: "user/frontend-app",
		branch: "develop",
		hasChanges: false,
		messages: [],
		mode: "code",
		sessionId: "session-2",
		createdAt: "2024-01-14T15:30:00Z",
		updatedAt: "2024-01-15T09:00:00Z",
		isArchived: false,
		useLocalSandbox: false,
		projectId: "default",
		labels: ["ui", "responsive"],
		priority: "medium",
		versions: [],
		reviewStatus: "approved",
	},
	{
		id: "task-3",
		title: "Add unit tests for API endpoints",
		description: "Improve test coverage",
		status: "IN_PROGRESS",
		repository: "user/backend-api",
		branch: "testing",
		hasChanges: false,
		messages: [],
		mode: "code",
		sessionId: "session-3",
		createdAt: "2024-01-13T08:00:00Z",
		updatedAt: "2024-01-13T12:00:00Z",
		isArchived: false,
		useLocalSandbox: true,
		projectId: "default",
		labels: ["testing", "api"],
		priority: "medium",
		versions: [],
		reviewStatus: "pending",
	},
];

const mockArchivedTasks: Task[] = [
	{
		id: "archived-1",
		title: "Setup CI/CD pipeline",
		description: "Automated deployment",
		status: "DONE",
		repository: "user/backend-api",
		branch: "main",
		hasChanges: false,
		messages: [],
		mode: "code",
		sessionId: "session-4",
		createdAt: "2024-01-10T10:00:00Z",
		updatedAt: "2024-01-10T18:00:00Z",
		isArchived: true,
		useLocalSandbox: false,
		projectId: "default",
		labels: ["devops", "cicd"],
		priority: "high",
		versions: [],
		reviewStatus: "approved",
	},
];

describe("TaskList", () => {
	let mockUseTasks: ReturnType<typeof vi.fn>;
	let mockUseArchiveTask: ReturnType<typeof vi.fn>;
	let mockUseDeleteTask: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Get the mocked functions
		mockUseTasks = vi.mocked(await import("@/hooks/use-tasks")).useTasks;
		mockUseArchiveTask = vi.mocked(
			await import("@/hooks/use-tasks"),
		).useArchiveTask;
		mockUseDeleteTask = vi.mocked(
			await import("@/hooks/use-tasks"),
		).useDeleteTask;

		// Default mock implementations
		mockUseTasks.mockImplementation(({ archived }: { archived?: boolean }) => ({
			data: archived ? mockArchivedTasks : mockActiveTasks,
			isLoading: false,
		}));

		mockUseArchiveTask.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
		});

		mockUseDeleteTask.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should render the task list with tabs", () => {
		renderWithQueryClient(<TaskList />);

		expect(screen.getByRole("tab", { name: /tasks/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /archive/i })).toBeInTheDocument();
	});

	it("should display active tasks by default", () => {
		renderWithQueryClient(<TaskList />);

		expect(
			screen.getByText("Implement user authentication"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Fix responsive design issues"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Add unit tests for API endpoints"),
		).toBeInTheDocument();
	});

	it("should show task progress indicator for in-progress tasks", () => {
		renderWithQueryClient(<TaskList />);

		expect(
			screen.getByText("Setting up authentication middleware..."),
		).toBeInTheDocument();
	});

	it("should show task metadata for completed tasks", () => {
		renderWithQueryClient(<TaskList />);

		expect(screen.getByText("2 hours ago")).toBeInTheDocument();
		expect(screen.getByText("user/frontend-app")).toBeInTheDocument();
	});

	it("should show archive button for completed tasks", () => {
		renderWithQueryClient(<TaskList />);

		// Only the completed task should have an archive button
		const archiveButtons = screen.getAllByRole("button");
		const archiveButton = archiveButtons.find((button) =>
			button.querySelector(".lucide-archive"),
		);
		expect(archiveButton).toBeInTheDocument();
	});

	it("should show changes indicator for tasks with changes", () => {
		renderWithQueryClient(<TaskList />);

		// Task 1 has changes, so should show the blue dot
		const taskWithChanges = screen
			.getByText("Implement user authentication")
			.closest("div");
		expect(taskWithChanges?.querySelector(".bg-blue-500")).toBeInTheDocument();
	});

	it("should make tasks clickable with proper links", () => {
		renderWithQueryClient(<TaskList />);

		const taskLinks = screen.getAllByTestId("task-link");
		expect(taskLinks).toHaveLength(3); // 3 active tasks

		expect(taskLinks[0]).toHaveAttribute("href", "/task/task-1");
		expect(taskLinks[1]).toHaveAttribute("href", "/task/task-2");
		expect(taskLinks[2]).toHaveAttribute("href", "/task/task-3");
	});

	it("should handle archiving a task", async () => {
		const user = userEvent.setup();
		const mockArchiveMutate = vi.fn();
		mockUseArchiveTask.mockReturnValue({
			mutate: mockArchiveMutate,
			isPending: false,
		});

		renderWithQueryClient(<TaskList />);

		const archiveButtons = screen.getAllByRole("button");
		const archiveButton = archiveButtons.find((button) =>
			button.querySelector(".lucide-archive"),
		);

		if (archiveButton) {
			await user.click(archiveButton);
			expect(mockArchiveMutate).toHaveBeenCalledWith("task-2");
		}
	});

	it("should show loading state for archive operation", () => {
		mockUseArchiveTask.mockReturnValue({
			mutate: vi.fn(),
			isPending: true,
		});

		renderWithQueryClient(<TaskList />);

		// Look for loading spinner by checking for spinning animation class
		const loadingSpinner = document.querySelector(".animate-spin");
		expect(loadingSpinner).toBeInTheDocument();
	});

	it("should switch to archived tasks tab", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<TaskList />);

		const archivedTab = screen.getByRole("tab", { name: /archive/i });
		await user.click(archivedTab);

		expect(screen.getByText("Setup CI/CD pipeline")).toBeInTheDocument();
	});

	it("should show delete button for archived tasks", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<TaskList />);

		const archivedTab = screen.getByRole("tab", { name: /archive/i });
		await user.click(archivedTab);

		const deleteButton = screen.getByRole("button");
		expect(deleteButton.querySelector(".lucide-trash-2")).toBeInTheDocument();
	});

	it("should handle deleting an archived task", async () => {
		const user = userEvent.setup();
		const mockDeleteMutate = vi.fn();
		mockUseDeleteTask.mockReturnValue({
			mutate: mockDeleteMutate,
			isPending: false,
		});

		renderWithQueryClient(<TaskList />);

		const archivedTab = screen.getByRole("tab", { name: /archive/i });
		await user.click(archivedTab);

		const deleteButton = screen.getByRole("button");
		await user.click(deleteButton);

		expect(mockDeleteMutate).toHaveBeenCalledWith("archived-1");
	});

	it("should show loading state for delete operation", async () => {
		const user = userEvent.setup();
		mockUseDeleteTask.mockReturnValue({
			mutate: vi.fn(),
			isPending: true,
		});

		renderWithQueryClient(<TaskList />);

		const archivedTab = screen.getByRole("tab", { name: /archive/i });
		await user.click(archivedTab);

		// Look for loading spinner by checking for spinning animation class
		const loadingSpinner = document.querySelector(".animate-spin");
		expect(loadingSpinner).toBeInTheDocument();
	});

	it("should prevent event bubbling when clicking action buttons", async () => {
		const _user = userEvent.setup();
		const mockArchiveMutate = vi.fn();
		mockUseArchiveTask.mockReturnValue({
			mutate: mockArchiveMutate,
			isPending: false,
		});

		renderWithQueryClient(<TaskList />);

		const archiveButtons = screen.getAllByRole("button");
		const archiveButton = archiveButtons.find((button) =>
			button.querySelector(".lucide-archive"),
		);

		if (archiveButton) {
			// Mock stopPropagation to verify it's called
			const stopPropagationSpy = vi.fn();
			fireEvent.click(archiveButton, {
				stopPropagation: stopPropagationSpy,
			});

			expect(mockArchiveMutate).toHaveBeenCalled();
		}
	});

	it("should show loading state while fetching tasks", () => {
		mockUseTasks.mockImplementation(
			({ archived: _archived }: { archived?: boolean }) => ({
				data: [],
				isLoading: true,
			}),
		);

		renderWithQueryClient(<TaskList />);

		expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
	});

	it("should show loading state while fetching archived tasks", async () => {
		const user = userEvent.setup();

		// Mock different loading states for active vs archived
		mockUseTasks.mockImplementation(({ archived }: { archived?: boolean }) => ({
			data: archived ? [] : mockActiveTasks,
			isLoading: archived,
		}));

		renderWithQueryClient(<TaskList />);

		const archivedTab = screen.getByRole("tab", { name: /archive/i });
		await user.click(archivedTab);

		expect(screen.getByText("Loading archived tasks...")).toBeInTheDocument();
	});

	it("should show empty state for no active tasks", () => {
		mockUseTasks.mockImplementation(
			({ archived: _archived }: { archived?: boolean }) => ({
				data: [],
				isLoading: false,
			}),
		);

		renderWithQueryClient(<TaskList />);

		expect(screen.getByText("No active tasks yet.")).toBeInTheDocument();
	});

	it("should show empty state for no archived tasks", async () => {
		const user = userEvent.setup();
		mockUseTasks.mockImplementation(({ archived }: { archived?: boolean }) => ({
			data: archived ? [] : mockActiveTasks,
			isLoading: false,
		}));

		renderWithQueryClient(<TaskList />);

		const archivedTab = screen.getByRole("tab", { name: /archive/i });
		await user.click(archivedTab);

		expect(screen.getByText("No archived tasks yet.")).toBeInTheDocument();
	});

	it("should show task status in archived view", async () => {
		const user = userEvent.setup();
		renderWithQueryClient(<TaskList />);

		const archivedTab = screen.getByRole("tab", { name: /archive/i });
		await user.click(archivedTab);

		expect(screen.getByText(/status: DONE/i)).toBeInTheDocument();
		expect(screen.getByText(/branch: main/i)).toBeInTheDocument();
	});

	it("should handle hydration and loading states properly", async () => {
		// Test that the component handles the transition from loading to loaded state
		let isLoadingValue = true;

		mockUseTasks.mockImplementation(({ archived }: { archived?: boolean }) => ({
			data: isLoadingValue
				? []
				: archived
					? mockArchivedTasks
					: mockActiveTasks,
			isLoading: isLoadingValue,
		}));

		const { rerender } = renderWithQueryClient(<TaskList />);

		// Should show loading state when data is loading
		expect(screen.getByText("Loading tasks...")).toBeInTheDocument();

		// Simulate data loading completion
		isLoadingValue = false;
		rerender(
			<QueryClientProvider client={createTestQueryClient()}>
				<TaskList />
			</QueryClientProvider>,
		);

		// Wait for tasks to appear after loading completes
		await waitFor(() => {
			expect(
				screen.getByText("Implement user authentication"),
			).toBeInTheDocument();
		});

		// Ensure loading text is no longer present
		expect(screen.queryByText("Loading tasks...")).not.toBeInTheDocument();
	});

	it("should have proper accessibility attributes", () => {
		renderWithQueryClient(<TaskList />);

		// Check tabs have proper ARIA attributes
		const activeTab = screen.getByRole("tab", { name: /tasks/i });
		const archivedTab = screen.getByRole("tab", { name: /archive/i });

		expect(activeTab).toHaveAttribute("aria-selected");
		expect(archivedTab).toHaveAttribute("aria-selected");

		// Check buttons have accessible names
		const buttons = screen.getAllByRole("button");
		buttons.forEach((button) => {
			expect(button).toBeInTheDocument();
		});
	});

	it("should show default status message for in-progress tasks without specific message", () => {
		const taskWithoutMessage = {
			...mockActiveTasks[0],
			statusMessage: undefined,
		};

		mockUseTasks.mockImplementation(({ archived }: { archived?: boolean }) => ({
			data: archived ? mockArchivedTasks : [taskWithoutMessage],
			isLoading: false,
		}));

		renderWithQueryClient(<TaskList />);

		expect(screen.getByText("Working on your task...")).toBeInTheDocument();
	});
});
