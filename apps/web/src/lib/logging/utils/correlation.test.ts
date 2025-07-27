import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearCorrelationId,
	createCorrelationMiddleware,
	generateCorrelationId,
	getCorrelationId,
	setCorrelationId,
	withCorrelationId,
} from "./correlation";

// Helper function to avoid nesting in tests
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Correlation ID System", () => {
	beforeEach(() => {
		clearCorrelationId();
	});

	describe("Correlation ID Generation", () => {
		it("should generate a valid correlation ID", () => {
			const correlationId = generateCorrelationId();

			expect(correlationId).toBeDefined();
			expect(typeof correlationId).toBe("string");
			expect(correlationId.length).toBeGreaterThan(0);
		});

		it("should generate unique correlation IDs", () => {
			const id1 = generateCorrelationId();
			const id2 = generateCorrelationId();

			expect(id1).not.toBe(id2);
		});

		it("should generate correlation ID in UUID format", () => {
			const correlationId = generateCorrelationId();

			// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
			const uuidRegex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			expect(correlationId).toMatch(uuidRegex);
		});
	});

	describe("Correlation ID Storage", () => {
		it("should store and retrieve correlation ID", () => {
			const testId = "test-correlation-id";

			setCorrelationId(testId);
			const retrievedId = getCorrelationId();

			expect(retrievedId).toBe(testId);
		});

		it("should return undefined when no correlation ID is set", () => {
			const correlationId = getCorrelationId();

			expect(correlationId).toBeUndefined();
		});

		it("should clear correlation ID", () => {
			const testId = "test-correlation-id";

			setCorrelationId(testId);
			expect(getCorrelationId()).toBe(testId);

			clearCorrelationId();
			expect(getCorrelationId()).toBeUndefined();
		});

		it("should overwrite existing correlation ID", () => {
			const firstId = "first-id";
			const secondId = "second-id";

			setCorrelationId(firstId);
			expect(getCorrelationId()).toBe(firstId);

			setCorrelationId(secondId);
			expect(getCorrelationId()).toBe(secondId);
		});
	});

	describe("Correlation ID Context", () => {
		it("should execute function with correlation ID context", async () => {
			const testId = "test-context-id";
			let capturedId: string | undefined;

			await withCorrelationId(testId, () => {
				capturedId = getCorrelationId();
			});

			expect(capturedId).toBe(testId);
		});

		it("should restore previous correlation ID after context", async () => {
			const originalId = "original-id";
			const contextId = "context-id";

			setCorrelationId(originalId);

			await withCorrelationId(contextId, () => {
				expect(getCorrelationId()).toBe(contextId);
			});

			expect(getCorrelationId()).toBe(originalId);
		});

		it("should handle async functions in context", async () => {
			const testId = "async-test-id";
			let capturedId: string | undefined;

			const asyncOperation = async () => {
				await delay(10);
				capturedId = getCorrelationId();
			};

			await withCorrelationId(testId, asyncOperation);

			expect(capturedId).toBe(testId);
		});

		it("should handle errors in context and restore correlation ID", async () => {
			const originalId = "original-id";
			const contextId = "context-id";

			setCorrelationId(originalId);

			try {
				await withCorrelationId(contextId, () => {
					throw new Error("Test error");
				});
			} catch (_error) {
				// Expected error
			}

			expect(getCorrelationId()).toBe(originalId);
		});
	});

	describe("Correlation Middleware", () => {
		interface MockRequest {
			headers: Record<string, string | string[] | undefined>;
			correlationId?: string;
		}

		interface MockResponse {
			setHeader: ReturnType<typeof vi.fn>;
		}

		it("should create middleware function", () => {
			const middleware = createCorrelationMiddleware();

			expect(middleware).toBeDefined();
			expect(typeof middleware).toBe("function");
		});

		it("should generate correlation ID when none exists in headers", () => {
			const middleware = createCorrelationMiddleware();
			const mockReq: MockRequest = {
				headers: {},
			};
			const mockRes: MockResponse = {
				setHeader: vi.fn(),
			};
			const mockNext = vi.fn();

			middleware(mockReq, mockRes, mockNext);

			expect(mockReq.correlationId).toBeDefined();
			expect(typeof mockReq.correlationId).toBe("string");
			expect(mockRes.setHeader).toHaveBeenCalledWith(
				"x-correlation-id",
				mockReq.correlationId,
			);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should use existing correlation ID from headers", () => {
			const existingId = "existing-correlation-id";
			const middleware = createCorrelationMiddleware();
			const mockReq: MockRequest = {
				headers: {
					"x-correlation-id": existingId,
				},
			};
			const mockRes: MockResponse = {
				setHeader: vi.fn(),
			};
			const mockNext = vi.fn();

			middleware(mockReq, mockRes, mockNext);

			expect(mockReq.correlationId).toBe(existingId);
			expect(mockRes.setHeader).toHaveBeenCalledWith(
				"x-correlation-id",
				existingId,
			);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should support custom header name", () => {
			const customHeader = "x-custom-correlation";
			const middleware = createCorrelationMiddleware({
				headerName: customHeader,
			});
			const mockReq: MockRequest = {
				headers: {},
			};
			const mockRes: MockResponse = {
				setHeader: vi.fn(),
			};
			const mockNext = vi.fn();

			middleware(mockReq, mockRes, mockNext);

			expect(mockRes.setHeader).toHaveBeenCalledWith(
				customHeader,
				mockReq.correlationId,
			);
		});
	});
});
