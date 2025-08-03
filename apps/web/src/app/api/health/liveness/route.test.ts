import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/logging/factory");

import { createApiLogger } from "@/lib/logging/factory";

describe("/api/health/liveness", () => {
	const mockLogger = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	};

	// Store original process methods
	const originalUptime = process.uptime;
	const originalMemoryUsage = process.memoryUsage;
	const originalCpuUsage = process.cpuUsage;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default mocks
		(createApiLogger as Mock).mockReturnValue(mockLogger);

		// Mock process methods with realistic values
		process.uptime = vi.fn().mockReturnValue(300) as typeof process.uptime; // 5 minutes uptime
		process.memoryUsage = vi.fn().mockReturnValue({
			rss: 50 * 1024 * 1024, // 50MB
			heapTotal: 30 * 1024 * 1024, // 30MB
			heapUsed: 15 * 1024 * 1024, // 15MB (50% heap usage)
			external: 5 * 1024 * 1024, // 5MB
			arrayBuffers: 1 * 1024 * 1024, // 1MB
		}) as unknown as typeof process.memoryUsage;
		process.cpuUsage = vi.fn().mockReturnValue({
			user: 100000, // 100ms
			system: 50000, // 50ms
		}) as typeof process.cpuUsage;
	});

	afterEach(() => {
		vi.restoreAllMocks();

		// Restore original process methods
		process.uptime = originalUptime;
		process.memoryUsage = originalMemoryUsage;
		process.cpuUsage = originalCpuUsage;
	});

	describe("GET", () => {
		it("should return alive status with process information", async () => {
			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toMatchObject({
				alive: true,
				timestamp: expect.any(String),
				uptime: 300,
				pid: expect.any(Number),
				memory: {
					rss: 50 * 1024 * 1024,
					heapTotal: 30 * 1024 * 1024,
					heapUsed: 15 * 1024 * 1024,
					external: 5 * 1024 * 1024,
					arrayBuffers: 1 * 1024 * 1024,
				},
				cpu: {
					user: 100000,
					system: 50000,
				},
				message: "Application is alive",
				details: {
					errors: [],
					warnings: [],
				},
			});
		});

		it("should warn about high heap usage", async () => {
			// Mock high heap usage (95%)
			process.memoryUsage = vi.fn().mockReturnValue({
				rss: 100 * 1024 * 1024,
				heapTotal: 30 * 1024 * 1024,
				heapUsed: 28.5 * 1024 * 1024, // 95% heap usage
				external: 5 * 1024 * 1024,
				arrayBuffers: 1 * 1024 * 1024,
			}) as unknown as typeof process.memoryUsage;

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.alive).toBe(true);
			expect(data.message).toBe("Application is alive but with warnings");
			expect(data.details.warnings).toContain(
				expect.stringContaining("High heap usage: 95.0%"),
			);
		});

		it("should warn about high memory usage", async () => {
			// Mock high memory usage (2GB)
			process.memoryUsage = vi.fn().mockReturnValue({
				rss: 2 * 1024 * 1024 * 1024, // 2GB
				heapTotal: 100 * 1024 * 1024,
				heapUsed: 50 * 1024 * 1024,
				external: 10 * 1024 * 1024,
				arrayBuffers: 5 * 1024 * 1024,
			}) as unknown as typeof process.memoryUsage;

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.alive).toBe(true);
			expect(data.message).toBe("Application is alive but with warnings");
			expect(data.details.warnings).toContain(
				expect.stringContaining("High memory usage: 2048.0MB"),
			);
		});

		it("should warn about low uptime indicating restart loops", async () => {
			// Mock low uptime (30 seconds)
			process.uptime = vi.fn().mockReturnValue(30) as typeof process.uptime;

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.alive).toBe(true);
			expect(data.uptime).toBe(30);
			expect(data.message).toBe("Application is alive but with warnings");
			expect(data.details.warnings).toContain(
				expect.stringContaining("Low uptime: 30.0s - potential restart loop"),
			);
		});

		it("should detect runtime execution problems", async () => {
			// Mock Array.prototype.map to return wrong length (simulating JS engine issues)
			const originalMap = Array.prototype.map;
			Array.prototype.map = vi.fn().mockReturnValue([1, 2]); // Wrong length

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.alive).toBe(false);
			expect(data.message).toBe("Application is not responding properly");
			expect(data.details.errors).toContain(
				"Basic JavaScript execution test failed",
			);

			// Restore original method
			Array.prototype.map = originalMap;
		});

		it("should handle async execution test failures", async () => {
			// Mock setImmediate to throw an error
			const originalSetImmediate = global.setImmediate;
			global.setImmediate = vi.fn().mockImplementation(() => {
				throw new Error("Event loop blocked");
			}) as unknown as typeof setImmediate;

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.alive).toBe(false);
			expect(data.message).toBe("Application is not responding properly");
			expect(data.details.errors).toContain(
				"Runtime execution test failed: Event loop blocked",
			);

			// Restore original method
			global.setImmediate = originalSetImmediate;
		});

		it("should combine multiple warnings correctly", async () => {
			// Setup multiple warning conditions
			process.uptime = vi.fn().mockReturnValue(45) as typeof process.uptime; // Low uptime
			process.memoryUsage = vi.fn().mockReturnValue({
				rss: 1.5 * 1024 * 1024 * 1024, // High memory (1.5GB)
				heapTotal: 100 * 1024 * 1024,
				heapUsed: 92 * 1024 * 1024, // High heap usage (92%)
				external: 10 * 1024 * 1024,
				arrayBuffers: 5 * 1024 * 1024,
			}) as unknown as typeof process.memoryUsage;

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.alive).toBe(true);
			expect(data.message).toBe("Application is alive but with warnings");
			expect(data.details.warnings).toHaveLength(3);
			expect(data.details.warnings).toContain(
				expect.stringContaining("High heap usage: 92.0%"),
			);
			expect(data.details.warnings).toContain(
				expect.stringContaining("High memory usage: 1536.0MB"),
			);
			expect(data.details.warnings).toContain(
				expect.stringContaining("Low uptime: 45.0s"),
			);
		});

		it("should handle endpoint errors gracefully", async () => {
			// Mock process.memoryUsage to throw an error
			process.memoryUsage = vi.fn().mockImplementation(() => {
				throw new Error("Memory access denied");
			}) as unknown as typeof process.memoryUsage;

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.alive).toBe(false);
			expect(data.message).toBe("Liveness probe error");
			expect(data.details.errors).toContain("Memory access denied");
			expect(data.memory).toEqual(expect.any(Object)); // Should still have some memory info
		});

		it("should log liveness probe activity", async () => {
			await GET();

			expect(mockLogger.debug).toHaveBeenCalledWith("Liveness probe requested");
			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Liveness probe completed",
				expect.objectContaining({
					alive: true,
					uptime: 300,
					memoryUsageMB: expect.any(String),
					heapUsagePercent: expect.any(String),
					errors: 0,
					warnings: 0,
				}),
			);
		});

		it("should log warnings in probe activity", async () => {
			// Setup warning condition
			process.memoryUsage = vi.fn().mockReturnValue({
				rss: 1.2 * 1024 * 1024 * 1024, // High memory
				heapTotal: 100 * 1024 * 1024,
				heapUsed: 50 * 1024 * 1024,
				external: 10 * 1024 * 1024,
				arrayBuffers: 5 * 1024 * 1024,
			}) as unknown as typeof process.memoryUsage;

			await GET();

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Liveness probe completed",
				expect.objectContaining({
					alive: true,
					warnings: 1,
				}),
			);
		});

		it("should log errors when probe detects issues", async () => {
			// Mock runtime execution failure
			const originalMap = Array.prototype.map;
			Array.prototype.map = vi.fn().mockReturnValue([1, 2]); // Wrong length

			await GET();

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Liveness probe completed",
				expect.objectContaining({
					alive: false,
					errors: 1,
				}),
			);

			// Restore original method
			Array.prototype.map = originalMap;
		});

		it("should handle probe errors and still log them", async () => {
			// Mock a complete failure scenario
			(createApiLogger as Mock).mockImplementation(() => {
				throw new Error("Logger unavailable");
			});

			const response = await GET();
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.alive).toBe(false);
			expect(data.message).toBe("Liveness probe error");
			expect(data.details.errors).toContain("Logger unavailable");
		});

		it("should return proper timestamp format", async () => {
			const beforeTime = new Date().toISOString();
			const response = await GET();
			const afterTime = new Date().toISOString();
			const data = await response.json();

			expect(data.timestamp).toMatch(
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
			);
			expect(new Date(data.timestamp).getTime()).toBeGreaterThanOrEqual(
				new Date(beforeTime).getTime(),
			);
			expect(new Date(data.timestamp).getTime()).toBeLessThanOrEqual(
				new Date(afterTime).getTime(),
			);
		});

		it("should include current process PID", async () => {
			const response = await GET();
			const data = await response.json();

			expect(data.pid).toBe(process.pid);
			expect(typeof data.pid).toBe("number");
			expect(data.pid).toBeGreaterThan(0);
		});

		it("should maintain consistent memory object structure", async () => {
			const response = await GET();
			const data = await response.json();

			expect(data.memory).toHaveProperty("rss");
			expect(data.memory).toHaveProperty("heapTotal");
			expect(data.memory).toHaveProperty("heapUsed");
			expect(data.memory).toHaveProperty("external");
			expect(data.memory).toHaveProperty("arrayBuffers");

			// All should be numbers
			Object.values(data.memory).forEach((value) => {
				expect(typeof value).toBe("number");
				expect(value).toBeGreaterThanOrEqual(0);
			});
		});

		it("should maintain consistent CPU object structure", async () => {
			const response = await GET();
			const data = await response.json();

			expect(data.cpu).toHaveProperty("user");
			expect(data.cpu).toHaveProperty("system");

			expect(typeof data.cpu.user).toBe("number");
			expect(typeof data.cpu.system).toBe("number");
			expect(data.cpu.user).toBeGreaterThanOrEqual(0);
			expect(data.cpu.system).toBeGreaterThanOrEqual(0);
		});
	});
});
