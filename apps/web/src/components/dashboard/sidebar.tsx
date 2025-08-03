"use client";

import {
	BarChart3,
	Bot,
	ChevronDown,
	FileText,
	Globe,
	Home,
	MessageSquare,
	Settings,
	User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
	className?: string;
}

const navigationItems = [
	{
		title: "Home",
		href: "/",
		icon: Home,
	},
	{
		title: "Automations",
		href: "/automations",
		icon: Bot,
	},
	{
		title: "Stats",
		href: "/stats",
		icon: BarChart3,
	},
];

const configureItems = [
	{
		title: "Environments",
		href: "/environments",
		icon: Globe,
	},
	{
		title: "Settings",
		href: "/settings",
		icon: Settings,
	},
];

const supportItems = [
	{
		title: "Release Notes",
		href: "/release-notes",
		icon: FileText,
	},
	{
		title: "Documentation",
		href: "/docs",
		icon: FileText,
	},
	{
		title: "Send Feedback",
		href: "/feedback",
		icon: MessageSquare,
	},
	{
		title: "Discord",
		href: "/discord",
		icon: MessageSquare,
	},
];

export function Sidebar({ className }: SidebarProps) {
	const pathname = usePathname();

	return (
		<div
			className={cn(
				"flex h-screen w-64 flex-col border-r bg-gray-50/40 dark:bg-gray-900/40",
				className,
			)}
		>
			{/* Header */}
			<div className="flex h-14 items-center justify-between border-b px-4">
				<div className="flex items-center gap-2">
					<ChevronDown className="h-4 w-4 text-gray-500" />
					<span className="font-semibold text-gray-900 dark:text-gray-100">
						Solomon Codes
					</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="h-6 w-6 rounded border bg-white dark:bg-gray-800" />
				</div>
			</div>

			{/* Navigation */}
			<div className="flex-1 overflow-auto py-4">
				<nav className="space-y-6 px-3">
					{/* Main Navigation */}
					<div>
						<ul className="space-y-1">
							{navigationItems.map((item) => {
								const isActive = pathname === item.href;
								return (
									<li key={item.href}>
										<Link
											href={item.href}
											className={cn(
												"flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
												isActive
													? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
													: "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
											)}
										>
											<item.icon className="h-4 w-4" />
											{item.title}
										</Link>
									</li>
								);
							})}
						</ul>
					</div>

					{/* Configure Section */}
					<div>
						<h3 className="mb-2 px-3 font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
							Configure
						</h3>
						<ul className="space-y-1">
							{configureItems.map((item) => {
								const isActive = pathname === item.href;
								return (
									<li key={item.href}>
										<Link
											href={item.href}
											className={cn(
												"flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
												isActive
													? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
													: "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
											)}
										>
											<item.icon className="h-4 w-4" />
											{item.title}
										</Link>
									</li>
								);
							})}
						</ul>
					</div>

					{/* Support Section */}
					<div>
						<h3 className="mb-2 px-3 font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
							Support
						</h3>
						<ul className="space-y-1">
							{supportItems.map((item) => {
								const isActive = pathname === item.href;
								return (
									<li key={item.href}>
										<Link
											href={item.href}
											className={cn(
												"flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
												isActive
													? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
													: "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
											)}
										>
											<item.icon className="h-4 w-4" />
											{item.title}
										</Link>
									</li>
								);
							})}
						</ul>
					</div>
				</nav>
			</div>

			{/* User Profile */}
			<div className="border-t p-4">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-700">
						<User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium text-gray-900 text-sm dark:text-gray-100">
							Ryan Lisse
						</p>
					</div>
					<ChevronDown className="h-4 w-4 text-gray-500" />
				</div>
			</div>
		</div>
	);
}
