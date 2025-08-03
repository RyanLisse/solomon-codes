import {
	ChevronDown,
	Cloud,
	FileText,
	Home,
	Laptop,
	Settings,
	User,
	Zap,
} from "lucide-react";
import type * as React from "react";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";

const navigationItems = [
	{
		title: "Home",
		url: "/",
		icon: Home,
		isActive: true,
	},
	{
		title: "Automations",
		url: "/automations",
		icon: Zap,
	},
	{
		title: "Stats",
		url: "/stats",
		icon: FileText,
	},
];

const configureItems = [
	{
		title: "Environments",
		url: "/environments",
		icon: Settings,
	},
	{
		title: "Settings",
		url: "/settings",
		icon: Settings,
	},
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	isLocalExecution?: boolean;
	onLocalExecutionChange?: (value: boolean) => void;
}

export function AppSidebar({
	isLocalExecution = true,
	onLocalExecutionChange,
	...props
}: AppSidebarProps) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader className="border-gray-200 border-b p-4">
				<div className="flex items-center gap-2">
					<ChevronDown className="h-4 w-4 text-gray-500" />
					<span className="font-semibold text-gray-900 group-data-[collapsible=icon]:hidden">
						Solomon Codes
					</span>
				</div>
			</SidebarHeader>

			<SidebarContent className="p-2">
				{/* Main Navigation */}
				<div className="space-y-1">
					<SidebarMenu>
						{navigationItems.map((item) => (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									asChild
									isActive={item.isActive}
									tooltip={item.title}
								>
									<a href={item.url} className="flex items-center gap-2">
										<item.icon className="h-4 w-4" />
										<span>{item.title}</span>
									</a>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</div>

				{/* Configure Section */}
				<div className="mt-6">
					<div className="mb-2 px-2 font-medium text-gray-500 text-xs uppercase tracking-wider group-data-[collapsible=icon]:hidden">
						Configure
					</div>
					<SidebarMenu>
						{configureItems.map((item) => (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton asChild tooltip={item.title}>
									<a href={item.url} className="flex items-center gap-2">
										<item.icon className="h-4 w-4" />
										<span>{item.title}</span>
									</a>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</div>
			</SidebarContent>

			<SidebarFooter className="border-gray-200 border-t p-2">
				{/* Execution Mode */}
				<div className="mb-2 p-2">
					<div className="flex w-full items-center justify-between">
						<div className="flex items-center gap-2">
							<Cloud className="h-4 w-4 text-muted-foreground" />
							<Switch
								checked={isLocalExecution}
								onCheckedChange={onLocalExecutionChange}
								className="data-[state=checked]:bg-primary"
								aria-label={
									isLocalExecution
										? "Switch to Cloud Execution"
										: "Switch to Local Execution"
								}
							/>
							<Laptop className="h-4 w-4 text-muted-foreground" />
						</div>
						<span className="text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
							{isLocalExecution ? "Local" : "Cloud"}
						</span>
					</div>
				</div>

				{/* User Profile */}
				<div className="flex items-center gap-2 p-2">
					<div className="flex h-6 w-6 items-center justify-center rounded bg-gray-200">
						<User className="h-4 w-4 text-gray-600" />
					</div>
					<span className="font-medium text-sm group-data-[collapsible=icon]:hidden">
						Ryan Lisse
					</span>
				</div>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
