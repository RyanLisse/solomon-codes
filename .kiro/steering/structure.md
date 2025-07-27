# Project Structure

## Monorepo Organization
```
solomon_codes/
├── apps/                    # Applications
│   ├── web/                # Next.js web application
│   └── docs/               # Astro documentation site
├── packages/               # Shared packages (if any)
└── [config files]          # Root configuration
```

## Web Application Structure (`apps/web/`)
```
src/
├── app/                    # Next.js App Router
│   ├── _components/        # Page-specific components
│   ├── actions/           # Server actions (inngest, stagehand, vibekit)
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── inngest/       # Background job webhooks
│   │   └── stagehand/     # Browser automation endpoints
│   ├── auth/              # Auth-related pages
│   ├── stagehand/         # Stagehand automation pages
│   └── task/              # Task management pages
├── components/            # Shared components
│   └── ui/                # shadcn/ui components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and configurations
├── stores/                # Zustand state stores
└── test/                  # Test setup and utilities
```

## Documentation Structure (`apps/docs/`)
```
src/
├── content/
│   └── docs/              # Markdown documentation
│       ├── guides/        # User guides
│       └── reference/     # API reference
└── assets/                # Static assets
```

## Configuration Files
- **Root Level**: `package.json`, `turbo.json`, `biome.json`
- **Web App**: `next.config.ts`, `tailwind.config.js`, `vitest.config.ts`
- **Docs**: `astro.config.mjs`

## Key Directories
- **`.claude/`**: Claude AI agent configurations and commands
- **`.kiro/`**: Kiro AI assistant steering rules
- **`.hive-mind/`**: Hive mind coordination system
- **`.turbo/`**: Turborepo cache and logs
- **`node_modules/`**: Dependencies (managed by Bun)

## Naming Conventions
- **Components**: PascalCase (e.g., `TaskForm.tsx`)
- **Files**: kebab-case for non-components (e.g., `use-github-auth.ts`)
- **Directories**: kebab-case (e.g., `_components/`)
- **API Routes**: kebab-case following Next.js conventions

## Import Organization
- External libraries first
- Internal utilities and components
- Relative imports last
- Biome automatically organizes imports

## Component Structure
- Use shadcn/ui components as base
- Custom components in `components/` for reusability
- Page-specific components in `app/_components/`
- UI primitives in `components/ui/`

## State Management
- **Global State**: Zustand stores in `src/stores/`
- **Server State**: TanStack Query for API data
- **Form State**: TanStack Form with Zod validation
- **Theme State**: next-themes provider