import { afterEach, beforeAll, beforeEach, vi } from "vitest";

// Setup Node.js environment for lib testing
beforeAll(() => {
	// Mock browser APIs that might be referenced in lib code
	global.fetch = vi.fn();

	// Only mock localStorage if it doesn't exist or is not already mocked
	if (
		!global.localStorage ||
		typeof global.localStorage.getItem !== "function"
	) {
		Object.defineProperty(global, "localStorage", {
			value: {
				getItem: vi.fn(),
				setItem: vi.fn(),
				removeItem: vi.fn(),
				clear: vi.fn(),
				length: 0,
				key: vi.fn(),
			},
			writable: true,
		});
	}

	// Only mock sessionStorage if it doesn't exist
	if (!global.sessionStorage) {
		Object.defineProperty(global, "sessionStorage", {
			value: global.localStorage,
			writable: true,
		});
	}

	// Mock console methods for cleaner test output
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});

	// Mock process.env if not available
	if (typeof process === "undefined") {
		global.process = {
			env: {
				NODE_ENV: "test",
			},
			cwd: vi.fn(() => "/test"),
			exit: vi.fn(),
			browser: false,
		} as unknown as NodeJS.Process;
	}
});

beforeEach(() => {
	// Reset all mocks before each test
	vi.clearAllMocks();

	// Reset timers
	vi.useFakeTimers();
});

afterEach(() => {
	// Restore timers
	vi.useRealTimers();

	// Clear all mocks
	vi.clearAllMocks();
});
