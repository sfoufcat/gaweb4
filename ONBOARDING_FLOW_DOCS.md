# Onboarding Flow Documentation

## Overview

This document describes the complete onboarding flow for new users signing up for Growth Addicts.

## Flow Sequence

The onboarding process follows this exact sequence:

```
Sign Up (Clerk) 
  ↓
/onboarding/welcome (Welcome to GrowthAddicts)
  ↓
/onboarding/create-profile-intro (Create your public profile)
  ↓
/profile?edit=true&fromOnboarding=true (Edit Profile - Onboarding Mode)
  ↓
/onboarding (Mission - "What is your mission?")
  ↓
/onboarding/goal (Goal Setting)
  ↓
/onboarding/commitment (Success/Commitment)
  ↓
/ (Home Dashboard)
```

## Onboarding Status Field

User documents in Firebase now include an `onboardingStatus` field that tracks progress:

```typescript
type OnboardingStatus = 
  | 'welcome' 
  | 'create_profile_intro' 
  | 'edit_profile' 
  | 'mission' 
  | 'goal' 
  | 'completed';
```

Additionally, a `hasCompletedOnboarding` boolean field is used for quick checks.

## New Screens

### 1. Welcome Screen (`/onboarding/welcome`)

**File:** `src/app/onboarding/welcome/page.tsx`

**Design:** Based on Figma design at node-id=694-3035

**Features:**
- Displays welcome message with gradient heading
- Shows a checklist of what's coming:
  - Enable notifications
  - Create your profile
  - Set your goal
- Primary CTA: "Let's Crush It!" button
- Updates `onboardingStatus` to `'create_profile_intro'` on continue

**Behavior:**
- Redirects to `/onboarding/create-profile-intro` on CTA click

---

### 2. Create Profile Intro Screen (`/onboarding/create-profile-intro`)

**File:** `src/app/onboarding/create-profile-intro/page.tsx`

**Design:** Based on Figma design at node-id=409-3877

**Features:**
- Explains the importance of creating a public profile
- Two action buttons:
  - **Primary:** "Next" - Proceeds to edit profile
  - **Secondary:** "I'll do it later in settings" - Skips to mission

**Behavior:**
- **Next:** 
  - Updates `onboardingStatus` to `'edit_profile'`
  - Redirects to `/profile?edit=true&fromOnboarding=true`
- **Skip:** 
  - Updates `onboardingStatus` to `'mission'`
  - Redirects to `/onboarding`

---

### 3. Edit Profile (Onboarding Mode)

**File:** `src/app/profile/page.tsx` (with onboarding parameter)

**Component:** `src/components/profile/ProfileEditForm.tsx`

**Special Behavior When `fromOnboarding=true`:**
- Accepts `fromOnboarding` prop
- On Save:
  - Updates `onboardingStatus` to `'mission'`
  - Redirects to `/onboarding` (Mission page) instead of profile view
- On Cancel:
  - Returns to `/onboarding/create-profile-intro` instead of profile view

---

### 4. Mission Page (`/onboarding`)

**File:** `src/app/onboarding/page.tsx`

**Existing screen** - no changes needed for this task.

After completion, redirects to `/onboarding/goal`.

---

### 5. Goal Page (`/onboarding/goal`)

**File:** `src/app/onboarding/goal/page.tsx`

**Existing screen** - no changes needed for this task.

After completion, redirects to `/onboarding/commitment`.

---

### 6. Commitment Page (`/onboarding/commitment`)

**File:** `src/app/onboarding/commitment/page.tsx`

**Updated Behavior:**
- On "Let's go!" button click:
  - Updates `onboardingStatus` to `'completed'`
  - Sets `hasCompletedOnboarding` to `true`
  - Redirects to `/` (home dashboard)

---

## Routing Logic

### New User Detection

**File:** `src/app/page.tsx` (Home Dashboard)

On page load, the home dashboard checks the user's onboarding status:

```typescript
if (!hasCompletedOnboarding) {
  if (!onboardingStatus || onboardingStatus === 'welcome') {
    router.push('/onboarding/welcome');
  } else if (onboardingStatus === 'create_profile_intro') {
    router.push('/onboarding/create-profile-intro');
  } else if (onboardingStatus === 'edit_profile') {
    router.push('/profile?edit=true&fromOnboarding=true');
  } else if (onboardingStatus === 'mission') {
    router.push('/onboarding');
  } else if (onboardingStatus === 'goal') {
    router.push('/onboarding/goal');
  }
}
```

