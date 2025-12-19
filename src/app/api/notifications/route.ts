import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { 
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/notifications';
import type { Notification } from '@/types';

/**
 * GET /api/notifications
 * Fetches the current user's notifications
 * Query params:
 *   - limit: number (default 20)
 *   - unreadOnly: boolean (default false)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    let query = adminDb
      .collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (unreadOnly) {
      query = adminDb
        .collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();
    const notifications: Notification[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];

    // Also get unread count for badge
    const unreadSnapshot = await adminDb
      .collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    return NextResponse.json({
      notifications,
      unreadCount: unreadSnapshot.size,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch notifications';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 * Body:
 *   - markAllRead: boolean - marks all notifications as read
 *   - notificationId: string - marks a single notification as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { markAllRead, notificationId } = body;

    if (markAllRead) {
      const count = await markAllNotificationsAsRead(userId);
      return NextResponse.json({ success: true, markedCount: count });
    }

    if (notificationId) {
      // Verify the notification belongs to the user
      const notificationDoc = await adminDb
        .collection('notifications')
        .doc(notificationId)
        .get();

      if (!notificationDoc.exists) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      const notificationData = notificationDoc.data() as Notification;
      if (notificationData.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await markNotificationAsRead(notificationId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Either markAllRead or notificationId is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating notifications:', error);
    const message = error instanceof Error ? error.message : 'Failed to update notifications';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications
 * Delete a notification
 * Body:
 *   - notificationId: string - the notification to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: 'notificationId is required' },
        { status: 400 }
      );
    }

    // Verify the notification belongs to the user
    const notificationDoc = await adminDb
      .collection('notifications')
      .doc(notificationId)
      .get();

    if (!notificationDoc.exists) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const notificationData = notificationDoc.data() as Notification;
    if (notificationData.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the notification
    await adminDb.collection('notifications').doc(notificationId).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete notification';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}




