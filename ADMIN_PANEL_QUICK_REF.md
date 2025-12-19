# Admin Panel - Quick Reference

## 🚀 Quick Start

### Access the Admin Panel
1. Navigate to `/admin` (or click "Admin" in the sidebar)
2. Only visible to users with `admin` or `super_admin` role

### First-Time Setup
1. Create your first super_admin manually in Firebase Console:
   - Go to Firestore → `users` collection
   - Find your user document
   - Set `role: "super_admin"`
2. Refresh the page - Admin menu item will appear
3. Navigate to Admin Panel

## 📋 Common Tasks

### Promote a User to Admin
1. Go to Admin Panel → Users tab
2. Find the user in the table
3. Click the role dropdown
4. Select "Admin" or "Super Admin" (super_admin only)

### Create a New Squad
1. Go to Admin Panel → Squads tab
2. Click "Create Squad"
3. Fill in:
   - Name (required)
   - Avatar URL (optional)
   - Premium toggle
   - Coach (if premium)
4. Click "Create Squad"

### Assign a Coach to a Premium Squad
1. First, promote a user to "Coach" role (in Users tab)
2. Go to Squads tab
3. Edit the squad or create new
4. Toggle "Premium Squad"
5. Select the coach from dropdown
6. Save

### Delete a User
1. Go to Users tab
2. Find the user
3. Click "Delete" (only if you have permission)
4. Confirm deletion

## 🔐 Permission Matrix

| Action | Admin | Super Admin |
|--------|-------|-------------|
| View all users | ✅ | ✅ |
| Change user → user/coach/admin | ✅ | ✅ |
| Change user → super_admin | ❌ | ✅ |
| Modify super_admin user | ❌ | ✅ |
| Delete regular user | ✅ | ✅ |
| Delete super_admin | ❌ | ✅ |
| Create squad | ✅ | ✅ |
| Edit squad | ✅ | ✅ |
| Delete squad | ✅ | ✅ |

## 🎯 User Roles Explained

- **User** - Regular user with standard access
- **Coach** - Can coach premium squads
- **Admin** - Can manage most users and all squads
- **Super Admin** - Full system access, can manage all users including admins

## ⚠️ Important Notes

- You **cannot** delete yourself
- Admins **cannot** modify or delete super_admins
- Premium squads **must** have a coach assigned
- All destructive actions require confirmation
- Desktop only - no mobile support yet

## 🔧 Troubleshooting

### Admin menu item not showing?
- Check your role in Firebase Console
- Ensure `role` field is set to `"admin"` or `"super_admin"`
- Clear browser cache and refresh

### Can't change a user's role?
- Verify you have permission (see matrix above)
- Admins cannot modify super_admin users
- Check browser console for errors

### Can't create premium squad?
- Ensure a coach is selected
- Verify the coach user has role `"coach"`
- Check if coach exists in the dropdown

### API returns 403 Forbidden?
- Your role may have changed
- Refresh the page to reload user data
- Check Firestore for current role

## 📞 Need Help?

See full documentation: `ADMIN_PANEL_DOCS.md`

## 🗺️ File Structure

```
src/
├── app/
│   ├── admin/page.tsx                    # Main admin page
│   └── api/admin/
│       ├── users/route.ts                # List users
│       ├── users/[userId]/route.ts       # Delete user
│       ├── users/[userId]/role/route.ts  # Update role
│       ├── squads/route.ts               # List/create squads
│       ├── squads/[squadId]/route.ts     # Update/delete squad
│       └── coaches/route.ts              # List coaches
├── components/admin/
│   ├── AdminUsersTab.tsx                 # Users UI
│   ├── AdminSquadsTab.tsx                # Squads UI
│   └── SquadFormDialog.tsx               # Squad form
└── lib/
    └── admin-utils.ts                    # Auth utilities
```

