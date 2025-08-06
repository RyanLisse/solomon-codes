import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "./collapsible";

describe("Collapsible Components", () => {
	const BasicCollapsible = ({
		open = undefined,
		onOpenChange = vi.fn(),
		defaultOpen = false,
	}: {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		defaultOpen?: boolean;
	}) => (
		<Collapsible
			open={open}
			onOpenChange={onOpenChange}
			defaultOpen={defaultOpen}
		>
			<CollapsibleTrigger data-testid="collapsible-trigger">
				Toggle Content
			</CollapsibleTrigger>
			<CollapsibleContent data-testid="collapsible-content">
				<div className="p-4">
					This is the collapsible content that can be shown or hidden.
				</div>
			</CollapsibleContent>
		</Collapsible>
	);

	describe("Collapsible Root", () => {
		it("should render collapsible with correct attributes", () => {
			render(<BasicCollapsible />);

			const trigger = screen.getByTestId("collapsible-trigger");
			const collapsible = trigger.closest('[data-slot="collapsible"]');

			expect(collapsible).toBeInTheDocument();
			expect(collapsible).toHaveAttribute("data-slot", "collapsible");
		});

		it("should handle controlled state", async () => {
			const user = userEvent.setup();
			const onOpenChange = vi.fn();

			render(<BasicCollapsible open={false} onOpenChange={onOpenChange} />);

			// Content should be hidden when open={false}
			const content = screen.queryByTestId("collapsible-content");
			expect(content).toBeInTheDocument();
			expect(content).toHaveAttribute("hidden");
			expect(content).toHaveAttribute("data-state", "closed");

			// Clicking trigger should call onOpenChange
			await user.click(screen.getByTestId("collapsible-trigger"));
			expect(onOpenChange).toHaveBeenCalledWith(true);
		});

		it("should work as uncontrolled component", async () => {
			const user = userEvent.setup();

			render(<BasicCollapsible />);

			// Content should be hidden initially
			const content = screen.queryByTestId("collapsible-content");
			expect(content).toBeInTheDocument();
			expect(content).toHaveAttribute("hidden");
			expect(content).toHaveAttribute("data-state", "closed");

			// Click trigger to open
			await user.click(screen.getByTestId("collapsible-trigger"));

			await waitFor(() => {
				const openContent = screen.getByTestId("collapsible-content");
				expect(openContent).not.toHaveAttribute("hidden");
				expect(openContent).toHaveAttribute("data-state", "open");
			});
		});

		it("should handle defaultOpen prop", () => {
			render(<BasicCollapsible defaultOpen={true} />);

			// Content should be visible when defaultOpen={true}
			const content = screen.getByTestId("collapsible-content");
			expect(content).toBeInTheDocument();
			expect(content).not.toHaveAttribute("hidden");
			expect(content).toHaveAttribute("data-state", "open");
		});
	});

	describe("CollapsibleTrigger", () => {
		it("should render trigger with correct attributes", () => {
			render(<BasicCollapsible />);

			const trigger = screen.getByTestId("collapsible-trigger");
			expect(trigger).toBeInTheDocument();
			expect(trigger).toHaveAttribute("data-slot", "collapsible-trigger");
			expect(trigger).toHaveTextContent("Toggle Content");
		});

		it("should have correct ARIA attributes", () => {
			render(<BasicCollapsible />);

			const trigger = screen.getByTestId("collapsible-trigger");
			// Radix UI CollapsibleTrigger renders as a proper button element by default
			expect(trigger.tagName.toLowerCase()).toBe("button");
			expect(trigger).toHaveAttribute("aria-controls");
			expect(trigger).toHaveAttribute("aria-expanded", "false");
			expect(trigger).toHaveAttribute("data-state", "closed");
		});
	});

	describe("CollapsibleContent", () => {
		it("should not render content initially when closed", () => {
			render(<BasicCollapsible />);

			const content = screen.queryByTestId("collapsible-content");
			expect(content).toBeInTheDocument();
			expect(content).toHaveAttribute("hidden");
			expect(content).toHaveAttribute("data-state", "closed");
		});

		it("should have correct ARIA attributes", async () => {
			const user = userEvent.setup();

			render(<BasicCollapsible />);

			const trigger = screen.getByTestId("collapsible-trigger");
			await user.click(trigger);

			await waitFor(() => {
				const content = screen.getByTestId("collapsible-content");
				const contentId = content.getAttribute("id");

				expect(content).toHaveAttribute("role", "region");
				expect(trigger).toHaveAttribute("aria-controls", contentId);
				// Note: aria-labelledby is not automatically set by Radix UI for collapsible
				// The trigger controls the content via aria-controls
			});
		});

		it("should animate content visibility", async () => {
			const user = userEvent.setup();

			render(<BasicCollapsible />);

			const trigger = screen.getByTestId("collapsible-trigger");

			// Open
			await user.click(trigger);
			await waitFor(() => {
				const content = screen.getByTestId("collapsible-content");
				expect(content).toHaveAttribute("data-state", "open");
				expect(content).not.toHaveAttribute("hidden");
			});

			// Close
			await user.click(trigger);
			await waitFor(() => {
				const closedContent = screen.getByTestId("collapsible-content");
				expect(closedContent).toHaveAttribute("hidden");
				expect(closedContent).toHaveAttribute("data-state", "closed");
			});
		});
	});

	describe("State Management", () => {
		it("should toggle between open and closed states", async () => {
			const user = userEvent.setup();

			render(<BasicCollapsible />);

			const trigger = screen.getByTestId("collapsible-trigger");

			// Initially closed
			expect(trigger).toHaveAttribute("aria-expanded", "false");
			const closedContent = screen.getByTestId("collapsible-content");
			expect(closedContent).toHaveAttribute("hidden");
			expect(closedContent).toHaveAttribute("data-state", "closed");

			// Open
			await user.click(trigger);
			await waitFor(() => {
				expect(trigger).toHaveAttribute("aria-expanded", "true");
				const openContent = screen.getByTestId("collapsible-content");
				expect(openContent).not.toHaveAttribute("hidden");
				expect(openContent).toHaveAttribute("data-state", "open");
			});

			// Close
			await user.click(trigger);
			await waitFor(() => {
				expect(trigger).toHaveAttribute("aria-expanded", "false");
				const closedContent = screen.getByTestId("collapsible-content");
				expect(closedContent).toHaveAttribute("hidden");
				expect(closedContent).toHaveAttribute("data-state", "closed");
			});
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA relationships", async () => {
			const user = userEvent.setup();

			render(<BasicCollapsible />);

			const trigger = screen.getByTestId("collapsible-trigger");
			await user.click(trigger);

			await waitFor(() => {
				const content = screen.getByTestId("collapsible-content");
				const contentId = content.getAttribute("id");

				expect(trigger).toHaveAttribute("aria-controls", contentId);
				// Note: Radix UI Collapsible doesn't automatically set aria-labelledby
				// The relationship is maintained through aria-controls from trigger to content
			});
		});

		it("should support screen reader navigation", async () => {
			const user = userEvent.setup();

			render(<BasicCollapsible />);

			const trigger = screen.getByTestId("collapsible-trigger");

			// Should be announced as a button (proper HTML button element)
			expect(trigger.tagName.toLowerCase()).toBe("button");

			await user.click(trigger);

			await waitFor(() => {
				const content = screen.getByTestId("collapsible-content");
				expect(content).toHaveAttribute("role", "region");
			});
		});
	});
});
