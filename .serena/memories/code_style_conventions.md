# Code Style and Conventions

## Formatting (Biome Configuration)
- **Indentation**: Tabs (not spaces)
- **Quote Style**: Double quotes for JavaScript/TypeScript
- **Import Organization**: Auto-organize imports enabled

## Linting Rules
- **Base**: Biome recommended rules
- **React**: React hooks dependency warnings (info level)
- **Style Rules**:
  - No parameter assignment (error)
  - Use const assertions (error)
  - Use default parameter last (error)
  - Use enum initializers (error)
  - Self-closing elements (error)
  - Single var declarator (error)
  - No unused template literals (error)
  - Use number namespace (error)
  - No inferrable types (error)
  - No useless else (error)
- **Tailwind**: Sorted classes with clsx, cva, cn functions

## TypeScript Conventions
- Strict TypeScript configuration
- Explicit type definitions for interfaces and types
- Use PascalCase for components and types
- Use camelCase for functions and variables
- Use kebab-case for file names

## File Organization
- Components in `src/components/` with UI components in `src/components/ui/`
- Hooks in `src/hooks/`
- Utilities in `src/lib/`
- Stores (Zustand) in `src/stores/`
- API routes in `src/app/api/`
- Actions in `src/app/actions/`

## Component Patterns
- React functional components with hooks
- shadcn/ui component library
- Consistent prop interfaces with TypeScript
- React Query for data fetching
- Zustand for state management