import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "./table";

describe("Table", () => {
	it("should render table with container", () => {
		render(<Table data-testid="table">Table content</Table>);

		const container = screen.getByTestId("table").parentElement;
		const table = screen.getByTestId("table");

		expect(container).toHaveAttribute("data-slot", "table-container");
		expect(container).toHaveClass("relative", "w-full", "overflow-x-auto");
		expect(table).toHaveAttribute("data-slot", "table");
		expect(table).toHaveClass("w-full", "caption-bottom", "text-sm");
	});

	it("should apply custom className", () => {
		render(<Table className="custom-table" data-testid="table" />);

		const table = screen.getByTestId("table");
		expect(table).toHaveClass("custom-table");
	});

	it("should spread additional props", () => {
		render(<Table role="grid" data-testid="table" />);

		const table = screen.getByTestId("table");
		expect(table).toHaveAttribute("role", "grid");
	});
});

describe("TableHeader", () => {
	it("should render table header", () => {
		render(
			<table>
				<TableHeader data-testid="table-header">
					<tr>
						<th>Header</th>
					</tr>
				</TableHeader>
			</table>,
		);

		const header = screen.getByTestId("table-header");
		expect(header).toBeInTheDocument();
		expect(header).toHaveAttribute("data-slot", "table-header");
		expect(header).toHaveClass("[&_tr]:border-b");
	});

	it("should apply custom className", () => {
		render(
			<table>
				<TableHeader className="custom-header" data-testid="table-header">
					<tr>
						<th>Header</th>
					</tr>
				</TableHeader>
			</table>,
		);

		const header = screen.getByTestId("table-header");
		expect(header).toHaveClass("custom-header");
	});
});

describe("TableBody", () => {
	it("should render table body", () => {
		render(
			<table>
				<TableBody data-testid="table-body">
					<tr>
						<td>Body</td>
					</tr>
				</TableBody>
			</table>,
		);

		const body = screen.getByTestId("table-body");
		expect(body).toBeInTheDocument();
		expect(body).toHaveAttribute("data-slot", "table-body");
		expect(body).toHaveClass("[&_tr:last-child]:border-0");
	});

	it("should apply custom className", () => {
		render(
			<table>
				<TableBody className="custom-body" data-testid="table-body">
					<tr>
						<td>Body</td>
					</tr>
				</TableBody>
			</table>,
		);

		const body = screen.getByTestId("table-body");
		expect(body).toHaveClass("custom-body");
	});
});

describe("TableFooter", () => {
	it("should render table footer", () => {
		render(
			<table>
				<TableFooter data-testid="table-footer">
					<tr>
						<td>Footer</td>
					</tr>
				</TableFooter>
			</table>,
		);

		const footer = screen.getByTestId("table-footer");
		expect(footer).toBeInTheDocument();
		expect(footer).toHaveAttribute("data-slot", "table-footer");
		expect(footer).toHaveClass(
			"border-t",
			"bg-muted/50",
			"font-medium",
			"[&>tr]:last:border-b-0",
		);
	});

	it("should apply custom className", () => {
		render(
			<table>
				<TableFooter className="custom-footer" data-testid="table-footer">
					<tr>
						<td>Footer</td>
					</tr>
				</TableFooter>
			</table>,
		);

		const footer = screen.getByTestId("table-footer");
		expect(footer).toHaveClass("custom-footer");
	});
});

describe("TableRow", () => {
	it("should render table row", () => {
		render(
			<table>
				<tbody>
					<TableRow data-testid="table-row">
						<td>Row content</td>
					</TableRow>
				</tbody>
			</table>,
		);

		const row = screen.getByTestId("table-row");
		expect(row).toBeInTheDocument();
		expect(row).toHaveAttribute("data-slot", "table-row");
		expect(row).toHaveClass(
			"border-b",
			"transition-colors",
			"hover:bg-muted/50",
			"data-[state=selected]:bg-muted",
		);
	});

	it("should handle selected state", () => {
		render(
			<table>
				<tbody>
					<TableRow data-state="selected" data-testid="table-row">
						<td>Selected row</td>
					</TableRow>
				</tbody>
			</table>,
		);

		const row = screen.getByTestId("table-row");
		expect(row).toHaveAttribute("data-state", "selected");
	});

	it("should apply custom className", () => {
		render(
			<table>
				<tbody>
					<TableRow className="custom-row" data-testid="table-row">
						<td>Row</td>
					</TableRow>
				</tbody>
			</table>,
		);

		const row = screen.getByTestId("table-row");
		expect(row).toHaveClass("custom-row");
	});
});

describe("TableHead", () => {
	it("should render table head cell", () => {
		render(
			<table>
				<thead>
					<tr>
						<TableHead data-testid="table-head">Header Cell</TableHead>
					</tr>
				</thead>
			</table>,
		);

		const head = screen.getByTestId("table-head");
		expect(head).toBeInTheDocument();
		expect(head).toHaveAttribute("data-slot", "table-head");
		expect(head).toHaveClass(
			"h-10",
			"whitespace-nowrap",
			"px-2",
			"text-left",
			"align-middle",
			"font-medium",
			"text-foreground",
		);
		expect(head).toHaveTextContent("Header Cell");
	});

	it("should apply custom className", () => {
		render(
			<table>
				<thead>
					<tr>
						<TableHead className="custom-head" data-testid="table-head">
							Header
						</TableHead>
					</tr>
				</thead>
			</table>,
		);

		const head = screen.getByTestId("table-head");
		expect(head).toHaveClass("custom-head");
	});

	it("should handle checkbox styling", () => {
		render(
			<table>
				<thead>
					<tr>
						<TableHead data-testid="table-head">
							<input type="checkbox" />
						</TableHead>
					</tr>
				</thead>
			</table>,
		);

		const head = screen.getByTestId("table-head");
		expect(head).toHaveClass(
			"[&:has([role=checkbox])]:pr-0",
			"[&>[role=checkbox]]:translate-y-[2px]",
		);
	});
});

