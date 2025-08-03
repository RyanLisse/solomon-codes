/**
 * Global type declarations for the application
 */

// Helper types for test expectations
type ExpectResolves<T> = {
	toBe(expected: T): Promise<void>;
	toEqual(expected: T): Promise<void>;
	toBeTruthy(): Promise<void>;
	toBeFalsy(): Promise<void>;
};

type ExpectRejects = {
	toThrow(expected?: string | RegExp | Error): Promise<void>;
	toBe(expected: unknown): Promise<void>;
};

type ExpectNot<T> = {
	toBe(expected: T): void;
	toEqual(expected: T): void;
	toBeTruthy(): void;
	toBeFalsy(): void;
	toBeNull(): void;
	toBeUndefined(): void;
	toBeDefined(): void;
	toContain(expected: unknown): void;
	toThrow(expected?: string | RegExp | Error): void;
	toHaveBeenCalled(): void;
	toHaveBeenCalledWith(...args: unknown[]): void;
	toHaveBeenCalledTimes(times: number): void;
	toMatchObject(expected: Partial<T>): void;
	toStrictEqual(expected: T): void;
	toBeInstanceOf(expected: new (...args: unknown[]) => unknown): void;
	toBeGreaterThan(expected: number): void;
	toBeLessThan(expected: number): void;
};

// Module declarations for missing modules
declare module "bun:test" {
	export function describe(name: string, fn: () => void): void;
	export function test(name: string, fn: () => void | Promise<void>): void;
	export function it(name: string, fn: () => void | Promise<void>): void;
	export function expect<T = unknown>(
		actual: T,
	): {
		toBe(expected: T): void;
		toEqual(expected: T): void;
		toBeTruthy(): void;
		toBeFalsy(): void;
		toBeNull(): void;
		toBeUndefined(): void;
		toBeDefined(): void;
		toContain(expected: unknown): void;
		toThrow(expected?: string | RegExp | Error): void;
		toHaveBeenCalled(): void;
		toHaveBeenCalledWith(...args: unknown[]): void;
		toHaveBeenCalledTimes(times: number): void;
		toMatchObject(expected: Partial<T>): void;
		toStrictEqual(expected: T): void;
		toBeInstanceOf(expected: new (...args: unknown[]) => unknown): void;
		toBeGreaterThan(expected: number): void;
		toBeLessThan(expected: number): void;
		resolves: ExpectResolves<T>;
		rejects: ExpectRejects;
		not: ExpectNot<T>;
	};
	export function beforeEach(fn: () => void | Promise<void>): void;
	export function afterEach(fn: () => void | Promise<void>): void;
	export function beforeAll(fn: () => void | Promise<void>): void;
	export function afterAll(fn: () => void | Promise<void>): void;
	export function mock<T extends (...args: unknown[]) => unknown>(fn?: T): T;
}

// Global expect function for test environments
declare global {
	function expect<T = unknown>(
		actual: T,
	): {
		toBe(expected: T): void;
		toEqual(expected: T): void;
		toBeTruthy(): void;
		toBeFalsy(): void;
		toBeNull(): void;
		toBeUndefined(): void;
		toBeDefined(): void;
		toContain(expected: unknown): void;
		toThrow(expected?: string | RegExp | Error): void;
		toHaveBeenCalled(): void;
		toHaveBeenCalledWith(...args: unknown[]): void;
		toHaveBeenCalledTimes(times: number): void;
		toMatchObject(expected: Partial<T>): void;
		toStrictEqual(expected: T): void;
		toBeInstanceOf(expected: new (...args: unknown[]) => unknown): void;
		toBeGreaterThan(expected: number): void;
		toBeLessThan(expected: number): void;
		resolves: ExpectResolves<T>;
		rejects: ExpectRejects;
		not: ExpectNot<T>;
	};

	// Test globals
	function describe(name: string, fn: () => void): void;
	function test(name: string, fn: () => void | Promise<void>): void;
	function it(name: string, fn: () => void | Promise<void>): void;
	function beforeEach(fn: () => void | Promise<void>): void;
	function afterEach(fn: () => void | Promise<void>): void;
	function beforeAll(fn: () => void | Promise<void>): void;
	function afterAll(fn: () => void | Promise<void>): void;
	function mock<T extends (...args: unknown[]) => unknown>(fn?: T): T;

	// Process environment override
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV: "development" | "production" | "test" | "staging";
			[key: string]: string | undefined;
		}
	}
}

export {};
