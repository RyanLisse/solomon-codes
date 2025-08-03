import { beforeAll, beforeEach, vi } from "vitest";

// Setup Node.js environment for integration tests
beforeAll(() => {
	// Set test environment
	vi.stubEnv("NODE_ENV", "test");

	// Mock environment variables for testing
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
	process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";

	// Mock fetch for API route testing
	global.fetch = vi.fn();

	// Mock console methods to reduce noise during tests
	const originalConsole = console;
	global.console = {
		...originalConsole,
		log: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		// Keep error and warn for debugging
		error: originalConsole.error,
		warn: originalConsole.warn,
	};
});

beforeEach(() => {
	// Clear all mocks before each test
	vi.clearAllMocks();
});
