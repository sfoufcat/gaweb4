# Admin Panel Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     GROWTH ADDICTS APP                          │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────────────────────┐   │
│  │   SIDEBAR NAV    │  │     MAIN CONTENT AREA            │   │
│  │                  │  │                                   │   │
│  │  • Home          │  │                                   │   │
│  │  • Squad         │  │                                   │   │
│  │  • Discover      │  │     [Current Page Content]       │   │
│  │  • Chat          │  │                                   │   │
│  │  • Admin  ◄──────┼──┼─── ONLY VISIBLE TO ADMIN/       │   │
│  │    (Desktop)     │  │     SUPER_ADMIN                  │   │
│  │                  │  │                                   │   │
│  │  • My Account    │  │                                   │   │
│  └──────────────────┘  └──────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

When Admin clicked → Navigate to /admin:

┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN PANEL (/admin)                       │
│                                                                 │
│  Authorization Check:                                          │
│  ✓ User authenticated (Clerk)                                 │
│  ✓ User role is admin or super_admin                          │
│  ✗ Otherwise → Redirect to home                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Admin Panel Header                                      │  │
│  │  "Manage users and squads across Growth Addicts"        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Tabs:  [Users]  [Squads]                             │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  USERS TAB (default)                                    │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  [Refresh]                      Total: 25 users  │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │ Name    │ Email      │ Role ▼     │ Squad │ ... │  │   │
│  │  ├──────────────────────────────────────────────────┤  │   │
│  │  │ John D. │ john@...   │ [User ▼]   │ —     │ Del │  │   │
│  │  │ Sarah M.│ sarah@...  │ [Coach ▼]  │ sq_1  │ Del │  │   │
│  │  │ Mike A. │ mike@...   │ [Admin ▼]  │ —     │ Del │  │   │
│  │  │ Boss    │ boss@...   │ Super Admin│ —     │ —   │  │   │
│  │  │         │            │ (locked)   │       │     │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SQUADS TAB (when clicked)                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Refresh]  [Create Squad]          Total: 12 squads    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Avatar │ Name      │ Type    │ Coach   │ Members │ ... │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │   🏆   │ Squad A   │ Premium │ coach_1 │   12    │ E D │  │
│  │   👥   │ Squad B   │ Free    │   —     │    8    │ E D │  │
│  │   💪   │ Squad C   │ Premium │ coach_2 │   15    │ E D │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  E = Edit, D = Delete                                          │
└─────────────────────────────────────────────────────────────────┘

ROLE HIERARCHY & PERMISSIONS:
════════════════════════════════════════════════════════════════

┌──────────────────────┐
│    SUPER ADMIN       │  ← Full System Access
│    (super_admin)     │     • Can do EVERYTHING
│                      │     • Manage all users (including admins)
│                      │     • Promote to super_admin
│                      │     • Delete anyone
└──────────────────────┘
         ▲
         │
         │ can manage
         │
┌──────────────────────┐
│       ADMIN          │  ← Most Management Access
│       (admin)        │     • Can manage users & squads
│                      │     • CANNOT modify super_admins
│                      │     • CANNOT promote to super_admin
└──────────────────────┘
         ▲
         │
         │ can manage
         │
┌──────────────────────┐
│       COACH          │  ← Can Coach Premium Squads
│       (coach)        │     • Assigned to premium squads
│                      │     • No admin access
└──────────────────────┘
         ▲
         │
┌──────────────────────┐
│       USER           │  ← Regular User
│       (user)         │     • Standard app access
│                      │     • No admin access
└──────────────────────┘


API FLOW:
═════════

Frontend Action → API Call → Backend Validation → Database Update

Example: Change User Role
──────────────────────────

┌──────────────┐
│  Admin UI    │  Admin selects "Coach" for user_123
└──────┬───────┘
       │
       │ PATCH /api/admin/users/user_123/role
       │ Body: { role: "coach" }
       │
       ▼
┌──────────────────────┐
│  API Route Handler   │  1. Check Clerk auth (userId exists)
│  [userId]/role       │  2. Fetch current user from Firestore
│                      │  3. Verify current user is admin/super_admin
│                      │  4. Fetch target user
│                      │  5. Check canModifyUserRole()
│                      │      - Current: admin
│                      │      - Target: user
│                      │      - New: coach
│                      │      → ✅ ALLOWED
│                      │  6. Update Firestore
└──────┬───────────────┘
       │
       │ Success/Error
       │
       ▼
