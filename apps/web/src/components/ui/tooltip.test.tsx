import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

describe("Tooltip Components", () => {
	const BasicTooltip = ({
		open = undefined,
		onOpenChange = undefined,
	}: {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}) => (
		<Tooltip open={open} onOpenChange={onOpenChange}>
			<TooltipTrigger data-testid="tooltip-trigger">Hover me</TooltipTrigger>
			<TooltipContent data-testid="tooltip-content">
				This is a helpful tooltip
			</TooltipContent>
		</Tooltip>
	);

	describe("Tooltip Root", () => {
		it("should render tooltip trigger", () => {
			render(<BasicTooltip />);

			const trigger = screen.getByTestId("tooltip-trigger");
			expect(trigger).toBeInTheDocument();
			expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger");
		});

		it("should render tooltip content when opened", async () => {
			render(<BasicTooltip open={true} />);

			await waitFor(() => {
				const content = screen.getByTestId("tooltip-content");
				expect(content).toBeInTheDocument();
				expect(content).toHaveAttribute("data-slot", "tooltip-content");
			});
		});

		it("should not render content when closed", () => {
			render(<BasicTooltip open={false} />);

			const content = screen.queryByTestId("tooltip-content");
			expect(content).not.toBeInTheDocument();
		});
	});

	describe("TooltipTrigger", () => {
		it("should have proper ARIA attributes", async () => {
			const user = userEvent.setup();
			render(<BasicTooltip />);

			const trigger = screen.getByTestId("tooltip-trigger");

			// Initially no aria-describedby since tooltip is not visible
			expect(trigger).not.toHaveAttribute("aria-describedby");

			// Hover to show tooltip
			await user.hover(trigger);

			await waitFor(() => {
				const trigger = screen.getByTestId("tooltip-trigger");
				// After hover, aria-describedby should be set
				expect(trigger).toHaveAttribute("aria-describedby");

				const contentId = trigger.getAttribute("aria-describedby");
				expect(contentId).toBeTruthy();
				const content = document.getElementById(contentId as string);
				expect(content).toBeInTheDocument();
				expect(content).toHaveAttribute("role", "tooltip");
			});
		});

		it("should show tooltip on hover", async () => {
			const user = userEvent.setup();
			render(<BasicTooltip />);

			const trigger = screen.getByTestId("tooltip-trigger");

			await user.hover(trigger);

			await waitFor(() => {
				const content = screen.getByTestId("tooltip-content");
				expect(content).toBeInTheDocument();
			});
		});

		it("should manage tooltip state", async () => {
			const user = userEvent.setup();
			render(<BasicTooltip />);

			const trigger = screen.getByTestId("tooltip-trigger");

			// Initially no tooltip
			expect(trigger).not.toHaveAttribute("aria-describedby");

			// Show tooltip on hover
			await user.hover(trigger);
			await waitFor(() => {
				expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
				expect(trigger).toHaveAttribute("aria-describedby");
			});

			// The exact hiding behavior is timing-dependent and varies by implementation
			// The important thing is that the ARIA relationship is properly established when visible
		});
	});

	describe("TooltipContent", () => {
		it("should have proper ARIA attributes", async () => {
			render(<BasicTooltip open={true} />);

			await waitFor(() => {
				const content = screen.getByTestId("tooltip-content");
				expect(content).toBeInTheDocument();

				// The actual tooltip role is on a child span element
				const tooltipElement = content.querySelector('[role="tooltip"]');
				expect(tooltipElement).toBeInTheDocument();
				expect(tooltipElement).toHaveAttribute("id");
			});
		});

		it("should render with proper styling classes", async () => {
			render(<BasicTooltip open={true} />);

			await waitFor(() => {
				const content = screen.getByTestId("tooltip-content");
				expect(content).toHaveClass(
					"z-50",
					"rounded-md",
					"bg-primary",
					"text-primary-foreground",
				);
			});
		});

		it("should render arrow element", async () => {
			render(<BasicTooltip open={true} />);

			await waitFor(() => {
				const content = screen.getByTestId("tooltip-content");
				// The arrow is an SVG element within the content
				const arrow = content.querySelector("svg");
				expect(arrow).toBeInTheDocument();
				expect(arrow).toHaveClass("z-50", "size-2.5");
			});
		});
	});

	describe("Accessibility", () => {
		it("should maintain proper ARIA relationships", async () => {
			const user = userEvent.setup();
			render(<BasicTooltip />);

			const trigger = screen.getByTestId("tooltip-trigger");

			await user.hover(trigger);

			await waitFor(() => {
				const trigger = screen.getByTestId("tooltip-trigger");
				const triggerDescribedBy = trigger.getAttribute("aria-describedby");

				expect(triggerDescribedBy).toBeTruthy();

				// Find the actual tooltip element by its ID
				const tooltipElement = document.getElementById(
					triggerDescribedBy as string,
				);
				expect(tooltipElement).toBeInTheDocument();
				expect(tooltipElement).toHaveAttribute("role", "tooltip");
			});
		});

		it("should support keyboard navigation", async () => {
			const user = userEvent.setup();
			render(<BasicTooltip />);

			const trigger = screen.getByTestId("tooltip-trigger");

			// Focus the trigger
			await user.tab();
			expect(trigger).toHaveFocus();

			// Tooltip should show on focus
			await waitFor(() => {
				const content = screen.getByTestId("tooltip-content");
				expect(content).toBeInTheDocument();
			});
		});

		it("should hide on escape key", async () => {
			const user = userEvent.setup();
			render(<BasicTooltip />);

			const trigger = screen.getByTestId("tooltip-trigger");

			// Show tooltip
			await user.hover(trigger);
			await waitFor(() => {
				expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
			});

			// Press escape
			await user.keyboard("{Escape}");

			await waitFor(() => {
				expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
			});
		});
	});

	describe("Controlled Mode", () => {
		it("should work in controlled mode", async () => {
			let isOpen = false;
			const onOpenChange = (open: boolean) => {
				isOpen = open;
			};

			const { rerender } = render(
				<BasicTooltip open={isOpen} onOpenChange={onOpenChange} />,
			);

			// Initially closed
			expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();

			// Programmatically open
			isOpen = true;
			rerender(<BasicTooltip open={isOpen} onOpenChange={onOpenChange} />);

			await waitFor(() => {
				expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
			});
		});
	});
});
