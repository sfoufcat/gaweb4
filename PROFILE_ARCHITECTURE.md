# Profile System - Component Architecture

## Visual Component Tree

```
ProfilePage (/src/app/profile/page.tsx)
│
├─ Mode Detection (via query params)
│   ├─ Default: /profile → My Profile View
│   ├─ Edit: /profile?edit=true → Edit Profile View
│   └─ Other: /profile?userId=xxx → Other Profile View
│
├─ Edit Mode (if ?edit=true)
│   └─ ProfileEditForm
│       ├─ Avatar Section
│       │   └─ Avatar + Edit Icon
│       ├─ Basic Info Section
│       │   ├─ Name Input
│       │   ├─ Location Input
│       │   ├─ Profession Input
│       │   └─ Company Input
│       ├─ About Me Section
│       │   ├─ Bio Textarea
│       │   └─ Interests Input
│       ├─ Contacts Section
│       │   ├─ Instagram Input
│       │   ├─ LinkedIn Input
│       │   ├─ Twitter/X Input
│       │   ├─ Website Input
│       │   ├─ Email (Read-only)
│       │   └─ Phone Input
│       └─ Actions
│           ├─ Save Button
│           └─ Preview Button
│
└─ View Mode (default or ?userId=xxx)
    ├─ ProfileHeader
    │   ├─ Back Button
    │   ├─ Name (36px heading)
    │   ├─ Avatar (160x160 circular)
    │   ├─ Profession & Company (with icon)
    │   ├─ Location (with icon)
    │   └─ Actions
    │       ├─ Settings Icon (own profile)
    │       └─ Message Icon (other profile)
    │
    └─ ProfileTabs
        ├─ Tab Switcher
        │   ├─ My Journey Tab
        │   └─ My Details Tab
        │
        ├─ My Journey Content (when active)
        │   └─ MyJourneyTab
        │       ├─ My Mission Section
        │       │   ├─ Section Header + Edit Link
        │       │   ├─ Mission Text
        │       │   └─ Empty State + CTA
        │       │
        │       ├─ My Goals Section
        │       │   ├─ Section Header
        │       │   ├─ Goal Card
        │       │   │   ├─ Circular Progress (SVG)
        │       │   │   ├─ Goal Text
        │       │   │   └─ Days Left
        │       │   └─ Empty State + CTA
        │       │
        │       └─ My Habits Section
        │           ├─ Section Header
        │           ├─ Habit Cards (up to 2)
        │           │   └─ Clickable → /habits/[id]
        │           ├─ Show More Link
        │           └─ Empty State + CTA
        │
        └─ My Details Content (when active)
            └─ MyDetailsTab
                ├─ About Me Section
                │   ├─ Section Header
                │   └─ Bio Text
                │
                ├─ My Interests Section
                │   ├─ Section Header
                │   └─ Interests Text
                │
                └─ Contacts & Social Section
                    ├─ Section Header
                    ├─ Phone (with icon)
                    ├─ Email (with icon)
                    ├─ Instagram (with icon)
                    ├─ LinkedIn (with icon)
                    ├─ Twitter/X (with icon)
                    ├─ Website (with icon)
                    └─ Empty State
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  ProfilePage Component                       │
│  • Detects mode from query params                           │
│  • Manages state (userData, habits, loading)                │
│  • Fetches data on mount                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        ┌──────────────────┐  ┌──────────────────┐
        │   View Mode      │  │   Edit Mode      │
        └──────────────────┘  └──────────────────┘
                │                       │
                ▼                       ▼
    ┌──────────────────────┐  ┌──────────────────────┐
    │  GET /api/user/me    │  │  ProfileEditForm     │
    │  or                  │  │  • Shows form        │
    │  GET /api/user/[id]  │  │  • On save:          │
    └──────────────────────┘  │    PATCH /api/user/me│
                │              └──────────────────────┘
                ▼                       │
    ┌──────────────────────┐           ▼
    │  Returns:            │  ┌──────────────────────┐
    │  • user data         │  │  Firebase Update     │
    │  • goal data         │  │  • Merges fields     │
    │  • isOwnProfile flag │  │  • Sets updatedAt    │
    └──────────────────────┘  └──────────────────────┘
                │                       │
                ▼                       ▼
    ┌──────────────────────┐  ┌──────────────────────┐
    │  Render Profile      │  │  Reload & Redirect   │
    │  • ProfileHeader     │  │  to /profile         │
    │  • ProfileTabs       │  └──────────────────────┘
    │    - MyJourneyTab    │
    │    - MyDetailsTab    │
    └──────────────────────┘
```

---

## State Management

