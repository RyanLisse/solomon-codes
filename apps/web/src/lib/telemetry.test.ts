import { beforeEach, describe, expect, it, vi } from "vitest";
import * as configService from "./config/service";
import {
	getTelemetryConfig,
	isTelemetryEnabled,
	resetTelemetryService,
} from "./telemetry/index";

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
vi.mock("./logging/server", () => ({
	createServerLogger: vi.fn(() => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	})),
}));

describe("Telemetry Configuration Integration", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		delete process.env.HOSTNAME;
		resetTelemetryService();
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

	it("should include hostname when available", async () => {
		process.env.HOSTNAME = "test-host";
		resetTelemetryService(); // Reset to pick up new environment variable

		const config = await getTelemetryConfig();
		expect(config.resourceAttributes["service.instance.id"]).toBe("test-host");
	});

	it("should handle configuration service errors gracefully", async () => {
		// Mock configuration service to throw an error
		const mockedConfigService = vi.mocked(
			configService.getConfigurationService,
		);
		mockedConfigService.mockImplementationOnce(() => {
			throw new Error("Configuration service error");
		});

		const config = await getTelemetryConfig();

		// Should return fallback configuration
		expect(config.isEnabled).toBe(false);
		expect(config.endpoint).toBe("http://localhost:4318/v1/traces");
		expect(config.serviceName).toBe("solomon-codes-web");
	});
});
