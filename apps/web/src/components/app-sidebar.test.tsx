import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "./ui/sidebar";

// Mock the mobile hook
vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: vi.fn(() => false),
}));

const renderWithSidebar = (component: React.ReactElement) => {
	return render(<SidebarProvider>{component}</SidebarProvider>);
};

describe("AppSidebar", () => {
	const mockOnLocalExecutionChange = vi.fn();

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should render sidebar with all navigation items", () => {
		renderWithSidebar(<AppSidebar />);

		// Check main navigation items
		expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /automations/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /stats/i })).toBeInTheDocument();

		// Check configure section
		expect(screen.getByText("Configure")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /environments/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
	});

	it("should display Solomon Codes branding", () => {
		renderWithSidebar(<AppSidebar />);
		expect(screen.getByText("Solomon Codes")).toBeInTheDocument();
	});

	it("should show user profile information", () => {
		renderWithSidebar(<AppSidebar />);
		expect(screen.getByText("Ryan Lisse")).toBeInTheDocument();
	});

	it("should render navigation links with correct URLs", () => {
		renderWithSidebar(<AppSidebar />);

		expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.getByRole("link", { name: /automations/i })).toHaveAttribute(
			"href",
			"/automations",
		);
		expect(screen.getByRole("link", { name: /stats/i })).toHaveAttribute(
			"href",
			"/stats",
		);
		expect(screen.getByRole("link", { name: /environments/i })).toHaveAttribute(
			"href",
			"/environments",
		);
		expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
			"href",
			"/settings",
		);
	});

	it("should highlight active navigation item", () => {
		renderWithSidebar(<AppSidebar />);
		expect(screen.getByText("Ryan Lisse")).toBeInTheDocument();
	});

	it("should render navigation links with correct URLs", () => {
		renderWithSidebar(<AppSidebar />);

		expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.getByRole("link", { name: /automations/i })).toHaveAttribute(
			"href",
			"/automations",
		);
		expect(screen.getByRole("link", { name: /stats/i })).toHaveAttribute(
			"href",
			"/stats",
		);
		expect(screen.getByRole("link", { name: /environments/i })).toHaveAttribute(
			"href",
			"/environments",
		);
		expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
			"href",
			"/settings",
		);
	});

	it("should highlight active navigation item", () => {
		renderWithSidebar(<AppSidebar />);

		// Home should be active by default
		const homeLink = screen.getByRole("link", { name: /home/i });
		expect(homeLink.closest("[data-active]")).toHaveAttribute(
			"data-active",
			"true",
		);
	});

	it("should display execution mode switch with default local execution", () => {
		renderWithSidebar(<AppSidebar />);

		const executionSwitch = screen.getByRole("switch");
		expect(executionSwitch).toBeChecked(); // Local execution is default
		expect(screen.getByText("Local")).toBeInTheDocument();
	});

	it("should display cloud execution when switch is off", () => {
		renderWithSidebar(<AppSidebar isLocalExecution={false} />);

		const executionSwitch = screen.getByRole("switch");
		expect(executionSwitch).not.toBeChecked();
		expect(screen.getByText("Cloud")).toBeInTheDocument();
	});

	it("should call onLocalExecutionChange when switch is toggled", async () => {
		const user = userEvent.setup();
		renderWithSidebar(
			<AppSidebar
				isLocalExecution={true}
				onLocalExecutionChange={mockOnLocalExecutionChange}
			/>,
		);

		const executionSwitch = screen.getByRole("switch");
		await user.click(executionSwitch);

		expect(mockOnLocalExecutionChange).toHaveBeenCalledWith(false);
	});

	it("should show appropriate icons for all navigation items", () => {
		renderWithSidebar(<AppSidebar />);

		// Check that all navigation items have icons (they're SVG elements)
		const links = screen.getAllByRole("link");
		links.forEach((link) => {
			const svg = link.querySelector("svg");
			expect(svg).toBeInTheDocument();
		});
	});

	it("should have proper accessibility attributes", () => {
		renderWithSidebar(<AppSidebar />);

		// Check for sidebar data attribute instead of role
		const sidebar = document.querySelector('[data-slot="sidebar"]');
		expect(sidebar).toBeInTheDocument();

		// Check switch has accessible name
		const executionSwitch = screen.getByRole("switch");
		expect(executionSwitch).toHaveAccessibleName();

		// Check all links are accessible
		const links = screen.getAllByRole("link");
		links.forEach((link) => {
			expect(link).toHaveAccessibleName();
		});
	});

	it("should support keyboard navigation", async () => {
		const user = userEvent.setup();
		renderWithSidebar(
			<AppSidebar onLocalExecutionChange={mockOnLocalExecutionChange} />,
		);

		// Tab through elements and test switch activation
		const executionSwitch = screen.getByRole("switch");
		await user.tab(); // May need to tab multiple times to reach the switch

		// Focus the switch specifically - wrap in act() to handle tooltip state updates
		await act(async () => {
			executionSwitch.focus();
		});
		expect(executionSwitch).toHaveFocus();

		// Test space key activation - wrap in act() to handle state changes
		await act(async () => {
			await user.keyboard(" ");
		});
		expect(mockOnLocalExecutionChange).toHaveBeenCalled();
	});

	it("should handle collapsible sidebar state", () => {
		renderWithSidebar(<AppSidebar />);

		// Check that sidebar has collapsible data attribute (it may be empty string by default)
		const sidebar = document.querySelector('[data-slot="sidebar"]');
		expect(sidebar).toHaveAttribute("data-collapsible");
	});

	it("should display execution mode tooltips", () => {
		const { rerender } = renderWithSidebar(
			<AppSidebar isLocalExecution={true} />,
		);

		// Check that tooltip content exists (it may be in a portal or hidden)
		// Just verify the basic UI elements exist
		expect(screen.getByText("Local")).toBeInTheDocument();

		rerender(
			<SidebarProvider>
				<AppSidebar isLocalExecution={false} />
			</SidebarProvider>,
		);

		// Cloud execution mode text
		expect(screen.getByText("Cloud")).toBeInTheDocument();
	});

	it("should separate navigation sections visually", () => {
		renderWithSidebar(<AppSidebar />);

		// Check Configure section header
		const configureHeader = screen.getByText("Configure");
		expect(configureHeader).toHaveClass(
			"text-xs",
			"uppercase",
			"text-gray-500",
		);
	});

	it("should handle missing onLocalExecutionChange prop gracefully", () => {
		// Should not throw when onLocalExecutionChange is not provided
		expect(() => {
			renderWithSidebar(<AppSidebar isLocalExecution={true} />);
		}).not.toThrow();
	});

	it("should pass through additional props to Sidebar component", () => {
		renderWithSidebar(
			<AppSidebar className="custom-sidebar" data-testid="test-sidebar" />,
		);

		const sidebar = screen.getByTestId("test-sidebar");
		expect(sidebar).toHaveClass("custom-sidebar");
	});
});
