import { getConfigurationService } from "../config/service";
import { createLogger as createWinstonLogger } from "./index";
import type { Logger, LogMetadata } from "./types";

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
class ContextAwareLoggerImpl {
	private readonly baseLogger: Logger;
	private readonly context: LoggerContext;

	constructor(baseLogger: Logger, context: LoggerContext) {
		this.baseLogger = baseLogger;
		this.context = { ...context };
	}

	/**
	 * Create a proxy that delegates to the base logger
	 */
	static createProxy(
		baseLogger: Logger,
		context: LoggerContext,
	): ContextAwareLogger {
		const impl = new ContextAwareLoggerImpl(baseLogger, context);

		return new Proxy(impl, {
			get(target, prop, receiver) {
				// If the property exists on our target, return it
				if (prop in target) {
					return Reflect.get(target, prop, receiver);
				}

				// Otherwise, delegate to the base logger
				const baseValue = Reflect.get(target.baseLogger, prop);
				if (typeof baseValue === "function") {
					return baseValue.bind(target.baseLogger);
				}
				return baseValue;
			},
			set(target, prop, value) {
				// Try to set on target first
				if (prop in target || typeof prop === "symbol") {
					return Reflect.set(target, prop, value);
				}
				// Otherwise set on base logger
				return Reflect.set(target.baseLogger, prop, value);
			},
		}) as unknown as ContextAwareLogger;
	}

	// Override child method to add context
	child(options: LogMetadata): Logger {
		return this.baseLogger.child(this.addContextToMeta(options));
	}

	/**
	 * Create a new logger with additional context
	 */
	withContext(additionalContext: Partial<LoggerContext>): ContextAwareLogger {
		const newContext = { ...this.context, ...additionalContext };
		return ContextAwareLoggerImpl.createProxy(this.baseLogger, newContext);
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
	private addContextToMeta(meta?: object): LogMetadata {
		const baseMeta = meta || {};
		return {
			...(baseMeta as LogMetadata),
			context: this.context,
		} as LogMetadata;
	}

	/**
	 * Log debug message with context
	 */
	debug(message: string, meta?: LogMetadata): Logger {
		return this.baseLogger.debug(message, this.addContextToMeta(meta));
	}

	/**
	 * Log info message with context
	 */
	info(message: string, meta?: LogMetadata): Logger {
		return this.baseLogger.info(message, this.addContextToMeta(meta));
	}

	/**
	 * Log warn message with context
	 */
	warn(message: string, meta?: LogMetadata): Logger {
		return this.baseLogger.warn(message, this.addContextToMeta(meta));
	}

	/**
	 * Log error message with context
	 */
	error(message: string | Error, meta?: LogMetadata): Logger {
		return this.baseLogger.error(message, this.addContextToMeta(meta));
	}
}

/**
 * Logger factory for creating context-aware loggers
 */
export class LoggerFactory {
	private static instance: LoggerFactory | null = null;
	private configService: ReturnType<typeof getConfigurationService> | null =
		null;

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
	 * Get configuration service, lazy-loaded to avoid initialization issues
	 */
	private getConfigService() {
		if (!this.configService) {
			this.configService = getConfigurationService();
		}
		return this.configService;
	}

	/**
	 * Create a context-aware logger
	 */
	createLogger(
		component: string,
		initialContext?: Partial<LoggerContext>,
	): ContextAwareLogger {
		const baseLogger = createWinstonLogger({ serviceName: component });

		// Use environment variables for immediate access
		// Configuration service will be used for runtime updates
		let environment = process.env.NODE_ENV || "development";
		let version = process.env.npm_package_version || "unknown";

		// Try to get configuration synchronously if available
		try {
			const configService = this.getConfigService();
			// Use cached config if available, otherwise fall back to env vars
			if (configService && (configService as any)._cachedConfig) {
				const config = (configService as any)._cachedConfig;
				environment = config.nodeEnv || environment;
				version = config.appVersion || version;
			}
		} catch {
			// Configuration not available - use fallbacks
			// This is expected during build time or early initialization
		}

		const context: LoggerContext = {
			component,
			environment,
			version,
			...initialContext,
		};

		return ContextAwareLoggerImpl.createProxy(baseLogger, context);
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
