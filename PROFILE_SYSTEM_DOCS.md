# Profile System Implementation

This document describes the complete Profile system implementation for the Growth Addicts app.

## Overview

The Profile system consists of three main views:
1. **My Profile** - User viewing their own profile
2. **Edit Profile** - User editing their profile information
3. **Other Profile** - User viewing another member's profile

## Architecture

### Data Model

Extended `FirebaseUser` type in `/src/types/index.ts` with the following profile fields:

```typescript
interface FirebaseUser {
  // ... existing fields ...
  
  // Profile fields
  name?: string;              // Display name (can differ from firstName + lastName)
  avatarUrl?: string;         // Profile picture URL (overrides Clerk imageUrl if set)
  location?: string;          // e.g., "Berlin, DE"
  profession?: string;        // Job title, e.g., "Software Engineer"
  company?: string;           // Company name, e.g., "Acme Corporation"
  interests?: string;         // Comma-separated or free text
  instagramHandle?: string;
  linkedinHandle?: string;
  twitterHandle?: string;     // X/Twitter
  websiteUrl?: string;
  phoneNumber?: string;
}
```

### API Endpoints

#### GET `/api/user/me`
Fetches the current user's profile data, including:
- User profile fields
- Active goal with progress calculation
- Returns `{ exists: boolean, user: FirebaseUser, goal: GoalData }`

#### PATCH `/api/user/me`
Updates the current user's profile information
- Accepts profile fields: name, avatarUrl, location, profession, company, bio, interests, social handles, etc.
- Returns updated user data: `{ success: boolean, user: FirebaseUser }`

#### GET `/api/user/[userId]`
Fetches another user's public profile data
- Used for viewing other users' profiles
- Returns public profile fields only
- Includes `isOwnProfile` flag to detect if viewing own profile
- Returns `{ exists: boolean, user: Partial<FirebaseUser>, goal: GoalData, isOwnProfile: boolean }`

### Components

#### ProfileHeader (`/src/components/profile/ProfileHeader.tsx`)
Displays the profile header with:
- Back button
- User name (large heading)
- Avatar (circular, 160x160px)
- Profession and company (with briefcase icon)
- Location (with map pin icon)
- Settings icon (for own profile) or Message icon (for other profiles)

**Props:**
```typescript
{
  user: FirebaseUser;
  isOwnProfile?: boolean;
  onEditClick?: () => void;
  onMessageClick?: () => void;
}
```

#### ProfileTabs (`/src/components/profile/ProfileTabs.tsx`)
Tab switcher component with two tabs:
- **My journey** - Mission, goals, and habits
- **My details** - Bio, interests, and contact info

**Props:**
```typescript
{
  defaultTab?: 'journey' | 'details';
  journeyContent: React.ReactNode;
  detailsContent: React.ReactNode;
}
```

#### MyJourneyTab (`/src/components/profile/MyJourneyTab.tsx`)
Displays the user's journey information:

1. **My mission**
   - Shows user's identity/mission statement
   - Edit link (only on own profile)
   - Empty state with CTA to define mission

2. **My goals**
   - Displays current goal with circular progress indicator
   - Shows percentage complete and days left
   - Empty state with CTA to define goal

3. **My habits**
   - Shows up to 2 habits as clickable cards
   - "Show more" link if more than 2 habits exist
   - Links to habit detail pages
   - Empty state with CTA to create first habit

**Props:**
```typescript
{
  user: FirebaseUser;
  goal?: GoalData | null;
  habits?: Habit[];
  isOwnProfile?: boolean;
}
```

#### MyDetailsTab (`/src/components/profile/MyDetailsTab.tsx`)
Displays detailed user information:

1. **About me** - Bio text
2. **My interests** - Interests text
3. **My contacts and social**
   - Phone number (with phone icon)
   - Email (with @ icon)
   - Instagram handle
   - LinkedIn handle
   - Twitter/X handle
   - Website URL

Each field only renders if it exists. Shows empty state if no contact info available.

**Props:**
```typescript
{
  user: FirebaseUser;
}
```

#### ProfileEditForm (`/src/components/profile/ProfileEditForm.tsx`)
Comprehensive profile editing form with:

**Basic Info Section:**
- Avatar with edit icon (placeholder for future upload functionality)
- Name input
- Location input
- Profession input
- Company input

**About Me Section:**
- Bio textarea (multi-line)
- Interests input

**Contacts Section:**
- Instagram handle
- LinkedIn handle
- X/Twitter handle
- Blog/website URL
- Email (read-only, pre-populated from Clerk)
- Phone number

**Actions:**
- Primary "Save" button
- Secondary "Preview my profile" button (optional, for canceling)

**Props:**
```typescript
{
  initialData?: Partial<FirebaseUser>;
  onSave?: () => void;
  onCancel?: () => void;
}
```

### Main Page

#### `/src/app/profile/page.tsx`

The profile page supports three modes via query parameters:

1. **Default mode** (`/profile`) - Shows own profile
2. **Edit mode** (`/profile?edit=true`) - Shows edit form
3. **View other user** (`/profile?userId=xxx`) - Shows another user's profile

