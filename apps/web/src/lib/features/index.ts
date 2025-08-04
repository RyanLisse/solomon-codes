// Feature Gates
import { isDevelopment, isProduction, isStaging } from "./environment";
import { isFeatureEnabled } from "./gates";

// Environment Detection
export {
	devLog,
	devWarn,
	EnvironmentService,
	envError,
	getCurrentEnvironment,
	getEnvironmentService,
	isDevelopment,
	isNonProduction,
	isProduction,
	isStaging,
	resetEnvironmentService,
	useEnvironment,
} from "./environment";
export {
	Environment,
	FeatureGate,
	FeatureGateService,
	type FeatureGates,
	Features,
	getFeatureGateService,
	isFeatureEnabled,
	resetFeatureGateService,
	useFeatureGates,
	withFeatureGate,
} from "./gates";

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
