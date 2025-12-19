import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendMorningCheckInNotification } from '@/lib/notifications';
import { 
  isMorningNotificationTime, 
  getTodayInTimezone,
  getDebugTimeString,
  isWeekendInTimezone,
  DEFAULT_TIMEZONE 
} from '@/lib/timezone';
import type { BillingInfo } from '@/types';

/**
 * Check if user has an active subscription
 * - No billing data = allow (Clerk middleware is source of truth, Firebase may not be synced)
 * - 'active' or 'trialing' = full access
 * - 'canceled' but still in paid period = grace access
 * - 'past_due' or expired = blocked
 */
function hasActiveSubscription(billing?: BillingInfo): boolean {
  // If no billing info in Firebase, don't block - they might be a legacy user
  // or the Stripe webhook didn't sync to Firebase yet (Clerk is source of truth for access)
  if (!billing || !billing.status) return true;
  
  // Active or trialing = full access
  if (billing.status === 'active' || billing.status === 'trialing') {
    return true;
  }
  
  // Canceled but still in paid period = grace access
  if (billing.status === 'canceled' && billing.currentPeriodEnd) {
    const endDate = new Date(billing.currentPeriodEnd);
    const now = new Date();
    return endDate > now;
  }
  
  // Past due or expired cancellation - block
  return false;
}

/**
 * GET/POST /api/notifications/cron/morning
 * 
 * Timezone-aware morning notification cron.
 * 
 * This job should run EVERY HOUR (e.g., "0 * * * *" in cron syntax).
 * For each user, it checks if their local time is 7 AM and sends the notification.
 * 
 * This approach ensures users receive notifications at 7 AM in their local timezone,
 * regardless of where the server is located.
 * 
 * Security: Protected by CRON_SECRET header.
 * 
 * Note: Vercel cron jobs send GET requests by default, so we support both methods.
 */
export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  try {
    // Validate cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = {
      processed: 0,
      notificationsSent: 0,
      skippedWrongTime: 0,
      skippedWeekend: 0,
      skippedNoSubscription: 0,
      skippedAlreadyCheckedIn: 0,
      skippedAlreadyNotified: 0,
      errors: 0,
    };

    // Get all active users with their timezone
    const usersSnapshot = await adminDb
      .collection('users')
      .where('hasCompletedOnboarding', '==', true)
      .limit(500) // Process in batches for production
      .get();

    for (const userDoc of usersSnapshot.docs) {
      stats.processed++;
      const userId = userDoc.id;
      const userData = userDoc.data();
      const userTimezone = userData.timezone || DEFAULT_TIMEZONE;

      try {
        // Check if it's 7 AM in the user's timezone
        if (!isMorningNotificationTime(userTimezone)) {
          stats.skippedWrongTime++;
          continue;
        }

        // Check if user has an active subscription
        if (!hasActiveSubscription(userData.billing)) {
          stats.skippedNoSubscription++;
          continue;
        }

        // Skip weekends - no morning check-in on Saturday/Sunday
        if (isWeekendInTimezone(userTimezone)) {
          stats.skippedWeekend++;
          continue;
        }

        // Get today's date in the user's timezone
        const today = getTodayInTimezone(userTimezone);

        // Check if user already completed morning check-in today
        const checkInRef = adminDb
          .collection('users')
          .doc(userId)
          .collection('checkins')
          .doc(today);
        
        const checkInDoc = await checkInRef.get();
        
        if (checkInDoc.exists && checkInDoc.data()?.completedAt) {
          // Already completed, skip
          stats.skippedAlreadyCheckedIn++;
          continue;
        }

        // Send notification
        const notificationId = await sendMorningCheckInNotification(userId);
        
        if (notificationId) {
          stats.notificationsSent++;
          console.log(`[CRON_MORNING] Sent notification to ${userId} (${getDebugTimeString(userTimezone)})`);
        } else {
          stats.skippedAlreadyNotified++;
        }
      } catch (userError) {
        console.error(`[CRON_MORNING] Error processing user ${userId}:`, userError);
        stats.errors++;
      }
    }

    console.log('[CRON_MORNING] Completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Morning notifications cron completed',
      stats,
    });
  } catch (error: any) {
    console.error('[CRON_MORNING] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process morning notifications' },
      { status: 500 }
    );
  }
}
