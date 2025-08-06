import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Separator } from "./separator";

describe("Separator Component", () => {
	const BasicSeparator = ({
		orientation = "horizontal" as const,
		decorative = true,
		...props
	}: {
		orientation?: "horizontal" | "vertical";
		decorative?: boolean;
		[key: string]: unknown;
	}) => (
		<Separator
			orientation={orientation}
			decorative={decorative}
			data-testid="separator"
			{...props}
		/>
	);

	describe("Separator Root", () => {
		it("should render separator with correct attributes", () => {
			render(<BasicSeparator />);

			const separator = screen.getByTestId("separator");
			expect(separator).toBeInTheDocument();
			expect(separator).toHaveAttribute("data-slot", "separator");
		});

		it("should apply default styling classes for horizontal orientation", () => {
			render(<BasicSeparator orientation="horizontal" />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveClass("shrink-0", "bg-border");
			expect(separator).toHaveAttribute("data-orientation", "horizontal");
		});

		it("should apply correct styling classes for vertical orientation", () => {
			render(<BasicSeparator orientation="vertical" />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveClass("shrink-0", "bg-border");
			expect(separator).toHaveAttribute("data-orientation", "vertical");
		});

		it("should allow custom className", () => {
			render(<BasicSeparator className="custom-separator" />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveClass("custom-separator");
		});

		it("should default to horizontal orientation", () => {
			render(<Separator data-testid="separator" />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveAttribute("data-orientation", "horizontal");
		});
	});

	describe("Accessibility", () => {
		it("should be decorative by default (removed from semantic tree)", () => {
			render(<BasicSeparator />);

			const separator = screen.getByTestId("separator");
			// When decorative=true, Radix UI uses role="none" to remove semantic meaning
			expect(separator).toHaveAttribute("role", "none");
			expect(separator).not.toHaveAttribute("aria-hidden");
		});

		it("should have proper ARIA attributes when not decorative", () => {
			render(<BasicSeparator decorative={false} />);

			const separator = screen.getByTestId("separator");
			// When decorative=false, Radix UI adds role="separator"
			expect(separator).toHaveAttribute("role", "separator");
			expect(separator).not.toHaveAttribute("aria-hidden");
		});

		it("should have proper aria-orientation for vertical when not decorative", () => {
			render(<BasicSeparator decorative={false} orientation="vertical" />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveAttribute("role", "separator");
			expect(separator).toHaveAttribute("aria-orientation", "vertical");
		});

		it("should not add aria-orientation for horizontal when not decorative", () => {
			render(<BasicSeparator decorative={false} orientation="horizontal" />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveAttribute("role", "separator");
			// Horizontal is the default orientation, so aria-orientation is not needed
			expect(separator).not.toHaveAttribute("aria-orientation");
		});

		it("should be found by role when not decorative", () => {
			render(<BasicSeparator decorative={false} />);

			const separator = screen.getByRole("separator");
			expect(separator).toBeInTheDocument();
		});

		it("should not be found by role when decorative", () => {
			render(<BasicSeparator decorative={true} />);

			// Should not be found by role when decorative (uses role="none")
			const separator = screen.queryByRole("separator");
			expect(separator).not.toBeInTheDocument();

			// But should still be found by test id
			const separatorByTestId = screen.getByTestId("separator");
			expect(separatorByTestId).toBeInTheDocument();
			expect(separatorByTestId).toHaveAttribute("role", "none");
		});
	});

	describe("Orientation Handling", () => {
		it("should handle horizontal orientation styling", () => {
			render(<BasicSeparator orientation="horizontal" />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveAttribute("data-orientation", "horizontal");
			// CSS data attributes are applied via Tailwind classes
			expect(separator).toHaveClass("shrink-0", "bg-border");
		});

		it("should handle vertical orientation styling", () => {
			render(<BasicSeparator orientation="vertical" />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveAttribute("data-orientation", "vertical");
			expect(separator).toHaveClass("shrink-0", "bg-border");
		});

		it("should pass through all props", () => {
			render(<BasicSeparator id="test-separator" title="Visual separator" />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveAttribute("id", "test-separator");
			expect(separator).toHaveAttribute("title", "Visual separator");
		});
	});

	describe("States and Behavior", () => {
		it("should work with different orientations", () => {
			const orientations = ["horizontal", "vertical"] as const;

			orientations.forEach((orientation) => {
				const { rerender } = render(
					<BasicSeparator orientation={orientation} />,
				);

				const separator = screen.getByTestId("separator");
				expect(separator).toHaveAttribute("data-orientation", orientation);

				if (orientation !== orientations[orientations.length - 1]) {
					rerender(<div />); // Clear for next iteration
				}
			});
		});

		it("should handle decorative mode changes", () => {
			const { rerender } = render(<BasicSeparator decorative={true} />);

			let separator = screen.getByTestId("separator");
			expect(separator).toHaveAttribute("role", "none");

			rerender(<BasicSeparator decorative={false} />);

			separator = screen.getByTestId("separator");
			expect(separator).toHaveAttribute("role", "separator");
		});

		it("should maintain styling consistency", () => {
			render(<BasicSeparator />);

			const separator = screen.getByTestId("separator");
			expect(separator).toHaveClass("shrink-0", "bg-border");
		});
	});

	describe("Integration", () => {
		it("should work as a visual divider", () => {
			render(
				<div>
					<div>Content above</div>
					<BasicSeparator />
					<div>Content below</div>
				</div>,
			);

			const separator = screen.getByTestId("separator");
			expect(separator).toBeInTheDocument();
			expect(separator).toHaveAttribute("role", "none");
		});

		it("should work as a semantic separator", () => {
			render(
				<div>
					<section>Section 1</section>
					<BasicSeparator decorative={false} />
					<section>Section 2</section>
				</div>,
			);

			const separator = screen.getByRole("separator");
			expect(separator).toBeInTheDocument();
			expect(separator).not.toHaveAttribute("aria-hidden");
		});
	});
});
