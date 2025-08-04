import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Label } from "./label";

describe("Label", () => {
	it("should render label", () => {
		render(<Label>Label text</Label>);

		const label = screen.getByText("Label text");
		expect(label).toBeInTheDocument();
		expect(label).toHaveAttribute("data-slot", "label");
	});

	it("should have proper default classes", () => {
		render(<Label>Label text</Label>);

		const label = screen.getByText("Label text");
		expect(label).toHaveClass(
			"flex",
			"select-none",
			"items-center",
			"gap-2",
			"font-medium",
			"text-sm",
			"leading-none",
		);
	});

	it("should apply custom className", () => {
		render(<Label className="custom-label">Custom label</Label>);

		const label = screen.getByText("Custom label");
		expect(label).toHaveClass("custom-label");
	});

	it("should spread additional props", () => {
		render(
			<Label data-testid="custom-label" aria-describedby="help">
				Label
			</Label>,
		);

		const label = screen.getByTestId("custom-label");
		expect(label).toHaveAttribute("aria-describedby", "help");
	});

	it("should work with htmlFor attribute", () => {
		render(
			<>
				<Label htmlFor="input-id">Input label</Label>
				<input id="input-id" type="text" />
			</>,
		);

		const label = screen.getByText("Input label");
		const input = screen.getByRole("textbox");

		expect(label).toHaveAttribute("for", "input-id");
		expect(input).toHaveAttribute("id", "input-id");
	});

	it("should focus associated input when clicked", async () => {
		const user = userEvent.setup();

		render(
			<>
				<Label htmlFor="test-input">Click me</Label>
				<input id="test-input" type="text" />
			</>,
		);

		const label = screen.getByText("Click me");
		const input = screen.getByRole("textbox");

		await user.click(label);
		expect(input).toHaveFocus();
	});

	it("should handle peer disabled state", () => {
		render(
			<div className="group">
				<input className="peer" disabled />
				<Label>Peer disabled label</Label>
			</div>,
		);

		const label = screen.getByText("Peer disabled label");
		expect(label).toHaveClass(
			"peer-disabled:cursor-not-allowed",
			"peer-disabled:opacity-50",
		);
	});

	it("should handle group disabled state", () => {
		render(
			<div className="group" data-disabled="true">
				<Label>Group disabled label</Label>
			</div>,
		);

		const label = screen.getByText("Group disabled label");
		expect(label).toHaveClass(
			"group-data-[disabled=true]:pointer-events-none",
			"group-data-[disabled=true]:opacity-50",
		);
	});

	it("should render with children elements", () => {
		render(
			<Label>
				<span>Required</span>
				<span className="text-red-500">*</span>
			</Label>,
		);

		expect(screen.getByText("Required")).toBeInTheDocument();
		expect(screen.getByText("*")).toBeInTheDocument();
	});

	it("should support required indicator", () => {
		render(
			<Label>
				Email
				<span aria-label="required">*</span>
			</Label>,
		);

		expect(screen.getByText("Email")).toBeInTheDocument();
		expect(screen.getByLabelText("required")).toBeInTheDocument();
	});

	it("should work with form controls", () => {
		render(
			<form>
				<div>
					<Label htmlFor="email">Email Address</Label>
					<input
						id="email"
						type="email"
						required
						aria-describedby="email-help"
					/>
					<div id="email-help">Enter your email address</div>
				</div>
			</form>,
		);

		const label = screen.getByText("Email Address");
		const input = screen.getByRole("textbox");

		expect(label).toHaveAttribute("for", "email");
		expect(input).toHaveAttribute("aria-describedby", "email-help");
	});

	it("should handle click events", async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();

		render(<Label onClick={onClick}>Clickable label</Label>);

		const label = screen.getByText("Clickable label");
		await user.click(label);

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("should be accessible with screen readers", () => {
		render(
			<>
				<Label htmlFor="accessible-input">Accessible Label</Label>
				<input id="accessible-input" type="text" aria-describedby="help-text" />
				<div id="help-text">Helper text</div>
			</>,
		);

		const input = screen.getByLabelText("Accessible Label");
		expect(input).toBeInTheDocument();
		expect(input).toHaveAttribute("aria-describedby", "help-text");
	});
});
