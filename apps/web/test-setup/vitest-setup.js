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

	// Mock DOM APIs for Radix UI components
	if (typeof Element !== "undefined") {
		// Mock hasPointerCapture for Radix UI Select and other components
		Element.prototype.hasPointerCapture = vi.fn(() => false);
		Element.prototype.setPointerCapture = vi.fn();
		Element.prototype.releasePointerCapture = vi.fn();

		// Mock scrollIntoView for Radix UI components
		Element.prototype.scrollIntoView = vi.fn();

		// Mock getBoundingClientRect for positioning
		Element.prototype.getBoundingClientRect = vi.fn(() => ({
			bottom: 0,
			height: 0,
			left: 0,
			right: 0,
			top: 0,
			width: 0,
			x: 0,
			y: 0,
			toJSON: vi.fn(),
		}));

		// Mock getComputedStyle for layout calculations
		global.getComputedStyle = vi.fn(() => ({
			getPropertyValue: vi.fn(() => ""),
			getPropertyPriority: vi.fn(() => ""),
			setProperty: vi.fn(),
			removeProperty: vi.fn(),
		}));
	}

	// Mock window.matchMedia for responsive components
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(), // deprecated
			removeListener: vi.fn(), // deprecated
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});

	// Mock requestAnimationFrame and cancelAnimationFrame
	global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
	global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

	// Mock CSS properties that Radix UI might use
	if (typeof CSSStyleDeclaration !== "undefined") {
		CSSStyleDeclaration.prototype.setProperty = vi.fn();
		CSSStyleDeclaration.prototype.removeProperty = vi.fn();
		CSSStyleDeclaration.prototype.getPropertyValue = vi.fn(() => "");
	}
});

// Runs cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

// Add global error handling to suppress expected test errors
beforeAll(() => {
	// Store original handlers
	const originalOnError = global.onerror;
	const originalOnUnhandledRejection = global.onunhandledrejection;

	// Handle uncaught errors that might escape during testing
	global.onerror = (message, source, lineno, colno, error) => {
		// Suppress known test errors from error boundary tests
		if (
			error?.message &&
			(error.message.includes("Test error") ||
				error.message.includes("Retry test error") ||
				error.message.includes("Custom error message") ||
				error.message.includes("Detailed error message") ||
				error.message.includes("Logging test error") ||
				error.message.includes("Error in error handler"))
		) {
			// These are expected errors from error boundary tests
			return true;
		}
		// Let other errors through
		return originalOnError
			? originalOnError(message, source, lineno, colno, error)
			: false;
	};

	// Handle unhandled promise rejections
	global.onunhandledrejection = (event) => {
		// Suppress known test errors
		if (
			event.reason?.message &&
			(event.reason.message.includes("Test error") ||
				event.reason.message.includes("Retry test error") ||
				event.reason.message.includes("Custom error message") ||
				event.reason.message.includes("Detailed error message") ||
				event.reason.message.includes("Logging test error") ||
				event.reason.message.includes("Error in error handler"))
		) {
			event.preventDefault();
			return;
		}
		// Let other rejections through
		if (originalOnUnhandledRejection) {
			originalOnUnhandledRejection(event);
		}
	};
});
