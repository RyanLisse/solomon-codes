import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SandboxStore {
	useLocalSandbox: boolean;
	setUseLocalSandbox: (useLocal: boolean) => void;
	canUseLocal: boolean;
	checkLocalAvailability: () => void;
}

export const useSandboxStore = create<SandboxStore>()(
	persist(
		(set, get) => ({
			useLocalSandbox: false,
			canUseLocal: false,

			setUseLocalSandbox: (useLocal: boolean) => {
				// Only allow local if it's available
				const { canUseLocal } = get();
				set({ useLocalSandbox: useLocal && canUseLocal });
			},

			checkLocalAvailability: () => {
				// Check if we're in development and Docker is available
				const isDevelopment = process.env.NODE_ENV === "development";
				const hasDocker =
					typeof window !== "undefined" &&
					(!!process.env.DOCKER_HOST || process.platform !== "win32");

				const canUseLocal = isDevelopment && hasDocker;

				set({ canUseLocal });

				// If local is not available but was selected, switch to cloud
				const { useLocalSandbox } = get();
				if (useLocalSandbox && !canUseLocal) {
					set({ useLocalSandbox: false });
				}
			},
		}),
		{
			name: "sandbox-preferences",
			// Only persist the user preference, not capability check
			partialize: (state) => ({ useLocalSandbox: state.useLocalSandbox }),
		},
	),
);
