import { beforeEach, describe, expect, it } from "vitest";
import {
	createOpenTelemetryFormat,
	createOpenTelemetryTransport,
	getOpenTelemetryConfig,
	getTraceContext,
	OpenTelemetryTransport,
} from "./opentelemetry";

describe("OpenTelemetry Winston Integration", () => {
	beforeEach(() => {
		// Reset environment variables
		delete process.env.NODE_ENV;
		delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
	});

	describe("Trace Context Extraction", () => {
		it("should return empty object when no active span (default behavior)", () => {
			const context = getTraceContext();
			expect(context).toEqual({});
		});

		it("should handle errors gracefully", () => {
			// This should not throw even if OpenTelemetry is not properly initialized
			expect(() => getTraceContext()).not.toThrow();
		});
	});

	describe("OpenTelemetry Transport", () => {
		it("should create OpenTelemetry transport", () => {
			const transport = createOpenTelemetryTransport();

			expect(transport).toBeDefined();
			expect(typeof transport.log).toBe("function");
		});

		it("should create OpenTelemetry transport class", () => {
			const transport = new OpenTelemetryTransport();

			expect(transport).toBeDefined();
			expect(typeof transport.log).toBe("function");
		});
	});

	describe("Winston Format Integration", () => {
		it("should create OpenTelemetry format", () => {
			const format = createOpenTelemetryFormat();

			expect(format).toBeDefined();
			expect(typeof format.transform).toBe("function");
		});

		it("should transform log info without errors", () => {
			const format = createOpenTelemetryFormat();

			const logInfo = {
				level: "info",
				message: "Test message",
				timestamp: new Date().toISOString(),
			};

			const transformedInfo = format.transform(logInfo);

			expect(transformedInfo).toBeDefined();
			expect(transformedInfo.level).toBe("info");
			expect(transformedInfo.message).toBe("Test message");
		});
	});

	describe("Configuration Integration", () => {
		it("should integrate with existing telemetry config", () => {
			const config = getOpenTelemetryConfig();

			expect(config).toBeDefined();
			expect(config.serviceName).toBe("solomon-codes-web");
			expect(config.isEnabled).toBe(false); // Should be false in test environment
		});

		it("should respect environment variables", () => {
			process.env.NODE_ENV = "production";
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://test-endpoint.com";

			const config = getOpenTelemetryConfig();

			expect(config.isEnabled).toBe(true);
			expect(config.endpoint).toBe("https://test-endpoint.com");

			// Clean up
			delete process.env.NODE_ENV;
			delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
		});
	});
});
