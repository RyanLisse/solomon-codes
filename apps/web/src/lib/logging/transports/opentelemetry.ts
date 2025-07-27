import { trace } from "@opentelemetry/api";
import winston from "winston";
import { getOpenTelemetryConfig } from "../config";

/**
 * Extract trace context from the current OpenTelemetry span
 */
export function getTraceContext(): { traceId?: string; spanId?: string } {
	try {
		const activeSpan = trace.getActiveSpan();
		if (!activeSpan) {
			return {};
		}

		const spanContext = activeSpan.spanContext();
		if (!spanContext) {
			return {};
		}

		return {
			traceId: spanContext.traceId,
			spanId: spanContext.spanId,
		};
	} catch (_error) {
		// Silently fail if OpenTelemetry is not properly initialized
		return {};
	}
}

/**
 * Create a Winston format that adds OpenTelemetry trace context
 */
export function createOpenTelemetryFormat() {
	return winston.format((info) => {
		const traceContext = getTraceContext();
		return {
			...info,
			...traceContext,
		};
	})();
}

/**
 * Create a Winston transport that includes OpenTelemetry context
 */
export function createOpenTelemetryTransport(
	options: { level?: string; format?: winston.Logform.Format } = {},
) {
	const { level = "info", format } = options;

	return new winston.transports.Console({
		level,
		format: winston.format.combine(
			createOpenTelemetryFormat(),
			format || winston.format.json(),
		),
	});
}

/**
 * Create a custom Winston transport that sends logs to OpenTelemetry collector
 */
export class OpenTelemetryTransport extends winston.Transport {
	private readonly config: ReturnType<typeof getOpenTelemetryConfig>;

	constructor(options: winston.TransportStreamOptions = {}) {
		super(options);
		this.config = getOpenTelemetryConfig();
	}

	log(info: winston.LogEntry, callback: () => void) {
		setImmediate(() => {
			this.emit("logged", info);
		});

		// Add trace context to the log entry
		const traceContext = getTraceContext();
		const enhancedInfo = {
			...info,
			...traceContext,
			service: this.config.serviceName,
			version: this.config.serviceVersion,
		};

		// In a real implementation, you would send this to your OpenTelemetry collector
		// For now, we'll just ensure the trace context is included
		if (this.config.isEnabled) {
			// Here you could send to OTLP endpoint, but for now we'll use console
			console.log(JSON.stringify(enhancedInfo));
		}

		callback();
	}
}

/**
 * Create OpenTelemetry-enhanced logger configuration
 */
export function createOpenTelemetryLoggerConfig() {
	const config = getOpenTelemetryConfig();

	return {
		defaultMeta: {
			service: config.serviceName,
			version: config.serviceVersion,
			environment: config.resourceAttributes.environment,
		},
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.errors({ stack: true }),
			createOpenTelemetryFormat(),
			winston.format.json(),
		),
	};
}

/**
 * Initialize OpenTelemetry instrumentation for Winston
 */
export function initializeOpenTelemetryInstrumentation() {
	const config = getOpenTelemetryConfig();

	if (!config.isEnabled) {
		return null;
	}

	try {
		// In a full implementation, you would initialize the OpenTelemetry SDK here
		// For now, we'll just return a configuration object
		return {
			serviceName: config.serviceName,
			serviceVersion: config.serviceVersion,
			endpoint: config.endpoint,
			headers: config.headers,
		};
	} catch (error) {
		console.warn("Failed to initialize OpenTelemetry instrumentation:", error);
		return null;
	}
}

/**
 * Create a logger with OpenTelemetry integration
 */
export function createOpenTelemetryLogger(
	options: {
		level?: string;
		enableConsole?: boolean;
		enableOTLP?: boolean;
	} = {},
) {
	const { level = "info", enableConsole = true, enableOTLP = false } = options;

	const config = getOpenTelemetryConfig();
	const transports: winston.transport[] = [];

	// Add console transport with OpenTelemetry context
	if (enableConsole) {
		transports.push(createOpenTelemetryTransport({ level }));
	}

	// Add OTLP transport if enabled
	if (enableOTLP && config.isEnabled) {
		transports.push(new OpenTelemetryTransport({ level }));
	}

	return winston.createLogger({
		level,
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.errors({ stack: true }),
			createOpenTelemetryFormat(),
			winston.format.json(),
		),
		defaultMeta: {
			service: config.serviceName,
			version: config.serviceVersion,
			environment: config.resourceAttributes.environment,
		},
		transports,
	});
}

/**
 * Middleware to add OpenTelemetry context to request logging
 */
interface MiddlewareRequest {
	headers: Record<string, string | string[] | undefined>;
	traceContext?: { traceId?: string; spanId?: string };
}

interface MiddlewareResponse {
	setHeader: (name: string, value: string) => void;
}

export function createOpenTelemetryLoggingMiddleware() {
	return (
		req: MiddlewareRequest,
		res: MiddlewareResponse,
		next: () => void,
	) => {
		const traceContext = getTraceContext();

		// Add trace context to request object for later use
		req.traceContext = traceContext;

		// Add trace context to response headers for client correlation
		if (traceContext.traceId) {
			res.setHeader("x-trace-id", traceContext.traceId);
		}
		if (traceContext.spanId) {
			res.setHeader("x-span-id", traceContext.spanId);
		}

		next();
	};
}

/**
 * Utility to create a child logger with trace context
 */
export function createTraceLogger(parentLogger: winston.Logger) {
	const traceContext = getTraceContext();
	return parentLogger.child(traceContext);
}

/**
 * Export the OpenTelemetry configuration for reuse
 */
export { getOpenTelemetryConfig } from "../config";
