# Console.log Replacement Summary

This document tracks the replacement of console.log statements with structured logging throughout the codebase.

## Completed Replacements

### Configuration System
- ✅ `apps/web/src/lib/config/startup.ts` - Replaced all console statements with structured logging
- ✅ `apps/web/src/lib/config/service.ts` - Added structured logging while keeping console for startup visibility
- ✅ `apps/web/src/lib/config/index.ts` - Kept console for critical startup errors (appropriate)

### API Routes
- ✅ `apps/web/src/app/api/stagehand/session/route.ts` - Added structured logging for API errors

### Actions
- ✅ `apps/web/src/app/actions/stagehand.ts` - Replaced console.error with structured logging

## Remaining Console Statements (Intentionally Kept)

### Critical Startup Messages
These console statements are intentionally kept for startup visibility:
- Configuration initialization messages
- Startup validation results
- Critical error messages during application bootstrap

### Development/Debug Console Statements
The following console statements should be evaluated case-by-case:

1. **Database Connection Logging** (`apps/web/src/lib/database/connection.ts`)
   - `console.log("Database notice:", notice);`
   - `console.log("Database notification:", notification);`
   - **Recommendation**: Replace with structured logging

2. **Component Debug Logging** (`apps/web/src/app/environments/_components/environments-list.tsx`)
   - `console.log(isAuthenticated);`
   - **Recommendation**: Remove or replace with debug logging

3. **Hook Debug Logging** (`apps/web/src/hooks/use-github-auth.ts`)
   - `console.log("isAuthenticated", isAuthenticated);`
   - **Recommendation**: Remove or replace with debug logging

4. **Error Handling in Hooks** (`apps/web/src/hooks/use-tasks.ts`, `apps/web/src/hooks/use-github-auth.ts`)
   - Various `console.error` statements
   - **Recommendation**: Replace with structured logging

5. **Component Error Handling** (`apps/web/src/app/_components/task-form.tsx`, etc.)
   - Various `console.error` statements
   - **Recommendation**: Replace with structured logging and user-facing error handling

6. **API Route Error Handling** (Multiple files)
   - Various `console.error` statements
   - **Recommendation**: Replace with structured logging

## Logging Infrastructure Improvements

### Added Components
1. **Context-Aware Logger Factory** (`apps/web/src/lib/logging/factory.ts`)
   - Provides loggers with automatic context injection
   - Supports correlation IDs, user IDs, session IDs

2. **Request Correlation Middleware** (`apps/web/src/lib/logging/middleware.ts`)
   - Adds correlation IDs to requests
   - Performance monitoring
   - Error logging middleware

3. **Enhanced Configuration Integration**
   - Logging configuration now uses the centralized config service
   - Environment-aware log levels and transports

### Usage Patterns

#### For API Routes
```typescript
import { createApiLogger } from "@/lib/logging/factory";

export async function POST(request: NextRequest) {
  const logger = createApiLogger("route-name");
  
  try {
    // ... route logic
    logger.info("Request processed successfully", { data });
  } catch (error) {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
```

#### For Server Actions
```typescript
import { createServiceLogger } from "@/lib/logging/factory";

export async function myAction() {
  const logger = createServiceLogger("service-name");
  
  logger.info("Action started");
  // ... action logic
}
```

#### For Components (Client-side)
```typescript
import { createContextLogger } from "@/lib/logging/factory";

export function MyComponent() {
  const logger = createContextLogger("component-name");
  
  useEffect(() => {
    logger.debug("Component mounted");
  }, []);
}
```

## Next Steps

1. **Phase 2**: Replace remaining console statements in hooks and components
2. **Phase 3**: Add user-facing error handling (toast notifications, error boundaries)
3. **Phase 4**: Implement request correlation across the entire application
4. **Phase 5**: Add performance monitoring and alerting

## Production Considerations

- Structured logs are now properly formatted for production log aggregation
- Log levels are environment-aware (debug in dev, info/warn in production)
- OpenTelemetry integration provides distributed tracing capabilities
- Configuration-driven logging allows runtime adjustments without code changes