**Features:**
- Fetches user data and habits on mount
- Detects own vs other profile
- Seamlessly switches between view and edit modes
- Handles loading states
- Integrates all profile components

**Navigation:**
- "Edit" (settings icon) → Navigates to `/profile?edit=true`
- "Back" from edit → Returns to `/profile`
- "Message" on other profile → Navigates to `/chat` (TODO: implement direct chat)

## Integration with Existing Systems

### Mission/Identity
- Profile reads the existing `identity` field from the user document
- Edit link navigates to `/onboarding` to edit mission
- Uses the same mission validation and storage as onboarding flow

### Goals
- Profile reads the existing `goal`, `goalTargetDate`, and `goalSetAt` fields
- Calculates progress percentage based on time elapsed vs total time to goal
- Calculates days left until target date
- Edit link navigates to `/onboarding/goal`
- Uses the same goal structure as the goal-setting flow

### Habits
- Profile fetches habits using the existing `/api/habits` endpoint
- Displays active habits only
- Links to individual habit pages at `/habits/[id]`
- Shows "Create First Habit" CTA if no habits exist
- Uses the existing Habits system (no duplication)

### Chat (Future)
- Other profiles show a "Message" icon in the header
- Currently navigates to `/chat` page
- TODO: Implement direct channel creation/navigation using Stream Chat APIs

## Design Specifications

Follows the Figma designs precisely:

**Typography:**
- Headers: Albert Sans
  - Large heading: 36px, -2px tracking, 1.2 line height
  - Medium heading: 24px, -1.5px tracking, 1.3 line height
  - Small heading: 18px, -1px tracking, 1.3 line height
- Body: Geist
  - Regular: 16px, -0.3px tracking, 1.2 line height
  - Small: 14px, 1.2 line height
  - Label: 12px, 1.2 line height

**Colors:**
- Background: `#faf8f6`
- Text Primary: `#1a1a1a`
- Text Secondary: `#5f5a55`
- Text Muted: `#a7a39e`
- Accent Secondary: `#a07855`
- Background Elevated: `#f3f1ef`
- Border: `#e1ddd8` / `rgba(225, 221, 216, 0.5)`
- Button Primary BG: `#2c2520`
- Button Primary Text: `#ffffff`

**Layout:**
- Max width: 2xl (768px on larger screens)
- Mobile-first responsive design
- Rounded corners: 20px for cards, 32px-50px for buttons/inputs
- Consistent spacing: 12px gaps between sections

**Components:**
- Cards: White background, border, 20px border-radius, padding 16px
- Inputs: 54px height, 50px border-radius, white background
- Buttons: 32px border-radius, padding 16px, shadow on primary
- Avatar: 160x160px, circular, placeholder with user icon if no image
- Icons: 16-20px size, text-secondary color

## Testing

To test the profile system:

1. **View Own Profile:**
   - Navigate to `/profile`
   - Verify all sections display correctly
   - Check that mission, goal, and habits show up from existing data

2. **Edit Profile:**
   - Click settings icon or navigate to `/profile?edit=true`
   - Fill in all profile fields
   - Click "Save" and verify data persists
   - Check that you're redirected back to `/profile`

3. **View Other Profile:**
   - Navigate to `/profile?userId=<some-user-id>`
   - Verify no "Edit" links are shown
   - Verify "Message" icon appears instead of settings
   - Check that appropriate data is displayed

4. **Empty States:**
   - Test with a new user who has no mission/goal/habits
   - Verify all empty states display with CTAs
   - Verify CTAs navigate to correct pages

## Future Enhancements

1. **Avatar Upload:** Implement profile picture upload functionality (currently uses Clerk's imageUrl)
2. **Direct Messaging:** Implement Stream Chat channel creation when clicking "Message" on other profiles
3. **Privacy Settings:** Add privacy controls for which fields are visible to others
4. **Activity Feed:** Add recent activities/achievements section
5. **Profile Completion:** Show profile completion percentage and suggestions
6. **Social Sharing:** Add ability to share profile externally
7. **Public Habits:** Allow users to make specific habits visible to squad members

## Files Created/Modified

### New Files:
- `/src/components/profile/ProfileHeader.tsx`
- `/src/components/profile/ProfileTabs.tsx`
- `/src/components/profile/MyJourneyTab.tsx`
- `/src/components/profile/MyDetailsTab.tsx`
- `/src/components/profile/ProfileEditForm.tsx`
- `/src/app/api/user/[userId]/route.ts`

### Modified Files:
- `/src/types/index.ts` - Extended `FirebaseUser` interface
- `/src/app/api/user/me/route.ts` - Added PATCH endpoint
- `/src/app/profile/page.tsx` - Complete rewrite to support all profile modes

## Notes

- The email field is read-only (sourced from Clerk) and cannot be edited through the profile
- Profile fields are optional - users can skip any fields they don't want to fill
- The system gracefully handles missing data with empty states
- All profile data is stored in the Firebase `users` collection
- The implementation reuses existing mission, goal, and habit data (no duplication)















