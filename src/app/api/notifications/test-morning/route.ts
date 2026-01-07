import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  sendMorningCheckInNotification, 
  hasNotificationForToday,
  notifyUser 
} from '@/lib/notifications';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET/POST /api/notifications/test-morning
 * 
 * Test endpoint to manually trigger a morning notification for the current user.
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
    const organizationId = userData?.primaryOrganizationId;

    // Check if already sent today (for verbose response)
    const alreadySentToday = await hasNotificationForToday(
      userId, 
      'morning_checkin', 
      userTimezone, 
      organizationId
    );

    console.log('[TEST_MORNING] Debug info:', {
      userId,
      userEmail,
      userTimezone,
      organizationId,
      alreadySentToday,
      force,
    });

    // If force=true, bypass the "already sent" check and send directly
    if (force) {
      const notificationId = await notifyUser({
        userId,
        type: 'morning_checkin',
        title: 'Your morning check-in is ready',
        body: "Start your day strong by checking in and setting today's focus.",
        actionRoute: '/checkin/flow/morning',
        organizationId,
      });

      return NextResponse.json({
        success: true,
        message: 'Morning notification FORCE sent (bypassed duplicate check)!',
        notificationId,
        debug: {
          userId,
          userEmail,
          userTimezone,
          organizationId,
          alreadySentToday,
        },
      });
    }

    // Normal flow: use sendMorningCheckInNotification which checks for duplicates
    const notificationId = await sendMorningCheckInNotification(userId);
    
    if (notificationId) {
      return NextResponse.json({
        success: true,
        message: 'Morning notification sent!',
        notificationId,
        debug: {
          userId,
          userEmail,
          userTimezone,
          organizationId,
          alreadySentToday: false,
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Notification skipped - you already have a morning notification for today',
        debug: {
          userId,
          userEmail,
          userTimezone,
          organizationId,
          alreadySentToday: true,
          hint: 'Use ?force=true to send anyway (for testing)',
        },
      });
    }
  } catch (error) {
    console.error('[TEST_MORNING] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}




