# Admin Panel Documentation

## Overview

The Admin Panel is a powerful management interface for Growth Addicts that allows administrators to manage users and squads. Access is restricted to users with `admin` or `super_admin` roles.

## Access Control

### User Roles

The system now supports four user roles:

1. **`user`** - Regular user with standard access
2. **`coach`** - User who can coach premium squads
3. **`admin`** - Administrator with most management capabilities
4. **`super_admin`** - Super administrator with full system access

### Role Hierarchy & Permissions

#### Super Admin (`super_admin`)
- Full access to all admin features
- Can manage all users including other admins
- Can promote/demote users to/from any role including `super_admin`
- Can delete any user
- Can create, edit, and delete all squads
- No restrictions

#### Admin (`admin`)
- Can access the admin panel
- Can manage most users
- **Cannot:**
  - Modify `super_admin` users' roles
  - Delete `super_admin` users
  - Promote anyone to `super_admin`
  - Promote themselves to `super_admin`
- Can create, edit, and delete squads (except those containing super admins)

### Accessing the Admin Panel

1. **Route:** `/admin`
2. **Visibility:** The "Admin" navigation item only appears in the sidebar for users with `admin` or `super_admin` roles
3. **Desktop Only:** The admin panel is designed for desktop use only (no mobile view)
4. **Authorization:** The route automatically redirects unauthorized users to the home page

## Features

### Users Management Tab

The Users tab provides comprehensive user management capabilities:

#### View All Users
- Display all users in the system
- Shows: Name, Email, Role, Squad membership, Created date
- Sortable table view
- Real-time updates

#### Change User Roles
- Dropdown select for each user (if permitted)
- Available roles depend on current user's role:
  - **Super Admin** can assign: `user`, `coach`, `admin`, `super_admin`
  - **Admin** can assign: `user`, `coach`, `admin`
- Role badges with color coding:
  - User: Gray
  - Coach: Blue
  - Admin: Purple
  - Super Admin: Red

#### Delete Users
- Delete button for each user (if permitted)
- Confirmation dialog before deletion
- Cannot delete yourself
- Deletes user from Firebase
- **TODO:** Integration with Clerk to also remove from authentication system

#### Future Features
- Invite new users via email
- Bulk user operations
- User search and filtering
- Export user list

### Squads Management Tab

The Squads tab provides full squad lifecycle management:

#### View All Squads
- Display all squads in the system
- Shows: Name, Avatar, Type (Free/Premium), Coach, Member count, Created date
- Sortable table view

#### Create Squad
- Modal form with fields:
  - **Name** (required)
  - **Avatar URL** (optional)
  - **Premium Toggle**
  - **Coach Selection** (required for premium squads)
- Validates premium squad requirements
- Creates squad in Firestore

#### Edit Squad
- Click "Edit" to open squad in modal
- Modify all squad properties:
  - Name
  - Avatar
  - Premium status
  - Coach assignment
- Updates squad in Firestore

#### Delete Squad
- Click "Delete" with confirmation dialog
- Removes squad from Firestore
- Automatically removes squad reference from all member users
- **TODO:** Clean up squad members collection
- **TODO:** Handle Stream chat channel cleanup

#### Squad Properties
- **Name**: Display name of the squad
- **Avatar URL**: Profile picture URL
- **isPremium**: Boolean flag for premium status
- **coachId**: User ID of assigned coach (required for premium)
- **createdAt**: Creation timestamp
- **updatedAt**: Last update timestamp

## Technical Architecture

### Frontend Components

```
/src/app/admin/page.tsx
  └─ Main admin page with tabs

/src/components/admin/
  ├─ AdminUsersTab.tsx          # Users management UI
  ├─ AdminSquadsTab.tsx         # Squads management UI
  └─ SquadFormDialog.tsx        # Squad create/edit form
```

### Backend API Routes

```
/src/app/api/admin/
  ├─ users/
  │   ├─ route.ts                    # GET: List all users
  │   └─ [userId]/
  │       ├─ route.ts                # DELETE: Delete user
  │       └─ role/
  │           └─ route.ts            # PATCH: Update user role
  │
  ├─ squads/
  │   ├─ route.ts                    # GET: List all squads, POST: Create squad
  │   └─ [squadId]/
  │       └─ route.ts                # PATCH: Update squad, DELETE: Delete squad
  │
  └─ coaches/
      └─ route.ts                    # GET: List all coaches
```

### Utility Functions

```
/src/lib/admin-utils.ts
```

Key functions:
- `isAdmin(role)` - Check if user has admin access
- `isSuperAdmin(role)` - Check if user is super admin
- `canModifyUserRole(adminRole, targetRole, newRole)` - Check role change permissions
- `canDeleteUser(adminRole, targetRole)` - Check delete permissions
- `getAssignableRoles(adminRole)` - Get list of roles user can assign
- `formatRoleName(role)` - Format role for display
- `getRoleBadgeColor(role)` - Get color class for role badge

### Authorization Flow

1. User navigates to `/admin`
2. Client-side: `useServerUser()` hook fetches current user data
3. Client-side: `isAdmin()` check determines if admin panel should render
4. Client-side: If not admin, redirect to home page
5. API calls: Each admin API endpoint validates:
   - User is authenticated (via Clerk)
   - User has admin role (via Firebase)
   - Specific action is permitted (via admin-utils)

