# Code Style and Conventions

## TypeScript
- Strict mode enabled
- Path alias: Use `@/*` for imports from `src/*`
  ```typescript
  import { useFirebaseUser } from '@/hooks/useFirebaseUser';
  import { db } from '@/lib/firebase';
  ```

## ESLint Rules (Relaxed Warnings)
- `@typescript-eslint/no-explicit-any` - warn
- `@typescript-eslint/no-unused-vars` - warn (ignores `_` prefixed variables)
- `react/no-unescaped-entities` - warn
- `@next/next/no-img-element` - warn
- `react-hooks/exhaustive-deps` - warn

## Naming Conventions
- **Hooks**: `use` prefix (e.g., `useFirebaseUser`, `useSquad`)
- **Components**: PascalCase (e.g., `StreamChatProvider.tsx`)
- **Utilities**: camelCase functions in `src/lib/`
- **Types**: Located in `src/types/` with PascalCase

## Component Patterns
- Server components are the default in Next.js App Router
- Client components marked with `'use client'` directive
- Components organized by feature in `src/components/`
- Base UI components in `src/components/ui/`

## Hook Patterns
All hooks in `src/hooks/` follow the pattern:
- Return loading states, error states, and data
- Use SWR for data fetching where appropriate
- Named exports (e.g., `export function useFirebaseUser()`)

## API Routes
- Located in `src/app/api/`
- Use Clerk `auth()` for authentication
- Access tenant context from headers or auth metadata
- Return `NextResponse.json()` responses

## Styling
- Tailwind CSS with custom design tokens from `globals.css`
- Use `cn()` utility from `src/lib/utils.ts` for class merging
- Design tokens for colors, spacing, etc.
