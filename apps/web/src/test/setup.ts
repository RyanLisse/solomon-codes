import "@testing-library/jest-dom";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, expect, vi } from "vitest";

// extends Vitest's expect method with methods from react-testing-library
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
});

// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
