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
