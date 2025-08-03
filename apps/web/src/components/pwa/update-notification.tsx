"use client";

import { CheckCircle, Download, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUpdatePrompt } from "@/lib/pwa/pwa-provider";

export function UpdateNotification() {
	const { showUpdateNotification, applyUpdate, dismissUpdateNotification } =
		useUpdatePrompt();
	const [isUpdating, setIsUpdating] = useState(false);
	const [updateError, setUpdateError] = useState<string | null>(null);

	if (!showUpdateNotification) return null;

	const handleUpdate = async () => {
		if (isUpdating) return;

		try {
			setIsUpdating(true);
			setUpdateError(null);
			await applyUpdate();
			// The page should reload automatically after update
		} catch (error) {
			console.error("Update failed:", error);
			setUpdateError(error instanceof Error ? error.message : "Update failed");
			setIsUpdating(false);
		}
	};

	const handleDismiss = () => {
		if (isUpdating) return;
		dismissUpdateNotification();
	};

	return (
		<div className="fixed top-4 right-4 z-50 max-w-sm rounded-lg border bg-card p-4 shadow-lg">
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0">
					<RefreshCw className="size-5 text-blue-500" />
				</div>

				<div className="min-w-0 flex-1">
					<h3 className="font-medium text-card-foreground text-sm">
						Update Available
					</h3>
					<p className="mt-1 text-muted-foreground text-xs">
						A new version of the app is ready. Update now for the latest
						features and improvements.
					</p>

					{updateError && (
						<p className="mt-2 text-destructive text-xs">{updateError}</p>
					)}
				</div>

				{!isUpdating && (
					<button
						type="button"
						onClick={handleDismiss}
						className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						aria-label="Dismiss update notification"
					>
						<X className="size-4" />
					</button>
				)}
			</div>

			<div className="mt-3 flex gap-2">
				<Button
					variant="default"
					size="sm"
					onClick={handleUpdate}
					disabled={isUpdating}
					className="flex-1"
				>
					{isUpdating ? (
						<>
							<div className="mr-1.5 size-3 animate-spin rounded-full border border-current border-t-transparent" />
							Updating...
						</>
					) : (
						<>
							<Download className="mr-1.5 size-3" />
							Update Now
						</>
					)}
				</Button>

				{!isUpdating && (
					<Button variant="ghost" size="sm" onClick={handleDismiss}>
						Later
					</Button>
				)}
			</div>
		</div>
	);
}

// Compact update notification for mobile
export function UpdateNotificationCompact() {
	const { showUpdateNotification, applyUpdate, dismissUpdateNotification } =
		useUpdatePrompt();
	const [isUpdating, setIsUpdating] = useState(false);

	if (!showUpdateNotification) return null;

	const handleUpdate = async () => {
		if (isUpdating) return;

		try {
			setIsUpdating(true);
			await applyUpdate();
		} catch (error) {
			console.error("Update failed:", error);
			setIsUpdating(false);
		}
	};

	return (
		<div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-xs rounded-lg border bg-card p-3 shadow-lg">
			<div className="flex items-center gap-2">
				<RefreshCw className="size-4 flex-shrink-0 text-blue-500" />
				<span className="min-w-0 flex-1 font-medium text-sm">Update ready</span>

				<div className="flex gap-1">
					<Button
						variant="default"
						size="sm"
						onClick={handleUpdate}
						disabled={isUpdating}
						className="h-7 px-2 text-xs"
					>
						{isUpdating ? (
							<div className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
						) : (
							"Update"
						)}
					</Button>

					{!isUpdating && (
						<Button
							variant="ghost"
							size="sm"
							onClick={dismissUpdateNotification}
							className="h-7 px-2"
						>
							<X className="size-3" />
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

// Toast-style update notification
export function UpdateToast() {
	const { showUpdateNotification, applyUpdate, dismissUpdateNotification } =
		useUpdatePrompt();
	const [isUpdating, setIsUpdating] = useState(false);
	const [isVisible, setIsVisible] = useState(true);

	if (!showUpdateNotification || !isVisible) return null;

	const handleUpdate = async () => {
		if (isUpdating) return;

		try {
			setIsUpdating(true);
			await applyUpdate();
		} catch (error) {
			console.error("Update failed:", error);
			setIsUpdating(false);
		}
	};

	const handleDismiss = () => {
		setIsVisible(false);
		setTimeout(() => {
			dismissUpdateNotification();
		}, 300); // Allow animation to complete
	};

	return (
		<div
			className={`fixed top-4 right-4 z-50 max-w-md transform transition-all duration-300 ease-in-out ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"} `}
		>
			<div className="rounded-lg border bg-card p-4 shadow-lg">
				<div className="flex items-start gap-3">
					<div className="flex-shrink-0">
						<div className="flex size-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
							<RefreshCw className="size-4 text-blue-600 dark:text-blue-400" />
						</div>
					</div>

					<div className="min-w-0 flex-1">
						<div className="flex items-center justify-between">
							<h3 className="font-medium text-card-foreground text-sm">
								App Update Ready
							</h3>
							{!isUpdating && (
								<button
									type="button"
									onClick={handleDismiss}
									className="ml-2 rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								>
									<X className="size-4" />
								</button>
							)}
						</div>

						<p className="mt-1 text-muted-foreground text-xs">
							A new version is available with performance improvements and bug
							fixes.
						</p>

						<div className="mt-3 flex items-center gap-2">
							<Button
								variant="default"
								size="sm"
								onClick={handleUpdate}
								disabled={isUpdating}
								className="h-8 px-3 text-xs"
							>
								{isUpdating ? (
									<>
										<div className="mr-1.5 size-3 animate-spin rounded-full border border-current border-t-transparent" />
										Updating...
									</>
								) : (
									<>
										<CheckCircle className="mr-1.5 size-3" />
										Update & Reload
									</>
								)}
							</Button>

							{!isUpdating && (
								<Button
									variant="ghost"
									size="sm"
									onClick={handleDismiss}
									className="h-8 px-3 text-xs"
								>
									Remind me later
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
