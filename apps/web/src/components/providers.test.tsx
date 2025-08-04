import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Providers from "./providers";

// Mock the theme-provider
vi.mock("./theme-provider", () => ({
	ThemeProvider: vi.fn(({ children }) => (
		<div data-testid="theme-provider">{children}</div>
	)),
}));

// Mock the Toaster component
vi.mock("./ui/sonner", () => ({
	Toaster: () => <div data-testid="toaster" />,
}));

describe("Providers", () => {
	it("should render children within providers", () => {
		render(
			<Providers>
				<div data-testid="test-child">Test Content</div>
			</Providers>,
		);

		expect(screen.getByTestId("test-child")).toBeInTheDocument();
		expect(screen.getByText("Test Content")).toBeInTheDocument();
	});

	it("should wrap children with ThemeProvider", () => {
		render(
			<Providers>
				<div>Test</div>
			</Providers>,
		);

		expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
	});

	it("should include Toaster component", () => {
		render(
			<Providers>
				<div>Test</div>
			</Providers>,
		);

		expect(screen.getByTestId("toaster")).toBeInTheDocument();
	});

	it("should render multiple children correctly", () => {
		render(
			<Providers>
				<div data-testid="child-1">First Child</div>
				<div data-testid="child-2">Second Child</div>
				<span data-testid="child-3">Third Child</span>
			</Providers>,
		);

		expect(screen.getByTestId("child-1")).toBeInTheDocument();
		expect(screen.getByTestId("child-2")).toBeInTheDocument();
		expect(screen.getByTestId("child-3")).toBeInTheDocument();
	});

	it("should handle no children gracefully", () => {
		render(<Providers>{undefined}</Providers>);

		expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
		expect(screen.getByTestId("toaster")).toBeInTheDocument();
	});

	it("should render ThemeProvider with children", () => {
		render(
			<Providers>
				<div>Test</div>
			</Providers>,
		);

		expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
		expect(screen.getByText("Test")).toBeInTheDocument();
	});

	it("should maintain component structure", () => {
		const { container } = render(
			<Providers>
				<div>Test</div>
			</Providers>,
		);

		// ThemeProvider should be the root element
		expect(container.firstChild).toBe(screen.getByTestId("theme-provider"));

		// Toaster should be rendered alongside children
		expect(screen.getByTestId("toaster")).toBeInTheDocument();
	});

	it("should render with complex nested children", () => {
		render(
			<Providers>
				<div>
					<header>Header</header>
					<main>
						<section>
							<article>Content</article>
						</section>
					</main>
					<footer>Footer</footer>
				</div>
			</Providers>,
		);

		expect(screen.getByText("Header")).toBeInTheDocument();
		expect(screen.getByText("Content")).toBeInTheDocument();
		expect(screen.getByText("Footer")).toBeInTheDocument();
	});

	it("should handle React fragments as children", () => {
		render(
			<Providers>
				<div data-testid="fragment-child-1">Fragment Child 1</div>
				<div data-testid="fragment-child-2">Fragment Child 2</div>
			</Providers>,
		);

		expect(screen.getByTestId("fragment-child-1")).toBeInTheDocument();
		expect(screen.getByTestId("fragment-child-2")).toBeInTheDocument();
	});

	it("should preserve children props and attributes", () => {
		render(
			<Providers>
				<button type="button" className="test-class" data-custom="value">
					Button Text
				</button>
			</Providers>,
		);

		const button = screen.getByRole("button");
		expect(button).toHaveAttribute("type", "button");
		expect(button).toHaveClass("test-class");
		expect(button).toHaveAttribute("data-custom", "value");
		expect(button).toHaveTextContent("Button Text");
	});
});
