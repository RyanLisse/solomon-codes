import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "./alert";

describe("Alert", () => {
	it("should render alert with default variant", () => {
		render(<Alert>Test alert</Alert>);

		const alert = screen.getByRole("alert");
		expect(alert).toBeInTheDocument();
		expect(alert).toHaveTextContent("Test alert");
		expect(alert).toHaveClass("bg-background", "text-foreground");
	});

	it("should render alert with destructive variant", () => {
		render(<Alert variant="destructive">Destructive alert</Alert>);

		const alert = screen.getByRole("alert");
		expect(alert).toBeInTheDocument();
		expect(alert).toHaveClass("border-destructive/50", "text-destructive");
	});

	it("should forward ref correctly", () => {
		const ref = { current: null };
		render(<Alert ref={ref}>Alert with ref</Alert>);

		expect(ref.current).toBeInstanceOf(HTMLDivElement);
	});

	it("should apply custom className", () => {
		render(<Alert className="custom-class">Custom alert</Alert>);

		const alert = screen.getByRole("alert");
		expect(alert).toHaveClass("custom-class");
	});

	it("should spread additional props", () => {
		render(
			<Alert data-testid="custom-alert" aria-label="Custom alert">
				Alert
			</Alert>,
		);

		const alert = screen.getByTestId("custom-alert");
		expect(alert).toHaveAttribute("aria-label", "Custom alert");
	});
});

describe("AlertTitle", () => {
	it("should render alert title", () => {
		render(<AlertTitle>Alert Title</AlertTitle>);

		const title = screen.getByRole("heading", { level: 5 });
		expect(title).toBeInTheDocument();
		expect(title).toHaveTextContent("Alert Title");
		expect(title).toHaveClass(
			"mb-1",
			"font-medium",
			"leading-none",
			"tracking-tight",
		);
	});

	it("should forward ref correctly", () => {
		const ref = { current: null };
		render(<AlertTitle ref={ref}>Title with ref</AlertTitle>);

		expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
	});

	it("should apply custom className", () => {
		render(<AlertTitle className="custom-title">Custom Title</AlertTitle>);

		const title = screen.getByRole("heading");
		expect(title).toHaveClass("custom-title");
	});

	it("should spread additional props", () => {
		render(<AlertTitle data-testid="alert-title">Title</AlertTitle>);

		const title = screen.getByTestId("alert-title");
		expect(title).toBeInTheDocument();
	});
});

describe("AlertDescription", () => {
	it("should render alert description", () => {
		render(<AlertDescription>Alert description</AlertDescription>);

		const description = screen.getByText("Alert description");
		expect(description).toBeInTheDocument();
		expect(description).toHaveClass("text-sm", "[&_p]:leading-relaxed");
	});

	it("should forward ref correctly", () => {
		const ref = { current: null };
		render(<AlertDescription ref={ref}>Description with ref</AlertDescription>);

		expect(ref.current).toBeInstanceOf(HTMLDivElement);
	});

	it("should apply custom className", () => {
		render(
			<AlertDescription className="custom-desc">
				Custom Description
			</AlertDescription>,
		);

		const description = screen.getByText("Custom Description");
		expect(description).toHaveClass("custom-desc");
	});

	it("should spread additional props", () => {
		render(
			<AlertDescription data-testid="alert-desc">Description</AlertDescription>,
		);

		const description = screen.getByTestId("alert-desc");
		expect(description).toBeInTheDocument();
	});

	it("should render with complex content", () => {
		render(
			<AlertDescription>
				<p>First paragraph</p>
				<p>Second paragraph</p>
			</AlertDescription>,
		);

		expect(screen.getByText("First paragraph")).toBeInTheDocument();
		expect(screen.getByText("Second paragraph")).toBeInTheDocument();
	});
});

describe("Alert composition", () => {
	it("should render complete alert with title and description", () => {
		render(
			<Alert>
				<AlertTitle>Warning</AlertTitle>
				<AlertDescription>This is a warning message</AlertDescription>
			</Alert>,
		);

		expect(screen.getByRole("alert")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Warning" }),
		).toBeInTheDocument();
		expect(screen.getByText("This is a warning message")).toBeInTheDocument();
	});

	it("should render destructive alert with complete content", () => {
		render(
			<Alert variant="destructive">
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>Something went wrong</AlertDescription>
			</Alert>,
		);

		const alert = screen.getByRole("alert");
		expect(alert).toHaveClass("text-destructive");
		expect(screen.getByRole("heading", { name: "Error" })).toBeInTheDocument();
		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});
});
