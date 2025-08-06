import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpenCodeIcon } from "./opencode-icon";

describe("OpenCodeIcon Component", () => {
	const BasicIcon = ({
		size = 24,
		className,
		ariaLabel,
	}: {
		size?: number;
		className?: string;
		ariaLabel?: string;
	}) => (
		<OpenCodeIcon
			size={size}
			className={className}
			ariaLabel={ariaLabel}
			data-testid="opencode-icon"
		/>
	);

	describe("OpenCodeIcon Root", () => {
		it("should render icon with correct attributes", () => {
			render(<BasicIcon />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toBeInTheDocument();
			expect(icon.tagName.toLowerCase()).toBe("svg");
		});

		it("should have default size of 24px", () => {
			render(<BasicIcon />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("width", "24");
			expect(icon).toHaveAttribute("height", "24");
		});

		it("should accept custom size", () => {
			render(<BasicIcon size={48} />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("width", "48");
			expect(icon).toHaveAttribute("height", "48");
		});

		it("should apply custom className", () => {
			render(<BasicIcon className="custom-icon-class" />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveClass("custom-icon-class");
		});

		it("should have correct viewBox", () => {
			render(<BasicIcon />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("viewBox", "0 0 600 600");
		});

		it("should have proper SVG attributes", () => {
			render(<BasicIcon />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("fill", "none");
			expect(icon).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA attributes", () => {
			render(<BasicIcon />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("role", "img");
			expect(icon).toHaveAttribute("aria-label", "OpenCode logo");
		});

		it("should allow custom aria-label", () => {
			render(<BasicIcon ariaLabel="Custom OpenCode icon" />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("role", "img");
			expect(icon).toHaveAttribute("aria-label", "Custom OpenCode icon");
		});

		it("should be accessible by role", () => {
			render(<BasicIcon />);

			const icon = screen.getByRole("img");
			expect(icon).toBeInTheDocument();
		});

		it("should be accessible by accessible name", () => {
			render(<BasicIcon />);

			const icon = screen.getByRole("img", { name: "OpenCode logo" });
			expect(icon).toBeInTheDocument();
		});

		it("should be accessible with custom aria-label", () => {
			render(<BasicIcon ariaLabel="OpenCode brand icon" />);

			const icon = screen.getByRole("img", { name: "OpenCode brand icon" });
			expect(icon).toBeInTheDocument();
		});

		it("should have title element for additional accessibility", () => {
			render(<BasicIcon />);

			const icon = screen.getByTestId("opencode-icon");
			const titleElement = icon.querySelector("title");
			expect(titleElement).toBeInTheDocument();
			expect(titleElement).toHaveTextContent("OpenCode logo");
		});

		it("should work with screen readers", () => {
			render(<BasicIcon ariaLabel="OpenCode company logo" />);

			// Should be found by both role and accessible name
			const iconByRole = screen.getByRole("img");
			const iconByName = screen.getByRole("img", {
				name: "OpenCode company logo",
			});

			expect(iconByRole).toBeInTheDocument();
			expect(iconByName).toBeInTheDocument();
			expect(iconByRole).toBe(iconByName);
		});
	});

	describe("Visual Content", () => {
		it("should contain the expected SVG paths", () => {
			render(<BasicIcon />);

			const icon = screen.getByTestId("opencode-icon");

			// Should have background rect
			const backgroundRect = icon.querySelector("rect");
			expect(backgroundRect).toBeInTheDocument();
			expect(backgroundRect).toHaveAttribute("width", "600");
			expect(backgroundRect).toHaveAttribute("height", "600");
			expect(backgroundRect).toHaveAttribute("fill", "black");

			// Should have the logo paths
			const paths = icon.querySelectorAll("path");
			expect(paths).toHaveLength(2);

			// Both paths should be white
			paths.forEach((path) => {
				expect(path).toHaveAttribute("fill", "white");
			});
		});

		it("should maintain aspect ratio", () => {
			render(<BasicIcon size={100} />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("width", "100");
			expect(icon).toHaveAttribute("height", "100");
			expect(icon).toHaveAttribute("viewBox", "0 0 600 600");
		});
	});

	describe("Props Handling", () => {
		it("should handle different sizes", () => {
			const sizes = [16, 24, 32, 48, 64];

			sizes.forEach((size) => {
				const { rerender } = render(<BasicIcon size={size} />);

				const icon = screen.getByTestId("opencode-icon");
				expect(icon).toHaveAttribute("width", size.toString());
				expect(icon).toHaveAttribute("height", size.toString());

				if (size !== sizes[sizes.length - 1]) {
					rerender(<div />); // Clear for next iteration
				}
			});
		});

		it("should handle className combinations", () => {
			render(<BasicIcon className="text-blue-500 hover:text-blue-600" />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveClass("text-blue-500", "hover:text-blue-600");
		});

		it("should work without optional props", () => {
			render(<OpenCodeIcon data-testid="minimal-icon" />);

			const icon = screen.getByTestId("minimal-icon");
			expect(icon).toBeInTheDocument();
			expect(icon).toHaveAttribute("width", "24");
			expect(icon).toHaveAttribute("height", "24");
			expect(icon).toHaveAttribute("aria-label", "OpenCode logo");
		});
	});

	describe("Integration", () => {
		it("should work in different contexts", () => {
			render(
				<div>
					<button type="button">
						<BasicIcon size={16} ariaLabel="OpenCode menu icon" />
						Menu
					</button>
					<h1>
						<BasicIcon size={32} ariaLabel="OpenCode brand logo" />
						OpenCode
					</h1>
				</div>,
			);

			const menuIcon = screen.getByRole("img", { name: "OpenCode menu icon" });
			const brandLogo = screen.getByRole("img", {
				name: "OpenCode brand logo",
			});

			expect(menuIcon).toHaveAttribute("width", "16");
			expect(brandLogo).toHaveAttribute("width", "32");
		});

		it("should maintain accessibility when styled", () => {
			render(
				<BasicIcon
					className="h-8 w-8 fill-current text-primary"
					ariaLabel="Styled OpenCode logo"
				/>,
			);

			const icon = screen.getByRole("img", { name: "Styled OpenCode logo" });
			expect(icon).toBeInTheDocument();
			expect(icon).toHaveClass("w-8", "h-8", "text-primary", "fill-current");
		});
	});

	describe("Edge Cases", () => {
		it("should handle zero size gracefully", () => {
			render(<BasicIcon size={0} />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("width", "0");
			expect(icon).toHaveAttribute("height", "0");
		});

		it("should handle very large sizes", () => {
			render(<BasicIcon size={1000} />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("width", "1000");
			expect(icon).toHaveAttribute("height", "1000");
		});

		it("should handle empty className", () => {
			render(<BasicIcon className="" />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("class", "");
		});

		it("should handle empty aria-label", () => {
			render(<BasicIcon ariaLabel="" />);

			const icon = screen.getByTestId("opencode-icon");
			expect(icon).toHaveAttribute("aria-label", "");
			expect(icon).toHaveAttribute("role", "img");
		});
	});
});
