/**
 * Common type definitions shared across the application
 */

// Base types for API responses
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
	code?: string;
	timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	pagination?: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
}

// Health check and monitoring types
export interface HealthStatus {
	healthy: boolean;
	timestamp: string;
	service: string;
	version?: string;
	uptime?: number;
	checks: Record<string, HealthCheck>;
	details?: Record<string, unknown>;
	errors?: string[];
	warnings?: string[];
}

export interface HealthCheck {
	status: "healthy" | "unhealthy" | "degraded";
	message?: string;
	duration?: number;
	lastCheck?: string;
	details?: Record<string, unknown>;
}

// Performance and monitoring types
export interface PerformanceMetric {
	name: string;
	value: number;
	unit: "ms" | "bytes" | "count" | "percentage" | "rate";
	timestamp: string;
	tags: Record<string, string>;
}

export interface ResourceUtilization {
	cpu: {
		usage: number;
		loadAverage: number[];
	};
	memory: {
		total: number;
		used: number;
		free: number;
		percentage: number;
	};
	disk?: {
		total: number;
		used: number;
		free: number;
		percentage: number;
	};
}

// Configuration and environment types
export interface Environment {
	NODE_ENV: "development" | "production" | "test" | "staging";
	PORT?: number;
	DATABASE_URL?: string;
	API_BASE_URL?: string;
}

export interface DatabaseConfig {
	url: string;
	maxConnections?: number;
	connectionTimeout?: number;
	ssl?: boolean;
}

export interface ApiConfig {
	baseUrl: string;
	timeout?: number;
	retries?: number;
	rateLimiting?: {
		requests: number;
		window: number; // in milliseconds
	};
}

// Logging and telemetry types
export interface LogEntry {
	level: "debug" | "info" | "warn" | "error";
	message: string;
	timestamp: string;
	service?: string;
	traceId?: string;
	spanId?: string;
	metadata?: Record<string, unknown>;
}

export interface TelemetryData {
	traceId: string;
	spanId?: string;
	operation: string;
	duration: number;
	status: "success" | "error";
	tags?: Record<string, string>;
	metadata?: Record<string, unknown>;
}

// Error handling types
export interface ErrorDetails {
	code: string;
	message: string;
	context?: Record<string, unknown>;
	stack?: string;
	timestamp: string;
}

export interface ValidationError {
	field: string;
	message: string;
	value?: unknown;
}

export interface BusinessError extends Error {
	code: string;
	details?: Record<string, unknown>;
	isRetryable?: boolean;
}

// User and authentication types
export interface UserSession {
	id: string;
	userId: string;
	expiresAt: Date;
	createdAt: Date;
	metadata?: Record<string, unknown>;
}

export interface AuthenticationResult {
	success: boolean;
	user?: {
		id: string;
		email?: string;
		name?: string;
		roles?: string[];
	};
	token?: string;
	expiresIn?: number;
	error?: string;
}

// Task and automation types (extending existing stagehand types)
export interface TaskExecution {
	id: string;
	taskId: string;
	status: "pending" | "running" | "completed" | "failed" | "cancelled";
	startTime: string;
	endTime?: string;
	duration?: number;
	result?: unknown;
	error?: string;
	logs?: string[];
	metadata?: Record<string, unknown>;
}

export interface TaskDefinition {
	id: string;
	name: string;
	description?: string;
	type: string;
	configuration: Record<string, unknown>;
	schedule?: string; // cron expression
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
}

// Generic utility types
export type Without<T, K extends keyof T> = Omit<T, K>;
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Configuration service types (for type safety)
export interface ConfigurationSchema {
	server: {
		port: number;
		host: string;
		cors: {
			origin: string | string[];
			credentials: boolean;
		};
	};
	database: DatabaseConfig;
	api: ApiConfig;
	monitoring: {
		enabled: boolean;
		endpoint?: string;
		interval: number;
	};
	logging: {
		level: string;
		format: "json" | "text";
		destination: "console" | "file" | "both";
	};
}

// HTTP and networking types
export interface HttpRequest {
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	url: string;
	headers?: Record<string, string>;
	body?: unknown;
	timeout?: number;
}

export interface HttpResponse<T = unknown> {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	data: T;
	duration?: number;
}

// Generic data transfer objects
export type CreateDto<T> = Omit<T, "id" | "createdAt" | "updatedAt">;
export type UpdateDto<T> = Partial<Omit<T, "id" | "createdAt">>;

// Search and filtering types
export interface SearchParams {
	query?: string;
	filters?: Record<string, unknown>;
	sort?: {
		field: string;
		order: "asc" | "desc";
	};
	page?: number;
	limit?: number;
}

export interface SearchResult<T> {
	items: T[];
	total: number;
	query: string;
	executionTime: number;
	facets?: Record<string, Array<{ value: string; count: number }>>;
}
