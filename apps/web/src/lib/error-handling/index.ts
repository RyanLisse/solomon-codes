/**
 * Error handling and monitoring system initialization
 */

import { initializeGlobalErrorHandling } from "./global-handler";
import { initializeErrorReporting } from "./error-reporting";
import { initializePerformanceMonitoring } from "../monitoring/performance";
import { createContextLogger } from "../logging/factory";

export * from "./global-handler";
export * from "./error-reporting";
export * from "../monitoring/performance";

/**
 * Initialize comprehensive error handling and monitoring system
 */
export async function initializeErrorHandlingSystem(): Promise<void> {
	const logger = createContextLogger("error-system-init");
	
	try {
		logger.info("Initializing comprehensive error handling and monitoring system...");
		
		// Initialize global error handling
		initializeGlobalErrorHandling();
		
		// Initialize error reporting
		initializeErrorReporting({
			enabled: true,
			samplingRate: 1.0,
			batchSize: 10,
			flushInterval: 30000,
		});
		
		// Initialize performance monitoring
		initializePerformanceMonitoring({
			enabled: true,
			metricsRetention: 7,
			baselineWindow: 24,
			alertingEnabled: true,
			thresholds: {
				responseTime: 1000,
				memoryUsage: 80,
				errorRate: 5,
				cpuUsage: 80,
			},
		});
		
		logger.info("Error handling and monitoring system initialized successfully");
		console.log("🛡️ Error handling and monitoring system initialized successfully");
		
	} catch (error) {
		logger.error("Failed to initialize error handling system", { error });
		console.error("❌ Failed to initialize error handling system:", error);
		throw error;
	}
}