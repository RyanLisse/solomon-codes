import type winston from "winston";

/**
 * Log levels supported by the logging system
 */
export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

/**
 * Environment types for configuration
 */
export type Environment = "development" | "production" | "test";

/**
 * Metadata that can be included with log entries
 */
export interface LogMetadata {
	[key: string]: unknown;
	correlationId?: string;
	traceId?: string;
	spanId?: string;
	userId?: string;
	sessionId?: string;
	requestId?: string;
	component?: string;
	operation?: string;
	duration?: number;
	error?: Error | string;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
	level?: LogLevel;
	environment?: Environment;
	serviceName?: string;
	serviceVersion?: string;
	filePath?: string;
	enableConsole?: boolean;
	enableFile?: boolean;
	enableOpenTelemetry?: boolean;
	defaultMeta?: LogMetadata;
}

/**
 * Transport configuration for different output destinations
 */
export interface TransportConfig {
	console?: {
		enabled: boolean;
		level?: LogLevel;
		colorize?: boolean;
	};
	file?: {
		enabled: boolean;
		filename: string;
		level?: LogLevel;
		maxsize?: number;
		maxFiles?: number;
		tailable?: boolean;
	};
	opentelemetry?: {
		enabled: boolean;
		level?: LogLevel;
	};
}

/**
 * Logger interface that extends Winston logger with additional methods
 */
export interface Logger
	extends Omit<winston.Logger, "debug" | "info" | "warn" | "error" | "child"> {
	// Override specific methods to match our LogMetadata type
	debug(message: string, meta?: LogMetadata): Logger;
	info(message: string, meta?: LogMetadata): Logger;
	warn(message: string, meta?: LogMetadata): Logger;
	error(message: string | Error, meta?: LogMetadata): Logger;
	child(defaultMeta: LogMetadata): Logger;
}

/**
 * Logger factory interface
 */
export interface LoggerFactory {
	createLogger(config?: Partial<LoggerConfig>): Logger;
	getDefaultConfig(): LoggerConfig;
}

/**
 * Context information for request tracking
 */
export interface RequestContext {
	correlationId: string;
	traceId?: string;
	spanId?: string;
	userId?: string;
	sessionId?: string;
	requestId?: string;
	method?: string;
	url?: string;
	userAgent?: string;
	ip?: string;
}

/**
 * Performance metrics for logging
 */
export interface PerformanceMetrics {
	duration: number;
	memoryUsage?: NodeJS.MemoryUsage;
	cpuUsage?: NodeJS.CpuUsage;
	timestamp: string;
}

/**
 * Database operation metadata
 */
export interface DatabaseMetadata extends LogMetadata {
	query?: string;
	queryType?: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "TRANSACTION";
	affectedRows?: number;
	executionTime?: number;
	connectionId?: string;
	database?: string;
	table?: string;
}

/**
 * API operation metadata
 */
export interface ApiMetadata extends LogMetadata {
	method: string;
	url: string;
	statusCode?: number;
	responseTime?: number;
	requestSize?: number;
	responseSize?: number;
	userAgent?: string;
	ip?: string;
}

/**
 * Agent operation metadata
 */
export interface AgentMetadata extends LogMetadata {
	agentType: string;
	agentId: string;
	operation: string;
	provider?: string;
	model?: string;
	tokenUsage?: {
		prompt: number;
		completion: number;
		total: number;
	};
	confidence?: number;
	reasoning?: string;
}
