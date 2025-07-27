import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTelemetryConfig, isTelemetryEnabled } from "./telemetry";

// Mock the configuration service
vi.mock("./config/service", () => ({
	getConfigurationService: vi.fn(() => ({
		getTelemetryConfig: vi.fn(() => ({
			isEnabled: false,
			endpoint: "http://localhost:4318/v1/traces",
			serviceName: "solomon-codes-web",
			serviceVersion: "1.0.0",
			headers: {},
			timeout: 5000,
			samplingRatio: 1.0,
		})),
		getServerConfig: vi.fn(() => ({
			environment: "development",
		})),
	})),
}));

// Mock the logger
vi.mock("./logging/factory", () => ({
	createContextLogger: vi.fn(() => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	})),
}));

describe("Telemetry Configuration Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.HOSTNAME;
	});

	it("should get telemetry configuration from service", () => {
		const config = getTelemetryConfig();

		expect(config).toEqual({
			isEnabled: false,
			endpoint: "http://localhost:4318/v1/traces",
			serviceName: "solomon-codes-web",
			serviceVersion: "1.0.0",
			headers: {},
			timeout: 5000,
			samplingRatio: 1.0,
			resourceAttributes: {
				environment: "development",
				"service.name": "solomon-codes-web",
				"service.version": "1.0.0",
				"service.instance.id": "unknown",
			},
		});
	});

	it("should check if telemetry is enabled", () => {
		const enabled = isTelemetryEnabled();
		expect(enabled).toBe(false);
	});

	it("should include hostname when available", () => {
		process.env.HOSTNAME = "test-host";
		
		const config = getTelemetryConfig();
		expect(config.resourceAttributes["service.instance.id"]).toBe("test-host");
	});

	it("should handle configuration service errors gracefully", () => {
		// Mock configuration service to throw an error
		const { getConfigurationService } = vi.mocked(require("./config/service"));
		getConfigurationService.mockImplementationOnce(() => {
			throw new Error("Configuration service error");
		});

		const config = getTelemetryConfig();
		
		// Should return fallback configuration
		expect(config.isEnabled).toBe(false);
		expect(config.endpoint).toBe("http://localhost:4318/v1/traces");
		expect(config.serviceName).toBe("solomon-codes-web");
	});
});
