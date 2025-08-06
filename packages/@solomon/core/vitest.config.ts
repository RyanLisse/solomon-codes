import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    includeSource: ['src/**/*.{js,ts}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
        '**/test-doubles/*',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    // TDD London School: Always use mocks by default
    unstubGlobals: true,
    unstubEnvs: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test-doubles': path.resolve(__dirname, './tests/test-doubles'),
      '@fixtures': path.resolve(__dirname, './tests/fixtures'),
    },
  },
});