import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  sendEveningReminderNotification, 
  hasAnyEveningNotificationForToday,
  notifyUser 
} from '@/lib/notifications';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET/POST /api/notifications/test-evening
 * 
 * Test endpoint to manually trigger an evening notification for the current user.
 * For development/testing purposes only.
 * 
 * Query params:
 *   - force=true: Bypass "already sent today" check and send regardless
 */
export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for force param
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Get user data for verbose logging
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const userTimezone = userData?.timezone || 'UTC';
    const userEmail = userData?.email || 'no email';

    // Check if already sent today (for verbose response)
    const alreadySentToday = await hasAnyEveningNotificationForToday(userId, userTimezone);

    console.log('[TEST_EVENING] Debug info:', {
      userId,
      userEmail,
      userTimezone,
      alreadySentToday,
      force,
    });

    // If force=true, bypass the "already sent" check and send directly
    if (force) {
      const notificationId = await notifyUser({
        userId,
        type: 'evening_checkin_incomplete_tasks',
        title: 'Close your day with a quick check-in',
        body: "Not every day is a hit, and that's okay. Take a moment to reflect and close your day.",
        actionRoute: '/checkin/flow/evening',
      });

      return NextResponse.json({
        success: true,
        message: 'Evening notification FORCE sent (bypassed duplicate check)!',
        notificationId,
        debug: {
          userId,
          userEmail,
          userTimezone,
          alreadySentToday,
        },
      });
    }

    // Normal flow: use sendEveningReminderNotification which checks for duplicates
    const notificationId = await sendEveningReminderNotification(userId);
    
    if (notificationId) {
      return NextResponse.json({
        success: true,
        message: 'Evening notification sent!',
        notificationId,
        debug: {
          userId,
          userEmail,
          userTimezone,
          alreadySentToday: false,
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Notification skipped - you already have an evening notification for today',
        debug: {
          userId,
          userEmail,
          userTimezone,
          alreadySentToday: true,
          hint: 'Use ?force=true to send anyway (for testing)',
        },
      });
    }
  } catch (error) {
    console.error('[TEST_EVENING] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

