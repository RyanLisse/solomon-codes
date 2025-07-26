# Project Overview

## Purpose
**solomon_codes** is a modern TypeScript web application built with Better-T-Stack. It appears to be a web application that includes browser automation capabilities with Stagehand, task management, and GitHub integration.

## Tech Stack
- **Frontend Framework**: Next.js 15.3.0 with React 19
- **Language**: TypeScript
- **Styling**: TailwindCSS 4.1.10 with shadcn/ui components
- **Package Manager**: Bun 1.2.19
- **Monorepo**: Turborepo for build orchestration
- **Documentation**: Astro Starlight
- **Code Quality**: Biome for linting and formatting
- **Git Hooks**: Husky for pre-commit hooks
- **PWA**: Progressive Web App support

## Key Features
- Browser automation with Stagehand/Browserbase
- Task management system
- GitHub authentication and integration
- Real-time updates with Inngest
- Environment management
- AI SDK integration with OpenAI

## Architecture
- Monorepo structure with two main apps:
  - `apps/web/`: Next.js frontend application (port 3001)
  - `apps/docs/`: Astro Starlight documentation site