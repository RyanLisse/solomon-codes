import { registerOTel } from "@vercel/otel";

export function register() {
	// Initialize Next.js OpenTelemetry with @vercel/otel
	registerOTel({
		serviceName: process.env.OTEL_SERVICE_NAME || "vibeX-web-app",
		// Configure resource attributes to coordinate with VibeKit
		attributes: {
			"service.name": process.env.OTEL_SERVICE_NAME || "vibeX-web-app",
			"service.version": process.env.OTEL_SERVICE_VERSION || "1.0.0",
			"service.namespace": "vibeX",
			"deployment.environment": process.env.NODE_ENV || "development",
		},
	});

	// Initialize VibeKit telemetry coordination
	if (process.env.NODE_ENV !== "test") {
		initializeVibeKitTelemetry();
	}
}

async function initializeVibeKitTelemetry() {
	try {
		// Skip telemetry initialization in test environment to avoid config validation issues
		if (process.env.NODE_ENV === "test") {
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
