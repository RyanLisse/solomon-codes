import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button Component", () => {
	it("should render button with correct text", () => {
		render(<Button>Click me</Button>);
		expect(
			screen.getByRole("button", { name: "Click me" }),
		).toBeInTheDocument();
	});

	it("should apply variant classes correctly", () => {
		render(<Button variant="destructive">Delete</Button>);
		const button = screen.getByRole("button");
		expect(button).toHaveClass("bg-destructive");
	});

	it("should apply size classes correctly", () => {
		render(<Button size="lg">Large Button</Button>);
		const button = screen.getByRole("button");
		expect(button).toHaveClass("h-10");
	});

	it("should handle click events", async () => {
		const user = userEvent.setup();
		const handleClick = vi.fn();

		render(<Button onClick={handleClick}>Click me</Button>);

		await user.click(screen.getByRole("button"));
		expect(handleClick).toHaveBeenCalledOnce();
	});

	it("should be disabled when disabled prop is true", () => {
		render(<Button disabled>Disabled Button</Button>);
		const button = screen.getByRole("button");
		expect(button).toBeDisabled();
	});

	it("should apply custom className", () => {
		render(<Button className="custom-class">Button</Button>);
		const button = screen.getByRole("button");
		expect(button).toHaveClass("custom-class");
	});

	it("should render as child component when asChild is true", () => {
		render(
			<Button asChild>
				<a href="/test">Link Button</a>
			</Button>,
		);
		const link = screen.getByRole("link");
		expect(link).toBeInTheDocument();
		expect(link).toHaveTextContent("Link Button");
		expect(link).toHaveAttribute("href", "/test");
	});
});
