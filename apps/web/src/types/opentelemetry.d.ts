declare module "@opentelemetry/api" {
	export interface SpanStatus {
		code: number;
		message?: string;
	}

	export interface SpanContext {
		traceId: string;
		spanId: string;
		traceFlags: number;
		traceState?: unknown;
	}

	export interface SpanOptions {
		kind?: number;
		attributes?: Record<string, string | number | boolean>;
		startTime?: number;
		root?: boolean;
		parent?: Span | SpanContext;
	}

	export interface Span {
		setStatus(status: SpanStatus): void;
		setAttributes(attributes: Record<string, string | number | boolean>): void;
		recordException(exception: Error): void;
		addEvent(
			name: string,
			attributes?: Record<string, string | number | boolean>,
		): void;
		end(): void;
		spanContext(): SpanContext;
	}

	export interface Tracer {
		startSpan(name: string, options?: SpanOptions): Span;
		startActiveSpan<T>(
			name: string,
			options: SpanOptions,
			callback: (span: Span) => T,
		): T;
	}

	export const trace: {
		getTracer(name: string, version?: string): Tracer;
		getActiveSpan(): Span | undefined;
	};

	export const SpanStatusCode: {
		OK: number;
		ERROR: number;
	};

	export const SpanKind: {
		INTERNAL: number;
		CLIENT: number;
		SERVER: number;
		PRODUCER: number;
		CONSUMER: number;
	};
}
