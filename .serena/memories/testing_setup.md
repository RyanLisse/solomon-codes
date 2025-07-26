# Testing Setup with Vitest

## Configuration
- **Testing Framework**: Vitest 3.2.4
- **Test Environment**: jsdom for React component testing
- **Testing Library**: @testing-library/react for component testing
- **Utilities**: @testing-library/user-event for user interactions
- **DOM Matchers**: @testing-library/jest-dom for extended assertions

## Test Scripts (apps/web)
- `bun test` - Run tests in watch mode
- `bun test:run` - Run tests once
- `bun test:watch` - Run tests in watch mode (explicit)
- `bun test:ui` - Run tests with Vitest UI
- `bun test:coverage` - Run tests with coverage report

## Configuration Files
- `apps/web/vitest.config.ts` - Main Vitest configuration
- `apps/web/src/test/setup.ts` - Test setup with DOM matchers

## Test File Conventions
- Test files: `*.test.{ts,tsx}` or `*.spec.{ts,tsx}`
- Location: Co-located with source files or in `__tests__` directories
- Setup includes automatic cleanup after each test

## TDD Workflow
1. Write failing test first
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. Use `bun test:watch` for continuous feedback

## Example Tests Created
- `src/lib/utils.test.ts` - Unit tests for utility functions
- `src/components/ui/button.test.tsx` - Component tests with user interactions