// PWA Module - Public API exports

// UI Components
export { UpdateNotification } from "../../components/pwa/update-notification";

// React components and hooks
export {
	PWAProvider,
	useInstallPrompt,
	usePWA,
	useServiceWorkerStatus,
	useUpdatePrompt,
} from "./pwa-provider";
export type {
	PWAInstallPrompt,
	ServiceWorkerStatus,
} from "./service-worker-manager";
// Core PWA functionality
export {
	getServiceWorkerManager,
	ServiceWorkerManager,
} from "./service-worker-manager";

// Types are available through the hooks and components above
