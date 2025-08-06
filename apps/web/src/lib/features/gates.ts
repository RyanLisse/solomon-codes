import React from "react";
import { getConfigurationService } from "../config/service";
import { createContextLogger } from "../logging/factory";

/**
 * Feature gate definitions
 */
export interface FeatureGates {
	// Environment detection
	isDevelopment: boolean;
	isStaging: boolean;
	isProduction: boolean;

	// Development tools
	enableDebugTools: boolean;
	enableDevToolbar: boolean;
	enableReactDevTools: boolean;
	enableReduxDevTools: boolean;

	// Data and testing
	enableMockData: boolean;
	enableTestFixtures: boolean;
	enableSeedData: boolean;

	// Logging and monitoring
	enableDetailedLogging: boolean;
	enablePerformanceMonitoring: boolean;
	enableErrorReporting: boolean;
	enableTelemetry: boolean;

	// Security
	requireSecureEndpoints: boolean;
	enableCORS: boolean;
	enableCSRF: boolean;

	// Features
	enableExperimentalFeatures: boolean;
	enableBetaFeatures: boolean;
	enableStagehandIntegration: boolean;
	enableVibeKitIntegration: boolean;
	enableGitHubIntegration: boolean;

	// API features
	enableRateLimiting: boolean;
	enableCaching: boolean;
	enableCompression: boolean;
}

/**
 * Feature gate service for managing environment-based functionality
 */
export class FeatureGateService {
	private configService = getConfigurationService();
	private logger = createContextLogger("feature-gates");
	private gates: FeatureGates | null = null;

	constructor() {
		// Initialize with default gates, will be properly set in initialize()
		this.gates = this.getDefaultGates();
	}

	/**
	 * Initialize the feature gates service
	 */
	async initialize(): Promise<void> {
		this.gates = await this.initializeGates();
		await this.logFeatureGateStatus();
	}

	/**
	 * Get default feature gates for fallback
	 */
	private getDefaultGates(): FeatureGates {
		return {
			isDevelopment: process.env.NODE_ENV === "development",
			isStaging:
				process.env.NODE_ENV === "staging" || process.env.NODE_ENV === "test",
			isProduction: process.env.NODE_ENV === "production",
			enableDebugTools: false,
			enableDevToolbar: false,
			enableReactDevTools: false,
			enableReduxDevTools: false,
			enableMockData: false,
			enableTestFixtures: false,
			enableSeedData: false,
			enableDetailedLogging: false,
			enablePerformanceMonitoring: false,
			enableErrorReporting: false,
			enableTelemetry: false,
			requireSecureEndpoints: true,
			enableCORS: false,
			enableCSRF: true,
			enableExperimentalFeatures: false,
			enableBetaFeatures: false,
			enableStagehandIntegration: false,
			enableVibeKitIntegration: false,
			enableGitHubIntegration: false,
			enableRateLimiting: true,
			enableCaching: true,
			enableCompression: true,
		};
	}

	/**
	 * Initialize feature gates based on environment and configuration
	 */
	private async initializeGates(): Promise<FeatureGates> {
		const config = await this.configService.getConfiguration();
		const profile = await this.configService.getProfile();
		const apiConfig = await this.configService.getApiConfig();

		return {
			// Environment detection
			isDevelopment: config.nodeEnv === "development",
			isStaging: config.nodeEnv === "staging",
			isProduction: config.nodeEnv === "production",

			// Development tools
			enableDebugTools: profile.features.enableDebugTools,
			enableDevToolbar: config.nodeEnv === "development",
			enableReactDevTools: config.nodeEnv !== "production",
			enableReduxDevTools: config.nodeEnv !== "production",

			// Data and testing
			enableMockData: profile.features.enableMockData,
			enableTestFixtures: config.nodeEnv === "development",
			enableSeedData: config.nodeEnv !== "production",

			// Logging and monitoring
			enableDetailedLogging: profile.features.enableDetailedLogging,
			enablePerformanceMonitoring: config.nodeEnv !== "development",
			enableErrorReporting: config.nodeEnv === "production",
			enableTelemetry: profile.features.enableTelemetry,

			// Security
			requireSecureEndpoints: profile.features.requireSecureEndpoints,
			enableCORS: config.nodeEnv !== "production",
			enableCSRF: config.nodeEnv === "production",

			// Features
			enableExperimentalFeatures: config.nodeEnv === "development",
			enableBetaFeatures: config.nodeEnv !== "production",
			enableStagehandIntegration: apiConfig.browserbase.isConfigured,
			enableVibeKitIntegration: false, // Temporarily disabled
			enableGitHubIntegration: true, // Always enabled for now

			// API features
			enableRateLimiting: config.nodeEnv === "production",
			enableCaching: config.nodeEnv !== "development",
			enableCompression: config.nodeEnv === "production",
		};
	}

	/**
	 * Log the current feature gate status
	 */
	private async logFeatureGateStatus(): Promise<void> {
		const config = await this.configService.getConfiguration();
		this.logger.info("Feature gates initialized", {
			environment: config.nodeEnv,
			gates: this.gates,
		});
	}

	/**
	 * Check if a feature is enabled
	 */
	isEnabled(feature: keyof FeatureGates): boolean {
		return this.gates?.[feature] ?? false;
	}

	/**
	 * Get all feature gates
	 */
	getAllGates(): FeatureGates {
		return { ...(this.gates || this.getDefaultGates()) };
	}

	/**
	 * Get enabled features only
	 */
	getEnabledFeatures(): Partial<FeatureGates> {
		const enabled: Partial<FeatureGates> = {};
		const gates = this.gates || this.getDefaultGates();

		for (const [key, value] of Object.entries(gates)) {
			if (value) {
				enabled[key as keyof FeatureGates] = value;
			}
		}

		return enabled;
	}

