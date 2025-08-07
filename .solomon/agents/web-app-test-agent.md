# Web App Test Agent

## Scope
- **Domain**: `/apps/web/` test suite
- **Responsibility**: Fix all web app tests, ensure 100% pass rate
- **Independence**: Complete autonomy over web app test files

## Key Tasks
1. Fix failing unit tests in `/apps/web/src/components/ui/`
2. Fix failing API route tests in `/apps/web/src/app/api/`  
3. Fix component tests (task-form, task-list)
4. Ensure all web app tests pass with 0 failures
5. Optimize test performance and coverage

## Test Files
- `/apps/web/src/app/_components/task-form.test.tsx`
- `/apps/web/src/app/_components/task-list.test.tsx` 
- `/apps/web/src/app/api/health/liveness/route.test.ts`
- `/apps/web/src/app/api/health/route.test.ts`
- `/apps/web/src/app/api/health/readiness/route.test.ts`
- `/apps/web/src/app/api/version/route.test.ts`
- `/apps/web/src/components/ui/button.test.tsx`
- `/apps/web/src/components/ui/breadcrumb.test.tsx`
- `/apps/web/src/components/ui/collapsible.test.tsx`
- `/apps/web/src/components/ui/alert.test.tsx`

## Commands
- `cd apps/web && bun test`
- `cd apps/web && bun run test:coverage`

## Success Criteria
- All web app tests pass (0 failures)
- No skipped tests
- Maintain or improve test coverage