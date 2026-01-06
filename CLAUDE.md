# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Coachful is a productivity and accountability SaaS platform built with Next.js 16+. It's a multi-tenant coaching platform where coaches can create organizations with custom domains, programs, and squads to support their clients.

## Development Commands

```bash
# Development (requires Doppler CLI for secrets)
npm run dev              # Start dev server with Doppler
npm run dev:local        # Start with .env.local (fallback for offline)

# Build & Production
npm run build            # Build for production
npm run lint             # Run ESLint

# Doppler (secrets management)
npm run doppler:setup    # Configure Doppler project
npm run doppler:open     # Open Doppler dashboard
npm run doppler:secrets  # List all secrets
npm run doppler:sync     # Download secrets to .env.local
```

## Tech Stack

- **Framework**: Next.js 16+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom design tokens
- **Auth**: Clerk (multi-tenant with organizations)
- **Database**: Firebase Firestore
- **Real-time Chat**: Stream Chat
- **Video Calls**: Stream Video
- **Payments**: Stripe (with Stripe Connect for coaches)
- **Email**: Resend
- **AI**: Anthropic Claude API
- **Secrets**: Doppler (required for development)

## Architecture

### Multi-Tenancy Model
- Platform operates on `app.coachful.co` (admin/platform)
- Coaches get subdomains: `{org}.coachful.co`
- Coaches can also use custom domains
- Tenant resolution happens in `src/proxy.ts` (middleware)

### Key Contexts (Provider Hierarchy in layout.tsx)
- `DemoModeProvider` / `DemoSessionProvider` - Demo mode support
- `ThemeProvider` - Dark/light theme with org defaults
- `BrandingProvider` - Per-org branding (logo, colors, title)
- `SquadProvider` - Squad membership and data
- `OrganizationProvider` - Clerk organization context
- `StreamChatProvider` / `StreamVideoProvider` - Real-time features
- `ChatSheetProvider` - Chat UI state

### Data Flow
1. Middleware (`src/proxy.ts`) resolves tenant from domain
2. Server components fetch data with tenant context
3. Contexts hydrate client-side with SSR data
4. SWR handles client-side data fetching/caching

### User Roles
- `user` - Regular client/member
- `editor` - Can edit content
- `coach` - Can manage squads within an organization
- `admin` - Organization admin (super_coach)
- `super_admin` - Platform admin

### Organization Roles (within a tenant)
- `super_coach` - Organization owner
- `coach` - Squad coach
- `member` - Client/member

## Code Patterns

### Path Alias
Use `@/*` for imports from `src/*`:
```typescript
import { useFirebaseUser } from '@/hooks/useFirebaseUser';
import { db } from '@/lib/firebase';
```

### API Routes
- Located in `src/app/api/`
- Use Clerk `auth()` for authentication
- Access tenant context from headers or auth metadata

### Custom Hooks
All hooks in `src/hooks/` follow the pattern:
- Return loading states, error states, and data
- Use SWR for data fetching where appropriate
- Example: `useFirebaseUser`, `useStreamChat`, `useSquad`

### Components
- `src/components/ui/` - Base UI components (buttons, inputs, dialogs)
- Feature-specific folders (chat, feed, squad, coach, etc.)
- Use Tailwind classes with design tokens from `globals.css`

### Firestore Collections
Key collections (see `FIRESTORE_SCHEMAS.md` for full details):
- `users` - User profiles synced from Clerk
- `goals` - User goals with progress tracking
- `habits` - Daily/weekly habits
- `tasks` - Daily Focus tasks (max 3 per day) and backlog
- `squads` - User groups/communities
- `squad_members` - Membership records
- `programs` - Coach-created programs
- `enrollments` - User program enrollments

### Common Patterns

**Authenticated API route:**
```typescript
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... handle request
}
```

**Server component with tenant context:**
```typescript
import { getServerBranding } from '@/lib/branding-server';

export default async function Page() {
  const branding = await getServerBranding();
  // ... render with org branding
}
```

## Important Files

- `src/proxy.ts` - Main middleware (tenant resolution, auth, routing)
- `src/app/layout.tsx` - Root layout with all providers
- `src/lib/firebase-admin.ts` - Server-side Firebase Admin SDK
- `src/lib/firebase.ts` - Client-side Firebase SDK
- `src/lib/clerk-organizations.ts` - Clerk org utilities
- `src/types/index.ts` - Core TypeScript definitions

## ESLint Rules

The project uses relaxed warnings for:
- `@typescript-eslint/no-explicit-any` - warn
- `@typescript-eslint/no-unused-vars` - warn (ignores `_` prefixed)
- `react-hooks/exhaustive-deps` - warn

