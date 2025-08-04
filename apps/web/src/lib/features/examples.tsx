/**
 * Examples of how to use feature gates throughout the application
 * This file serves as documentation and can be removed in production
 */

import React from "react";
import { devLog, useEnvironment } from "./environment";
import {
	FeatureGate,
	getFeatureGateService,
	useFeatureGates,
	withFeatureGate,
} from "./gates";

// Example 1: Using FeatureGate component for conditional rendering
export function DebugPanel() {
	return (
		<FeatureGate feature="enableDebugTools">
			<div className="debug-panel">
				<h3>Debug Information</h3>
				<p>This panel only shows in development</p>
			</div>
		</FeatureGate>
	);
}

// Example 2: Using FeatureGate with fallback
export function DataDisplay() {
	return (
		<FeatureGate
			feature="enableMockData"
			fallback={<div>Loading real data...</div>}
		>
			<div>Showing mock data for development</div>
		</FeatureGate>
	);
}

// Example 3: Using the hook for complex logic
export function ComplexComponent() {
	const { isEnabled, isDevelopment, isProduction } = useFeatureGates();
	const environment = useEnvironment();

	React.useEffect(() => {
		if (isEnabled("enableDetailedLogging")) {
			devLog("Component mounted with detailed logging");
		}

		if (isDevelopment()) {
			devLog("Development mode - extra debugging enabled");
		}
	}, [isEnabled, isDevelopment]);

	const handleAction = () => {
		if (isEnabled("enableExperimentalFeatures")) {
			// Use experimental API
			experimentalAction();
		} else {
			// Use stable API
			stableAction();
		}
	};

	return (
		<div>
			<h2>Environment: {environment.environment}</h2>

			{isProduction() && (
				<div className="production-warning">
					Production mode - limited features available
				</div>
			)}

			<button type="button" onClick={handleAction}>
				{isEnabled("enableExperimentalFeatures")
					? "Try Experimental"
					: "Use Stable"}
			</button>
		</div>
	);
}

// Example 4: Higher-order component for feature gating
const _ExperimentalFeature = withFeatureGate(
	"enableExperimentalFeatures",
	() => <div>Experimental features not available</div>,
)(function ExperimentalComponent() {
	return <div>This is an experimental feature!</div>;
});

// Example 5: API route with feature gating
export async function apiRouteExample(request: Request) {
	const { isEnabled } = getFeatureGateService();

	// Check if rate limiting should be applied
	if (isEnabled("enableRateLimiting")) {
		// Apply rate limiting logic
		const rateLimitResult = await checkRateLimit(request);
		if (!rateLimitResult.allowed) {
			return new Response("Rate limit exceeded", { status: 429 });
		}
	}

	// Check if caching should be used
	if (isEnabled("enableCaching")) {
		const cached = await getFromCache(request.url);
		if (cached) {
			return new Response(cached, {
				headers: { "X-Cache": "HIT" },
			});
		}
	}

	// Process request normally
	const result = await processRequest(request);

	// Cache result if caching is enabled
	if (isEnabled("enableCaching")) {
		await setCache(request.url, result);
	}

	return new Response(result);
}

// Example 6: Server action with feature gating
export async function serverActionExample() {
	const { isEnabled } = getFeatureGateService();

	if (isEnabled("enableMockData")) {
		// Return mock data for development
		return {
			data: "mock-data",
			source: "mock",
		};
	}

	// Fetch real data
	const realData = await fetchRealData();

	// Add telemetry if enabled
	if (isEnabled("enableTelemetry")) {
		await recordTelemetry("server-action-executed", {
			action: "serverActionExample",
			dataSize: realData.length,
		});
	}

	return {
		data: realData,
		source: "real",
	};
}

// Example 7: Middleware with feature gating
export function middlewareExample(_request: Request) {
	const { isEnabled } = getFeatureGateService();

	const response = new Response();

	// Add security headers if required
	if (isEnabled("requireSecureEndpoints")) {
		response.headers.set("Strict-Transport-Security", "max-age=31536000");
		response.headers.set("X-Content-Type-Options", "nosniff");
		response.headers.set("X-Frame-Options", "DENY");
	}

	// Enable CORS for development
	if (isEnabled("enableCORS")) {
		response.headers.set("Access-Control-Allow-Origin", "*");
		response.headers.set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE",
		);
	}

	return response;
}

// Example 8: Database connection with feature gating
export async function databaseExample() {
	const { isEnabled } = getFeatureGateService();

	if (isEnabled("enableMockData")) {
		// Use in-memory database for development
		return createInMemoryDatabase();
	}

	// Use real database connection
	const connection = await createDatabaseConnection();

	// Enable query logging in non-production
	if (isEnabled("enableDetailedLogging")) {
		connection.enableQueryLogging();
	}

	return connection;
}

// Helper functions (would be implemented elsewhere)
function experimentalAction() {
	devLog("Using experimental action");
}

function stableAction() {
	devLog("Using stable action");
}

async function checkRateLimit(_request: Request) {
	// Rate limiting implementation
	return { allowed: true };
}

async function getFromCache(_key: string) {
	// Cache retrieval implementation
	return null;
}

async function setCache(_key: string, _value: unknown) {
	// Cache storage implementation
}

async function processRequest(_request: Request) {
	// Request processing implementation
	return "processed result";
}

async function fetchRealData() {
	// Real data fetching implementation
	return "real data";
}

async function recordTelemetry(_event: string, _data: unknown) {
	// Telemetry recording implementation
}

function createInMemoryDatabase() {
	// In-memory database creation
	return {};
}

async function createDatabaseConnection() {
	// Real database connection
	return {
		enableQueryLogging: () => devLog("Query logging enabled"),
	};
}
