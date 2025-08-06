/**
 * Vitest setup file for TDD London School
 * Configures global test doubles and utilities
 */

import { beforeEach, afterEach, vi, expect } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Global test setup
beforeEach(() => {
  // Clear all module mocks
  vi.clearAllMocks();
  
  // Reset all timers
  vi.useRealTimers();
});

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
});

// Global test utilities
global.createMockWithDefaults = <T>(defaults: Partial<T> = {}) => {
  return mockDeep<T>(defaults);
};

// TDD London School helpers
global.createTestDouble = <T>(name: string) => {
  const mock = mockDeep<T>();
  // Add metadata for debugging
  (mock as any).__testDoubleName = name;
  return mock;
};

// Assertion helpers for better test readability
global.assertCalledWith = (mock: any, ...args: any[]) => {
  expect(mock).toHaveBeenCalledWith(...args);
};

global.assertCalledOnce = (mock: any) => {
  expect(mock).toHaveBeenCalledTimes(1);
};

global.assertNeverCalled = (mock: any) => {
  expect(mock).not.toHaveBeenCalled();
};

// Type declarations
declare global {
  var createMockWithDefaults: <T>(defaults?: Partial<T>) => T;
  var createTestDouble: <T>(name: string) => T;
  var assertCalledWith: (mock: any, ...args: any[]) => void;
  var assertCalledOnce: (mock: any) => void;
  var assertNeverCalled: (mock: any) => void;
}