	/**
	 * Check if running in development mode
	 */
	isDevelopment(): boolean {
		const gates = this.gates || this.getDefaultGates();
		return gates.isDevelopment;
	}

	/**
	 * Check if running in staging mode
	 */
	isStaging(): boolean {
		const gates = this.gates || this.getDefaultGates();
		return gates.isStaging;
	}

	/**
	 * Check if running in production mode
	 */
	isProduction(): boolean {
		const gates = this.gates || this.getDefaultGates();
		return gates.isProduction;
	}

	/**
	 * Check if debug tools should be enabled
	 */
	shouldEnableDebugTools(): boolean {
		const gates = this.gates || this.getDefaultGates();
		return gates.enableDebugTools;
	}

	/**
	 * Check if mock data should be used
	 */
	shouldUseMockData(): boolean {
		const gates = this.gates || this.getDefaultGates();
		return gates.enableMockData;
	}

	/**
	 * Check if detailed logging should be enabled
	 */
	shouldEnableDetailedLogging(): boolean {
		const gates = this.gates || this.getDefaultGates();
		return gates.enableDetailedLogging;
	}

	/**
	 * Check if telemetry should be enabled
	 */
	shouldEnableTelemetry(): boolean {
		const gates = this.gates || this.getDefaultGates();
		return gates.enableTelemetry;
	}

	/**
	 * Check if secure endpoints are required
	 */
	shouldRequireSecureEndpoints(): boolean {
		const gates = this.gates || this.getDefaultGates();
		return gates.requireSecureEndpoints;
	}

	/**
	 * Check if experimental features should be enabled
	 */
	shouldEnableExperimentalFeatures(): boolean {
		const gates = this.gates || this.getDefaultGates();
		return gates.enableExperimentalFeatures;
	}

	/**
	 * Get feature gate status for monitoring/debugging
	 */
	async getStatus(): Promise<{
		environment: string;
		totalGates: number;
		enabledGates: number;
		disabledGates: number;
		criticalFeatures: {
			debugTools: boolean;
			mockData: boolean;
			telemetry: boolean;
			secureEndpoints: boolean;
		};
	}> {
		const gates = this.gates || this.getDefaultGates();
		const allGates = Object.values(gates);
		const enabledCount = allGates.filter(Boolean).length;

		const config = await this.configService.getConfiguration();
		return {
			environment: config.nodeEnv,
			totalGates: allGates.length,
			enabledGates: enabledCount,
			disabledGates: allGates.length - enabledCount,
			criticalFeatures: {
				debugTools: gates.enableDebugTools,
				mockData: gates.enableMockData,
				telemetry: gates.enableTelemetry,
				secureEndpoints: gates.requireSecureEndpoints,
			},
		};
	}
}

/**
 * Global feature gate service instance
 */
let _featureGateService: FeatureGateService | null = null;

/**
 * Get the global feature gate service instance
 */
export function getFeatureGateService(): FeatureGateService {
	if (!_featureGateService) {
		_featureGateService = new FeatureGateService();
	}
	return _featureGateService;
}

/**
 * Reset feature gate service (for testing)
 */
export function resetFeatureGateService(): void {
	_featureGateService = null;
}

/**
 * Convenience function to check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureGates): boolean {
	return getFeatureGateService().isEnabled(feature);
}

/**
 * Environment detection utilities
 */
export const Environment = {
	isDevelopment: () => getFeatureGateService().isDevelopment(),
	isStaging: () => getFeatureGateService().isStaging(),
	isProduction: () => getFeatureGateService().isProduction(),
} as const;

/**
 * Feature-specific utilities
 */
export const Features = {
	debugTools: () => getFeatureGateService().shouldEnableDebugTools(),
	mockData: () => getFeatureGateService().shouldUseMockData(),
	detailedLogging: () => getFeatureGateService().shouldEnableDetailedLogging(),
	telemetry: () => getFeatureGateService().shouldEnableTelemetry(),
	secureEndpoints: () => getFeatureGateService().shouldRequireSecureEndpoints(),
	experimentalFeatures: () =>
		getFeatureGateService().shouldEnableExperimentalFeatures(),
} as const;

/**
 * React hook for using feature gates in components
 */
export function useFeatureGates() {
	const service = getFeatureGateService();

	return {
		isEnabled: (feature: keyof FeatureGates) => service.isEnabled(feature),
		getAllGates: () => service.getAllGates(),
		getEnabledFeatures: () => service.getEnabledFeatures(),
		isDevelopment: () => service.isDevelopment(),
		isStaging: () => service.isStaging(),
		isProduction: () => service.isProduction(),
		Environment,
		Features,
	};
}

/**
 * Higher-order component for feature gating
 */
export function withFeatureGate<P extends object>(
	feature: keyof FeatureGates,
	fallback?: React.ComponentType<P> | null,
) {
	return function FeatureGatedComponent(Component: React.ComponentType<P>) {
		return function WrappedComponent(props: P) {
			const isEnabled = isFeatureEnabled(feature);

			if (!isEnabled) {
				return fallback ? React.createElement(fallback, props) : null;
			}

			return React.createElement(Component, props);
		};
	};
}

/**
 * Feature gate component for conditional rendering
 */
export function FeatureGate({
	feature,
	children,
	fallback = null,
}: {
	feature: keyof FeatureGates;
	children: React.ReactNode;
	fallback?: React.ReactNode;
}) {
	const isEnabled = isFeatureEnabled(feature);

	return isEnabled ? children : fallback;
}