describe("TableCell", () => {
	it("should render table cell", () => {
		render(
			<table>
				<tbody>
					<tr>
						<TableCell data-testid="table-cell">Cell Content</TableCell>
					</tr>
				</tbody>
			</table>,
		);

		const cell = screen.getByTestId("table-cell");
		expect(cell).toBeInTheDocument();
		expect(cell).toHaveAttribute("data-slot", "table-cell");
		expect(cell).toHaveClass("whitespace-nowrap", "p-2", "align-middle");
		expect(cell).toHaveTextContent("Cell Content");
	});

	it("should apply custom className", () => {
		render(
			<table>
				<tbody>
					<tr>
						<TableCell className="custom-cell" data-testid="table-cell">
							Cell
						</TableCell>
					</tr>
				</tbody>
			</table>,
		);

		const cell = screen.getByTestId("table-cell");
		expect(cell).toHaveClass("custom-cell");
	});

	it("should handle checkbox styling", () => {
		render(
			<table>
				<tbody>
					<tr>
						<TableCell data-testid="table-cell">
							<input type="checkbox" />
						</TableCell>
					</tr>
				</tbody>
			</table>,
		);

		const cell = screen.getByTestId("table-cell");
		expect(cell).toHaveClass(
			"[&:has([role=checkbox])]:pr-0",
			"[&>[role=checkbox]]:translate-y-[2px]",
		);
	});
});

describe("TableCaption", () => {
	it("should render table caption", () => {
		render(
			<table>
				<TableCaption data-testid="table-caption">Table Caption</TableCaption>
			</table>,
		);

		const caption = screen.getByTestId("table-caption");
		expect(caption).toBeInTheDocument();
		expect(caption).toHaveAttribute("data-slot", "table-caption");
		expect(caption).toHaveClass("mt-4", "text-muted-foreground", "text-sm");
		expect(caption).toHaveTextContent("Table Caption");
	});

	it("should apply custom className", () => {
		render(
			<table>
				<TableCaption className="custom-caption" data-testid="table-caption">
					Caption
				</TableCaption>
			</table>,
		);

		const caption = screen.getByTestId("table-caption");
		expect(caption).toHaveClass("custom-caption");
	});
});

describe("Table composition", () => {
	it("should render complete table structure", () => {
		render(
			<Table>
				<TableCaption>A list of users and their details</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Role</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell>John Doe</TableCell>
						<TableCell>john@example.com</TableCell>
						<TableCell>Admin</TableCell>
					</TableRow>
					<TableRow data-state="selected">
						<TableCell>Jane Smith</TableCell>
						<TableCell>jane@example.com</TableCell>
						<TableCell>User</TableCell>
					</TableRow>
				</TableBody>
				<TableFooter>
					<TableRow>
						<TableCell colSpan={3}>2 users total</TableCell>
					</TableRow>
				</TableFooter>
			</Table>,
		);

		// Check table structure
		expect(screen.getByRole("table")).toBeInTheDocument();
		expect(
			screen.getByText("A list of users and their details"),
		).toBeInTheDocument();

		// Check headers
		expect(
			screen.getByRole("columnheader", { name: "Name" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: "Email" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: "Role" }),
		).toBeInTheDocument();

		// Check data cells
		expect(screen.getByRole("cell", { name: "John Doe" })).toBeInTheDocument();
		expect(
			screen.getByRole("cell", { name: "john@example.com" }),
		).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "Admin" })).toBeInTheDocument();

		expect(
			screen.getByRole("cell", { name: "Jane Smith" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("cell", { name: "jane@example.com" }),
		).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "User" })).toBeInTheDocument();

		// Check footer
		expect(
			screen.getByRole("cell", { name: "2 users total" }),
		).toBeInTheDocument();
	});

	it("should handle table with checkboxes", () => {
		render(
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>
							<input type="checkbox" aria-label="Select all" />
						</TableHead>
						<TableHead>Name</TableHead>
						<TableHead>Status</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell>
							<input type="checkbox" aria-label="Select row" />
						</TableCell>
						<TableCell>John Doe</TableCell>
						<TableCell>Active</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);

		expect(screen.getByLabelText("Select all")).toBeInTheDocument();
		expect(screen.getByLabelText("Select row")).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "John Doe" })).toBeInTheDocument();
	});

	it("should be accessible", () => {
		render(
			<Table role="grid" aria-label="User data">
				<TableCaption>User information table</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead scope="col">Name</TableHead>
						<TableHead scope="col">Email</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell>John Doe</TableCell>
						<TableCell>john@example.com</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);

		const table = screen.getByRole("grid");
		expect(table).toHaveAttribute("aria-label", "User data");
		expect(screen.getByText("User information table")).toBeInTheDocument();
	});
});
