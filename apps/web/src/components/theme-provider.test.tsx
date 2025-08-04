import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme-provider";

// Mock next-themes
vi.mock("next-themes", () => ({
	ThemeProvider: vi.fn(({ children, ...props }) => (
		<div data-testid="next-themes-provider" data-props={JSON.stringify(props)}>
			{children}
		</div>
	)),
}));

describe("ThemeProvider", () => {
	it("should render children within NextThemesProvider", () => {
		render(
			<ThemeProvider>
				<div data-testid="test-child">Test Content</div>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("test-child")).toBeInTheDocument();
		expect(screen.getByText("Test Content")).toBeInTheDocument();
		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
	});

	it("should pass all props to NextThemesProvider", () => {
		const props = {
			attribute: "class" as const,
			defaultTheme: "dark",
			enableSystem: true,
			disableTransitionOnChange: false,
		};

		render(
			<ThemeProvider {...props}>
				<div>Test</div>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
		expect(screen.getByText("Test")).toBeInTheDocument();
	});

	it("should handle custom theme configuration", () => {
		const customProps = {
			attribute: "data-theme" as const,
			defaultTheme: "system",
			enableSystem: true,
			enableColorScheme: false,
			storageKey: "custom-theme",
			themes: ["light", "dark", "auto"],
		};

		render(
			<ThemeProvider {...customProps}>
				<div>Custom Theme Config</div>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
	});

	it("should render multiple children correctly", () => {
		render(
			<ThemeProvider>
				<header data-testid="header">Header</header>
				<main data-testid="main">Main Content</main>
				<footer data-testid="footer">Footer</footer>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("header")).toBeInTheDocument();
		expect(screen.getByTestId("main")).toBeInTheDocument();
		expect(screen.getByTestId("footer")).toBeInTheDocument();
	});

	it("should handle no children gracefully", () => {
		render(<ThemeProvider>{undefined}</ThemeProvider>);

		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
	});

	it("should forward ref if provided", () => {
		render(
			<ThemeProvider>
				<div>Test with Ref</div>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
	});

	it("should handle boolean props correctly", () => {
		render(
			<ThemeProvider
				enableSystem={false}
				disableTransitionOnChange={true}
				enableColorScheme={true}
			>
				<div>Boolean Props Test</div>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
	});

	it("should handle array props correctly", () => {
		const themes = ["light", "dark", "blue", "red"];

		render(
			<ThemeProvider themes={themes}>
				<div>Array Props Test</div>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
	});

	it("should handle function props correctly", () => {
		const nonce = "test-nonce";

		render(
			<ThemeProvider nonce={nonce}>
				<div>Function Props Test</div>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
	});

	it("should preserve children structure and props", () => {
		render(
			<ThemeProvider>
				<button type="button" className="theme-button" onClick={() => {}}>
					Toggle Theme
				</button>
			</ThemeProvider>,
		);

		const button = screen.getByRole("button");
		expect(button).toHaveAttribute("type", "button");
		expect(button).toHaveClass("theme-button");
		expect(button).toHaveTextContent("Toggle Theme");
	});

	it("should work with complex nested component structures", () => {
		render(
			<ThemeProvider defaultTheme="dark">
				<div className="app">
					<nav>
						<ul>
							<li>Home</li>
							<li>About</li>
						</ul>
					</nav>
					<main>
						<article>
							<h1>Title</h1>
							<p>Content</p>
						</article>
					</main>
				</div>
			</ThemeProvider>,
		);

		expect(screen.getByText("Home")).toBeInTheDocument();
		expect(screen.getByText("About")).toBeInTheDocument();
		expect(screen.getByText("Title")).toBeInTheDocument();
		expect(screen.getByText("Content")).toBeInTheDocument();
	});

	it("should handle React fragments as children", () => {
		render(
			<ThemeProvider>
				<div data-testid="fragment-1">Fragment 1</div>
				<div data-testid="fragment-2">Fragment 2</div>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("fragment-1")).toBeInTheDocument();
		expect(screen.getByTestId("fragment-2")).toBeInTheDocument();
	});

	it("should not modify children props", () => {
		const originalProps = {
			"data-original": "value",
			className: "original-class",
			id: "original-id",
		};

		render(
			<ThemeProvider>
				<div {...originalProps}>Original Props Test</div>
			</ThemeProvider>,
		);

		const element = screen.getByText("Original Props Test");
		expect(element).toHaveAttribute("data-original", "value");
		expect(element).toHaveClass("original-class");
		expect(element).toHaveAttribute("id", "original-id");
	});

	it("should handle empty props object", () => {
		render(
			<ThemeProvider>
				<div>Empty Props Test</div>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
	});
});
