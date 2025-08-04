/**
 * Build-time mock data exclusion utilities
 * These utilities help ensure mock data is not included in production builds
 */

/**
 * Environment check for build-time exclusion
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_BUILD_TIME = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Exclude mock data from production builds
 */
export function excludeFromProduction<T>(data: T): T | undefined {
	if (IS_PRODUCTION || IS_BUILD_TIME) {
		return undefined;
	}
	return data;
}

/**
 * Conditional import for mock data
 * Returns undefined in production to enable tree-shaking
 */
export function conditionalImport<T>(importFn: () => T): T | undefined {
	if (IS_PRODUCTION || IS_BUILD_TIME) {
		return undefined;
	}
	return importFn();
}

/**
 * Mock data wrapper that gets stripped in production
 */
export class MockDataWrapper<T> {
	private data: T | undefined;

	constructor(data: T) {
		this.data = excludeFromProduction(data);
	}

	/**
	 * Get mock data with fallback
	 */
	get(fallback: T): T {
		return this.data ?? fallback;
	}

	/**
	 * Check if mock data is available
	 */
	isAvailable(): boolean {
		return this.data !== undefined;
	}

	/**
	 * Execute function only if mock data is available
	 */
	ifAvailable<R>(fn: (data: T) => R): R | undefined {
		if (this.data !== undefined) {
			return fn(this.data);
		}
		return undefined;
	}
}

/**
 * Create a mock data wrapper
 */
export function createMockWrapper<T>(data: T): MockDataWrapper<T> {
	return new MockDataWrapper(data);
}

/**
 * Webpack plugin helper for excluding mock files
 * This can be used in next.config.js to exclude mock files from production builds
 */
export const mockFileExclusionPattern =
	/\.(mock|fixture|test-data)\.(ts|tsx|js|jsx)$/;

/**
 * Next.js webpack configuration helper
 */
export function excludeMockFilesFromBuild(config: Record<string, unknown>) {
	if (IS_PRODUCTION || IS_BUILD_TIME) {
		// Add rule to exclude mock files
		(
			config.module as { rules: Array<{ test: RegExp; use: string }> }
		).rules.push({
			test: mockFileExclusionPattern,
			use: "null-loader",
		});

		// Exclude mock directories
		(config.resolve as { alias: Record<string, boolean> }).alias = {
			...(config.resolve as { alias: Record<string, boolean> }).alias,
			"@/lib/mock": false,
			"@/test": false,
			"@/fixtures": false,
		};
	}

	return config;
}

/**
 * Environment-aware mock data loader
 */
export async function loadMockData<T>(
	mockDataLoader: () => Promise<T> | T,
	fallback: T,
): Promise<T> {
	if (IS_PRODUCTION || IS_BUILD_TIME) {
		return fallback;
	}

	try {
		return await mockDataLoader();
	} catch (error) {
		console.warn("Failed to load mock data, using fallback:", error);
		return fallback;
	}
}

/**
 * Development-only code execution
 */
export function devOnly<T>(fn: () => T): T | undefined {
	if (IS_PRODUCTION || IS_BUILD_TIME) {
		return undefined;
	}
	return fn();
}

/**
 * Production safety check
 */
export function assertNotProduction(context: string): void {
	if (IS_PRODUCTION) {
		throw new Error(
			`${context} should not be executed in production environment`,
		);
	}
}

/**
 * Mock data registry for tracking all mock data usage
 */
class MockDataRegistry {
	private registry = new Map<string, unknown>();

	register(key: string, data: unknown): void {
		if (!IS_PRODUCTION) {
			this.registry.set(key, data);
		}
	}

	get(key: string): unknown {
		return this.registry.get(key);
	}

	getAll(): Record<string, unknown> {
		return Object.fromEntries(this.registry);
	}

	clear(): void {
		this.registry.clear();
	}

	size(): number {
		return this.registry.size;
	}
}

/**
 * Global mock data registry
 */
export const mockDataRegistry = new MockDataRegistry();

/**
 * Register mock data for tracking
 */
export function registerMockData(key: string, data: unknown): void {
	mockDataRegistry.register(key, data);
}

/**
 * Get registered mock data
 */
export function getRegisteredMockData(key: string): unknown {
	return mockDataRegistry.get(key);
}

/**
 * Development-only console logging
 */
export const devLog = (...args: unknown[]) => {
	if (!IS_PRODUCTION) {
		console.log("[DEV]", ...args);
	}
};

/**
 * Development-only console warning
 */
export const devWarn = (...args: unknown[]) => {
	if (!IS_PRODUCTION) {
		console.warn("[DEV]", ...args);
	}
};

/**
 * Mock data validation
 */
export function validateMockDataStructure<T>(
	data: T,
	validator: (data: T) => boolean,
	errorMessage: string,
): T {
	if (!IS_PRODUCTION && !validator(data)) {
		throw new Error(`Mock data validation failed: ${errorMessage}`);
	}
	return data;
}
