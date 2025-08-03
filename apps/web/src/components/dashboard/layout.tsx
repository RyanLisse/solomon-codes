"use client";

import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
	children: React.ReactNode;
	className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
	return (
		<div className={cn("flex h-screen overflow-hidden", className)}>
			<Sidebar />
			<main className="flex-1 overflow-auto bg-white dark:bg-gray-950">
				{children}
			</main>
		</div>
	);
}
