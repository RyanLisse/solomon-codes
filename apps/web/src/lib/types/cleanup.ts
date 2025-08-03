/**
 * Type cleanup utilities for addressing placeholder types and disabled implementations
 */

import { createContextLogger } from "../logging/factory";

/**
 * Logger for type cleanup operations
 */
const logger = createContextLogger("type-cleanup");

/**
 * Replacement for 'any' type with better type safety
 */
export type SafeAny = unknown;

/**
 * Replacement for generic object types
 */
export type GenericObject = Record<string, unknown>;

/**
 * Replacement for generic function types
 */
export type GenericFunction = (...args: unknown[]) => unknown;

/**
 * Express-like request type (replacement for any)
 */
export interface ExpressRequest {
	method: string;
	url: string;
	headers: Record<string, string | string[] | undefined>;
	body?: unknown;
	params?: Record<string, string>;
	query?: Record<string, string | string[]>;
	ip?: string;
	correlationId?: string;
	[key: string]: unknown;
}

/**
 * Express-like response type (replacement for any)
 */
export interface ExpressResponse {
	status: number;
	statusCode: number;
	setHeader: (name: string, value: string) => void;
	end: (chunk?: unknown, encoding?: string) => void;
	json?: (data: unknown) => void;
	send?: (data: unknown) => void;
	[key: string]: unknown;
}

/**
 * Generic API response type
 */
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
	timestamp: Date;
}

/**
 * Database record type (replacement for any)
 */
export interface DatabaseRecord {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	[key: string]: unknown;
}

/**
 * Configuration object type
 */
export interface ConfigurationObject {
	[key: string]: string | number | boolean | ConfigurationObject | undefined;
}

/**
 * Event data type
 */
export interface EventData {
	type: string;
	timestamp: Date;
	source: string;
	data: Record<string, unknown>;
}

/**
 * Validation result type
 */
export interface ValidationResult<T = unknown> {
	isValid: boolean;
	data?: T;
	errors: string[];
	warnings: string[];
}

/**
 * Async operation result type
 */
export interface OperationResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: Error;
	duration?: number;
}

/**
 * Type guard utilities
 */
export const TypeGuards = {
	/**
	 * Check if value is a non-null object
	 */
	isObject: (value: unknown): value is Record<string, unknown> => {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	},

	/**
	 * Check if value is a string
	 */
	isString: (value: unknown): value is string => {
		return typeof value === "string";
	},

	/**
	 * Check if value is a number
	 */
	isNumber: (value: unknown): value is number => {
		return typeof value === "number" && !Number.isNaN(value);
	},

	/**
	 * Check if value is a boolean
	 */
	isBoolean: (value: unknown): value is boolean => {
		return typeof value === "boolean";
	},

	/**
	 * Check if value is an array
	 */
	isArray: (value: unknown): value is unknown[] => {
		return Array.isArray(value);
	},

	/**
	 * Check if value is a function
	 */
	isFunction: (value: unknown): value is GenericFunction => {
		return typeof value === "function";
	},

	/**
	 * Check if value has a specific property
	 */
	hasProperty: <T extends string>(
		value: unknown,
		property: T,
	): value is Record<T, unknown> => {
		return TypeGuards.isObject(value) && property in value;
	},

	/**
	 * Check if value is an API response
	 */
	isApiResponse: (value: unknown): value is ApiResponse => {
		return (
			TypeGuards.isObject(value) &&
			TypeGuards.hasProperty(value, "success") &&
			TypeGuards.isBoolean(value.success)
		);
	},

	/**
	 * Check if value is a database record
	 */
	isDatabaseRecord: (value: unknown): value is DatabaseRecord => {
		return (
			TypeGuards.isObject(value) &&
			TypeGuards.hasProperty(value, "id") &&
			TypeGuards.hasProperty(value, "createdAt") &&
			TypeGuards.hasProperty(value, "updatedAt") &&
			TypeGuards.isString(value.id)
		);
	},
};

/**
 * Safe type conversion utilities
 */
export const TypeConverters = {
	/**
	 * Safely convert unknown to string
	 */
	toString: (value: unknown, fallback = ""): string => {
		if (TypeGuards.isString(value)) return value;
		if (value === null || value === undefined) return fallback;
		return String(value);
	},

	/**
	 * Safely convert unknown to number
	 */
	toNumber: (value: unknown, fallback = 0): number => {
		if (TypeGuards.isNumber(value)) return value;
		if (TypeGuards.isString(value)) {
			const parsed = Number.parseFloat(value);
			return Number.isNaN(parsed) ? fallback : parsed;
		}
		return fallback;
	},

	/**
	 * Safely convert unknown to boolean
	 */
	toBoolean: (value: unknown, fallback = false): boolean => {
		if (TypeGuards.isBoolean(value)) return value;
		if (TypeGuards.isString(value)) {
			return value.toLowerCase() === "true";
		}
		if (TypeGuards.isNumber(value)) {
			return value !== 0;
		}
		return fallback;
	},

	/**
	 * Safely convert unknown to object
	 */
	toObject: (
		value: unknown,
		fallback: Record<string, unknown> = {},
	): Record<string, unknown> => {
		if (TypeGuards.isObject(value)) return value;
		return fallback;
	},

	/**
	 * Safely convert unknown to array
	 */
	toArray: (value: unknown, fallback: unknown[] = []): unknown[] => {
		if (TypeGuards.isArray(value)) return value;
		if (value !== null && value !== undefined) return [value];
		return fallback;
	},
};

