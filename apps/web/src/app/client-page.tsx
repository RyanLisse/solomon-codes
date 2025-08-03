"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

export default function ClientPage() {
	const [isLocalExecution, setIsLocalExecution] = useState(true);

	return (
		<>
			<AppSidebar
				isLocalExecution={isLocalExecution}
				onLocalExecutionChange={setIsLocalExecution}
			/>
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
					<ChatInterface
						isLocalExecution={isLocalExecution}
						onLocalExecutionChange={setIsLocalExecution}
					/>
				</div>
			</SidebarInset>
		</>
	);
}
