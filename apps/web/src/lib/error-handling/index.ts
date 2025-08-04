/**
 * Error handling and monitoring system initialization
 */

import { createContextLogger } from "../logging/factory";
import { initializePerformanceMonitoring } from "../monitoring/performance";
import { initializeErrorReporting } from "./error-reporting";
import { initializeGlobalErrorHandling } from "./global-handler";

// Export all error handling utilities
export * from "../monitoring/performance";
export {
	api,
	apiRequest,
	createHttpError,
	handleFetchError,
	withApiErrorHandler,
	withRetry,
} from "./api-errors";
export {
	ErrorBoundary,
	type ErrorBoundaryProps,
	type ErrorBoundaryState,
	useErrorBoundary,
	withErrorBoundary,
} from "./error-boundary";

// Export new error handling system
export {
	AppError,
	createErrorResponse,
	createInternalError,
	createNetworkError,
	createNotFoundError,
	createSuccessResponse,
	createUnauthorizedError,
	createValidationError,
	type ErrorCode,
	ErrorCodes,
	type ErrorContext,
	type ErrorSeverity,
	getErrorCode,
	getErrorMessage,
	isAppError,
	isRecoverableError,
} from "./error-handler";
export * from "./error-reporting";
export * from "./global-handler";
export {
	type AsyncOperationState,
	type FormValidationErrors,
	type FormValidationRule,
	type UseAsyncOperationOptions,
	type UseErrorHandlerOptions,
	useApiCall,
	useAsyncOperation,
	useDebouncedError,
	useErrorHandler,
	useFormValidation,
} from "./hooks";

/**
 * Initialize comprehensive error handling and monitoring system
 */
export async function initializeErrorHandlingSystem(): Promise<void> {
	const logger = createContextLogger("error-system-init");

	try {
		logger.info(
			"Initializing comprehensive error handling and monitoring system...",
		);

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

		logger.info(
			"Error handling and monitoring system initialized successfully",
		);
		console.log(
			"🛡️ Error handling and monitoring system initialized successfully",
		);
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		logger.error("Failed to initialize error handling system", {
			error: errorObj,
		});
		console.error("❌ Failed to initialize error handling system:", error);
		throw error;
	}
}
