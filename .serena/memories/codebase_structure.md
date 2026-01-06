# Codebase Structure

## Root Directory
```
gaweb4-main/
├── src/                    # Main source code
├── public/                 # Static assets
├── docs/                   # Documentation
├── scripts/                # Build/utility scripts
├── .claude/                # Claude Code settings
├── .serena/                # Serena memories
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript config
├── tailwind.config.ts      # Tailwind CSS config
├── next.config.ts          # Next.js config
├── firebase.json           # Firebase config
├── firestore.rules         # Firestore security rules
├── CLAUDE.md               # Project instructions for Claude
└── FIRESTORE_SCHEMAS.md    # Database schema documentation
```

## Source Directory (`src/`)
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes
│   ├── admin/              # Admin panel
│   ├── coach/              # Coach dashboard
│   ├── squad/              # Squad features
│   ├── program/            # Program features
│   ├── onboarding/         # User onboarding
│   ├── profile/            # User profile
│   ├── chat/               # Chat interface
│   ├── feed/               # Activity feed
│   ├── habits/             # Habit tracking
│   └── ...                 # Other routes
├── components/             # React components
│   ├── ui/                 # Base UI components (buttons, inputs, etc.)
│   ├── coach/              # Coach-specific components
│   ├── squad/              # Squad components
│   ├── chat/               # Chat components
│   ├── feed/               # Feed components
│   ├── habits/             # Habit components
│   ├── onboarding/         # Onboarding components
│   └── ...                 # Feature-specific folders
├── hooks/                  # Custom React hooks
│   ├── useFirebaseUser.ts  # Firebase user data
│   ├── useSquad.ts         # Squad data
│   ├── useStreamChat.ts    # Chat functionality
│   └── ...                 # ~50+ hooks
├── lib/                    # Utility functions and services
│   ├── firebase.ts         # Client-side Firebase SDK
│   ├── firebase-admin.ts   # Server-side Firebase Admin SDK
│   ├── clerk-organizations.ts  # Clerk org utilities
│   ├── utils.ts            # General utilities (cn, etc.)
│   └── ...                 # Service-specific modules
├── contexts/               # React contexts
├── types/                  # TypeScript type definitions
└── proxy.ts                # Main middleware (tenant resolution)
```

## Key Files
- `src/proxy.ts` - Main middleware (tenant resolution, auth, routing)
- `src/app/layout.tsx` - Root layout with all providers
- `src/lib/firebase-admin.ts` - Server-side Firebase Admin SDK
- `src/lib/firebase.ts` - Client-side Firebase SDK
- `src/lib/clerk-organizations.ts` - Clerk org utilities
- `src/types/index.ts` - Core TypeScript definitions

## Firestore Collections
Key collections (see `FIRESTORE_SCHEMAS.md` for full details):
- `users` - User profiles synced from Clerk
- `goals` - User goals with progress tracking
- `habits` - Daily/weekly habits
- `tasks` - Daily Focus tasks (max 3 per day) and backlog
- `squads` - User groups/communities
- `squad_members` - Membership records
- `programs` - Coach-created programs
- `enrollments` - User program enrollments
