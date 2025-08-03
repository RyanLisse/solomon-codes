import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as configService from "./config/service";
import {
	getTelemetryConfig,
	isTelemetryEnabled,
	resetTelemetryService,
} from "./telemetry/index";

// Mock the configuration service
mock.module("./config/service", () => ({
	getConfigurationService: mock(() => ({
		getTelemetryConfig: mock(() => ({
			isEnabled: false,
			endpoint: "http://localhost:4318/v1/traces",
			serviceName: "solomon-codes-web",
			serviceVersion: "1.0.0",
			headers: {},
			timeout: 5000,
			samplingRatio: 1.0,
		})),
		getServerConfig: mock(() => ({
			environment: "development",
		})),
	})),
}));

// Mock the logger
mock.module("./logging/server", () => ({
	createServerLogger: mock(() => ({
		debug: mock(),
		info: mock(),
		warn: mock(),
		error: mock(),
	})),
}));

describe("Telemetry Configuration Integration", () => {
	beforeEach(() => {
		mock.restore();
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

	it("should include hostname when available", () => {
		process.env.HOSTNAME = "test-host";
		resetTelemetryService(); // Reset to pick up new environment variable

		const config = getTelemetryConfig();
		expect(config.resourceAttributes["service.instance.id"]).toBe("test-host");
	});

	it("should handle configuration service errors gracefully", () => {
		// Mock configuration service to throw an error
		const { getConfigurationService } = configService;
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
