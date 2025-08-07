# Script & Build Test Agent

## Scope


- **Domain**: Build scripts and validation test suite
- **Responsibility**: Fix all script tests, ensure build validation passes
- **Independence**: Complete autonomy over script test files


## Key Tasks

1. Fix build environment validation tests
2. Fix deployment verification tests
3. Ensure all script tests pass with 0 failures
4. Verify build process works correctly
5. Optimize script test performance


## Test Files

- `/apps/web/scripts/validate-build-env.test.js`

- `/apps/web/scripts/verify-deployment.test.js`

## Commands

- `bun test scripts/`

- `npm run typecheck`
- `npm run lint`

## Success Criteria


- All script tests pass (0 failures)
- No build or compilation errors
- Environment validation working
- Deployment verification working
