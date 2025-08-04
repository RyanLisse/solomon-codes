import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Neon serverless client
const mockNeonClient = {
	query: vi.fn(),
	transaction: vi.fn(),
	end: vi.fn(),
};

const mockNeon = vi.fn(() => mockNeonClient);

vi.mock("@neondatabase/serverless", () => ({
	neon: mockNeon,
	Pool: vi.fn(() => mockNeonClient),
}));

// Mock drizzle-orm
const mockDrizzle = vi.fn(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("drizzle-orm/neon-http", () => ({
	drizzle: mockDrizzle,
}));

describe("Database Connection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset environment variables
		delete process.env.DATABASE_URL;
		delete (process.env as { NODE_ENV?: string }).NODE_ENV;
	});

	describe("Database Configuration", () => {
		it("should create database configuration with default values", async () => {
			const { getDatabaseConfig } = await import("./connection");

			const config = getDatabaseConfig();

			expect(config).toBeDefined();
			expect(config.maxConnections).toBe(10);
			expect(config.idleTimeout).toBe(30000);
			expect(config.connectionTimeout).toBe(5000);
		});

		it("should use environment variables for configuration", async () => {
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
			process.env.DB_MAX_CONNECTIONS = "20";
			process.env.DB_IDLE_TIMEOUT = "60000";

			const { getDatabaseConfig } = await import("./connection");

			const config = getDatabaseConfig();

			expect(config.connectionString).toBe(
				"postgresql://test:test@localhost:5432/testdb",
			);
			expect(config.maxConnections).toBe(20);
			expect(config.idleTimeout).toBe(60000);
		});

		it("should enable SSL in production", async () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "production";

			const { getDatabaseConfig } = await import("./connection");

			const config = getDatabaseConfig();

			expect(config.ssl).toBe(true);
		});

		it("should disable SSL in development", async () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "development";

			const { getDatabaseConfig } = await import("./connection");

			const config = getDatabaseConfig();

			expect(config.ssl).toBe(false);
		});
	});

	describe("Database Client Creation", () => {
		it("should create database client with Neon", async () => {
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";

			const { createDatabaseClient } = await import("./connection");

			const client = createDatabaseClient();

			expect(mockNeon).toHaveBeenCalledWith(
				"postgresql://test:test@localhost:5432/testdb",
			);
			expect(mockDrizzle).toHaveBeenCalledWith(mockNeonClient);
			expect(client).toBeDefined();
		});

		it("should throw error when DATABASE_URL is not provided", async () => {
			const { createDatabaseClient } = await import("./connection");

			expect(() => createDatabaseClient()).toThrow(
				"DATABASE_URL environment variable is required",
			);
		});

		it("should create client with custom configuration", async () => {
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";

			const { createDatabaseClient } = await import("./connection");

			const customConfig = {
				connectionString: "postgresql://custom:custom@localhost:5432/customdb",
				ssl: true,
				maxConnections: 15,
			};

			const client = createDatabaseClient(customConfig);

			expect(mockNeon).toHaveBeenCalledWith(
				"postgresql://custom:custom@localhost:5432/customdb",
			);
			expect(client).toBeDefined();
		});
	});

	describe("Database Health Check", () => {
		it("should perform health check successfully", async () => {
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
			mockNeonClient.query.mockResolvedValue([{ now: new Date() }]);

			const { checkDatabaseHealth } = await import("./connection");

			const health = await checkDatabaseHealth();

			expect(health.isHealthy).toBe(true);
			expect(health.responseTime).toBeGreaterThan(0);
			expect(health.lastCheck).toBeInstanceOf(Date);
			expect(mockNeonClient.query).toHaveBeenCalledWith("SELECT NOW() as now");
		});

		it("should handle health check failure", async () => {
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
			const error = new Error("Connection failed");
			mockNeonClient.query.mockRejectedValue(error);

			const { checkDatabaseHealth } = await import("./connection");

			const health = await checkDatabaseHealth();

			expect(health.isHealthy).toBe(false);
			expect(health.errors).toContain("Connection failed");
		});

		it("should measure response time accurately", async () => {
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
			mockNeonClient.query.mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(() => resolve([{ now: new Date() }]), 100),
					),
			);

			const { checkDatabaseHealth } = await import("./connection");

			const health = await checkDatabaseHealth();

			expect(health.responseTime).toBeGreaterThanOrEqual(100);
		});
	});

	describe("Connection Pool Management", () => {
		it("should create connection pool with proper configuration", async () => {
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";

			const { createConnectionPool } = await import("./connection");

			const pool = createConnectionPool();

			expect(pool).toBeDefined();
		});

		it("should handle pool connection errors", async () => {
			process.env.DATABASE_URL = "invalid-connection-string";

			const { createConnectionPool } = await import("./connection");

			expect(() => createConnectionPool()).not.toThrow();
		});
	});

	describe("Database Initialization", () => {
		it("should initialize database successfully", async () => {
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
			mockNeonClient.query.mockResolvedValue([]);

			const { initializeDatabase } = await import("./connection");

			const result = await initializeDatabase();

			expect(result.success).toBe(true);
			expect(result.client).toBeDefined();
		});

		it("should handle initialization failure", async () => {
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
			mockNeonClient.query.mockRejectedValue(new Error("Init failed"));

			const { initializeDatabase } = await import("./connection");

			const result = await initializeDatabase();

			expect(result.success).toBe(false);
			expect(result.error).toBe("Init failed");
		});
	});

	describe("Environment-specific Configuration", () => {
		it("should use development configuration", async () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "development";
			process.env.DATABASE_URL = "postgresql://dev:dev@localhost:5432/devdb";

			const { getDatabaseConfig } = await import("./connection");

			const config = getDatabaseConfig();

			expect(config.ssl).toBe(false);
			expect(config.maxConnections).toBe(10);
		});

		it("should use production configuration", async () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "production";
			process.env.DATABASE_URL = "postgresql://prod:prod@prod.host:5432/proddb";

			const { getDatabaseConfig } = await import("./connection");

			const config = getDatabaseConfig();

			expect(config.ssl).toBe(true);
			expect(config.maxConnections).toBe(10);
		});

		it("should use test configuration", async () => {
			(process.env as { NODE_ENV?: string }).NODE_ENV = "test";
			process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";

			const { getDatabaseConfig } = await import("./connection");

			const config = getDatabaseConfig();

			expect(config.ssl).toBe(false);
			expect(config.maxConnections).toBe(5);
		});
	});
});
