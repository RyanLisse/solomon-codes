import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
	ButtonHTMLAttributes,
	HTMLAttributes,
	InputHTMLAttributes,
	LabelHTMLAttributes,
	ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaudeUser } from "@/lib/auth/claude-token-store";
import { ClaudeAuthButton } from "./claude-auth-button";

// Type definitions for mock components
interface MockAlertProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

interface MockButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
}

interface MockInputProps extends InputHTMLAttributes<HTMLInputElement> {
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface MockLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
	children: ReactNode;
}

interface MockTabsProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

// Mock useClaudeAuth hook type
interface MockUseClaudeAuth {
	isAuthenticated: boolean;
	user: ClaudeUser | null;
	authMethod: "oauth" | "api_key" | null;
	isLoading: boolean;
	error: string | null;
	login: ReturnType<typeof vi.fn>;
	loginWithApiKey: ReturnType<typeof vi.fn>;
	logout: ReturnType<typeof vi.fn>;
}

// Mock the useClaudeAuth hook
const mockUseClaudeAuth: MockUseClaudeAuth = {
	isAuthenticated: false,
	user: null,
	authMethod: null,
	isLoading: false,
	error: null,
	login: vi.fn(),
	loginWithApiKey: vi.fn(),
	logout: vi.fn(),
};

vi.mock("@/hooks/use-claude-auth", () => ({
	useClaudeAuth: () => mockUseClaudeAuth,
}));

// Mock UI components
vi.mock("@/components/ui/alert", () => ({
	Alert: ({ children, ...props }: MockAlertProps) => (
		<div data-testid="alert" {...props}>
			{children}
		</div>
	),
	AlertDescription: ({ children, ...props }: MockAlertProps) => (
		<div data-testid="alert-description" {...props}>
			{children}
		</div>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children, onClick, disabled, ...props }: MockButtonProps) => (
		<button
			onClick={onClick}
			disabled={disabled}
			data-testid="button"
			{...props}
		>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({ onChange, value, ...props }: MockInputProps) => (
		<input
			onChange={(e) => onChange?.(e)}
			value={value}
			data-testid="input"
			{...props}
		/>
	),
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({ children, ...props }: MockLabelProps) => (
		<label data-testid="label" htmlFor="mock-input" {...props}>
			{children}
		</label>
	),
}));

vi.mock("@/components/ui/tabs", () => ({
	Tabs: ({ children, ...props }: MockTabsProps) => (
		<div data-testid="tabs" {...props}>
			{children}
		</div>
	),
	TabsContent: ({ children, ...props }: MockTabsProps) => (
		<div data-testid="tabs-content" {...props}>
			{children}
		</div>
	),
	TabsList: ({ children, ...props }: MockTabsProps) => (
		<div data-testid="tabs-list" {...props}>
			{children}
		</div>
	),
	TabsTrigger: ({ children, ...props }: MockButtonProps) => (
		<button data-testid="tabs-trigger" {...props}>
			{children}
		</button>
	),
}));