This ensures that:
- New users are immediately redirected to the appropriate onboarding step
- Users who exit mid-onboarding can resume where they left off
- Completed users skip onboarding and go straight to the dashboard

### User Creation

**File:** `src/lib/clerk-firebase-sync.ts`

When a new user signs up through Clerk, their Firebase document is created with:

```typescript
{
  ...userData,
  onboardingStatus: 'welcome',
  hasCompletedOnboarding: false,
}
```

This triggers the onboarding flow on their first login.

---

## API Updates

### User API (`/api/user/me`)

**File:** `src/app/api/user/me/route.ts`

**Updated PATCH endpoint:**
- Now accepts `onboardingStatus` and `hasCompletedOnboarding` fields
- These fields are stored in Firebase and can be updated throughout the onboarding flow

---

## Type Updates

**File:** `src/types/index.ts`

Added:
- `OnboardingStatus` type enum
- `onboardingStatus?: OnboardingStatus` field to `FirebaseUser`
- `hasCompletedOnboarding?: boolean` field to `FirebaseUser`

---

## Testing the Flow

To test the complete onboarding flow:

1. **Sign up as a new user** through Clerk
2. You should be redirected to `/onboarding/welcome`
3. Click "Let's Crush It!" → redirects to `/onboarding/create-profile-intro`
4. Click "Next" → redirects to profile edit in onboarding mode
5. Fill out profile and click "Save" → redirects to `/onboarding` (mission)
6. Complete mission → redirects to `/onboarding/goal`
7. Set goal → redirects to `/onboarding/commitment`
8. Click "Let's go!" → redirects to `/` (home dashboard)
9. **On future logins**, the user should skip onboarding and go directly to home

### Testing Skip Profile Flow

1. At step 3, click "I'll do it later in settings" instead
2. Should skip directly to `/onboarding` (mission)
3. Profile can be filled out later from settings

---

## Files Changed/Created

### Created:
- `/src/app/onboarding/welcome/page.tsx`
- `/src/app/onboarding/create-profile-intro/page.tsx`
- `/ONBOARDING_FLOW_DOCS.md` (this file)

### Modified:
- `/src/types/index.ts` - Added `OnboardingStatus` type and fields
- `/src/components/profile/ProfileEditForm.tsx` - Added `fromOnboarding` prop
- `/src/app/profile/page.tsx` - Handle onboarding mode and navigation
- `/src/app/api/user/me/route.ts` - Allow onboarding status updates
- `/src/app/page.tsx` - Added onboarding redirect logic
- `/src/app/onboarding/commitment/page.tsx` - Mark onboarding complete
- `/src/lib/clerk-firebase-sync.ts` - Set initial onboarding status

---

## Design Notes

Both new screens follow the Figma designs closely:

- **Typography:** Uses `font-albert` for headings (36px) and `font-sans` for body text (18px)
- **Spacing:** Matches Figma specifications with appropriate padding and gaps
- **Colors:** Uses existing color tokens from `globals.css`
- **Buttons:** Primary buttons use the yellow accent (`#f7c948`), secondary buttons use dark (`#2c2520`)
- **Layout:** Full-screen layouts with content centered and CTAs at the bottom

---

## Future Enhancements

Potential improvements for the onboarding flow:

1. **Progress Indicator:** Show user where they are in the flow (e.g., "Step 2 of 5")
2. **Back Button:** Allow users to go back to previous onboarding steps
3. **Save & Exit:** Allow users to pause onboarding and resume later
4. **Onboarding Analytics:** Track completion rates and drop-off points
5. **Notifications Prompt:** Implement the actual notification permission request
6. **Profile Photo Upload:** Add ability to upload custom avatar during onboarding
7. **Personalized Welcome:** Use user's name in the welcome screen

---

## Important Notes

⚠️ **Onboarding vs Normal Profile Edit:**
- When editing profile from settings/profile page later, the flow behaves normally
- Only when `fromOnboarding=true` does it redirect to the mission page
- This allows users to edit their profile anytime after onboarding without disrupting the normal UX

⚠️ **Onboarding Status Persistence:**
- If a user exits mid-onboarding and logs back in, they'll resume where they left off
- This prevents frustration from having to restart the entire flow

⚠️ **API Security:**
- The onboarding status fields are restricted to authenticated users only
- Users can only update their own onboarding status
- Consider adding server-side validation to ensure status progression is logical

---

## Contact

For questions or issues with the onboarding flow, refer to this documentation or the individual file comments.















