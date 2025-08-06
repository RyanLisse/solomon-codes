import { getConfigurationService } from "../config/service";
import { getFeatureGateService } from "./gates";

/**
 * Environment detection and utilities
 */
export class EnvironmentService {
	private readonly configService = getConfigurationService();
	private readonly featureGates = getFeatureGateService();

	/**
	 * Get the current environment
	 */
	async getCurrentEnvironment(): Promise<
		"development" | "staging" | "production" | "test"
	> {
		const config = await this.configService.getConfiguration();
		return config.nodeEnv;
	}

	/**
	 * Check if running in development
	 */
	async isDevelopment(): Promise<boolean> {
		return (await this.getCurrentEnvironment()) === "development";
	}

	/**
	 * Check if running in staging
	 */
	async isStaging(): Promise<boolean> {
		return (await this.getCurrentEnvironment()) === "staging";
	}

	/**
	 * Check if running in production
	 */
	async isProduction(): Promise<boolean> {
		return (await this.getCurrentEnvironment()) === "production";
	}

	/**
	 * Check if running in a non-production environment
	 */
	async isNonProduction(): Promise<boolean> {
		return !(await this.isProduction());
	}

	/**
	 * Get environment-specific configuration
	 */
	async getEnvironmentConfig() {
		const env = await this.getCurrentEnvironment();
		const config = await this.configService.getConfiguration();

		return {
			environment: env,
			version: config.appVersion,
			serviceName: config.serviceName,
			serverUrl: config.serverUrl,
			logLevel: config.logLevel,
			features: this.featureGates.getAllGates(),
		};
	}

	/**
	 * Get environment information for debugging
	 */
	getEnvironmentInfo() {
		return {
			...this.getEnvironmentConfig(),
			nodeVersion: process.version,
			platform: process.platform,
			arch: process.arch,
			uptime: process.uptime(),
			memoryUsage: process.memoryUsage(),
		};
	}

	/**
	 * Check if a feature should be enabled based on environment
	 */
	shouldEnableFeature(feature: string): boolean {
		// Development: Enable most features
		if (this.isDevelopment()) {
			return !["rateLimiting", "compression", "errorReporting"].includes(
				feature,
			);
		}

		// Staging: Enable most features except production-only ones
		if (this.isStaging()) {
			return !["compression"].includes(feature);
		}

		// Production: Enable only production-ready features
		return ![
			"debugTools",
			"mockData",
			"testFixtures",
			"experimentalFeatures",
			"devToolbar",
		].includes(feature);
	}

	/**
	 * Get allowed origins for CORS based on environment
	 */
	async getAllowedOrigins(): Promise<string[]> {
		const config = await this.configService.getConfiguration();

		if (await this.isDevelopment()) {
			return [
				"http://localhost:3000",
				"http://localhost:3001",
				"http://127.0.0.1:3000",
				"http://127.0.0.1:3001",
			];
		}

		if (await this.isStaging()) {
			return [
				config.serverUrl,
				"https://staging.solomon-codes.com", // Example staging URL
			];
		}

		// Production
		return [
			config.serverUrl,
			"https://solomon-codes.com", // Example production URL
		];
	}

	/**
	 * Get security headers based on environment
	 */
	getSecurityHeaders(): Record<string, string> {
		const headers: Record<string, string> = {};

		if (this.isProduction()) {
			headers["Strict-Transport-Security"] =
				"max-age=31536000; includeSubDomains";
			headers["X-Content-Type-Options"] = "nosniff";
			headers["X-Frame-Options"] = "DENY";
			headers["X-XSS-Protection"] = "1; mode=block";
			headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
		}

		if (this.isNonProduction()) {
			// More permissive headers for development/staging
			headers["X-Frame-Options"] = "SAMEORIGIN";
		}

		return headers;
	}

	/**
	 * Get rate limiting configuration based on environment
	 */
	getRateLimitConfig() {
		if (this.isDevelopment()) {
			return {
				enabled: false,
				windowMs: 15 * 60 * 1000, // 15 minutes
				max: 1000, // Very high limit for development
			};
		}

		if (this.isStaging()) {
			return {
				enabled: true,
				windowMs: 15 * 60 * 1000, // 15 minutes
				max: 200, // Moderate limit for staging
			};
		}

		// Production
		return {
			enabled: true,
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 100, // Conservative limit for production
		};
	}

	/**
	 * Get cache configuration based on environment
	 */
	getCacheConfig() {
		if (this.isDevelopment()) {
			return {
				enabled: false,
				ttl: 0,
				maxSize: 0,
			};
		}

		if (this.isStaging()) {
			return {
				enabled: true,
				ttl: 5 * 60, // 5 minutes
				maxSize: 100,
			};
		}

		// Production
		return {
			enabled: true,
			ttl: 30 * 60, // 30 minutes
			maxSize: 1000,
		};
	}
}

/**
 * Global environment service instance
 */
let _environmentService: EnvironmentService | null = null;

/**
 * Get the global environment service instance
 */
export function getEnvironmentService(): EnvironmentService {
	if (!_environmentService) {
		_environmentService = new EnvironmentService();
	}
	return _environmentService;
}

/**
 * Reset environment service (for testing)
 */
export function resetEnvironmentService(): void {
	_environmentService = null;
}

/**
 * Convenience functions for environment detection
 */
export const isDevelopment = () => getEnvironmentService().isDevelopment();
export const isStaging = () => getEnvironmentService().isStaging();
export const isProduction = () => getEnvironmentService().isProduction();
export const isNonProduction = () => getEnvironmentService().isNonProduction();

/**
 * Get current environment string
 */
export const getCurrentEnvironment = () =>
	getEnvironmentService().getCurrentEnvironment();

/**
 * Environment-aware console logging (only in development)
 */
export const devLog = (...args: unknown[]) => {
	if (isDevelopment()) {
		console.log("[DEV]", ...args);
	}
};

/**
 * Environment-aware console warning (only in non-production)
 */
export const devWarn = (...args: unknown[]) => {
	if (isNonProduction()) {
		console.warn("[DEV]", ...args);
	}
};

/**
 * Environment-aware console error (always enabled but with context)
 */
export const envError = (...args: unknown[]) => {
	const env = getCurrentEnvironment();
	console.error(`[${env.toUpperCase()}]`, ...args);
};

/**
 * React hook for environment detection
 */
export function useEnvironment() {
	const service = getEnvironmentService();

	return {
		environment: service.getCurrentEnvironment(),
		isDevelopment: service.isDevelopment(),
		isStaging: service.isStaging(),
		isProduction: service.isProduction(),
		isNonProduction: service.isNonProduction(),
		config: service.getEnvironmentConfig(),
		info: service.getEnvironmentInfo(),
	};
}
