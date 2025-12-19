# Profile System - Quick Reference

## Routes

| Route | Description |
|-------|-------------|
| `/profile` | View your own profile |
| `/profile?edit=true` | Edit your profile |
| `/profile?userId=xxx` | View another user's profile |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/user/me` | GET | Fetch current user's profile data |
| `/api/user/me` | PATCH | Update current user's profile |
| `/api/user/[userId]` | GET | Fetch another user's public profile |

## Components

```
ProfileHeader        - Avatar, name, profession, location
├─ Back button
├─ Settings icon (own profile) OR Message icon (other profile)

ProfileTabs          - Tab switcher
├─ My Journey tab
│   └─ MyJourneyTab
│       ├─ Mission section
│       ├─ Goals section
│       └─ Habits section
└─ My Details tab
    └─ MyDetailsTab
        ├─ About me
        ├─ My interests
        └─ Contacts and social

ProfileEditForm      - Full profile editing form
├─ Avatar editor
├─ Basic info inputs
├─ About me section
└─ Contacts section
```

## Profile Fields

### Basic Info
- `name` - Display name
- `avatarUrl` - Profile picture URL
- `location` - City, country
- `profession` - Job title
- `company` - Company name

### About
- `bio` - About me text
- `interests` - Interests text

### Contacts
- `phoneNumber`
- `email` (read-only, from Clerk)
- `instagramHandle`
- `linkedinHandle`
- `twitterHandle`
- `websiteUrl`

### Journey (Read-only in profile, edited elsewhere)
- `identity` - Mission statement (edit at `/onboarding`)
- `goal` - Current goal (edit at `/onboarding/goal`)
- Habits (edit at `/habits`)

## Usage Examples

### Displaying a Profile Component

```tsx
import { ProfileHeader } from '@/components/profile/ProfileHeader';

<ProfileHeader
  user={userData}
  isOwnProfile={true}
  onEditClick={() => router.push('/profile?edit=true')}
/>
```

### Fetching Profile Data

```typescript
// Own profile
const response = await fetch('/api/user/me');
const data = await response.json();
// Returns: { exists: boolean, user: FirebaseUser, goal: GoalData }

// Other user's profile
const response = await fetch(`/api/user/${userId}`);
const data = await response.json();
// Returns: { exists: boolean, user: Partial<FirebaseUser>, goal: GoalData, isOwnProfile: boolean }
```

### Updating Profile

```typescript
const response = await fetch('/api/user/me', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    location: 'New York, NY',
    profession: 'Software Engineer',
    bio: 'Passionate about building great products',
    // ... other fields
  }),
});
```

## Navigation Flow

```
/profile
  │
  ├─ Click "Settings" → /profile?edit=true
  │   │
  │   ├─ Click "Save" → /profile (with reload)
  │   └─ Click "Back" → /profile
  │
  ├─ Click "Edit" on Mission → /onboarding
  ├─ Click "Edit" on Goal → /onboarding/goal
  ├─ Click habit card → /habits/[id]
  └─ Click "Show more" habits → /habits

/profile?userId=xxx (Other user)
  │
  └─ Click "Message" → /chat
```

## Design Tokens

```css
/* Colors */
--background-primary: #faf8f6
--background-elevated: #f3f1ef
--background-secondary: #ffffff
--text-primary: #1a1a1a
--text-secondary: #5f5a55
--text-muted: #a7a39e
--accent-secondary: #a07855
--button-primary: #2c2520
--border: #e1ddd8

/* Spacing */
gap-1: 4px
gap-2: 8px
gap-3: 12px
gap-4: 16px
gap-6: 24px

/* Borders */
cards: rounded-[20px]
buttons: rounded-[32px]
inputs: rounded-[50px]
avatar: rounded-full

/* Sizing */
avatar: 160x160px
icon: 16-20px
input-height: 54px
```

## Common Tasks

### Add a new profile field

1. Add field to `FirebaseUser` type in `/src/types/index.ts`
2. Add field to `allowedFields` array in `/src/app/api/user/me/route.ts` (PATCH)
3. Add input to `ProfileEditForm.tsx`
4. Add display to `MyDetailsTab.tsx` or appropriate component

### Change which fields are public

Edit the `publicProfile` object in `/src/app/api/user/[userId]/route.ts` to include/exclude fields.

### Customize empty states

Edit the empty state JSX in:
- `MyJourneyTab.tsx` - for mission/goal/habits
- `MyDetailsTab.tsx` - for bio/interests/contacts

## Tips

- Always check `isOwnProfile` to conditionally show edit controls
- Use existing `useRouter()` for navigation
- Leverage existing APIs for mission, goal, and habits
- Follow Figma designs for spacing and typography
- Test with empty data to ensure empty states work















