# Tech Stack

## Build System & Package Management
- **Turborepo**: Monorepo build system with optimized caching
- **Bun**: Package manager and runtime (v1.2.19)
- **TypeScript**: Primary language for type safety

## Frontend Stack
- **Next.js 15.3**: React framework with App Router
- **React 19**: UI library
- **TailwindCSS 4.1**: Utility-first CSS framework
- **shadcn/ui**: Reusable component library built on Radix UI
- **Framer Motion**: Animation library
- **next-themes**: Theme management

## AI & Automation
- **AI SDK**: OpenAI integration (@ai-sdk/openai)
- **Stagehand**: Browser automation (@browserbasehq/stagehand)
- **BrowserBase**: Browser automation platform
- **Inngest**: Background job processing with real-time capabilities

## State Management & Data
- **Zustand**: Lightweight state management
- **TanStack Query**: Server state management
- **TanStack Form**: Form handling
- **Zod**: Schema validation

## Documentation
- **Astro**: Static site generator
- **Starlight**: Documentation theme

## Code Quality & Testing
- **Biome**: Linting and formatting (replaces ESLint/Prettier)
- **Vitest**: Testing framework
- **Testing Library**: React testing utilities
- **Husky**: Git hooks
- **lint-staged**: Pre-commit linting

## Common Commands

### Development
```bash
bun dev              # Start all apps in development
bun dev:web          # Start web app only (port 3001)
bun dev:docs         # Start docs site only
```

### Building & Testing
```bash
bun build            # Build all applications
bun check-types      # TypeScript type checking
bun check            # Run Biome linting/formatting
bun test             # Run tests (in web app)
bun test:coverage    # Run tests with coverage
```

### Code Quality
```bash
bun check --write .  # Auto-fix linting issues
```

## Configuration Notes
- Uses tab indentation (configured in biome.json)
- Double quotes for JavaScript/TypeScript
- Tailwind class sorting enabled via Biome
- PWA assets can be generated in web app
- Turbopack enabled for faster dev builds