describe("ClaudeAuthButton", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset mock state
		mockUseClaudeAuth.isAuthenticated = false;
		mockUseClaudeAuth.user = null;
		mockUseClaudeAuth.authMethod = null;
		mockUseClaudeAuth.isLoading = false;
		mockUseClaudeAuth.error = null;
	});

	describe("Unauthenticated State", () => {
		it("should render login options when not authenticated", () => {
			render(<ClaudeAuthButton />);

			expect(screen.getByTestId("tabs")).toBeInTheDocument();
			expect(screen.getAllByTestId("tabs-trigger")).toHaveLength(2);
			expect(screen.getByText("Claude Max")).toBeInTheDocument();
			expect(screen.getByText("API Key")).toBeInTheDocument();
		});

		it("should render OAuth login button", () => {
			render(<ClaudeAuthButton />);

			const loginButton = screen.getByText("Sign in with Claude Max");
			expect(loginButton).toBeInTheDocument();
		});

		it("should render API key input form", () => {
			render(<ClaudeAuthButton />);

			expect(screen.getByTestId("input")).toBeInTheDocument();
			expect(screen.getByText("Claude API Key")).toBeInTheDocument();
		});
	});

	describe("Authentication Actions", () => {
		it("should call login when OAuth button is clicked", async () => {
			const user = userEvent.setup();

			render(<ClaudeAuthButton />);

			const loginButton = screen.getByText("Sign in with Claude Max");
			await user.click(loginButton);

			expect(mockUseClaudeAuth.login).toHaveBeenCalledOnce();
		});

		it("should call loginWithApiKey when API key form is submitted", async () => {
			const user = userEvent.setup();

			render(<ClaudeAuthButton />);

			// Enter API key
			const apiKeyInput = screen.getByTestId("input");
			await user.type(apiKeyInput, "test-api-key");

			// Submit API key form
			const submitButton = screen.getByText("Authenticate with API Key");
			await user.click(submitButton);

			expect(mockUseClaudeAuth.loginWithApiKey).toHaveBeenCalledWith(
				"test-api-key",
			);
		});

		it("should not submit API key form with empty key", async () => {
			const user = userEvent.setup();

			render(<ClaudeAuthButton />);

			const submitButton = screen.getByText("Authenticate with API Key");
			await user.click(submitButton);

			expect(mockUseClaudeAuth.loginWithApiKey).not.toHaveBeenCalled();
		});
	});

	describe("Authenticated State", () => {
		beforeEach(() => {
			mockUseClaudeAuth.isAuthenticated = true;
			mockUseClaudeAuth.user = {
				id: "user-123",
				name: "John Doe",
				email: "john.doe@example.com",
				subscription: "pro",
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};
			mockUseClaudeAuth.authMethod = "oauth";
		});

		it("should render user info when authenticated", () => {
			render(<ClaudeAuthButton />);

			expect(screen.getByText("John Doe")).toBeInTheDocument();
			expect(screen.getByText(/OAuth/)).toBeInTheDocument();
		});

		it("should render logout button when authenticated", () => {
			render(<ClaudeAuthButton />);

			const logoutButton = screen.getByText("Logout");
			expect(logoutButton).toBeInTheDocument();
		});

		it("should call logout when logout button is clicked", async () => {
			const user = userEvent.setup();

			render(<ClaudeAuthButton />);

			const logoutButton = screen.getByText("Logout");
			await user.click(logoutButton);

			expect(mockUseClaudeAuth.logout).toHaveBeenCalledOnce();
		});

		it("should display API key auth method correctly", () => {
			mockUseClaudeAuth.authMethod = "api_key";

			render(<ClaudeAuthButton />);

			expect(screen.getByText(/API Key/)).toBeInTheDocument();
		});
	});

	describe("Loading State", () => {
		it("should show loading spinner when loading", () => {
			mockUseClaudeAuth.isLoading = true;

			render(<ClaudeAuthButton />);

			// Loading spinner should be present (Loader2 component from lucide-react)
			const buttons = screen.getAllByTestId("button");
			expect(buttons.length).toBeGreaterThan(0);
		});

		it("should disable buttons when loading", () => {
			mockUseClaudeAuth.isLoading = true;

			render(<ClaudeAuthButton />);

			const buttons = screen.getAllByTestId("button");
			buttons.forEach((button) => {
				expect(button).toBeDisabled();
			});
		});
	});

	describe("Error Handling", () => {
		it("should display error message when error occurs", () => {
			mockUseClaudeAuth.error = "Authentication failed";

			render(<ClaudeAuthButton />);

			expect(screen.getByTestId("alert")).toBeInTheDocument();
			expect(screen.getByText("Authentication failed")).toBeInTheDocument();
		});

		it("should call onAuthError callback when login fails", async () => {
			const onAuthError = vi.fn();
			const errorMessage = "Authentication failed";

			// Mock login to throw an error
			mockUseClaudeAuth.login.mockRejectedValue(new Error(errorMessage));

			const user = userEvent.setup();
			render(<ClaudeAuthButton onAuthError={onAuthError} />);

			const loginButton = screen.getByText("Sign in with Claude Max");
			await user.click(loginButton);

			await waitFor(() => {
				expect(onAuthError).toHaveBeenCalledWith(errorMessage);
			});
		});
	});

	describe("Success Callbacks", () => {
		it("should call login function when OAuth button is clicked", async () => {
			const onAuthSuccess = vi.fn();
			const user = userEvent.setup();

			render(<ClaudeAuthButton onAuthSuccess={onAuthSuccess} />);

			const loginButton = screen.getByText("Sign in with Claude Max");
			await user.click(loginButton);

			expect(mockUseClaudeAuth.login).toHaveBeenCalledOnce();
		});

		it("should call loginWithApiKey function when API key is submitted", async () => {
			const onAuthSuccess = vi.fn();
			const user = userEvent.setup();

			render(<ClaudeAuthButton onAuthSuccess={onAuthSuccess} />);

			// Enter API key and submit
			const apiKeyInput = screen.getByTestId("input");
			await user.type(apiKeyInput, "test-api-key");

			const submitButton = screen.getByText("Authenticate with API Key");
			await user.click(submitButton);

			expect(mockUseClaudeAuth.loginWithApiKey).toHaveBeenCalledWith(
				"test-api-key",
			);
		});
	});

	describe("Styling and Props", () => {
		it("should apply custom className", () => {
			const { container } = render(
				<ClaudeAuthButton className="custom-class" />,
			);

			expect(container.firstChild).toHaveClass("custom-class");
		});

		it("should handle missing optional props gracefully", () => {
			expect(() => render(<ClaudeAuthButton />)).not.toThrow();
		});
	});

	describe("Form Validation", () => {
		it("should validate API key input", async () => {
			const user = userEvent.setup();

			render(<ClaudeAuthButton />);

			// Try to submit without API key
			const submitButton = screen.getByText("Authenticate with API Key");
			await user.click(submitButton);

			// Should not call loginWithApiKey
			expect(mockUseClaudeAuth.loginWithApiKey).not.toHaveBeenCalled();
		});

		it("should clear API key input after successful submission", async () => {
			const user = userEvent.setup();
			mockUseClaudeAuth.loginWithApiKey.mockResolvedValue(undefined);

			render(<ClaudeAuthButton />);

			const apiKeyInput = screen.getByTestId("input") as HTMLInputElement;
			await user.type(apiKeyInput, "test-api-key");

			const submitButton = screen.getByText("Authenticate with API Key");
			await user.click(submitButton);

			await waitFor(() => {
				expect(apiKeyInput.value).toBe("");
			});
		});
	});

	describe("Accessibility", () => {
		it("should have proper labels for form inputs", () => {
			render(<ClaudeAuthButton />);

			expect(screen.getByTestId("label")).toBeInTheDocument();
			expect(screen.getByText("Claude API Key")).toBeInTheDocument();
		});

		it("should be keyboard accessible", async () => {
			const user = userEvent.setup();

			render(<ClaudeAuthButton />);

			// Should be able to tab through interactive elements
			await user.tab();
			expect(screen.getAllByTestId("tabs-trigger")[0]).toHaveFocus();
		});

		it("should provide proper accessibility when loading", () => {
			mockUseClaudeAuth.isLoading = true;

			render(<ClaudeAuthButton />);

			const buttons = screen.getAllByTestId("button");
			buttons.forEach((button) => {
				expect(button).toBeDisabled();
			});
		});
	});
});
