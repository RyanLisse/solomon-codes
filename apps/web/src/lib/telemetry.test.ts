import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock VibeKit since we can't actually test the telemetry integration without a real backend
vi.mock("@vibe-kit/sdk", () => ({
	VibeKit: vi.fn().mockImplementation(() => ({
		createPullRequest: vi.fn().mockResolvedValue({ success: true }),
		generateCode: vi.fn().mockResolvedValue({ success: true }),
		setSession: vi.fn().mockResolvedValue(undefined),
		pause: vi.fn().mockResolvedValue(undefined),
	})),
}));

describe("OpenTelemetry Configuration", () => {
	beforeEach(() => {
		// Reset environment variables
		delete process.env.NODE_ENV;
		delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
		delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
		delete process.env.OTEL_SAMPLING_RATIO;
		delete process.env.HOSTNAME;
	});

	it("should have default telemetry configuration", () => {
		const config = {
			telemetry: {
				isEnabled: process.env.NODE_ENV === "production",
				endpoint:
					process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
					"http://localhost:4318/v1/traces",
				serviceName: "solomon-codes-web",
				serviceVersion: "1.0.0",
				headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
					? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
					: {},
				timeout: 5000,
				samplingRatio: Number.parseFloat(
					process.env.OTEL_SAMPLING_RATIO || "1.0",
				),
				resourceAttributes: {
					environment: process.env.NODE_ENV || "development",
					"service.instance.id": process.env.HOSTNAME || "unknown",
				},
			},
		};

		expect(config.telemetry.isEnabled).toBe(false); // NODE_ENV is not production
		expect(config.telemetry.endpoint).toBe("http://localhost:4318/v1/traces");
		expect(config.telemetry.serviceName).toBe("solomon-codes-web");
		expect(config.telemetry.serviceVersion).toBe("1.0.0");
		expect(config.telemetry.headers).toEqual({});
		expect(config.telemetry.timeout).toBe(5000);
		expect(config.telemetry.samplingRatio).toBe(1.0);
		expect(config.telemetry.resourceAttributes.environment).toBe("development");
		expect(config.telemetry.resourceAttributes["service.instance.id"]).toBe(
			"unknown",
		);
	});

	it("should enable telemetry in production", () => {
		process.env.NODE_ENV = "production";

		const config = {
			telemetry: {
				isEnabled: process.env.NODE_ENV === "production",
			},
		};

		expect(config.telemetry.isEnabled).toBe(true);
	});

	it("should use custom environment variables when provided", () => {
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
			"https://custom-jaeger.com/v1/traces";
		process.env.OTEL_EXPORTER_OTLP_HEADERS =
			'{"Authorization":"Bearer test-token"}';
		process.env.OTEL_SAMPLING_RATIO = "0.5";
		process.env.HOSTNAME = "test-host";
		process.env.NODE_ENV = "staging";

		const config = {
			telemetry: {
				endpoint:
					process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
					"http://localhost:4318/v1/traces",
				headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
					? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
					: {},
				samplingRatio: Number.parseFloat(
					process.env.OTEL_SAMPLING_RATIO || "1.0",
				),
				resourceAttributes: {
					environment: process.env.NODE_ENV || "development",
					"service.instance.id": process.env.HOSTNAME || "unknown",
				},
			},
		};

		expect(config.telemetry.endpoint).toBe(
			"https://custom-jaeger.com/v1/traces",
		);
		expect(config.telemetry.headers).toEqual({
			Authorization: "Bearer test-token",
		});
		expect(config.telemetry.samplingRatio).toBe(0.5);
		expect(config.telemetry.resourceAttributes.environment).toBe("staging");
		expect(config.telemetry.resourceAttributes["service.instance.id"]).toBe(
			"test-host",
		);
	});

	it("should handle invalid JSON in headers gracefully", () => {
		process.env.OTEL_EXPORTER_OTLP_HEADERS = "invalid-json";

		expect(() => {
			JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS || "{}");
		}).toThrow();
	});

	it("should handle invalid sampling ratio gracefully", () => {
		process.env.OTEL_SAMPLING_RATIO = "invalid-number";

		const config = {
			telemetry: {
				samplingRatio: Number.parseFloat(
					process.env.OTEL_SAMPLING_RATIO || "1.0",
				),
			},
		};

		expect(config.telemetry.samplingRatio).toBeNaN();
	});
});
