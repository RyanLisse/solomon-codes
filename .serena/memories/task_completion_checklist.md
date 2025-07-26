# Task Completion Checklist

## Before Committing Changes

### 1. Code Quality Checks
- [ ] Run `bun check` - Biome formatting and linting
- [ ] Run `bun check-types` - TypeScript type checking across all apps
- [ ] Verify no linting errors or warnings

### 2. Testing (After Vitest Setup)
- [ ] Run test suite to ensure all tests pass
- [ ] Add tests for new functionality
- [ ] Verify test coverage is maintained

### 3. Build Verification
- [ ] Run `bun build` - Ensure production build succeeds
- [ ] Test in development mode with `bun dev`

### 4. Documentation
- [ ] Update relevant documentation if needed
- [ ] Ensure README.md is current
- [ ] Update CLAUDE.md if new commands are added

### 5. Dependencies
- [ ] Verify all new dependencies are properly added to package.json
- [ ] Run `bun install` to ensure lockfile is updated
- [ ] Check for security vulnerabilities

### 6. Git Workflow
- [ ] Stage relevant changes only
- [ ] Write descriptive commit messages
- [ ] Husky pre-commit hooks should pass automatically

## Post-Deployment Verification
- [ ] Verify application starts correctly
- [ ] Check browser console for errors
- [ ] Test core functionality works as expected