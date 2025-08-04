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
  private gates: FeatureGates;

  constructor() {
    this.gates = this.initializeGates();
    this.logFeatureGateStatus();
  }

  /**
   * Initialize feature gates based on environment and configuration
   */
  private initializeGates(): FeatureGates {
    const config = this.configService.getConfiguration();
    const profile = this.configService.getProfile();
    const apiConfig = this.configService.getApiConfig();

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
  private logFeatureGateStatus(): void {
    this.logger.info("Feature gates initialized", {
      environment: this.configService.getConfiguration().nodeEnv,
      gates: this.gates,
    });
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(feature: keyof FeatureGates): boolean {
    return this.gates[feature];
  }

  /**
   * Get all feature gates
   */
  getAllGates(): FeatureGates {
    return { ...this.gates };
  }

  /**
   * Get enabled features only
   */
  getEnabledFeatures(): Partial<FeatureGates> {
    const enabled: Partial<FeatureGates> = {};

    for (const [key, value] of Object.entries(this.gates)) {
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
    return this.gates.isDevelopment;
  }

  /**
   * Check if running in staging mode
   */
  isStaging(): boolean {
    return this.gates.isStaging;
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.gates.isProduction;
  }

  /**
   * Check if debug tools should be enabled
   */
  shouldEnableDebugTools(): boolean {
    return this.gates.enableDebugTools;
  }

  /**
   * Check if mock data should be used
   */
  shouldUseMockData(): boolean {
    return this.gates.enableMockData;
  }

  /**
   * Check if detailed logging should be enabled
   */
  shouldEnableDetailedLogging(): boolean {
    return this.gates.enableDetailedLogging;
  }

  /**
   * Check if telemetry should be enabled
   */
  shouldEnableTelemetry(): boolean {
    return this.gates.enableTelemetry;
  }

  /**
   * Check if secure endpoints are required
   */
  shouldRequireSecureEndpoints(): boolean {
    return this.gates.requireSecureEndpoints;
  }

  /**
   * Check if experimental features should be enabled
   */
  shouldEnableExperimentalFeatures(): boolean {
    return this.gates.enableExperimentalFeatures;
  }

  /**
   * Get feature gate status for monitoring/debugging
   */
  getStatus(): {
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
  } {
    const allGates = Object.values(this.gates);
    const enabledCount = allGates.filter(Boolean).length;

    return {
      environment: this.configService.getConfiguration().nodeEnv,
      totalGates: allGates.length,
      enabledGates: enabledCount,
      disabledGates: allGates.length - enabledCount,
      criticalFeatures: {
        debugTools: this.gates.enableDebugTools,
        mockData: this.gates.enableMockData,
        telemetry: this.gates.enableTelemetry,
        secureEndpoints: this.gates.requireSecureEndpoints,
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
