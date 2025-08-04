import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
	title: "UI/Button",
	component: Button,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"A versatile button component with multiple variants and sizes, built on top of Radix UI Slot.",
			},
		},
	},
	tags: ["autodocs"],
	argTypes: {
		variant: {
			control: "select",
			options: [
				"default",
				"destructive",
				"outline",
				"secondary",
				"ghost",
				"link",
			],
			description: "The visual style variant of the button",
		},
		size: {
			control: "select",
			options: ["default", "sm", "lg", "icon"],
			description: "The size of the button",
		},
		asChild: {
			control: "boolean",
			description:
				"When true, the button will render as a child component using Radix Slot",
		},
		disabled: {
			control: "boolean",
			description: "Whether the button is disabled",
		},
	},
	args: {
		onClick: () => {},
	},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		children: "Button",
		variant: "default",
		size: "default",
	},
};

export const Destructive: Story = {
	args: {
		children: "Delete",
		variant: "destructive",
	},
};

export const Outline: Story = {
	args: {
		children: "Outline",
		variant: "outline",
	},
};

export const Secondary: Story = {
	args: {
		children: "Secondary",
		variant: "secondary",
	},
};

export const Ghost: Story = {
	args: {
		children: "Ghost",
		variant: "ghost",
	},
};

export const Link: Story = {
	args: {
		children: "Link",
		variant: "link",
	},
};

export const Small: Story = {
	args: {
		children: "Small",
		size: "sm",
	},
};

export const Large: Story = {
	args: {
		children: "Large",
		size: "lg",
	},
};

export const Icon: Story = {
	args: {
		children: "🚀",
		size: "icon",
	},
};

export const Disabled: Story = {
	args: {
		children: "Disabled",
		disabled: true,
	},
};

export const WithIcon: Story = {
	args: {
		children: (
			<>
				<svg
					className="size-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<title>Add icon</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add Item
			</>
		),
	},
};

export const AllVariants: Story = {
	render: () => (
		<div className="flex flex-wrap gap-4">
			<Button variant="default">Default</Button>
			<Button variant="destructive">Destructive</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="link">Link</Button>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story: "All button variants displayed together for comparison.",
			},
		},
	},
};

export const AllSizes: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Button size="sm">Small</Button>
			<Button size="default">Default</Button>
			<Button size="lg">Large</Button>
			<Button size="icon">🎯</Button>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story: "All button sizes displayed together for comparison.",
			},
		},
	},
};
