"use client";

import { Check, Download, Smartphone } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/pwa/pwa-provider";

interface InstallButtonProps {
	variant?: "default" | "outline" | "ghost";
	size?: "default" | "sm" | "lg";
	className?: string;
	showIcon?: boolean;
	children?: React.ReactNode;
}

export function InstallButton({
	variant = "default",
	size = "default",
	className,
	showIcon = true,
	children,
}: InstallButtonProps) {
	const { isInstallable, showInstallPrompt } = useInstallPrompt();
	const [isInstalling, setIsInstalling] = useState(false);
	const [isInstalled, setIsInstalled] = useState(false);

	const handleInstall = async () => {
		if (!isInstallable || isInstalling) return;

		try {
			setIsInstalling(true);
			const accepted = await showInstallPrompt();

			if (accepted) {
				setIsInstalled(true);
				// Reset after animation
				setTimeout(() => setIsInstalled(false), 2000);
			}
		} catch (error) {
			console.error("Install failed:", error);
		} finally {
			setIsInstalling(false);
		}
	};

	// Don't render if not installable
	if (!isInstallable) {
		return null;
	}

	const getButtonContent = () => {
		if (isInstalled) {
			return (
				<>
					{showIcon && <Check className="size-4" />}
					Installed!
				</>
			);
		}

		if (isInstalling) {
			return (
				<>
					{showIcon && (
						<div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
					)}
					Installing...
				</>
			);
		}

		if (children) {
			return children;
		}

		return (
			<>
				{showIcon && <Download className="size-4" />}
				Install App
			</>
		);
	};

	return (
		<Button
			variant={variant}
			size={size}
			className={className}
			onClick={handleInstall}
			disabled={isInstalling || isInstalled}
		>
			{getButtonContent()}
		</Button>
	);
}

// Compact version for mobile
export function InstallButtonCompact() {
	const { isInstallable, showInstallPrompt } = useInstallPrompt();
	const [isInstalling, setIsInstalling] = useState(false);

	if (!isInstallable) return null;

	const handleInstall = async () => {
		if (isInstalling) return;

		try {
			setIsInstalling(true);
			await showInstallPrompt();
		} catch (error) {
			console.error("Install failed:", error);
		} finally {
			setIsInstalling(false);
		}
	};

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleInstall}
			disabled={isInstalling}
			className="gap-1.5"
		>
			{isInstalling ? (
				<div className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
			) : (
				<Smartphone className="size-3" />
			)}
			<span className="hidden sm:inline">
				{isInstalling ? "Installing..." : "Install"}
			</span>
		</Button>
	);
}

// Banner version for prominent display
export function InstallBanner() {
	const { isInstallable, showInstallPrompt } = useInstallPrompt();
	const [isDismissed, setIsDismissed] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);

	if (!isInstallable || isDismissed) return null;

	const handleInstall = async () => {
		if (isInstalling) return;

		try {
			setIsInstalling(true);
			const accepted = await showInstallPrompt();
			if (accepted) {
				setIsDismissed(true);
			}
		} catch (error) {
			console.error("Install failed:", error);
		} finally {
			setIsInstalling(false);
		}
	};

	const handleDismiss = () => {
		setIsDismissed(true);
	};

	return (
		<div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-sm rounded-lg border bg-card p-4 shadow-lg sm:max-w-md">
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0">
					<Smartphone className="size-5 text-primary" />
				</div>

				<div className="min-w-0 flex-1">
					<h3 className="font-medium text-card-foreground text-sm">
						Install Solomon Codes
					</h3>
					<p className="mt-1 text-muted-foreground text-xs">
						Get the full app experience with offline access and faster loading.
					</p>
				</div>
			</div>

			<div className="mt-3 flex gap-2">
				<Button
					variant="default"
					size="sm"
					onClick={handleInstall}
					disabled={isInstalling}
					className="flex-1"
				>
					{isInstalling ? (
						<>
							<div className="mr-1.5 size-3 animate-spin rounded-full border border-current border-t-transparent" />
							Installing...
						</>
					) : (
						<>
							<Download className="mr-1.5 size-3" />
							Install
						</>
					)}
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={handleDismiss}
					disabled={isInstalling}
				>
					Later
				</Button>
			</div>
		</div>
	);
}
