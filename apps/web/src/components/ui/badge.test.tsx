import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
	it("should render badge with default variant", () => {
		render(<Badge>Default badge</Badge>);

		const badge = screen.getByText("Default badge");
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveClass(
			"inline-flex",
			"items-center",
			"rounded-full",
			"border",
			"px-2.5",
			"py-0.5",
			"font-semibold",
			"text-xs",
			"transition-colors",
			"border-transparent",
			"bg-primary",
			"text-primary-foreground",
		);
	});

	it("should render badge with secondary variant", () => {
		render(<Badge variant="secondary">Secondary badge</Badge>);

		const badge = screen.getByText("Secondary badge");
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveClass(
			"border-transparent",
			"bg-secondary",
			"text-secondary-foreground",
		);
	});

	it("should render badge with destructive variant", () => {
		render(<Badge variant="destructive">Destructive badge</Badge>);

		const badge = screen.getByText("Destructive badge");
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveClass(
			"border-transparent",
			"bg-destructive",
			"text-destructive-foreground",
		);
	});

	it("should render badge with outline variant", () => {
		render(<Badge variant="outline">Outline badge</Badge>);

		const badge = screen.getByText("Outline badge");
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveClass("text-foreground");
		expect(badge).not.toHaveClass("border-transparent");
	});

	it("should apply custom className", () => {
		render(<Badge className="custom-badge">Custom badge</Badge>);

		const badge = screen.getByText("Custom badge");
		expect(badge).toHaveClass("custom-badge");
	});

	it("should spread additional props", () => {
		render(
			<Badge data-testid="custom-badge" aria-label="Custom badge">
				Badge
			</Badge>,
		);

		const badge = screen.getByTestId("custom-badge");
		expect(badge).toHaveAttribute("aria-label", "Custom badge");
	});

	it("should render with custom content", () => {
		render(<Badge>🔥 Hot</Badge>);

		const badge = screen.getByText("🔥 Hot");
		expect(badge).toBeInTheDocument();
	});

	it("should have proper focus styles", () => {
		render(<Badge tabIndex={0}>Focusable badge</Badge>);

		const badge = screen.getByText("Focusable badge");
		expect(badge).toHaveClass(
			"focus:outline-none",
			"focus:ring-2",
			"focus:ring-ring",
			"focus:ring-offset-2",
		);
	});

	it("should handle empty content", () => {
		render(<Badge data-testid="empty-badge" />);

		const badge = screen.getByTestId("empty-badge");
		expect(badge).toBeInTheDocument();
		expect(badge).toBeEmptyDOMElement();
	});

	it("should render with multiple children", () => {
		render(
			<Badge>
				<span>Status:</span> Active
			</Badge>,
		);

		expect(screen.getByText("Status:")).toBeInTheDocument();
		expect(screen.getByText("Active")).toBeInTheDocument();
	});
});
