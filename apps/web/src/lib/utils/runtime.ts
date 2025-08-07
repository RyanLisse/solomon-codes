/**
 * Runtime Environment Detection and Utilities
 * Provides safe runtime detection and utilities for Node.js vs Edge Runtime environments
 */

type EdgeRuntimeName = "edge-light" | "edge-runtime";
type RuntimeEnvironment = "node" | "edge-light" | "edge-runtime";

// Extend globalThis to include EdgeRuntime
declare const EdgeRuntime: string | undefined;

/**
 * Get the current runtime environment
 */
export function getCurrentRuntime(): RuntimeEnvironment {
	// Check for Edge Runtime first
	if (typeof EdgeRuntime === "string") {
		return EdgeRuntime as EdgeRuntimeName;
	}

	// Check if we're in Node.js
	if (typeof process !== "undefined" && process.versions?.node) {
		return "node";
	}

	// Default fallback to edge-light
	return "edge-light";
}

/**
 * Check if running in Node.js environment
 */
export function isNodeRuntime(): boolean {
	return getCurrentRuntime() === "node";
}

/**
 * Check if running in Edge Runtime
 */
export function isEdgeRuntime(): boolean {
	return getCurrentRuntime().startsWith("edge");
}

/**
 * Get process working directory with Edge Runtime fallback
 */
export function getCwd(): string {
	if (isNodeRuntime() && typeof process !== "undefined") {
		return process.cwd();
	}
	// Edge Runtime fallback
	return "/";
}

/**
 * Event listener function type
 */
type EventListener = (...args: unknown[]) => void;

/**
 * Function type for event handler methods
 */
type EventHandlerMethod = (event: string) => EventListener[];

/**
 * Edge Runtime compatible stream interface
 */
interface EdgeWritableStream {
	write: (chunk: string) => boolean;
	writable: boolean;
	end: () => void;
	addListener: (event: string, listener: EventListener) => void;
	on: (event: string, listener: EventListener) => void;
	once: (event: string, listener: EventListener) => void;
	removeListener: (event: string, listener: EventListener) => void;
	removeAllListeners: (event?: string) => void;
	off: (event: string, listener: EventListener) => void;
	rawListeners: EventHandlerMethod;
	listenerCount: (event: string) => number;
	setMaxListeners: (n: number) => void;
	getMaxListeners: () => number;
	listeners: EventHandlerMethod;
	emit: (event: string, ...args: unknown[]) => boolean;
	prependListener: (event: string, listener: EventListener) => void;
	prependOnceListener: (event: string, listener: EventListener) => void;
	eventNames: () => string[];
	_writableState: { objectMode: boolean };
}

/**
 * Safely access process.stdout with Edge Runtime fallback
 */
export function getStdout(): NodeJS.WriteStream | EdgeWritableStream {
	if (isNodeRuntime()) {
		// Dynamic access to avoid Edge Runtime static analysis
		const proc = (globalThis as { process?: NodeJS.Process }).process;
		if (proc?.stdout) {
			return proc.stdout;
		}
	}

	// Edge Runtime fallback - create a mock stream
	return {
		write: () => true,
		writable: true,
		end: () => {},
		addListener: () => {},
		on: () => {},
		once: () => {},
		removeListener: () => {},
		removeAllListeners: () => {},
		off: () => {},
		rawListeners: () => [],
		listenerCount: () => 0,
		setMaxListeners: () => {},
		getMaxListeners: () => 0,
		listeners: () => [],
		emit: () => false,
		prependListener: () => {},
		prependOnceListener: () => {},
		eventNames: () => [],
		_writableState: { objectMode: false },
	};
}

/**
 * Safely access process.stderr with Edge Runtime fallback
 */
export function getStderr(): NodeJS.WriteStream | EdgeWritableStream {
	if (isNodeRuntime()) {
		const proc = (globalThis as { process?: NodeJS.Process }).process;
		if (proc?.stderr) {
			return proc.stderr;
		}
	}

	// Use same fallback as stdout
	return getStdout();
}

/**
 * Safe environment variable access
 */
export function getEnv(key: string): string | undefined {
	if (isNodeRuntime() && typeof process !== "undefined") {
		return process.env[key];
	}

	// Edge Runtime fallback - try globalThis
	const env = (globalThis as { process?: { env?: Record<string, string> } })
		.process?.env;
	return env?.[key];
}

/**
 * Check if a specific environment variable is set
 */
export function hasEnv(key: string): boolean {
	return getEnv(key) !== undefined;
}

/**
 * Safe process exit with Edge Runtime fallback
 */
export function safeProcessExit(code = 0): void {
	if (isNodeRuntime() && typeof process !== "undefined") {
		process.exit(code);
	}
	// Edge Runtime: Can't exit, just throw error to stop execution
	throw new Error(`Process exit requested with code: ${code}`);
}

/**
 * Get runtime information for debugging
 */
export function getRuntimeInfo() {
	const runtime = getCurrentRuntime();
	const nodeVersion = isNodeRuntime()
		? (globalThis as { process?: NodeJS.Process }).process?.versions?.node
		: undefined;

	return {
		runtime,
		isNode: isNodeRuntime(),
		isEdge: isEdgeRuntime(),
		nodeVersion,
		platform: isNodeRuntime()
			? (globalThis as { process?: NodeJS.Process }).process?.platform
			: "unknown",
		arch: isNodeRuntime()
			? (globalThis as { process?: NodeJS.Process }).process?.arch
			: "unknown",
	};
}

/**
 * Runtime-safe console implementation
 */
export const runtimeConsole = {
	log: (...args: unknown[]) => {
		if (typeof console !== "undefined") {
			console.log(...args);
		}
	},
	error: (...args: unknown[]) => {
		if (typeof console !== "undefined") {
			console.error(...args);
		}
	},
	warn: (...args: unknown[]) => {
		if (typeof console !== "undefined") {
			console.warn(...args);
		}
	},
	info: (...args: unknown[]) => {
		if (typeof console !== "undefined") {
			console.info(...args);
		}
	},
	debug: (...args: unknown[]) => {
		if (typeof console !== "undefined") {
			console.debug(...args);
		}
	},
};
