"use client";

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	getServiceWorkerManager,
	type ServiceWorkerStatus,
} from "./service-worker-manager";

interface PWAContextType {
	// Service Worker status
	status: ServiceWorkerStatus;
	isLoading: boolean;
	error: string | null;

	// Actions
	checkForUpdates: () => Promise<void>;
	applyUpdate: () => Promise<void>;
	invalidateCache: (pattern?: string) => Promise<void>;

	// Installation
	isInstallable: boolean;
	showInstallPrompt: () => Promise<boolean>;

	// Notifications
	showUpdateNotification: boolean;
	dismissUpdateNotification: () => void;
}

const PWAContext = createContext<PWAContextType | null>(null);

interface PWAProviderProps {
	children: React.ReactNode;
	autoRegister?: boolean;
	checkUpdateInterval?: number; // in milliseconds
}

export function PWAProvider({
	children,
	autoRegister = true,
	checkUpdateInterval = 30000, // 30 seconds
}: PWAProviderProps) {
	const [status, setStatus] = useState<ServiceWorkerStatus>({
		isSupported: false,
		isRegistered: false,
		isUpdateAvailable: false,
		isOnline: true,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isInstallable, setIsInstallable] = useState(false);
	const [showUpdateNotification, setShowUpdateNotification] = useState(false);

	const swManager = getServiceWorkerManager();

	// Status updater
	const updateStatus = useCallback(async () => {
		try {
			const newStatus = await swManager.getStatus();
			setStatus(newStatus);
		} catch (error) {
			console.error("[PWA] Status update failed:", error);
		}
	}, [swManager]);

	// Initialize service worker
	const initialize = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			if (autoRegister) {
				await swManager.register();
			}

			const currentStatus = await swManager.getStatus();
			setStatus(currentStatus);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Unknown error occurred";
			setError(errorMessage);
			console.error("[PWA] Initialization failed:", err);
		} finally {
			setIsLoading(false);
		}
	}, [autoRegister, swManager]);

	// Set up event listeners
	useEffect(() => {
		const handleRegistrationSuccess = () => {
			console.log("[PWA] Registration successful");
			updateStatus();
		};

		const handleRegistrationError = (error: unknown) => {
			console.error("[PWA] Registration failed:", error);
			setError("Service worker registration failed");
		};

		const handleUpdateAvailable = () => {
			console.log("[PWA] Update available");
			setShowUpdateNotification(true);
			updateStatus();
		};

		const handleControllerChange = () => {
			console.log("[PWA] Controller changed");
			updateStatus();
		};

		const handleInstallPromptAvailable = (data: unknown) => {
			setIsInstallable(Boolean(data));
		};

		const handleAppInstalled = () => {
			setIsInstallable(false);
			console.log("[PWA] App installed successfully");
		};

		const handleOnlineStatus = (data: unknown) => {
			setStatus((prev) => ({ ...prev, isOnline: Boolean(data) }));
		};

		// Register event listeners
		swManager.on("registration-success", handleRegistrationSuccess);
		swManager.on("registration-error", handleRegistrationError);
		swManager.on("update-available", handleUpdateAvailable);
		swManager.on("controller-change", handleControllerChange);
		swManager.on("install-prompt-available", handleInstallPromptAvailable);
		swManager.on("app-installed", handleAppInstalled);
		swManager.on("online-status", handleOnlineStatus);

		// Initialize
		initialize();

		// Cleanup
		return () => {
			swManager.off("registration-success", handleRegistrationSuccess);
			swManager.off("registration-error", handleRegistrationError);
			swManager.off("update-available", handleUpdateAvailable);
			swManager.off("controller-change", handleControllerChange);
			swManager.off("install-prompt-available", handleInstallPromptAvailable);
			swManager.off("app-installed", handleAppInstalled);
			swManager.off("online-status", handleOnlineStatus);
		};
	}, [initialize, swManager, updateStatus]);

	// Set up periodic update checks
	useEffect(() => {
		if (!status.isRegistered || checkUpdateInterval <= 0) {
			return;
		}

		const interval = setInterval(async () => {
			try {
				await swManager.checkForUpdates();
			} catch (error) {
				console.warn("[PWA] Periodic update check failed:", error);
			}
		}, checkUpdateInterval);

		return () => clearInterval(interval);
	}, [status.isRegistered, checkUpdateInterval, swManager]);

	const checkForUpdates = useCallback(async () => {
		try {
			setError(null);
			await swManager.checkForUpdates();
			await updateStatus();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Update check failed";
			setError(errorMessage);
			throw error;
		}
	}, [swManager, updateStatus]);

	const applyUpdate = useCallback(async () => {
		try {
			setError(null);
			await swManager.applyUpdate();
			setShowUpdateNotification(false);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Update application failed";
			setError(errorMessage);
			throw error;
		}
	}, [swManager]);

	const invalidateCache = useCallback(
		async (pattern?: string) => {
			try {
				setError(null);
				await swManager.invalidateCache(pattern);
				await updateStatus();
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Cache invalidation failed";
				setError(errorMessage);
				throw error;
			}
		},
		[swManager, updateStatus],
	);

	const showInstallPrompt = useCallback(async (): Promise<boolean> => {
		try {
			setError(null);
			const result = await swManager.showInstallPrompt();
			if (result) {
				setIsInstallable(false);
			}
			return result;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Install prompt failed";
			setError(errorMessage);
			throw error;
		}
	}, [swManager]);

	const dismissUpdateNotification = useCallback(() => {
		setShowUpdateNotification(false);
	}, []);

	const contextValue: PWAContextType = {
		status,
		isLoading,
		error,
		checkForUpdates,
		applyUpdate,
		invalidateCache,
		isInstallable,
		showInstallPrompt,
		showUpdateNotification,
		dismissUpdateNotification,
	};

	return (
		<PWAContext.Provider value={contextValue}>{children}</PWAContext.Provider>
	);
}

export function usePWA(): PWAContextType {
	const context = useContext(PWAContext);
	if (!context) {
		throw new Error("usePWA must be used within a PWAProvider");
	}
	return context;
}

// Utility hooks
export function useServiceWorkerStatus(): ServiceWorkerStatus {
	const { status } = usePWA();
	return status;
}

export function useInstallPrompt() {
	const { isInstallable, showInstallPrompt } = usePWA();
	return { isInstallable, showInstallPrompt };
}

export function useUpdatePrompt() {
	const { showUpdateNotification, applyUpdate, dismissUpdateNotification } =
		usePWA();

	return {
		showUpdateNotification,
		applyUpdate,
		dismissUpdateNotification,
	};
}
