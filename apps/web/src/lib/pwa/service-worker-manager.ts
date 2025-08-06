// Service Worker Manager for PWA functionality
// Handles registration, updates, and communication with service worker
import {
	type BaseErrorContext,
	ErrorCodes,
	ErrorSeverity,
	SystemError,
} from "../config";

/**
 * Client-safe logger for Service Worker operations
 * Avoids Winston dependencies that cause client-side issues
 */
class ClientSafeLogger {
	constructor(private context: { serviceName: string }) {}

	info(message: string, meta?: Record<string, unknown>) {
		console.log(
			`[${this.context.serviceName}] INFO: ${message}`,
			meta ? meta : "",
		);
	}

	warn(message: string, meta?: Record<string, unknown>) {
		console.warn(
			`[${this.context.serviceName}] WARN: ${message}`,
			meta ? meta : "",
		);
	}

	error(message: string, meta?: Record<string, unknown>) {
		console.error(
			`[${this.context.serviceName}] ERROR: ${message}`,
			meta ? meta : "",
		);
	}
}

/**
 * Service Worker specific error types for detailed error handling
 */
export enum ServiceWorkerErrorType {
	REGISTRATION_FAILED = "REGISTRATION_FAILED",
	UPDATE_FAILED = "UPDATE_FAILED",
	CACHE_ERROR = "CACHE_ERROR",
	COMMUNICATION_ERROR = "COMMUNICATION_ERROR",
	UNSUPPORTED_BROWSER = "UNSUPPORTED_BROWSER",
	NETWORK_ERROR = "NETWORK_ERROR",
	SCRIPT_PARSE_ERROR = "SCRIPT_PARSE_ERROR",
	SECURITY_ERROR = "SECURITY_ERROR",
	QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
	TIMEOUT_ERROR = "TIMEOUT_ERROR",
}

/**
 * Enhanced Service Worker error with detailed context
 */
export class ServiceWorkerError extends SystemError {
	public readonly swErrorType: ServiceWorkerErrorType;
	public readonly registrationScope?: string;
	public readonly scriptUrl?: string;
	public readonly retryCount?: number;

