import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock window.location.reload
Object.defineProperty(window, "location", {
	value: {
		...window.location,
		reload: vi.fn(),
	},
	writable: true,
});
