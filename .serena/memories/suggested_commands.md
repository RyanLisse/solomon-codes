# Suggested Commands

## Development Commands
- `bun install` - Install all dependencies
- `bun dev` - Start all applications in development mode
- `bun dev:web` - Start only the web application (localhost:3001)
- `bun dev:server` - Start only the server application
- `bun dev:native` - Start only the native application

## Build Commands
- `bun build` - Build all applications for production
- `bun check-types` - Check TypeScript types across all apps

## Code Quality Commands
- `bun check` - Run Biome formatting and linting (auto-fix enabled)
- `cd apps/web && bun lint` - Run Next.js ESLint

## Testing Commands
**Note**: Currently no test setup exists - Vitest needs to be added

## Documentation Commands
- `cd apps/docs && bun dev` - Start documentation site
- `cd apps/docs && bun build` - Build documentation site

## PWA Commands
- `cd apps/web && bun generate-pwa-assets` - Generate PWA assets

## System Commands (macOS/Darwin)
- `ls` - List directory contents
- `find` - Search for files and directories
- `grep` - Search text patterns
- `git` - Version control operations