	constructor(
		message: string,
		swErrorType: ServiceWorkerErrorType,
		context: BaseErrorContext & {
			registrationScope?: string;
			scriptUrl?: string;
			retryCount?: number;
		} = {},
		severity: ErrorSeverity = ErrorSeverity.HIGH,
	) {
		super(message, ErrorCodes.SERVICE_UNAVAILABLE, context, severity);
		this.swErrorType = swErrorType;
		this.registrationScope = context.registrationScope;
		this.scriptUrl = context.scriptUrl;
		this.retryCount = context.retryCount;
	}
}

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
	private logger = new ClientSafeLogger({
		serviceName: "service-worker-manager",
	});
	private retryAttempts = new Map<string, number>();
	private readonly maxRetries = 3;
	private readonly retryDelay = 1000;

	constructor() {
		this.setupEventListeners();
		this.logger.info("Service Worker Manager initialized", {
			component: "service-worker-manager",
			action: "constructor",
		});
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
			const error = new ServiceWorkerError(
				"Service Workers not supported in this browser",
				ServiceWorkerErrorType.UNSUPPORTED_BROWSER,
				{
					component: "service-worker-manager",
					action: "register",
				},
				ErrorSeverity.MEDIUM,
			);

			this.logger.warn(
				"Service Worker registration aborted - unsupported browser",
				{
					error: error.toStructuredError(),
				},
			);

			this.emit("registration-error", error);
			return false;
		}

		const scriptUrl = "/sw.js";
		const retryKey = `register-${scriptUrl}`;
		const currentRetries = this.retryAttempts.get(retryKey) || 0;

		try {
			this.logger.info("Registering Service Worker", {
				component: "service-worker-manager",
				action: "register",
				scriptUrl,
				retryAttempt: currentRetries,
			});

			this.registration = await navigator.serviceWorker.register(scriptUrl, {
				scope: "/",
				updateViaCache: "none", // Always check for updates
			});

			this.logger.info("Service Worker registered successfully", {
				component: "service-worker-manager",
				action: "register",
				scope: this.registration.scope,
				scriptURL: this.registration.scope,
			});

			// Reset retry count on successful registration
			this.retryAttempts.delete(retryKey);

			// Set up update detection
			this.setupUpdateDetection();

			// Check for immediate updates
			await this.checkForUpdates();

			this.emit("registration-success", this.registration);
			return true;
		} catch (error) {
			const swError = this.createServiceWorkerError(
				error,
				scriptUrl,
				currentRetries,
			);

			this.logger.error("Service Worker registration failed", {
				error: swError.toStructuredError(),
				originalError: error instanceof Error ? error.message : String(error),
				retryAttempt: currentRetries,
				willRetry: currentRetries < this.maxRetries,
			});

			// Retry logic for retryable errors
			if (currentRetries < this.maxRetries && this.isRetryableError(swError)) {
				this.retryAttempts.set(retryKey, currentRetries + 1);

				this.logger.info("Retrying Service Worker registration", {
					component: "service-worker-manager",
					action: "register-retry",
					retryAttempt: currentRetries + 1,
					maxRetries: this.maxRetries,
					delayMs: this.retryDelay,
				});

				// Wait before retry
				await new Promise((resolve) => setTimeout(resolve, this.retryDelay));

				// Recursive retry
				return this.register();
			}

			this.emit("registration-error", swError);
			return false;
		}
	}

	private setupUpdateDetection() {
		if (!this.registration) return;

		this.logger.info("Setting up Service Worker update detection", {
			component: "service-worker-manager",
			action: "setupUpdateDetection",
			scope: this.registration.scope,
		});

		// Listen for updates
		this.registration.addEventListener("updatefound", () => {
			const newWorker = this.registration?.installing;
			if (!newWorker) return;

			this.logger.info("New Service Worker found during update check", {
				component: "service-worker-manager",
				action: "updatefound",
				workerState: newWorker.state,
				scriptURL: newWorker.scriptURL,
			});

			newWorker.addEventListener("statechange", () => {
				this.logger.info("Service Worker state changed", {
					component: "service-worker-manager",
					action: "worker-statechange",
					newState: newWorker.state,
					hasController: !!navigator.serviceWorker.controller,
				});

				if (
					newWorker.state === "installed" &&
					navigator.serviceWorker.controller
				) {
					this.logger.info("Service Worker update available", {
						component: "service-worker-manager",
						action: "update-available",
						workerState: newWorker.state,
					});

					this.updateAvailable = true;
					this.emit("update-available", true);
				}
			});
		});

		// Listen for controlling service worker changes
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			this.logger.info("Service Worker controller changed", {
				component: "service-worker-manager",
				action: "controllerchange",
				updateAvailable: this.updateAvailable,
				willReload: this.updateAvailable,
			});

			this.emit("controller-change", true);

			// Reload the page to get the latest version
			if (this.updateAvailable) {
				this.logger.info("Reloading page to apply Service Worker update", {
					component: "service-worker-manager",
					action: "page-reload",
				});
				window.location.reload();
			}
		});
	}

	async checkForUpdates(): Promise<boolean> {
		if (!this.registration) {
			this.logger.warn(
				"Cannot check for updates - no Service Worker registration",
				{
					component: "service-worker-manager",
					action: "checkForUpdates",
				},
			);
			return false;
		}

		const retryKey = "update-check";
		const currentRetries = this.retryAttempts.get(retryKey) || 0;

		try {
			this.logger.info("Checking for Service Worker updates", {
				component: "service-worker-manager",
				action: "checkForUpdates",
				retryAttempt: currentRetries,
				scope: this.registration.scope,
			});

			await this.registration.update();

			this.logger.info("Service Worker update check completed", {
				component: "service-worker-manager",
				action: "checkForUpdates",
			});

			// Reset retry count on successful update check
			this.retryAttempts.delete(retryKey);
			return true;
		} catch (error) {
			const swError = this.createServiceWorkerError(
				error,
				this.registration.scope,
				currentRetries,
				ServiceWorkerErrorType.UPDATE_FAILED,
			);

			this.logger.error("Service Worker update check failed", {
				error: swError.toStructuredError(),
				originalError: error instanceof Error ? error.message : String(error),
				retryAttempt: currentRetries,
				willRetry: currentRetries < this.maxRetries,
			});

			// Retry logic for retryable errors
			if (currentRetries < this.maxRetries && this.isRetryableError(swError)) {
				this.retryAttempts.set(retryKey, currentRetries + 1);

				// Wait before retry
				await new Promise((resolve) => setTimeout(resolve, this.retryDelay));

				// Recursive retry
				return this.checkForUpdates();
			}

			this.emit("update-check-error", swError);
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

	/**
	 * Create a ServiceWorkerError from a caught error with proper categorization
	 */
	private createServiceWorkerError(
		error: unknown,
		scriptUrl: string,
		retryCount: number,
		errorType?: ServiceWorkerErrorType,
	): ServiceWorkerError {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorName = error instanceof Error ? error.name : "Unknown";

		// Determine error type based on error characteristics
		let swErrorType = errorType;
		if (!swErrorType) {
			if (
				errorMessage.includes("Failed to fetch") ||
				errorMessage.includes("NetworkError")
			) {
				swErrorType = ServiceWorkerErrorType.NETWORK_ERROR;
			} else if (
				errorMessage.includes("SecurityError") ||
				errorMessage.includes("The operation is insecure")
			) {
				swErrorType = ServiceWorkerErrorType.SECURITY_ERROR;
			} else if (
				errorMessage.includes("SyntaxError") ||
				errorMessage.includes("Unexpected token")
			) {
				swErrorType = ServiceWorkerErrorType.SCRIPT_PARSE_ERROR;
			} else if (
				errorMessage.includes("QuotaExceededError") ||
				errorMessage.includes("storage quota")
			) {
				swErrorType = ServiceWorkerErrorType.QUOTA_EXCEEDED;
			} else if (
				errorMessage.includes("timeout") ||
				errorMessage.includes("TimeoutError")
			) {
				swErrorType = ServiceWorkerErrorType.TIMEOUT_ERROR;
			} else if (
				errorMessage.includes("update") ||
				errorMessage.includes("Update")
			) {
				swErrorType = ServiceWorkerErrorType.UPDATE_FAILED;
			} else {
				swErrorType = ServiceWorkerErrorType.REGISTRATION_FAILED;
			}
		}

		// Determine severity based on error type
		const severity = this.getErrorSeverity(swErrorType);

		return new ServiceWorkerError(
			`Service Worker ${swErrorType.toLowerCase().replace("_", " ")}: ${errorMessage}`,
			swErrorType,
			{
				component: "service-worker-manager",
				action: "error-handling",
				scriptUrl,
				retryCount,
				registrationScope: this.registration?.scope,
				metadata: {
					originalErrorName: errorName,
					originalErrorMessage: errorMessage,
					userAgent:
						typeof navigator !== "undefined" ? navigator.userAgent : undefined,
				},
			},
			severity,
		);
	}

	/**
	 * Determine if an error is retryable based on its type and characteristics
	 */
	private isRetryableError(error: ServiceWorkerError): boolean {
		const retryableTypes = new Set([
			ServiceWorkerErrorType.NETWORK_ERROR,
			ServiceWorkerErrorType.UPDATE_FAILED,
			ServiceWorkerErrorType.TIMEOUT_ERROR,
			ServiceWorkerErrorType.COMMUNICATION_ERROR,
		]);

		return retryableTypes.has(error.swErrorType);
	}

	/**
	 * Get appropriate error severity based on Service Worker error type
	 */
	private getErrorSeverity(errorType: ServiceWorkerErrorType): ErrorSeverity {
		switch (errorType) {
			case ServiceWorkerErrorType.UNSUPPORTED_BROWSER:
				return ErrorSeverity.LOW;
			case ServiceWorkerErrorType.QUOTA_EXCEEDED:
			case ServiceWorkerErrorType.CACHE_ERROR:
				return ErrorSeverity.MEDIUM;
			case ServiceWorkerErrorType.SECURITY_ERROR:
			case ServiceWorkerErrorType.SCRIPT_PARSE_ERROR:
				return ErrorSeverity.HIGH;
			case ServiceWorkerErrorType.REGISTRATION_FAILED:
			case ServiceWorkerErrorType.COMMUNICATION_ERROR:
				return ErrorSeverity.HIGH;
			default:
				return ErrorSeverity.MEDIUM;
		}
	}

	/**
	 * Enhanced cache status with error handling and logging
	 */
	private async getCacheStatus(): Promise<Record<string, number>> {
		return new Promise((resolve, reject) => {
			if (!this.registration?.active) {
				const error = new ServiceWorkerError(
					"Cannot get cache status - no active Service Worker",
					ServiceWorkerErrorType.COMMUNICATION_ERROR,
					{
						component: "service-worker-manager",
						action: "getCacheStatus",
					},
				);

				this.logger.warn("Cache status request failed", {
					error: error.toStructuredError(),
				});

				reject(error);
				return;
			}

			const messageChannel = new MessageChannel();
			const timeoutId = setTimeout(() => {
				const timeoutError = new ServiceWorkerError(
					"Cache status request timed out after 5 seconds",
					ServiceWorkerErrorType.TIMEOUT_ERROR,
					{
						component: "service-worker-manager",
						action: "getCacheStatus",
					},
				);

				this.logger.error("Cache status request timeout", {
					error: timeoutError.toStructuredError(),
				});

				reject(timeoutError);
			}, 5000);

			messageChannel.port1.onmessage = (event) => {
				clearTimeout(timeoutId);

				this.logger.info("Cache status received", {
					component: "service-worker-manager",
					action: "getCacheStatus",
					cacheCount: Object.keys(event.data || {}).length,
				});

				resolve(event.data);
			};

			try {
				this.registration.active.postMessage({ type: "GET_CACHE_STATUS" }, [
					messageChannel.port2,
				]);
			} catch (error) {
				clearTimeout(timeoutId);

				const commError = new ServiceWorkerError(
					`Failed to send cache status request: ${error instanceof Error ? error.message : String(error)}`,
					ServiceWorkerErrorType.COMMUNICATION_ERROR,
					{
						component: "service-worker-manager",
						action: "getCacheStatus",
					},
				);

				this.logger.error("Cache status communication failed", {
					error: commError.toStructuredError(),
				});

				reject(commError);
			}
		});
	}

	// Cleanup
	destroy(): void {
		this.logger.info("Service Worker Manager destroyed", {
			component: "service-worker-manager",
			action: "destroy",
		});

		this.listeners.clear();
		this.retryAttempts.clear();
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
