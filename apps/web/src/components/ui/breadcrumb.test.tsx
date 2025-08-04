import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "./breadcrumb";

describe("Breadcrumb", () => {
	it("should render breadcrumb navigation", () => {
		render(<Breadcrumb data-testid="breadcrumb" />);

		const breadcrumb = screen.getByTestId("breadcrumb");
		expect(breadcrumb).toBeInTheDocument();
		expect(breadcrumb).toHaveAttribute("aria-label", "breadcrumb");
		expect(breadcrumb).toHaveAttribute("data-slot", "breadcrumb");
	});

	it("should spread additional props", () => {
		render(<Breadcrumb className="custom-nav" data-testid="breadcrumb" />);

		const breadcrumb = screen.getByTestId("breadcrumb");
		expect(breadcrumb).toHaveClass("custom-nav");
	});
});

describe("BreadcrumbList", () => {
	it("should render breadcrumb list", () => {
		render(<BreadcrumbList data-testid="breadcrumb-list" />);

		const list = screen.getByTestId("breadcrumb-list");
		expect(list).toBeInTheDocument();
		expect(list).toHaveAttribute("data-slot", "breadcrumb-list");
		expect(list).toHaveClass(
			"flex",
			"flex-wrap",
			"items-center",
			"gap-1.5",
			"break-words",
			"text-muted-foreground",
			"text-sm",
		);
	});

	it("should apply custom className", () => {
		render(
			<BreadcrumbList className="custom-list" data-testid="breadcrumb-list" />,
		);

		const list = screen.getByTestId("breadcrumb-list");
		expect(list).toHaveClass("custom-list");
	});
});

describe("BreadcrumbItem", () => {
	it("should render breadcrumb item", () => {
		render(<BreadcrumbItem data-testid="breadcrumb-item">Item</BreadcrumbItem>);

		const item = screen.getByTestId("breadcrumb-item");
		expect(item).toBeInTheDocument();
		expect(item).toHaveAttribute("data-slot", "breadcrumb-item");
		expect(item).toHaveClass("inline-flex", "items-center", "gap-1.5");
		expect(item).toHaveTextContent("Item");
	});

	it("should apply custom className", () => {
		render(
			<BreadcrumbItem className="custom-item" data-testid="breadcrumb-item">
				Item
			</BreadcrumbItem>,
		);

		const item = screen.getByTestId("breadcrumb-item");
		expect(item).toHaveClass("custom-item");
	});
});

