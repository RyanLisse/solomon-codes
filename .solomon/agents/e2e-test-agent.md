# E2E Test Agent

## Scope


- **Domain**: End-to-end integration test suite
- **Responsibility**: Fix all E2E tests, ensure integration tests pass
- **Independence**: Complete autonomy over E2E test files


## Key Tasks

1. Fix storage state management tests
2. Fix authentication tests (OpenAI, Claude OAuth)
3. Fix chat-vibekit integration tests
4. Fix service worker tests
5. Ensure all E2E tests pass with 0 failures


## Test Files

- `/apps/web/src/test/e2e/interactions/storage-state-management.test.ts`
- `/apps/web/src/test/e2e/auth/openai-validation.test.ts`
- `/apps/web/src/test/e2e/auth/claude-oauth.test.ts`
- `/apps/web/src/test/e2e/integration/chat-vibekit-integration.test.ts`

- `/apps/web/src/test/e2e/service-worker/service-worker-comprehensive.test.ts`

## Commands


- `cd apps/web && bun run test:e2e`
- `cd apps/web && bun run test:integration`

## Success Criteria


- All E2E tests pass (0 failures)
- No skipped tests
- Integration flows working
- Authentication flows working