### Type Definitions

Updated `UserRole` type in `/src/types/index.ts`:
```typescript
export type UserRole = 'user' | 'coach' | 'admin' | 'super_admin';
```

## UI Components Used

The admin panel uses shadcn/ui components:

- **Tabs** - Tab navigation between Users and Squads
- **Table** - Data tables for users and squads
- **Select** - Role selection dropdowns
- **Button** - All action buttons
- **AlertDialog** - Confirmation dialogs for destructive actions
- **Dialog** - Modal forms for squad creation/editing

All components follow the Growth Addicts design system with:
- Brown/earth-tone color palette (`#a07855`, `#8c6245`)
- Albert Sans font
- Glass morphism effects
- Rounded corners and smooth transitions

## Navigation Integration

The Admin menu item is added to the existing sidebar navigation:

**Desktop Sidebar:**
- Position: Below the "Chat" item
- Icon: Settings gear icon
- Visibility: Only shown if `isAdmin(userData?.role)` returns true
- Prefetching: Route is prefetched on mount for instant navigation

**Mobile:**
- Admin panel is NOT shown on mobile (desktop only)
- No mobile navigation item

## Security Considerations

### Frontend Security
- UI elements are conditionally rendered based on role
- Route-level protection with redirect
- Real-time role checks on mount and user data changes

### Backend Security
- All admin routes require Clerk authentication
- Role verification on every API call
- Action-specific permission checks
- No trust in client-side data

### Role Change Validation
- Cannot change your own role
- Cannot escalate privileges beyond your own level
- Cannot demote super admins (unless you're a super admin)

### Deletion Protection
- Cannot delete yourself
- Cannot delete super admins (unless you're a super admin)
- Confirmation dialogs for all destructive actions

## TODO / Future Enhancements

### User Management
- [ ] Integrate with Clerk API for user deletion
- [ ] Implement user invitation system
- [ ] Add user search and filtering
- [ ] Bulk user operations
- [ ] User activity logs
- [ ] Email/name editing via Clerk
- [ ] User suspension (temporary deactivation)

### Squad Management
- [ ] Display actual member count in table
- [ ] Squad members management UI
  - Add users to squad
  - Remove users from squad
  - Change member roles
- [ ] Clean up squad members collection on deletion
- [ ] Handle Stream chat channel cleanup
- [ ] Squad statistics dashboard
- [ ] Squad bulk operations
- [ ] Squad search and filtering
- [ ] Squad templates

### General
- [ ] Activity audit log for all admin actions
- [ ] Admin dashboard with metrics
- [ ] Export functionality (CSV, JSON)
- [ ] Role-based notifications
- [ ] Admin user permissions granularity
- [ ] Two-factor authentication for admins
- [ ] Rate limiting on sensitive operations

## Testing Checklist

### User Management Testing
- [ ] View users as admin
- [ ] View users as super_admin
- [ ] Change user role (admin → can change user/coach/admin)
- [ ] Change user role (super_admin → can change any role)
- [ ] Attempt to change super_admin role as admin (should fail)
- [ ] Attempt to promote to super_admin as admin (should fail)
- [ ] Delete user as admin (not super_admin)
- [ ] Delete user as super_admin
- [ ] Attempt to delete super_admin as admin (should fail)
- [ ] Attempt to delete yourself (should fail)

### Squad Management Testing
- [ ] View squads list
- [ ] Create free squad
- [ ] Create premium squad (with coach)
- [ ] Attempt to create premium squad without coach (should fail)
- [ ] Edit squad name
- [ ] Edit squad avatar
- [ ] Toggle premium status
- [ ] Change coach assignment
- [ ] Delete squad
- [ ] Verify users removed from deleted squad

### Access Control Testing
- [ ] Access admin panel as regular user (should redirect)
- [ ] Access admin panel as coach (should redirect)
- [ ] Access admin panel as admin (should work)
- [ ] Access admin panel as super_admin (should work)
- [ ] Verify admin nav item hidden for non-admins
- [ ] Verify admin nav item shown for admins

### API Security Testing
- [ ] Call admin API without authentication (should 401)
- [ ] Call admin API as regular user (should 403)
- [ ] Call admin API with expired token (should 401)
- [ ] Attempt unauthorized role change (should 403)
- [ ] Attempt unauthorized deletion (should 403)

## Migration Guide

If you need to promote an existing user to admin:

1. **Manually in Firebase Console:**
   - Navigate to Firestore
   - Find the user document in `users` collection
   - Edit the `role` field to `"admin"` or `"super_admin"`

2. **Via Firebase Admin SDK:**
   ```typescript
   await adminDb.collection('users').doc(userId).update({
     role: 'admin', // or 'super_admin'
     updatedAt: new Date().toISOString()
   });
   ```

3. **First Super Admin:**
   Since you need to be an admin to promote others, the first super_admin must be created manually via Firebase Console.

## Support

For questions or issues:
- Check this documentation first
- Review the code comments in admin-utils.ts
- Check TODOs in the code for known limitations
- Test in development environment before production

