import { neon, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import type { DatabaseConfig, DatabaseHealth } from "./types";

/**
 * Get database configuration based on environment variables
 */
export function getDatabaseConfig(): DatabaseConfig {
	const environment = process.env.NODE_ENV || "development";

	// Base configuration
	const config: DatabaseConfig = {
		connectionString: process.env.DATABASE_URL || "",
		ssl: environment === "production",
		maxConnections: Number.parseInt(process.env.DB_MAX_CONNECTIONS || "10", 10),
		idleTimeout: Number.parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
		connectionTimeout: Number.parseInt(
			process.env.DB_CONNECTION_TIMEOUT || "5000",
			10,
		),
	};

	// Environment-specific overrides
	if (environment === "test") {
		config.maxConnections = 5;
		config.ssl = false;
	}

	return config;
}

/**
 * Create a database client using Neon serverless
 */
export function createDatabaseClient(customConfig?: Partial<DatabaseConfig>) {
	const config = customConfig
		? { ...getDatabaseConfig(), ...customConfig }
		: getDatabaseConfig();

	if (!config.connectionString) {
		throw new Error("DATABASE_URL environment variable is required");
	}

	// Create Neon client
	const sql = neon(config.connectionString);

	// Create Drizzle client with schema
	const db = drizzle(sql, { schema });

	return db;
}

/**
 * Create a connection pool for better performance
 */
export function createConnectionPool(customConfig?: Partial<DatabaseConfig>) {
	const config = customConfig
		? { ...getDatabaseConfig(), ...customConfig }
		: getDatabaseConfig();

	if (!config.connectionString) {
		throw new Error("DATABASE_URL environment variable is required");
	}

	// Create connection pool
	const pool = new Pool({
		connectionString: config.connectionString,
		max: config.maxConnections,
		idleTimeoutMillis: config.idleTimeout,
		connectionTimeoutMillis: config.connectionTimeout,
		ssl: config.ssl,
	});

	return pool;
}

/**
 * Check database health and connectivity
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
	const startTime = Date.now();
	const health: DatabaseHealth = {
		isHealthy: false,
		connectionCount: 0,
		responseTime: 0,
		lastCheck: new Date(),
		errors: [],
	};

	try {
		const config = getDatabaseConfig();
		if (!config.connectionString) {
			throw new Error("DATABASE_URL not configured");
		}

		const sql = neon(config.connectionString);

		// Simple health check query
		await sql`SELECT NOW() as now`;

		health.isHealthy = true;
		health.responseTime = Date.now() - startTime;
	} catch (error) {
		health.isHealthy = false;
		health.errors.push(error instanceof Error ? error.message : String(error));
		health.responseTime = Date.now() - startTime;
	}

	return health;
}

/**
 * Initialize database connection and perform basic checks
 */
export async function initializeDatabase(): Promise<{
	success: boolean;
	client?: ReturnType<typeof createDatabaseClient>;
	error?: string;
}> {
	try {
		const client = createDatabaseClient();

		// Perform a simple query to verify connection
		const sql = neon(getDatabaseConfig().connectionString);
		await sql`SELECT 1 as test`;

		return {
			success: true,
			client,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Get database connection string for different environments
 */
export function getDatabaseUrl(environment?: string): string {
	const env = environment || process.env.NODE_ENV || "development";

	// Environment-specific database URLs
	switch (env) {
		case "production":
			return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
		case "test":
			return process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";
		default:
			return process.env.DATABASE_URL || process.env.DEV_DATABASE_URL || "";
	}
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): {
	isValid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!config.connectionString) {
		errors.push("Connection string is required");
	}

	if (config.maxConnections && config.maxConnections < 1) {
		errors.push("Max connections must be at least 1");
	}

	if (config.idleTimeout && config.idleTimeout < 1000) {
		errors.push("Idle timeout must be at least 1000ms");
	}

	if (config.connectionTimeout && config.connectionTimeout < 1000) {
		errors.push("Connection timeout must be at least 1000ms");
	}

	// Validate connection string format
	if (
		config.connectionString &&
		!config.connectionString.startsWith("postgresql://")
	) {
		errors.push("Connection string must be a valid PostgreSQL URL");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Create database client with logging integration
 */
export function createDatabaseClientWithLogging(
	customConfig?: Partial<DatabaseConfig>,
) {
	const config = customConfig
		? { ...getDatabaseConfig(), ...customConfig }
		: getDatabaseConfig();

	if (!config.connectionString) {
		throw new Error("DATABASE_URL environment variable is required");
	}

	// Create Neon client
	const sql = neon(config.connectionString);

	// Create Drizzle client with schema and logging
	const db = drizzle(sql, {
		schema,
		logger: process.env.NODE_ENV === "development",
	});

	return db;
}

/**
 * Singleton database client instance
 */
let dbInstance: ReturnType<typeof createDatabaseClient> | null = null;

/**
 * Get singleton database client instance
 */
export function getDatabase(): ReturnType<typeof createDatabaseClient> {
	if (!dbInstance) {
		dbInstance = createDatabaseClient();
	}
	return dbInstance;
}

/**
 * Reset database client instance (useful for testing)
 */
export function resetDatabase(): void {
	dbInstance = null;
}

/**
 * Close database connections gracefully
 */
export async function closeDatabaseConnections(): Promise<void> {
	// Neon serverless connections are automatically managed
	// This function is provided for consistency and future extensibility
	dbInstance = null;
}

/**
 * Test database connection with retry logic
 */
export async function testDatabaseConnection(
	maxRetries = 3,
	retryDelay = 1000,
): Promise<{ success: boolean; error?: string; attempts: number }> {
	let attempts = 0;
	let lastError: Error | null = null;

	while (attempts < maxRetries) {
		attempts++;

		try {
			const health = await checkDatabaseHealth();
			if (health.isHealthy) {
				return { success: true, attempts };
			}

			lastError = new Error(health.errors.join(", "));
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
		}

		if (attempts < maxRetries) {
			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	}

	return {
		success: false,
		error: lastError?.message || "Unknown error",
		attempts,
	};
}
