import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ENVIRONMENT_PROFILES,
	getConfigurationService,
	resetConfigurationService,
} from "./service";

describe("ConfigurationService", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		Object.defineProperty(process.env, "NODE_ENV", {
			value: "development",
			writable: true,
			configurable: true,
		});
		resetConfigurationService();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("environment profiles", () => {
		it("should have correct development profile", () => {
			const profile = ENVIRONMENT_PROFILES.development;

			expect(profile.name).toBe("development");
			expect(profile.features.enableDebugTools).toBe(true);
			expect(profile.features.enableMockData).toBe(true);
			expect(profile.features.enableDetailedLogging).toBe(true);
			expect(profile.features.requireSecureEndpoints).toBe(false);
			expect(profile.features.enableTelemetry).toBe(false);
		});

		it("should have correct staging profile", () => {
			const profile = ENVIRONMENT_PROFILES.staging;

			expect(profile.name).toBe("staging");
			expect(profile.features.enableDebugTools).toBe(true);
			expect(profile.features.enableMockData).toBe(false);
			expect(profile.features.enableTelemetry).toBe(true);
		});

		it("should have correct production profile", () => {
			const profile = ENVIRONMENT_PROFILES.production;

			expect(profile.name).toBe("production");
			expect(profile.features.enableDebugTools).toBe(false);
			expect(profile.features.enableMockData).toBe(false);
			expect(profile.features.enableDetailedLogging).toBe(false);
			expect(profile.features.requireSecureEndpoints).toBe(true);
			expect(profile.features.enableTelemetry).toBe(true);
		});
	});

	describe("global service", () => {
		it("should return the same service instance", () => {
			const service1 = getConfigurationService();
			const service2 = getConfigurationService();

			expect(service1).toBe(service2);
		});

		it("should reset service instance", () => {
			const service1 = getConfigurationService();
			resetConfigurationService();
			const service2 = getConfigurationService();

			expect(service1).not.toBe(service2);
		});
	});
});
