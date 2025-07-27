# VibeKit SDK Integration Analysis for solomon_codes

## Current Architecture Patterns

### 1. Task Management Store Pattern (`stores/tasks.ts`)
- **Zustand-based store** with TaskStore interface
- Task interface includes: id, title, description, messages[], status, branch, sessionId, repository, timestamps, mode ("code"|"ask"), hasChanges, pullRequest
- Methods: addTask, updateTask, setTasks, removeTask, archiveTask, unarchiveTask, getters by status/sessionId
- **Integration Point**: VibeKit can extend Task interface with vibekit-specific fields and use existing store methods

### 2. Inngest Integration Pattern (`lib/inngest.ts`, `app/actions/inngest.ts`)
- **Event-driven architecture** with realtime middleware
- Current pattern: `inngest.send()` triggers `createTask` function
- **Streaming support** via `createChunkPublisher` with 50ms delayed chunks
- **Mock data manager** integration for development/testing
- Task channel updates: `taskChannel().update()`, `taskChannel().status()`
- **Integration Point**: VibeKit can reuse streaming patterns and realtime updates

### 3. GitHub Authentication Flow (`hooks/use-github-auth.ts`)
- **Cookie-based auth** with github_access_token and github_user cookies
- **Popup OAuth flow** with message-based communication
- Repository and branch fetching with caching
- Auth verification via API calls
- **Integration Point**: VibeKit can reuse GitHub token and repository/branch selection

### 4. API Route Structure
- **Consistent RESTful patterns**: `/api/auth/github/[resource]/route.ts`
- **Runtime configuration** support (runtime exports)
- **Schema validation** patterns (Zod schemas)
- **Integration Point**: VibeKit can follow same API structure `/api/vibekit/[resource]/route.ts`

### 5. Real-time/Streaming Components
- **StreamingIndicator**: Three variants (dots, cursor, wave) with size options
- **OptimizedTaskClient**: 
  - Real-time message updates via useInngestSubscription
  - Streaming message state management with memory limits (MAX_STREAMING_MESSAGES = 50)
  - Message filtering and sorting by timestamp
  - **Integration Point**: VibeKit can reuse streaming UI patterns

### 6. Current VibeKit State (`app/actions/vibekit.ts`)
- **TEMPORARILY DISABLED** due to @dagger.io/dagger dependency conflict with @opentelemetry/core
- Stub implementation with error throwing
- Configuration interface ready: agent, environment.e2b, github, sessionId, telemetry
- **Integration Point**: Ready for re-enablement once dependency conflicts resolved

## Recommended Integration Strategy

### Phase 1: Foundation
1. **Resolve dependency conflicts** between @dagger.io/dagger and @opentelemetry/core
2. **Extend Task interface** with VibeKit-specific fields (e.g., vibekitSessionId, vibekitStatus)
3. **Create VibeKit API routes** following existing pattern: `/api/vibekit/session/route.ts`, `/api/vibekit/execute/route.ts`

### Phase 2: Core Integration
1. **Update createTask Inngest function** to support VibeKit execution alongside existing mock/real pattern
2. **Implement VibeKit streaming** using existing createChunkPublisher pattern
3. **Extend GitHub auth hook** to pass tokens to VibeKit configuration

### Phase 3: UI Integration
1. **Reuse OptimizedTaskClient** streaming patterns for VibeKit responses
2. **Add VibeKit status indicators** to existing task status system
3. **Extend task forms** with VibeKit-specific options (environment selection, model config)

This analysis shows the codebase is well-architected for VibeKit integration with established patterns for streaming, authentication, task management, and real-time updates.