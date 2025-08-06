import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	Environment,
	FeatureGateService,
	Features,
	getFeatureGateService,
	isFeatureEnabled,
	resetFeatureGateService,
} from "./gates";

describe("FeatureGateService", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		Object.defineProperty(process.env, "NODE_ENV", {
			value: "development",
			writable: true,
		});
		resetFeatureGateService();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("FeatureGateService", () => {
		it("should initialize with development gates", () => {
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "development",
				writable: true,
			});

			const service = new FeatureGateService();
			const gates = service.getAllGates();

			expect(gates.isDevelopment).toBe(true);
			expect(gates.isProduction).toBe(false);
			expect(gates.enableDebugTools).toBe(true);
			expect(gates.enableMockData).toBe(true);
			expect(gates.requireSecureEndpoints).toBe(false);
		});

		it("should initialize with production gates", () => {
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "production",
				writable: true,
			});
			process.env.OPENAI_API_KEY = "sk-test-key";
			process.env.BROWSERBASE_API_KEY = "bb-test-key";
			process.env.BROWSERBASE_PROJECT_ID = "test-project";

			const service = new FeatureGateService();
			const gates = service.getAllGates();

			expect(gates.isDevelopment).toBe(false);
			expect(gates.isProduction).toBe(true);
			expect(gates.enableDebugTools).toBe(false);
			expect(gates.enableMockData).toBe(false);
			expect(gates.requireSecureEndpoints).toBe(true);
			expect(gates.enableRateLimiting).toBe(true);
		});

		it("should check individual features", () => {
			const service = new FeatureGateService();

			expect(service.isEnabled("enableDebugTools")).toBe(true);
			expect(service.isEnabled("enableMockData")).toBe(true);
			expect(service.isEnabled("requireSecureEndpoints")).toBe(false);
		});

		it("should provide environment detection methods", () => {
			const service = new FeatureGateService();

			expect(service.isDevelopment()).toBe(true);
			expect(service.isStaging()).toBe(false);
			expect(service.isProduction()).toBe(false);
		});

		it("should provide feature-specific methods", () => {
			const service = new FeatureGateService();

			expect(service.shouldEnableDebugTools()).toBe(true);
			expect(service.shouldUseMockData()).toBe(true);
			expect(service.shouldRequireSecureEndpoints()).toBe(false);
		});

		it("should get enabled features only", () => {
			const service = new FeatureGateService();
			const enabledFeatures = service.getEnabledFeatures();

			expect(enabledFeatures.isDevelopment).toBe(true);
			expect(enabledFeatures.enableDebugTools).toBe(true);
			expect(enabledFeatures.isProduction).toBeUndefined(); // Should not be present
		});

		it("should provide status information", async () => {
			const service = new FeatureGateService();
			const status = await service.getStatus();

			expect(status.environment).toBe("development");
			expect(status.totalGates).toBeGreaterThan(0);
			expect(status.enabledGates).toBeGreaterThan(0);
			expect(status.criticalFeatures).toBeDefined();
			expect(status.criticalFeatures.debugTools).toBe(true);
		});
	});

	describe("Global service", () => {
		it("should return the same service instance", () => {
			const service1 = getFeatureGateService();
			const service2 = getFeatureGateService();

			expect(service1).toBe(service2);
		});

		it("should reset service instance", () => {
			const service1 = getFeatureGateService();
			resetFeatureGateService();
			const service2 = getFeatureGateService();

			expect(service1).not.toBe(service2);
		});
	});

	describe("Convenience functions", () => {
		it("should check feature enabled", () => {
			expect(isFeatureEnabled("enableDebugTools")).toBe(true);
			expect(isFeatureEnabled("requireSecureEndpoints")).toBe(false);
		});

		it("should provide environment utilities", () => {
			expect(Environment.isDevelopment()).toBe(true);
			expect(Environment.isProduction()).toBe(false);
		});

		it("should provide feature utilities", () => {
			expect(Features.debugTools()).toBe(true);
			expect(Features.mockData()).toBe(true);
			expect(Features.secureEndpoints()).toBe(false);
		});
	});

	describe("Environment-specific behavior", () => {
		it("should configure staging environment correctly", () => {
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "staging",
				writable: true,
			});
			process.env.OPENAI_API_KEY = "sk-test-key";

			const service = new FeatureGateService();
			const gates = service.getAllGates();

			expect(gates.isStaging).toBe(true);
			expect(gates.enableDebugTools).toBe(true); // Staging allows debug tools
			expect(gates.enableMockData).toBe(false); // But not mock data
			expect(gates.enableTelemetry).toBe(true);
			expect(gates.requireSecureEndpoints).toBe(true);
		});

		it("should handle missing API configuration", () => {
			delete process.env.BROWSERBASE_API_KEY;
			delete process.env.BROWSERBASE_PROJECT_ID;

			const service = new FeatureGateService();
			const gates = service.getAllGates();

			expect(gates.enableStagehandIntegration).toBe(false);
		});

		it("should enable features based on API availability", () => {
			process.env.BROWSERBASE_API_KEY = "bb-test-key";
			process.env.BROWSERBASE_PROJECT_ID = "test-project";

			const service = new FeatureGateService();
			const gates = service.getAllGates();

			expect(gates.enableStagehandIntegration).toBe(true);
		});
	});
});
