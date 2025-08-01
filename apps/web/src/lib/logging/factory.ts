import { createLogger as createWinstonLogger } from "./index";
import { getConfigurationService } from "../config/service";
import type { Logger } from "./types";

/**
 * Logger context information
 */
export interface LoggerContext {
	component: string;
	module?: string;
	userId?: string;
	sessionId?: string;
	correlationId?: string;
	environment?: string;
	version?: string;
}

/**
 * Enhanced logger with context awareness
 */
export interface ContextAwareLogger extends Logger {
	withContext(context: Partial<LoggerContext>): ContextAwareLogger;
	withCorrelationId(correlationId: string): ContextAwareLogger;
	withUserId(userId: string): ContextAwareLogger;
	withSessionId(sessionId: string): ContextAwareLogger;
	getContext(): LoggerContext;
}

/**
 * Context-aware logger implementation
 */
class ContextAwareLoggerImpl implements ContextAwareLogger {
	private baseLogger: Logger;
	private context: LoggerContext;

	constructor(baseLogger: Logger, context: LoggerContext) {
		this.baseLogger = baseLogger;
		this.context = { ...context };
	}

	/**
	 * Create a new logger with additional context
	 */
	withContext(additionalContext: Partial<LoggerContext>): ContextAwareLogger {
		const newContext = { ...this.context, ...additionalContext };
		return new ContextAwareLoggerImpl(this.baseLogger, newContext);
	}

	/**
	 * Create a new logger with correlation ID
	 */
	withCorrelationId(correlationId: string): ContextAwareLogger {
		return this.withContext({ correlationId });
	}

	/**
	 * Create a new logger with user ID
	 */
	withUserId(userId: string): ContextAwareLogger {
		return this.withContext({ userId });
	}

	/**
	 * Create a new logger with session ID
	 */
	withSessionId(sessionId: string): ContextAwareLogger {
		return this.withContext({ sessionId });
	}

	/**
	 * Get the current context
	 */
	getContext(): LoggerContext {
		return { ...this.context };
	}

	/**
	 * Add context to metadata
	 */
	private addContextToMeta(meta?: object): object {
		return {
			...meta,
			context: this.context,
		};
	}

	/**
	 * Log debug message with context
	 */
	debug(message: string, meta?: object): void {
		this.baseLogger.debug(message, this.addContextToMeta(meta));
	}

	/**
	 * Log info message with context
	 */
	info(message: string, meta?: object): void {
		this.baseLogger.info(message, this.addContextToMeta(meta));
	}

	/**
	 * Log warn message with context
	 */
	warn(message: string, meta?: object): void {
		this.baseLogger.warn(message, this.addContextToMeta(meta));
	}

	/**
	 * Log error message with context
	 */
	error(message: string, meta?: object): void {
		this.baseLogger.error(message, this.addContextToMeta(meta));
	}
}

/**
 * Logger factory for creating context-aware loggers
 */
export class LoggerFactory {
	private static instance: LoggerFactory | null = null;
	private configService = getConfigurationService();

	/**
	 * Get singleton instance
	 */
	static getInstance(): LoggerFactory {
		if (!LoggerFactory.instance) {
			LoggerFactory.instance = new LoggerFactory();
		}
		return LoggerFactory.instance;
	}

	/**
	 * Create a context-aware logger
	 */
	createLogger(
		component: string,
		initialContext?: Partial<LoggerContext>,
	): ContextAwareLogger {
		const baseLogger = createWinstonLogger(component);
		
		const context: LoggerContext = {
			component,
			environment: this.configService.getConfiguration().nodeEnv,
			version: this.configService.getConfiguration().appVersion,
			...initialContext,
		};

		return new ContextAwareLoggerImpl(baseLogger, context);
	}

	/**
	 * Create a logger for a specific module
	 */
	createModuleLogger(
		component: string,
		module: string,
		initialContext?: Partial<LoggerContext>,
	): ContextAwareLogger {
		return this.createLogger(component, {
			module,
			...initialContext,
		});
	}

	/**
	 * Create a logger for API routes
	 */
	createApiLogger(
		route: string,
		initialContext?: Partial<LoggerContext>,
	): ContextAwareLogger {
		return this.createLogger("api", {
			module: route,
			...initialContext,
		});
	}

	/**
	 * Create a logger for background jobs
	 */
	createJobLogger(
		jobName: string,
		initialContext?: Partial<LoggerContext>,
	): ContextAwareLogger {
		return this.createLogger("job", {
			module: jobName,
			...initialContext,
		});
	}

	/**
	 * Create a logger for database operations
	 */
	createDatabaseLogger(
		operation: string,
		initialContext?: Partial<LoggerContext>,
	): ContextAwareLogger {
		return this.createLogger("database", {
			module: operation,
			...initialContext,
		});
	}

	/**
	 * Create a logger for external service calls
	 */
	createServiceLogger(
		serviceName: string,
		initialContext?: Partial<LoggerContext>,
	): ContextAwareLogger {
		return this.createLogger("service", {
			module: serviceName,
			...initialContext,
		});
	}

	/**
	 * Reset factory instance (for testing)
	 */
	static reset(): void {
		LoggerFactory.instance = null;
	}
}

/**
 * Convenience function to create a context-aware logger
 */
export function createContextLogger(
	component: string,
	initialContext?: Partial<LoggerContext>,
): ContextAwareLogger {
	return LoggerFactory.getInstance().createLogger(component, initialContext);
}

/**
 * Convenience function to create a module logger
 */
export function createModuleLogger(
	component: string,
	module: string,
	initialContext?: Partial<LoggerContext>,
): ContextAwareLogger {
	return LoggerFactory.getInstance().createModuleLogger(
		component,
		module,
		initialContext,
	);
}

/**
 * Convenience function to create an API logger
 */
export function createApiLogger(
	route: string,
	initialContext?: Partial<LoggerContext>,
): ContextAwareLogger {
	return LoggerFactory.getInstance().createApiLogger(route, initialContext);
}

/**
 * Convenience function to create a job logger
 */
export function createJobLogger(
	jobName: string,
	initialContext?: Partial<LoggerContext>,
): ContextAwareLogger {
	return LoggerFactory.getInstance().createJobLogger(jobName, initialContext);
}

/**
 * Convenience function to create a database logger
 */
export function createDatabaseLogger(
	operation: string,
	initialContext?: Partial<LoggerContext>,
): ContextAwareLogger {
	return LoggerFactory.getInstance().createDatabaseLogger(
		operation,
		initialContext,
	);
}

/**
 * Convenience function to create a service logger
 */
export function createServiceLogger(
	serviceName: string,
	initialContext?: Partial<LoggerContext>,
): ContextAwareLogger {
	return LoggerFactory.getInstance().createServiceLogger(
		serviceName,
		initialContext,
	);
}