```typescript
// ProfilePage State
{
  // From useUser() (Clerk)
  clerkUser: User | null,
  clerkLoaded: boolean,
  
  // Local State
  userData: {
    user: FirebaseUser,
    goal: GoalData | null,
    isOwnProfile: boolean
  } | null,
  
  habits: Habit[],
  loading: boolean,
  isEditMode: boolean,
  viewingUserId: string | null
}
```

---

## API Integration Points

### Profile APIs
```
GET  /api/user/me            → Fetch own profile
PATCH /api/user/me           → Update own profile
GET  /api/user/[userId]      → Fetch other user's profile
```

### Integration APIs (Read-only)
```
GET  /api/habits             → Fetch user's habits
POST /api/habits             → Create new habit (from empty state CTA)
```

### Navigation Links
```
/onboarding                  → Edit mission
/onboarding/goal             → Edit goal
/habits/[id]                 → View/edit specific habit
/habits/new                  → Create new habit
/chat                        → Open chat (message button)
```

---

## Conditional Rendering Logic

```typescript
// Mode Detection
const isEditMode = searchParams.get('edit') === 'true'
const viewingUserId = searchParams.get('userId')
const isOwnProfile = userData?.isOwnProfile !== false

// Component Rendering
if (isEditMode) {
  return <ProfileEditForm />
}

return (
  <>
    <ProfileHeader 
      isOwnProfile={isOwnProfile}
      onEditClick={...}      // Only if own profile
      onMessageClick={...}   // Only if other profile
    />
    <ProfileTabs
      journeyContent={
        <MyJourneyTab 
          isOwnProfile={isOwnProfile}  // Affects edit links
        />
      }
      detailsContent={<MyDetailsTab />}
    />
  </>
)
```

---

## Props Flow

```
ProfilePage
  │
  ├─ userData: { user, goal, isOwnProfile }
  ├─ habits: Habit[]
  │
  ├─► ProfileHeader
  │     ├─ user: FirebaseUser
  │     ├─ isOwnProfile: boolean
  │     ├─ onEditClick: () => void
  │     └─ onMessageClick: () => void
  │
  └─► ProfileTabs
        ├─ journeyContent
        │   └─► MyJourneyTab
        │         ├─ user: FirebaseUser
        │         ├─ goal: GoalData | null
        │         ├─ habits: Habit[]
        │         └─ isOwnProfile: boolean
        │
        └─ detailsContent
            └─► MyDetailsTab
                  └─ user: FirebaseUser
```

---

## Empty States

```
Mission Empty State
├─ Icon: Star
├─ Text: "No mission set yet"
├─ CTA: "Define Your Mission" → /onboarding
└─ Visibility: Only on own profile

Goal Empty State
├─ Icon: Check circle
├─ Text: "No goal set yet"
├─ CTA: "Define Your Goal" → /onboarding/goal
└─ Visibility: Only on own profile

Habits Empty State
├─ Icon: (none)
├─ Text: "No habits yet"
├─ CTA: "Create First Habit" → /habits/new
└─ Visibility: Only on own profile

Contacts Empty State
├─ Icon: (none)
├─ Text: "No contact information available"
├─ CTA: (none)
└─ Visibility: Always
```

---

## Styling Classes Reference

### Typography
```css
/* Headings */
.heading-large    → font-albert text-[36px] tracking-[-2px] leading-[1.2]
.heading-medium   → font-albert text-2xl tracking-[-1.5px] leading-[1.3]
.heading-small    → font-albert text-lg font-semibold tracking-[-1px] leading-[1.3]

/* Body */
.body-regular     → font-sans text-base tracking-[-0.3px] leading-[1.2]
.body-small       → font-sans text-sm leading-[1.2]
.label            → font-sans text-xs leading-[1.2]
```

### Colors
```css
text-text-primary     → #1a1a1a
text-text-secondary   → #5f5a55
text-text-muted       → #a7a39e
text-accent-secondary → #a07855
bg-[#faf8f6]          → background-primary
bg-[#f3f1ef]          → background-elevated
bg-white              → background-secondary
border-[#e1ddd8]      → border color
```

### Components
```css
/* Cards */
.card → bg-white rounded-[20px] border border-[#e1ddd8] p-4

/* Buttons */
.btn-primary → bg-button-primary text-white rounded-[32px] p-4 shadow-[...]
.btn-secondary → bg-white border border-[...] text-button-primary rounded-[32px] p-4

/* Inputs */
.input → bg-white border border-[rgba(225,221,216,0.5)] rounded-[50px] h-[54px] px-4 py-3
```

---

This architecture ensures:
- ✅ Clean separation of concerns
- ✅ Reusable components
- ✅ Type-safe props
- ✅ Consistent styling
- ✅ Proper state management
- ✅ Clear data flow















