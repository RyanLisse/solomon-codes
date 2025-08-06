/**
 * Runtime detection utilities for Edge Runtime vs Node.js compatibility
 * Uses dynamic access to avoid Edge Runtime static analysis
 */

/**
 * Check if we're running in Edge Runtime
 */
export function isEdgeRuntime(): boolean {
	return (
		typeof globalThis !== "undefined" &&
		!!(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime
	);
}

/**
 * Check if we're running in Node.js environment
 */
export function isNodeRuntime(): boolean {
	// Use dynamic access to avoid static analysis
	const proc = (globalThis as { process?: NodeJS.Process }).process;
	return (
		typeof proc !== "undefined" &&
		proc.versions?.node !== undefined &&
		!isEdgeRuntime()
	);
}

/**
 * Safely access process.cwd() with Edge Runtime fallback
 */
export function getCwd(): string {
	if (isNodeRuntime()) {
		// Dynamic access to avoid Edge Runtime static analysis
		const proc = (globalThis as { process?: NodeJS.Process }).process;
		if (proc && typeof proc.cwd === "function") {
			return proc.cwd();
		}
	}
	return "/";
}

/**
 * Safely access process.stdout with Edge Runtime fallback
 */
export function getStdout():
	| NodeJS.WriteStream
	| { write: (chunk: string) => void } {
	if (isNodeRuntime()) {
		// Dynamic access to avoid Edge Runtime static analysis
		const proc = (globalThis as { process?: NodeJS.Process }).process;
		if (proc?.stdout) {
			return proc.stdout;
		}
	}
	return {
		write: (chunk: string) => console.log(chunk.replace(/\n$/, "")),
	};
}

/**
 * Safely exit process in Node.js environment only
 */
export function safeProcessExit(code = 0): void {
	if (isNodeRuntime()) {
		// Dynamic access to avoid Edge Runtime static analysis
		const proc = (globalThis as { process?: NodeJS.Process }).process;
		if (proc && typeof proc.exit === "function") {
			proc.exit(code);
			return;
		}
	}
	throw new Error(`Process exit requested with code ${code}`);
}

/**
 * Get runtime information
 */
export function getRuntimeInfo(): {
	type: "node" | "edge" | "unknown";
	version?: string;
	platform?: string;
} {
	if (isEdgeRuntime()) {
		return { type: "edge" };
	}

	if (isNodeRuntime()) {
		// Dynamic access to avoid Edge Runtime static analysis
		const proc = (globalThis as { process?: NodeJS.Process }).process;
		return {
			type: "node",
			version: proc?.version || "unknown",
			platform: proc?.platform || "unknown",
		};
	}

	return { type: "unknown" };
}
