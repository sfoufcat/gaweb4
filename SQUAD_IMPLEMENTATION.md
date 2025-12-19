# Squad Feature Implementation

## Overview

The Squad feature allows users to join groups for accountability and mutual support. Squad members can see each other's progress, maintain a squad streak, and track collective alignment scores.

## Status: ✅ Implemented (with mock data)

All UI components are complete and functional with placeholder data. API routes and real calculations are marked with TODOs for Phase 2.

---

## Architecture

### Data Model

#### User Roles
- `user` - Regular user
- `coach` - Can create squads, assign users, edit squad metadata
- `super_admin` - Full admin rights

#### Collections

**squads**
```typescript
{
  id: string;
  name: string;
  avatarUrl: string;
  isPremium: boolean;
  coachId: string | null;
  streak: number | null;  // TODO: Real calculation
  avgAlignment: number | null;  // TODO: Real calculation
  createdAt: string;
  updatedAt: string;
}
```

**squad_members**
```typescript
{
  id: string;
  squadId: string;
  userId: string;
  roleInSquad: 'member' | 'coach';
  firstName: string;
  lastName: string;
  imageUrl: string;
  alignmentScore: number | null;  // TODO: Real calculation
  streak: number | null;  // TODO: Real calculation
  moodState: 'energized' | 'confident' | 'neutral' | 'uncertain' | 'stuck' | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## UI Components

### 1. SquadEmptyState
**Path:** `src/components/squad/SquadEmptyState.tsx`
- Shown when user is not in a squad
- Large circular gradient avatar
- Heading: "Finding your growth teammates"
- Invite button

### 2. SquadHeader
**Path:** `src/components/squad/SquadHeader.tsx`
- Squad avatar and name
- "Premium squad" or "Squad" subtitle
- Circular progress gauge showing avg alignment
- Squad streak indicator (🔥 + number)

### 3. SquadMemberRow
**Path:** `src/components/squad/SquadMemberRow.tsx`
- Member avatar (with story ring if active)
- Name
- For coach: "Squad coach" label
- For members: mood state progress bar + streak

### 4. SquadMemberList
**Path:** `src/components/squad/SquadMemberList.tsx`
- Shows coach first (if premium)
- Then regular members
- Separates by role

### 5. SquadInviteCards
**Path:** `src/components/squad/SquadInviteCards.tsx`
- "Invite friends to your squad" card
- "Upgrade to a Premium Squad" card
- Both with explanatory text and action buttons

### 6. ContributionGrid
**Path:** `src/components/squad/ContributionGrid.tsx`
- GitHub-style heatmap showing squad daily completion
- Color-coded by completion rate
- Legend showing < 50%, 50-70%, 70-90%, > 90%
- "Load more" button

### 7. SquadStats
**Path:** `src/components/squad/SquadStats.tsx`
- Average alignment score with change indicator
- "Top X% of squads" badge
- Contribution grid
- Explanation cards

### 8. SquadStreakSheet
**Path:** `src/components/squad/SquadStreakSheet.tsx`
- Bottom sheet modal explaining squad streak rules
- "Squad keeps streak only if >50% complete daily focus"
- Contribution grid legend
- Detailed explanations

### 9. Main Squad Page
**Path:** `src/app/squad/page.tsx`
- Tab bar (Squad / Stats)
- Squad tab: member list + invite cards
- Stats tab: alignment + contribution grid
- Handles empty state

---

## Hook

### useSquad
**Path:** `src/hooks/useSquad.ts`

Returns:
```typescript
{
  squad: Squad | null;
  members: SquadMember[];
  stats: SquadStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

Currently uses mock data. TODO comments indicate where API calls should be made.

---

## Placeholder Values

All calculations currently use placeholder/mock values:

1. **User Role** - Defaults to 'user'
2. **Squad Streak** - Mock value: 5 days
3. **Avg Alignment** - Mock value: 78%
4. **Individual Alignment Scores** - Mock values: 10-100
5. **Individual Streaks** - Mock values: 0-21 days
6. **Mood States** - Mock: energized, confident, neutral, uncertain, stuck
7. **Contribution History** - Empty array (mock data generated in component)

---

## TODO: Phase 2 - Backend Integration

### API Routes to Create

#### GET /api/squad/me
- Get current user's squad membership
- Returns squad + members + stats

#### GET /api/squad/:id/members
- Get all members of a squad
- Returns array of SquadMember

#### GET /api/squad/:id/stats
- Get squad statistics
- Calculate real alignment, contribution history

#### POST /api/squad (Coach/Super Admin only)
- Create new squad
- Validate user role
- Assign coach if premium

#### PATCH /api/squad/:id (Coach/Super Admin only)
- Update squad metadata
- Can change name, avatar, isPremium, coachId

#### DELETE /api/squad/:id (Super Admin only)
- Delete squad
- Remove all members

#### POST /api/squad/:id/members (Coach/Super Admin only)
- Add member to squad
- Denormalize user data

#### DELETE /api/squad/:id/members/:memberId (Coach/Super Admin only)
- Remove member from squad
- Update user.squadId to null

---

## TODO: Phase 2 - Real Calculations

### 1. Alignment Score
Calculate based on:
- Daily task completion
- Habit completion
- Identity alignment (TBD)

### 2. Streak
- Individual: consecutive days with completed daily focus tasks
- Squad: consecutive days where >50% of members completed tasks

### 3. Mood State
Map alignment score to mood:
- 90-100: energized
- 70-89: confident
- 50-69: neutral
- 30-49: uncertain
- 0-29: stuck

### 4. Contribution Grid
- Query last 30-60 days
- For each day, calculate % of squad members who completed tasks
- Map to color scale

### 5. Top Percentile
- Query all squads
- Rank by average alignment
- Calculate percentile

---

## Firestore Security Rules

Added rules for squads and squad_members collections:

- **squads**: Read by all authenticated, create/update by coach/super_admin, delete by super_admin
- **squad_members**: Read by squad members, create/delete by coach/super_admin

See `FIRESTORE_SCHEMAS.md` for details.

---

## Design System

All components follow the existing Growth Addicts design system:

- **Font**: Albert Sans (headings), Geist (body)
- **Colors**: 
  - Primary text: #1a1a1a
  - Secondary text: #5f5a55
  - Muted text: #a7a39e
  - Background: #faf8f6
  - Elevated: #f3f1ef
  - Accent: #a07855 (brown)
  - Border: #e1ddd8
- **Spacing**: Matches existing patterns
- **Rounded corners**: 20px (cards), 32px-40px (buttons/containers)

---

## Testing

To test different states:

1. **Empty State**: In `useSquad.ts`, uncomment:
   ```typescript
   setSquad(null);
   setMembers([]);
   setStats(null);
   ```

2. **Premium Squad**: In mock data, set:
   ```typescript
   isPremium: true,
   coachId: 'coach_123'
   ```
   And add coach member with `roleInSquad: 'coach'`

3. **Different Mood States**: Modify `moodState` values in mock members

---

## Navigation

Squad page is accessible via:
- Bottom nav (mobile)
- Sidebar (desktop)
- Path: `/squad`

---

## Next Steps

1. Create API routes for CRUD operations
2. Implement real alignment score calculation
3. Implement real streak calculation
4. Implement contribution grid data fetching
5. Add invite friend flow
6. Add upgrade to premium flow
7. Add coach assignment UI (super admin)
8. Add squad creation UI (coach/super admin)
9. Test with real Firebase data

---

## Files Changed/Created

### New Files
- `src/components/squad/SquadEmptyState.tsx`
- `src/components/squad/SquadHeader.tsx`
- `src/components/squad/SquadMemberRow.tsx`
- `src/components/squad/SquadMemberList.tsx`
- `src/components/squad/SquadInviteCards.tsx`
- `src/components/squad/ContributionGrid.tsx`
- `src/components/squad/SquadStats.tsx`
- `src/components/squad/SquadStreakSheet.tsx`
- `src/app/squad/page.tsx`
- `src/hooks/useSquad.ts`
- `SQUAD_IMPLEMENTATION.md` (this file)

### Modified Files
- `src/types/index.ts` - Added Squad, SquadMember, SquadStats types
- `FIRESTORE_SCHEMAS.md` - Added Squad collections documentation

---

## Figma References

All components match the Figma designs:
- Empty State: node-id=751-9578
- Premium Squad: node-id=1802-13198
- Regular Squad: node-id=1799-11333
- Stats Tab: node-id=1802-13371
- Squad Streak Modal: node-id=1803-6445















