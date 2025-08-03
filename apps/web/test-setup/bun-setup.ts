// Bun test setup for logic/utility tests
// @ts-expect-error Bun test API not typed in TypeScript
import { beforeAll, mock } from "bun:test";

// Setup test environment
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = "test";

  // Mock window object for happy-dom compatibility  
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
