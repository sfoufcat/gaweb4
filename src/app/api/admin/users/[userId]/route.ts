import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin, canDeleteUser, getCurrentUserRole } from '@/lib/admin-utils-clerk';
import type { UserRole } from '@/types';

/**
 * DELETE /api/admin/users/[userId]
 * Deletes a user from Clerk and Firebase (admin/super_admin only, with restrictions)
 */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: currentUserId } = await auth();
    
    if (!currentUserId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check authorization (throws if not admin)
    const currentUserRole = await requireAdmin();

    const { userId: targetUserId } = await context.params;

    // Prevent self-deletion
    if (currentUserId === targetUserId) {
      return NextResponse.json({ error: 'You cannot delete yourself' }, { status: 400 });
    }

    // Fetch target user from Clerk
    const client = await clerkClient();
    const targetUser = await client.users.getUser(targetUserId);
    
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const targetUserRole = (targetUser.publicMetadata?.role as UserRole) || 'user';

    // Check if current user can delete target user
    if (!canDeleteUser(currentUserRole, targetUserRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this user' },
        { status: 403 }
      );
    }

    // Delete from Clerk (this is the source of truth)
    await client.users.deleteUser(targetUserId);

    // Also clean up Firebase data (app data only, not auth)
    try {
      await adminDb.collection('users').doc(targetUserId).delete();
      
      // Clean up user's data collections
      // Habits
      const habitsSnapshot = await adminDb.collection('habits')
        .where('userId', '==', targetUserId)
        .get();
      const habitsBatch = adminDb.batch();
      habitsSnapshot.forEach((doc) => habitsBatch.delete(doc.ref));
      await habitsBatch.commit();

      // Tasks
      const tasksSnapshot = await adminDb.collection('tasks')
        .where('userId', '==', targetUserId)
        .get();
      const tasksBatch = adminDb.batch();
      tasksSnapshot.forEach((doc) => tasksBatch.delete(doc.ref));
      await tasksBatch.commit();

      console.log(`Cleaned up Firebase data for user ${targetUserId}`);
    } catch (firebaseError) {
      console.error('[FIREBASE_CLEANUP_ERROR]', firebaseError);
      // Continue even if Firebase cleanup fails - user is already deleted from Clerk
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN_USER_DELETE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}