/**
 * Disabled implementation tracker
 */
export class DisabledImplementationTracker {
	private disabledFeatures = new Map<
		string,
		{
			reason: string;
			disabledAt: Date;
			plannedReenabling?: Date;
			issueUrl?: string;
		}
	>();

	/**
	 * Register a disabled implementation
	 */
	registerDisabled(
		featureName: string,
		reason: string,
		options?: {
			plannedReenabling?: Date;
			issueUrl?: string;
		},
	): void {
		this.disabledFeatures.set(featureName, {
			reason,
			disabledAt: new Date(),
			...options,
		});

		logger.warn("Feature disabled", {
			feature: featureName,
			reason,
			plannedReenabling: options?.plannedReenabling,
			issueUrl: options?.issueUrl,
		});
	}

	/**
	 * Check if a feature is disabled
	 */
	isDisabled(featureName: string): boolean {
		return this.disabledFeatures.has(featureName);
	}

	/**
	 * Get disabled feature info
	 */
	getDisabledInfo(featureName: string) {
		return this.disabledFeatures.get(featureName);
	}

	/**
	 * Get all disabled features
	 */
	getAllDisabled() {
		return Object.fromEntries(this.disabledFeatures);
	}

	/**
	 * Remove a disabled feature (when re-enabled)
	 */
	markAsEnabled(featureName: string): void {
		if (this.disabledFeatures.delete(featureName)) {
			logger.info("Feature re-enabled", { feature: featureName });
		}
	}

	/**
	 * Get features that should be re-enabled
	 */
	getFeaturesReadyForReenabling(): string[] {
		const now = new Date();
		const ready: string[] = [];

		for (const [featureName, info] of this.disabledFeatures) {
			if (info.plannedReenabling && info.plannedReenabling <= now) {
				ready.push(featureName);
			}
		}

		return ready;
	}
}

/**
 * Global disabled implementation tracker
 */
export const disabledTracker = new DisabledImplementationTracker();

/**
 * Decorator for marking methods as temporarily disabled
 */
export function temporarilyDisabled(
	reason: string,
	options?: {
		plannedReenabling?: Date;
		issueUrl?: string;
		fallbackValue?: unknown;
	},
) {
	return (
		target: unknown,
		propertyKey: string,
		descriptor: PropertyDescriptor,
	) => {
		const _originalMethod = descriptor.value;
		const featureName = `${target?.constructor?.name || "Unknown"}.${propertyKey}`;

		// Register as disabled
		disabledTracker.registerDisabled(featureName, reason, options);

		descriptor.value = (...args: unknown[]) => {
			logger.warn("Attempting to call disabled method", {
				method: featureName,
				reason,
				args: args.length,
			});

			if (options?.fallbackValue !== undefined) {
				return options.fallbackValue;
			}

			throw new Error(
				`Method ${featureName} is temporarily disabled: ${reason}`,
			);
		};

		return descriptor;
	};
}

/**
 * Safe property access utility
 */
export function safeGet<T>(
	obj: unknown,
	path: string,
	fallback?: T,
): T | undefined {
	if (!TypeGuards.isObject(obj)) {
		return fallback;
	}

	const keys = path.split(".");
	let current: unknown = obj;

	for (const key of keys) {
		if (!TypeGuards.isObject(current) || !(key in current)) {
			return fallback;
		}
		current = current[key];
	}

	return current as T;
}

/**
 * Type assertion with validation
 */
export function assertType<T>(
	value: unknown,
	validator: (value: unknown) => value is T,
	errorMessage: string,
): T {
	if (!validator(value)) {
		throw new TypeError(errorMessage);
	}
	return value;
}

/**
 * Create a type-safe wrapper for unknown data
 */
export function createTypeSafeWrapper<T>(
	data: unknown,
	validator: (data: unknown) => data is T,
	fallback: T,
): T {
	if (validator(data)) {
		return data;
	}

	logger.warn("Type validation failed, using fallback", {
		receivedType: typeof data,
		fallback,
	});

	return fallback;
}
