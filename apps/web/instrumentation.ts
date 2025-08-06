// Extend global type to include our OTEL flag
declare global {
	var __OTEL_INITIALIZED__: boolean | undefined;
}

export function register() {
	// Check if we're running in Edge Runtime - skip initialization if so
	const isEdgeRuntime =
		typeof globalThis !== "undefined" &&
		!!(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;

	if (isEdgeRuntime) {
		console.log("Skipping OpenTelemetry initialization in Edge Runtime");
		return;
	}

	// Safe process.env access with fallback
	const nodeEnv = (globalThis as { process?: NodeJS.Process }).process?.env
		?.NODE_ENV;
	const otelDisabled = (globalThis as { process?: NodeJS.Process }).process?.env
		?.OTEL_SDK_DISABLED;

	// Skip initialization in test environment
	if (nodeEnv === "test") {
		console.log("Skipping OpenTelemetry initialization in test environment");
		return;
	}

	// Check if VibeKit or Inngest has already initialized OpenTelemetry
	if (otelDisabled === "true" || global.__OTEL_INITIALIZED__) {
		console.log("OpenTelemetry already initialized, skipping");
		return;
	}

	try {
		// Mark as initialized to prevent conflicts
		global.__OTEL_INITIALIZED__ = true;

		// Initialize VibeKit telemetry coordination
		initializeVibeKitTelemetry().catch((error) => {
			console.warn("Failed to initialize telemetry:", error);
		});
	} catch (error) {
		console.warn("Failed to initialize telemetry:", error);
		// Continue execution without telemetry rather than crashing
	}
}

async function initializeVibeKitTelemetry() {
	try {
		// Check if we're running in Edge Runtime - skip if so
		const isEdgeRuntime =
			typeof globalThis !== "undefined" &&
			!!(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;

		if (isEdgeRuntime) {
			console.log("Skipping telemetry initialization in Edge Runtime");
			return;
		}

		// Safe process.env access with fallback
		const nodeEnv = (globalThis as { process?: NodeJS.Process }).process?.env
			?.NODE_ENV;

		// Skip telemetry initialization in test environment to avoid config validation issues
		if (nodeEnv === "test") {
			console.log("Skipping telemetry initialization in test environment");
			return;
		}

		// Import and initialize the existing telemetry service
		const { initializeTelemetry } = await import("./src/lib/telemetry");
		await initializeTelemetry();
	} catch (error) {
		console.warn("Failed to initialize VibeKit telemetry coordination:", error);
	}
}
