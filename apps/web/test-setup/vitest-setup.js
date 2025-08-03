import "@testing-library/jest-dom";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, expect, vi } from "vitest";

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Setup DOM environment before all tests
beforeAll(() => {
	// Ensure we have a proper DOM environment
	if (typeof window !== "undefined" && !window.location) {
		Object.defineProperty(window, "location", {
			value: {
				href: "http://localhost:3001",
				origin: "http://localhost:3001",
			},
			writable: true,
		});
	}

	// Mock IntersectionObserver for React components that use it
	global.IntersectionObserver = vi.fn(() => ({
		disconnect: vi.fn(),
		observe: vi.fn(),
		unobserve: vi.fn(),
	}));

	// Mock ResizeObserver for React components that use it
	global.ResizeObserver = vi.fn(() => ({
		disconnect: vi.fn(),
		observe: vi.fn(),
		unobserve: vi.fn(),
	}));
});

// Runs cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
