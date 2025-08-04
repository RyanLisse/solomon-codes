// Service Worker Manager for PWA functionality
// Handles registration, updates, and communication with service worker

export interface ServiceWorkerStatus {
	isSupported: boolean;
	isRegistered: boolean;
	isUpdateAvailable: boolean;
	isOnline: boolean;
	cacheStatus?: Record<string, number>;
}

export interface PWAInstallPrompt {
	prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

export class ServiceWorkerManager {
	private registration: ServiceWorkerRegistration | null = null;
	private updateAvailable = false;
	private installPrompt: PWAInstallPrompt | null = null;
	private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

	constructor() {
		this.setupEventListeners();
	}

	private setupEventListeners() {
		// Listen for beforeinstallprompt event
		if (typeof window !== "undefined") {
			window.addEventListener("beforeinstallprompt", (event) => {
				event.preventDefault();
				this.installPrompt = event as unknown as PWAInstallPrompt;
				this.emit("install-prompt-available", true);
			});

			// Listen for app installed event
			window.addEventListener("appinstalled", () => {
				this.installPrompt = null;
				this.emit("app-installed", true);
			});

			// Listen for online/offline events
			window.addEventListener("online", () => {
				this.emit("online-status", true);
			});

			window.addEventListener("offline", () => {
				this.emit("online-status", false);
			});
		}
	}

	async register(): Promise<boolean> {
		if (!this.isServiceWorkerSupported()) {
			console.warn("[PWA] Service Workers not supported");
			return false;
		}

		try {
			console.log("[PWA] Registering service worker...");

			this.registration = await navigator.serviceWorker.register("/sw.js", {
				scope: "/",
				updateViaCache: "none", // Always check for updates
			});

			console.log("[PWA] Service worker registered:", this.registration.scope);

			// Set up update detection
			this.setupUpdateDetection();

			// Check for immediate updates
			await this.checkForUpdates();

			this.emit("registration-success", this.registration);
			return true;
		} catch (error) {
			console.error("[PWA] Service worker registration failed:", error);
			this.emit("registration-error", error);
			return false;
		}
	}

	private setupUpdateDetection() {
		if (!this.registration) return;

		// Listen for updates
		this.registration.addEventListener("updatefound", () => {
			const newWorker = this.registration?.installing;
			if (!newWorker) return;

			console.log("[PWA] New service worker found");

			newWorker.addEventListener("statechange", () => {
				if (
					newWorker.state === "installed" &&
					navigator.serviceWorker.controller
				) {
					console.log("[PWA] New service worker installed, update available");
					this.updateAvailable = true;
					this.emit("update-available", true);
				}
			});
		});

		// Listen for controlling service worker changes
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			console.log("[PWA] Service worker controller changed");
			this.emit("controller-change", true);

			// Reload the page to get the latest version
			if (this.updateAvailable) {
				window.location.reload();
			}
		});
	}

	async checkForUpdates(): Promise<boolean> {
		if (!this.registration) return false;

		try {
			await this.registration.update();
			return true;
		} catch (error) {
			console.error("[PWA] Update check failed:", error);
			return false;
		}
	}

	async applyUpdate(): Promise<void> {
		if (!this.registration?.waiting) {
			throw new Error("No service worker update available");
		}

		// Send skip waiting message to the waiting service worker
		this.registration.waiting.postMessage({ type: "SKIP_WAITING" });
	}

	async getStatus(): Promise<ServiceWorkerStatus> {
		const isSupported = this.isServiceWorkerSupported();
		const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

		let cacheStatus: Record<string, number> | undefined;

		if (this.registration?.active) {
			try {
				cacheStatus = await this.getCacheStatus();
			} catch (error) {
				console.warn("[PWA] Failed to get cache status:", error);
			}
		}

		return {
			isSupported,
			isRegistered: !!this.registration,
			isUpdateAvailable: this.updateAvailable,
			isOnline,
			cacheStatus,
		};
	}

	private async getCacheStatus(): Promise<Record<string, number>> {
		return new Promise((resolve, reject) => {
			if (!this.registration?.active) {
				reject(new Error("No active service worker"));
				return;
			}

			const messageChannel = new MessageChannel();

			messageChannel.port1.onmessage = (event) => {
				resolve(event.data);
			};

			this.registration.active.postMessage({ type: "GET_CACHE_STATUS" }, [
				messageChannel.port2,
			]);

			// Timeout after 5 seconds
			setTimeout(() => {
				reject(new Error("Cache status request timeout"));
			}, 5000);
		});
	}

	async invalidateCache(pattern?: string): Promise<void> {
		if (!this.registration?.active) {
			throw new Error("No active service worker");
		}

		this.registration.active.postMessage({
			type: "CACHE_INVALIDATE",
			payload: { pattern },
		});
	}

	// PWA Installation
	async showInstallPrompt(): Promise<boolean> {
		if (!this.installPrompt) {
			throw new Error("Install prompt not available");
		}

		try {
			const result = await this.installPrompt.prompt();
			console.log("[PWA] Install prompt result:", result.outcome);

			if (result.outcome === "accepted") {
				this.emit("install-accepted", true);
				return true;
			}
			this.emit("install-dismissed", true);
			return false;
		} catch (error) {
			console.error("[PWA] Install prompt failed:", error);
			this.emit("install-error", error);
			return false;
		}
	}

	isInstallPromptAvailable(): boolean {
		return !!this.installPrompt;
	}

	isServiceWorkerSupported(): boolean {
		return typeof navigator !== "undefined" && "serviceWorker" in navigator;
	}

	// Event handling
	on(event: string, callback: (data: unknown) => void): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)?.add(callback);
	}

	off(event: string, callback: (data: unknown) => void): void {
		const eventListeners = this.listeners.get(event);
		if (eventListeners) {
			eventListeners.delete(callback);
		}
	}

	private emit(event: string, data: unknown): void {
		const eventListeners = this.listeners.get(event);
		if (eventListeners) {
			eventListeners.forEach((callback) => {
				try {
					callback(data);
				} catch (error) {
					console.error(`[PWA] Event callback error for ${event}:`, error);
				}
			});
		}
	}

	// Cleanup
	destroy(): void {
		this.listeners.clear();
		this.registration = null;
		this.installPrompt = null;
	}
}

// Singleton instance
let swManager: ServiceWorkerManager | null = null;

export function getServiceWorkerManager(): ServiceWorkerManager {
	if (!swManager) {
		swManager = new ServiceWorkerManager();
	}
	return swManager;
}