┌──────────────┐
│  Admin UI    │  Show success, refresh user list
└──────────────┘


SECURITY LAYERS:
════════════════

Layer 1: NAVIGATION
─────────────────────
✓ Admin menu item hidden if not admin
✓ Only visible on desktop

Layer 2: ROUTE PROTECTION
──────────────────────────
✓ Client-side redirect if not admin
✓ useServerUser() hook checks role
✓ Runs on mount and on user change

Layer 3: UI AUTHORIZATION
──────────────────────────
✓ Role dropdown disabled if can't modify
✓ Delete button hidden if can't delete
✓ Super admin badge locked/read-only

Layer 4: API AUTHENTICATION
────────────────────────────
✓ Clerk auth.userId() check
✓ 401 Unauthorized if no userId
✓ Applied to ALL admin routes

Layer 5: API AUTHORIZATION
───────────────────────────
✓ Fetch user's role from Firestore
✓ Verify admin/super_admin role
✓ 403 Forbidden if not authorized

Layer 6: ACTION VALIDATION
───────────────────────────
✓ Check specific permissions per action
✓ Use admin-utils functions
✓ Validate business rules (e.g., premium needs coach)
✓ 403 Forbidden if not permitted


DATA FLOW: Create Squad
════════════════════════

1. User clicks "Create Squad"
   └─→ SquadFormDialog opens

2. User fills form:
   - Name: "Growth Warriors"
   - Avatar: "https://..."
   - Premium: ✓ checked
   - Coach: Select coach_42

3. User clicks "Create Squad"
   └─→ POST /api/admin/squads
       Body: {
         name: "Growth Warriors",
         avatarUrl: "https://...",
         isPremium: true,
         coachId: "coach_42"
       }

4. API validates:
   ✓ User is admin/super_admin
   ✓ Name is not empty
   ✓ Premium has coach (coach_42)
   ✓ All validation passes

5. API creates squad:
   squadRef = await adminDb.collection('squads').add({
     name: "Growth Warriors",
     avatarUrl: "https://...",
     isPremium: true,
     coachId: "coach_42",
     createdAt: "2025-11-25T...",
     updatedAt: "2025-11-25T..."
   })

6. Return success:
   { success: true, squad: { id: "sq_123", ... } }

7. Frontend:
   - Close dialog
   - Refresh squads list
   - Show new squad in table


FILE STRUCTURE:
═══════════════

src/
├── types/index.ts                     ← UserRole updated
├── lib/
│   └── admin-utils.ts                 ← Auth & permissions
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx                ← Admin nav item added
│   ├── admin/                         ← NEW
│   │   ├── AdminUsersTab.tsx          ← Users UI
│   │   ├── AdminSquadsTab.tsx         ← Squads UI
│   │   └── SquadFormDialog.tsx        ← Create/Edit modal
│   └── ui/                            ← NEW UI components
│       ├── tabs.tsx
│       ├── table.tsx
│       ├── select.tsx
│       └── alert-dialog.tsx
└── app/
    ├── admin/
    │   └── page.tsx                   ← Main admin page
    └── api/admin/                     ← NEW
        ├── users/
        │   ├── route.ts               ← GET users
        │   └── [userId]/
        │       ├── route.ts           ← DELETE user
        │       └── role/
        │           └── route.ts       ← PATCH role
        ├── squads/
        │   ├── route.ts               ← GET/POST squads
        │   └── [squadId]/
        │       └── route.ts           ← PATCH/DELETE squad
        └── coaches/
            └── route.ts               ← GET coaches
```

## Key Concepts

### 1. Role-Based Access Control (RBAC)
- Hierarchical permission model
- Each role has specific capabilities
- Higher roles can manage lower roles
- Protection against self-promotion

### 2. Defense in Depth
- Multiple layers of security checks
- Client-side AND server-side validation
- UI restrictions + API enforcement
- Never trust client data

### 3. Separation of Concerns
- UI components handle presentation
- Utility functions handle authorization logic
- API routes handle data operations
- Clear boundaries between layers

### 4. User Experience
- Immediate feedback on actions
- Confirmation dialogs for dangerous operations
- Loading states during async operations
- Error messages when operations fail

### 5. Extensibility
- Clear TODO markers for future features
- Modular component structure
- Reusable authorization functions
- Well-documented codebase

