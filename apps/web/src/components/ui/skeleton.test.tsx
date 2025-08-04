import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
	it("should render skeleton", () => {
		render(<Skeleton data-testid="skeleton" />);

		const skeleton = screen.getByTestId("skeleton");
		expect(skeleton).toBeInTheDocument();
		expect(skeleton).toHaveAttribute("data-slot", "skeleton");
	});

	it("should have default classes", () => {
		render(<Skeleton data-testid="skeleton" />);

		const skeleton = screen.getByTestId("skeleton");
		expect(skeleton).toHaveClass("animate-pulse", "rounded-md", "bg-accent");
	});

	it("should apply custom className", () => {
		render(<Skeleton className="custom-skeleton" data-testid="skeleton" />);

		const skeleton = screen.getByTestId("skeleton");
		expect(skeleton).toHaveClass("custom-skeleton");
		expect(skeleton).toHaveClass("animate-pulse", "rounded-md", "bg-accent");
	});

	it("should spread additional props", () => {
		render(
			<Skeleton
				data-testid="skeleton"
				aria-label="Loading content"
				role="status"
			/>,
		);

		const skeleton = screen.getByTestId("skeleton");
		expect(skeleton).toHaveAttribute("aria-label", "Loading content");
		expect(skeleton).toHaveAttribute("role", "status");
	});

	it("should support different sizes", () => {
		render(<Skeleton className="h-4 w-20" data-testid="small-skeleton" />);

		const skeleton = screen.getByTestId("small-skeleton");
		expect(skeleton).toHaveClass("h-4", "w-20");
	});

	it("should render with children content", () => {
		render(
			<Skeleton data-testid="skeleton">
				<span>Loading...</span>
			</Skeleton>,
		);

		const skeleton = screen.getByTestId("skeleton");
		expect(skeleton).toContainHTML("<span>Loading...</span>");
	});

	it("should work as text placeholder", () => {
		render(
			<div>
				<Skeleton className="h-4 w-[250px]" data-testid="text-skeleton" />
				<Skeleton className="h-4 w-[200px]" data-testid="text-skeleton-2" />
			</div>,
		);

		const skeleton1 = screen.getByTestId("text-skeleton");
		const skeleton2 = screen.getByTestId("text-skeleton-2");

		expect(skeleton1).toHaveClass("h-4", "w-[250px]");
		expect(skeleton2).toHaveClass("h-4", "w-[200px]");
	});

	it("should work as avatar placeholder", () => {
		render(
			<Skeleton
				className="h-12 w-12 rounded-full"
				data-testid="avatar-skeleton"
			/>,
		);

		const skeleton = screen.getByTestId("avatar-skeleton");
		expect(skeleton).toHaveClass("h-12", "w-12", "rounded-full");
	});

	it("should work as card placeholder", () => {
		render(
			<div className="flex items-center space-x-4">
				<Skeleton className="h-12 w-12 rounded-full" data-testid="avatar" />
				<div className="space-y-2">
					<Skeleton className="h-4 w-[250px]" data-testid="line1" />
					<Skeleton className="h-4 w-[200px]" data-testid="line2" />
				</div>
			</div>,
		);

		expect(screen.getByTestId("avatar")).toHaveClass(
			"h-12",
			"w-12",
			"rounded-full",
		);
		expect(screen.getByTestId("line1")).toHaveClass("h-4", "w-[250px]");
		expect(screen.getByTestId("line2")).toHaveClass("h-4", "w-[200px]");
	});

	it("should support accessibility attributes", () => {
		render(
			<Skeleton
				data-testid="skeleton"
				aria-hidden="true"
				role="presentation"
			/>,
		);

		const skeleton = screen.getByTestId("skeleton");
		expect(skeleton).toHaveAttribute("aria-hidden", "true");
		expect(skeleton).toHaveAttribute("role", "presentation");
	});

	it("should work in loading state pattern", () => {
		const isLoading = true;

		render(
			<div>
				{isLoading ? (
					<Skeleton className="h-8 w-32" data-testid="loading-skeleton" />
				) : (
					<h1>Actual Content</h1>
				)}
			</div>,
		);

		expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
		expect(screen.queryByText("Actual Content")).not.toBeInTheDocument();
	});

	it("should handle multiple skeleton variants", () => {
		render(
			<div className="space-y-4">
				<Skeleton className="h-32 w-full" data-testid="header-skeleton" />
				<div className="space-y-2">
					<Skeleton className="h-4 w-full" data-testid="text-1" />
					<Skeleton className="h-4 w-4/5" data-testid="text-2" />
					<Skeleton className="h-4 w-3/5" data-testid="text-3" />
				</div>
				<Skeleton className="h-10 w-24" data-testid="button-skeleton" />
			</div>,
		);

		expect(screen.getByTestId("header-skeleton")).toHaveClass("h-32", "w-full");
		expect(screen.getByTestId("text-1")).toHaveClass("h-4", "w-full");
		expect(screen.getByTestId("text-2")).toHaveClass("h-4", "w-4/5");
		expect(screen.getByTestId("text-3")).toHaveClass("h-4", "w-3/5");
		expect(screen.getByTestId("button-skeleton")).toHaveClass("h-10", "w-24");
	});
});
