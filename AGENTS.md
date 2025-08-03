# AGENTS.md

Essential configuration for AI agents working with this codebase.

## Project Overview

Solomon Codes is a Next.js TypeScript monorepo with voice-first AI capabilities,
using Turbo for build orchestration and Bun as the package manager.

## Essential Commands

```bash
# Setup
bun install                    # Install all dependencies
./SETUP.sh                    # Run full environment setup

# Development
turbo dev                     # Start all development servers
turbo -F web dev              # Start only web app (port 3001)
turbo -F docs dev             # Start only docs

# Quality & Testing
turbo lint                    # Lint all packages
turbo typecheck              # TypeScript validation
turbo test                   # Run all tests
turbo test:ci                # Run tests for CI

# Build & Deploy
turbo build                  # Build all packages
turbo build:production       # Production build with validation
```

## Architecture

- **Monorepo**: Turborepo with workspaces in `apps/` and `packages/`
- **Main App**: `apps/web` - Next.js with voice-first UI
- **Docs**: `apps/docs` - Astro documentation site
- **Package Manager**: Bun (lockfile: `bun.lock`)
- **Database**: PostgreSQL with Electric SQL sync
- **Voice**: Letta AI integration with OpenAI Realtime API

## Key Technologies

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind
- **Voice**: Letta AI, OpenAI Realtime API, Web Speech API
- **Automation**: Browserbase, Stagehand, E2B sandboxes
- **Testing**: Vitest, Playwright, Bun test
- **Observability**: OpenTelemetry, Winston logging

## File Structure

```txt
apps/web/src/
├── app/           # Next.js app router
├── components/    # React components
├── lib/          # Utilities and services
├── hooks/        # Custom React hooks
└── types/        # TypeScript definitions
```

## Environment Setup

1. Copy `.env.example` to `.env` in `apps/web/`
2. Configure required API keys (OpenAI, Google AI, E2B, Browserbase)
3. Set up PostgreSQL database connection
4. Run `./SETUP.sh` for complete environment setup
