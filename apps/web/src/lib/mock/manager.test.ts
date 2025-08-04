import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as featureGates from "../features/gates";
import {
	getMockDataManager,
	getMockOrRealData,
	MockDataManager,
	resetMockDataManager,
	shouldUseMockData,
	withMockSupport,
} from "./manager";

// Mock the feature gates
vi.mock("../features/gates", () => ({
	isFeatureEnabled: vi.fn(),
}));

describe("MockDataManager", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		(process.env as { NODE_ENV?: string }).NODE_ENV = "development";
		resetMockDataManager();
		vi.clearAllMocks();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("MockDataManager", () => {
		it("should initialize with mock data enabled in development", () => {
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(true);

			const manager = new MockDataManager();

			expect(manager.shouldUseMockData()).toBe(true);
		});

		it("should initialize with mock data disabled in production", () => {
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(false);

			const manager = new MockDataManager();

			expect(manager.shouldUseMockData()).toBe(false);
		});

		it("should return mock data when enabled", async () => {
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(true);

			const manager = new MockDataManager();
			const mockData = "mock-data";
			const realData = "real-data";

			const result = await manager.getData(
				() => mockData,
				() => realData,
				"test-context",
			);

			expect(result).toBe(mockData);
		});

		it("should return real data when mock data is disabled", async () => {
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(false);

			const manager = new MockDataManager();
			const mockData = "mock-data";
			const realData = "real-data";

			const result = await manager.getData(
				() => mockData,
				() => realData,
				"test-context",
			);

			expect(result).toBe(realData);
		});

		it("should create mock wrapper correctly", () => {
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(true);

			const manager = new MockDataManager();
			const realService = {
				method1: () => "real-method1",
				method2: () => "real-method2",
			};
			const mockService = {
				method1: () => "mock-method1",
			};

			const wrappedService = manager.createMockWrapper(
				realService,
				mockService,
				"test-service",
			);

			expect(wrappedService.method1()).toBe("mock-method1");
			expect(wrappedService.method2()).toBe("real-method2");
		});

		it("should validate production safety", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "production";
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(true);

			const manager = new MockDataManager();

			expect(() => manager.validateProductionSafety()).toThrow(
				"Mock data is enabled in production environment",
			);
		});

		it("should not throw in non-production environments", () => {
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "development",
				writable: true,
			});
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(true);

			const manager = new MockDataManager();

			expect(() => manager.validateProductionSafety()).not.toThrow();
		});
	});

	describe("Global functions", () => {
		it("should return the same manager instance", () => {
			const manager1 = getMockDataManager();
			const manager2 = getMockDataManager();

			expect(manager1).toBe(manager2);
		});

		it("should reset manager instance", () => {
			const manager1 = getMockDataManager();
			resetMockDataManager();
			const manager2 = getMockDataManager();

			expect(manager1).not.toBe(manager2);
		});

		it("should provide convenience functions", async () => {
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(true);

			const mockData = "mock-data";
			const realData = "real-data";

			const result = await getMockOrRealData(
				() => mockData,
				() => realData,
				"test-context",
			);

			expect(result).toBe(mockData);
		});

		it("should create mock-aware services", () => {
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(true);

			const realService = {
				getData: () => "real-data",
			};
			const mockService = {
				getData: () => "mock-data",
			};

			const service = withMockSupport(realService, mockService, "test-service");

			expect(service.getData()).toBe("mock-data");
		});
	});

	describe("Production safety", () => {
		it("should not use mock data in production even if feature is enabled", () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "production";
			const mockIsFeatureEnabled = vi.mocked(featureGates.isFeatureEnabled);
			mockIsFeatureEnabled.mockReturnValue(false); // Feature gates should disable in production

			expect(shouldUseMockData()).toBe(false);
		});
	});
});
