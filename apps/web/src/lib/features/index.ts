// Feature Gates
export {
	FeatureGateService,
	getFeatureGateService,
	resetFeatureGateService,
	isFeatureEnabled,
	Environment,
	Features,
	useFeatureGates,
	withFeatureGate,
	FeatureGate,
	type FeatureGates,
} from "./gates";

// Environment Detection
export {
	EnvironmentService,
	getEnvironmentService,
	resetEnvironmentService,
	isDevelopment,
	isStaging,
	isProduction,
	isNonProduction,
	getCurrentEnvironment,
	devLog,
	devWarn,
	envError,
	useEnvironment,
} from "./environment";

// Re-export commonly used utilities
export const FeatureFlags = {
	// Environment checks
	isDev: () => isDevelopment(),
	isStaging: () => isStaging(),
	isProd: () => isProduction(),
	
	// Feature checks
	debugTools: () => isFeatureEnabled("enableDebugTools"),
	mockData: () => isFeatureEnabled("enableMockData"),
	telemetry: () => isFeatureEnabled("enableTelemetry"),
	secureEndpoints: () => isFeatureEnabled("requireSecureEndpoints"),
	experimentalFeatures: () => isFeatureEnabled("enableExperimentalFeatures"),
	
	// Integration checks
	stagehand: () => isFeatureEnabled("enableStagehandIntegration"),
	github: () => isFeatureEnabled("enableGitHubIntegration"),
} as const;