## Demo Mode

The app supports a demo mode (`demo.coachful.co`) that simulates data without authentication. Demo logic is in:
- `src/contexts/DemoModeContext.tsx`
- `src/contexts/DemoSessionContext.tsx`
- `src/lib/demo-*.ts` files

## MCP Server Usage

This project has several MCP (Model Context Protocol) servers configured. Use them appropriately for efficient development.

### Serena (Semantic Code Tools)

Use Serena for **intelligent code exploration and editing**. It provides symbol-aware operations that are more efficient than reading entire files.

**When to use:**
- Exploring unfamiliar code - use `get_symbols_overview` first
- Finding specific functions/classes - use `find_symbol` with name patterns
- Understanding code relationships - use `find_referencing_symbols`
- Making precise edits - use `replace_symbol_body` or `insert_after_symbol`

**Key principles:**
- Avoid reading entire files; use symbolic tools to get only what you need
- Use `find_symbol` with `include_body=True` only when you need implementation details
- Use `depth=1` to get class methods without reading their bodies
- For small edits within a symbol, use `replace_content` with regex

**Example workflow:**
```
1. get_symbols_overview("src/hooks/useFirebaseUser.ts") → See all exports
2. find_symbol("useFirebaseUser", depth=1) → Get hook structure
3. find_symbol("useFirebaseUser/fetchUser", include_body=True) → Read specific function
4. find_referencing_symbols("useFirebaseUser") → Find all usages
```

**Available memories** (read with `read_memory`):
- `codebase_structure` - Project directory layout
- `project_overview` - High-level architecture
- `suggested_commands` - Common dev commands
- `code_style_conventions` - Coding standards
- `task_completion_checklist` - Pre-commit checklist

### Context7 (Library Documentation)

Use Context7 to fetch **up-to-date documentation** for any library or framework.

**When to use:**
- Looking up API usage for dependencies (Next.js, Clerk, Firebase, Stream, etc.)
- Checking current best practices for a library
- Finding code examples for specific features

**Workflow:**
```
1. resolve-library-id("next.js", "How to use server actions") → Get library ID
2. query-docs("/vercel/next.js", "server actions with forms") → Get documentation
```

**Common libraries in this project:**
- Next.js: `/vercel/next.js`
- Clerk: `/clerk/clerk`
- Firebase: `/firebase/firebase-js-sdk`
- Tailwind CSS: `/tailwindlabs/tailwindcss`
- Stream Chat: `/getstream/stream-chat-js`

### Chrome DevTools (Browser Automation)

Use Chrome DevTools MCP for **testing and debugging** the running application.

**When to use:**
- Testing UI interactions and flows
- Debugging frontend issues
- Taking screenshots for verification
- Inspecting network requests and console logs

**Key tools:**
- `navigate_page` - Go to a URL or navigate history
- `take_snapshot` - Get page content as accessible text (preferred over screenshots)
- `take_screenshot` - Capture visual state
- `click`, `fill`, `hover` - Interact with elements
- `list_console_messages` - Check for errors
- `list_network_requests` - Debug API calls
- `performance_start_trace` - Profile page performance

**Example workflow:**
```
1. navigate_page(url="http://localhost:3000/coach")
2. take_snapshot() → Get page structure with element UIDs
3. click(uid="submit-button") → Interact with elements
4. list_console_messages() → Check for errors
```

### Task Master AI (Task Management)

Use Task Master for **project planning and task tracking** when working on larger features.

**When to use:**
- Breaking down PRD into actionable tasks
- Tracking progress on multi-step implementations
- Finding the next task to work on

**Key tools:**
- `parse_prd` - Generate tasks from a PRD document
- `get_tasks` - List all tasks with optional status filter
- `next_task` - Find the next task based on dependencies
- `set_task_status` - Update task status (pending, in-progress, done, etc.)
- `expand_task` - Break a task into subtasks

**Task statuses:** `pending`, `in-progress`, `done`, `deferred`, `cancelled`, `blocked`, `review`

**PRD location:** `.taskmaster/docs/prd.txt`
**Tasks file:** `.taskmaster/tasks/tasks.json`

### MCP Best Practices

1. **Prefer Serena over raw file reads** for code exploration
2. **Use Context7** before implementing unfamiliar library features
3. **Use Chrome DevTools** to verify UI changes work correctly
4. **Use Task Master** for complex, multi-step feature work
5. **Read relevant Serena memories** at the start of a session
6. **Use thinking tools** (`think_about_collected_information`, `think_about_task_adherence`) before making changes
