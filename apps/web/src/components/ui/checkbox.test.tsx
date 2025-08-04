import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
	it("should render checkbox", () => {
		render(<Checkbox />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toBeInTheDocument();
		expect(checkbox).toHaveAttribute("data-slot", "checkbox");
	});

	it("should be unchecked by default", () => {
		render(<Checkbox />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).not.toBeChecked();
		expect(checkbox).toHaveAttribute("data-state", "unchecked");
	});

	it("should be checked when checked prop is true", () => {
		render(<Checkbox checked />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toBeChecked();
		expect(checkbox).toHaveAttribute("data-state", "checked");
	});

	it("should handle controlled state", async () => {
		const user = userEvent.setup();
		const onCheckedChange = vi.fn();

		render(<Checkbox checked={false} onCheckedChange={onCheckedChange} />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).not.toBeChecked();

		await user.click(checkbox);
		expect(onCheckedChange).toHaveBeenCalledWith(true);
	});

	it("should handle uncontrolled state", async () => {
		const user = userEvent.setup();
		const onCheckedChange = vi.fn();

		render(<Checkbox onCheckedChange={onCheckedChange} />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).not.toBeChecked();

		await user.click(checkbox);
		expect(onCheckedChange).toHaveBeenCalledWith(true);
		expect(checkbox).toBeChecked();
	});

	it("should be disabled when disabled prop is true", () => {
		render(<Checkbox disabled />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toBeDisabled();
		expect(checkbox).toHaveClass(
			"disabled:cursor-not-allowed",
			"disabled:opacity-50",
		);
	});

	it("should not respond to clicks when disabled", async () => {
		const user = userEvent.setup();
		const onCheckedChange = vi.fn();

		render(<Checkbox disabled onCheckedChange={onCheckedChange} />);

		const checkbox = screen.getByRole("checkbox");
		await user.click(checkbox);

		expect(onCheckedChange).not.toHaveBeenCalled();
		expect(checkbox).not.toBeChecked();
	});

	it("should apply custom className", () => {
		render(<Checkbox className="custom-checkbox" />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toHaveClass("custom-checkbox");
	});

	it("should spread additional props", () => {
		render(
			<Checkbox data-testid="custom-checkbox" aria-label="Custom checkbox" />,
		);

		const checkbox = screen.getByTestId("custom-checkbox");
		expect(checkbox).toHaveAttribute("aria-label", "Custom checkbox");
	});

	it("should have proper focus styles", () => {
		render(<Checkbox />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toHaveClass(
			"focus-visible:border-ring",
			"focus-visible:ring-[3px]",
			"focus-visible:ring-ring/50",
		);
	});

	it("should show check indicator when checked", () => {
		render(<Checkbox checked />);

		const indicator = screen
			.getByRole("checkbox")
			.querySelector('[data-slot="checkbox-indicator"]');
		expect(indicator).toBeInTheDocument();
		expect(indicator).toHaveClass("flex", "items-center", "justify-center");
	});

	it("should support keyboard navigation", async () => {
		const user = userEvent.setup();
		const onCheckedChange = vi.fn();

		render(<Checkbox onCheckedChange={onCheckedChange} />);

		const checkbox = screen.getByRole("checkbox");
		checkbox.focus();

		await user.keyboard(" ");
		expect(onCheckedChange).toHaveBeenCalledWith(true);
	});

	it("should have proper ARIA attributes", () => {
		render(<Checkbox aria-describedby="help-text" />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toHaveAttribute("aria-describedby", "help-text");
	});

	it("should handle invalid state", () => {
		render(<Checkbox aria-invalid />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toHaveClass(
			"aria-invalid:border-destructive",
			"aria-invalid:ring-destructive/20",
		);
	});
});