describe("BreadcrumbLink", () => {
	it("should render as anchor by default", () => {
		render(<BreadcrumbLink href="/home">Home</BreadcrumbLink>);

		const link = screen.getByRole("link", { name: "Home" });
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute("data-slot", "breadcrumb-link");
		expect(link).toHaveAttribute("href", "/home");
		expect(link).toHaveClass("transition-colors", "hover:text-foreground");
	});

	it("should work with asChild prop", () => {
		render(
			<BreadcrumbLink asChild>
				<button type="button">Custom Link</button>
			</BreadcrumbLink>,
		);

		const button = screen.getByRole("button", { name: "Custom Link" });
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute("data-slot", "breadcrumb-link");
		expect(button).toHaveClass("transition-colors", "hover:text-foreground");
	});

	it("should handle click events", async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();

		render(
			<BreadcrumbLink href="#" onClick={onClick}>
				Clickable
			</BreadcrumbLink>,
		);

		const link = screen.getByRole("link", { name: "Clickable" });
		await user.click(link);

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("should apply custom className", () => {
		render(
			<BreadcrumbLink href="#" className="custom-link">
				Link
			</BreadcrumbLink>,
		);

		const link = screen.getByRole("link");
		expect(link).toHaveClass("custom-link");
	});
});

describe("BreadcrumbPage", () => {
	it("should render current page", () => {
		render(<BreadcrumbPage>Current Page</BreadcrumbPage>);

		const page = screen.getByText("Current Page");
		expect(page).toBeInTheDocument();
		expect(page).toHaveAttribute("data-slot", "breadcrumb-page");
		expect(page).toHaveAttribute("aria-current", "page");
		expect(page).toHaveClass("font-normal", "text-foreground");
	});

	it("should apply custom className", () => {
		render(<BreadcrumbPage className="custom-page">Page</BreadcrumbPage>);

		const page = screen.getByText("Page");
		expect(page).toHaveClass("custom-page");
	});
});

describe("BreadcrumbSeparator", () => {
	it("should render with default chevron icon", () => {
		render(<BreadcrumbSeparator data-testid="separator" />);

		const separator = screen.getByTestId("separator");
		expect(separator).toBeInTheDocument();
		expect(separator).toHaveAttribute("data-slot", "breadcrumb-separator");
		expect(separator).toHaveAttribute("role", "presentation");
		expect(separator).toHaveAttribute("aria-hidden", "true");
		expect(separator).toHaveClass("[&>svg]:size-3.5");
	});

	it("should render with custom children", () => {
		render(
			<BreadcrumbSeparator data-testid="separator">|</BreadcrumbSeparator>,
		);

		const separator = screen.getByTestId("separator");
		expect(separator).toHaveTextContent("|");
	});

	it("should apply custom className", () => {
		render(
			<BreadcrumbSeparator
				className="custom-separator"
				data-testid="separator"
			/>,
		);

		const separator = screen.getByTestId("separator");
		expect(separator).toHaveClass("custom-separator");
	});
});

describe("BreadcrumbEllipsis", () => {
	it("should render ellipsis with more horizontal icon", () => {
		render(<BreadcrumbEllipsis data-testid="ellipsis" />);

		const ellipsis = screen.getByTestId("ellipsis");
		expect(ellipsis).toBeInTheDocument();
		expect(ellipsis).toHaveAttribute("data-slot", "breadcrumb-ellipsis");
		expect(ellipsis).toHaveAttribute("role", "presentation");
		expect(ellipsis).toHaveAttribute("aria-hidden", "true");
		expect(ellipsis).toHaveClass(
			"flex",
			"size-9",
			"items-center",
			"justify-center",
		);
	});

	it("should have screen reader text", () => {
		render(<BreadcrumbEllipsis />);

		const srText = screen.getByText("More");
		expect(srText).toBeInTheDocument();
		expect(srText).toHaveClass("sr-only");
	});

	it("should apply custom className", () => {
		render(
			<BreadcrumbEllipsis className="custom-ellipsis" data-testid="ellipsis" />,
		);

		const ellipsis = screen.getByTestId("ellipsis");
		expect(ellipsis).toHaveClass("custom-ellipsis");
	});
});

describe("Breadcrumb composition", () => {
	it("should render complete breadcrumb navigation", () => {
		render(
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Home</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink href="/products">Products</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Current Product</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>,
		);

		expect(screen.getByRole("navigation")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
			"href",
			"/products",
		);
		expect(screen.getByText("Current Product")).toHaveAttribute(
			"aria-current",
			"page",
		);
	});

	it("should render breadcrumb with ellipsis", () => {
		render(
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Home</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbEllipsis />
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Current</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>,
		);

		expect(screen.getByRole("navigation")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
		expect(screen.getByText("More")).toBeInTheDocument();
		expect(screen.getByText("Current")).toBeInTheDocument();
	});

	it("should support keyboard navigation", async () => {
		const user = userEvent.setup();

		render(
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Home</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink href="/products">Products</BreadcrumbLink>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>,
		);

		const homeLink = screen.getByRole("link", { name: "Home" });
		const productsLink = screen.getByRole("link", { name: "Products" });

		homeLink.focus();
		expect(homeLink).toHaveFocus();

		await user.tab();
		expect(productsLink).toHaveFocus();
	});

	it("should work with custom separators", () => {
		render(
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Home</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator>/</BreadcrumbSeparator>
					<BreadcrumbItem>
						<BreadcrumbPage>Current</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>,
		);

		expect(screen.getByText("/")).toBeInTheDocument();
		expect(screen.getByText("/")).toHaveAttribute("role", "presentation");
	});
});
