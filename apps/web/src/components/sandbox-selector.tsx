"use client";

import { Cloud, Monitor } from "lucide-react";
import { useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useSandboxStore } from "@/stores/sandbox";

interface SandboxSelectorProps {
	className?: string;
}

export function SandboxSelector({ className }: SandboxSelectorProps) {
	const {
		useLocalSandbox,
		setUseLocalSandbox,
		canUseLocal,
		checkLocalAvailability,
	} = useSandboxStore();

	// Check local availability on mount
	useEffect(() => {
		checkLocalAvailability();
	}, [checkLocalAvailability]);

	if (!canUseLocal) {
		// If local sandbox isn't available, show cloud-only indicator
		return (
			<div
				className={`flex items-center gap-2 text-muted-foreground text-sm ${className}`}
			>
				<Cloud className="h-4 w-4" />
				<span>Cloud Sandbox</span>
			</div>
		);
	}

	return (
		<div className={`flex items-center gap-3 ${className}`}>
			<div className="flex items-center gap-2 text-sm">
				<Cloud
					className={`h-4 w-4 ${!useLocalSandbox ? "text-blue-500" : "text-muted-foreground"}`}
				/>
				<span
					className={
						!useLocalSandbox ? "text-foreground" : "text-muted-foreground"
					}
				>
					Cloud
				</span>
			</div>

			<Switch
				checked={useLocalSandbox}
				onCheckedChange={setUseLocalSandbox}
				aria-label="Toggle between local and cloud sandbox"
			/>

			<div className="flex items-center gap-2 text-sm">
				<Monitor
					className={`h-4 w-4 ${useLocalSandbox ? "text-green-500" : "text-muted-foreground"}`}
				/>
				<span
					className={
						useLocalSandbox ? "text-foreground" : "text-muted-foreground"
					}
				>
					Local
				</span>
			</div>
		</div>
	);
}

// Hook to get current sandbox preference
export function useSandboxPreference() {
	const { useLocalSandbox, canUseLocal } = useSandboxStore();
	return {
		useLocal: useLocalSandbox && canUseLocal,
		canUseLocal,
		preferenceText:
			useLocalSandbox && canUseLocal ? "Local (Dagger)" : "Cloud (E2B)",
	};
}
