import { isFeatureEnabled } from "../features/gates";
import { createContextLogger } from "../logging/factory";

/**
 * Mock data manager for development and testing environments
 */
export class MockDataManager {
	private logger = createContextLogger("mock-data-manager");
	private mockDataEnabled: boolean;

	constructor() {
		this.mockDataEnabled = isFeatureEnabled("enableMockData");
		this.logger.info("Mock data manager initialized", {
			enabled: this.mockDataEnabled,
		});
	}

	/**
	 * Check if mock data should be used
	 */
	shouldUseMockData(): boolean {
		return this.mockDataEnabled;
	}

	/**
	 * Get mock data or real data based on environment
	 */
	async getData<T>(
		mockDataProvider: () => T | Promise<T>,
		realDataProvider: () => T | Promise<T>,
		context?: string,
	): Promise<T> {
		if (this.shouldUseMockData()) {
			this.logger.debug("Using mock data", { context });
			return await mockDataProvider();
		}

		this.logger.debug("Using real data", { context });
		return await realDataProvider();
	}

	/**
	 * Conditionally execute code based on mock data setting
	 */
	async conditionalExecution<T>(
		mockExecution: () => T | Promise<T>,
		realExecution: () => T | Promise<T>,
		context?: string,
	): Promise<T> {
		return this.getData(mockExecution, realExecution, context);
	}

	/**
	 * Create a mock data wrapper for services
	 */
	createMockWrapper<T extends object>(
		realService: T,
		mockService: Partial<T>,
		serviceName: string,
	): T {
		if (!this.shouldUseMockData()) {
			return realService;
		}

		this.logger.info("Using mock service", { serviceName });

		// Create a proxy that uses mock methods when available, falls back to real service
		return new Proxy(realService, {
			get: (target, prop) => {
				if (prop in mockService) {
					this.logger.debug("Using mock method", {
						serviceName,
						method: String(prop),
					});
					return mockService[prop as keyof T];
				}
				return target[prop as keyof T];
			},
		});
	}

	/**
	 * Validate that mock data is not used in production
	 */
	validateProductionSafety(): void {
		if (process.env.NODE_ENV === "production" && this.mockDataEnabled) {
			const error = new Error(
				"Mock data is enabled in production environment. This should never happen.",
			);
			this.logger.error("Production safety violation", {
				error: error.message,
				environment: process.env.NODE_ENV,
				mockDataEnabled: this.mockDataEnabled,
			});
			throw error;
		}
	}
}

/**
 * Global mock data manager instance
 */
let _mockDataManager: MockDataManager | null = null;

/**
 * Get the global mock data manager instance
 */
export function getMockDataManager(): MockDataManager {
	if (!_mockDataManager) {
		_mockDataManager = new MockDataManager();
	}
	return _mockDataManager;
}

/**
 * Reset mock data manager (for testing)
 */
export function resetMockDataManager(): void {
	_mockDataManager = null;
}

/**
 * Convenience function to check if mock data should be used
 */
export function shouldUseMockData(): boolean {
	return getMockDataManager().shouldUseMockData();
}

/**
 * Convenience function to get mock or real data
 */
export async function getMockOrRealData<T>(
	mockDataProvider: () => T | Promise<T>,
	realDataProvider: () => T | Promise<T>,
	context?: string,
): Promise<T> {
	return getMockDataManager().getData(
		mockDataProvider,
		realDataProvider,
		context,
	);
}

/**
 * Higher-order function to create mock-aware services
 */
export function withMockSupport<T extends object>(
	realService: T,
	mockService: Partial<T>,
	serviceName: string,
): T {
	return getMockDataManager().createMockWrapper(
		realService,
		mockService,
		serviceName,
	);
}

/**
 * Decorator for mock-aware methods
 */
export function mockAware<T extends unknown[], R>(
	mockImplementation: (...args: T) => R | Promise<R>,
	context?: string,
) {
	return (
		target: unknown,
		propertyKey: string,
		descriptor: PropertyDescriptor,
	) => {
		const originalMethod = descriptor.value;

		descriptor.value = async function (...args: T): Promise<R> {
			const manager = getMockDataManager();

			if (manager.shouldUseMockData()) {
				const logger = createContextLogger("mock-decorator");
				logger.debug("Using mock implementation", {
					context:
						context ||
						`${(target as { constructor: { name: string } }).constructor.name}.${propertyKey}`,
					method: propertyKey,
				});
				return await mockImplementation.apply(this, args);
			}

			return await originalMethod.apply(this, args);
		};

		return descriptor;
	};
}

/**
 * Build-time mock data exclusion utility
 */
export function excludeFromProduction<T>(mockData: T): T | undefined {
	if (process.env.NODE_ENV === "production") {
		return undefined;
	}
	return mockData;
}

/**
 * Runtime mock data validation
 */
export function validateMockDataUsage(): void {
	getMockDataManager().validateProductionSafety();
}
