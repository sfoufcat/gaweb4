import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEveningReminderNotification } from '@/lib/notifications';
import { 
  isEveningNotificationTime, 
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
 * GET/POST /api/notifications/cron/evening
 * 
 * Timezone-aware evening notification cron.
 * 
 * This job should run EVERY HOUR (e.g., "0 * * * *" in cron syntax).
 * For each user, it checks if their local time is 5 PM and sends the notification.
 * 
 * Important: This will NOT send if the user already received a "tasks completed"
 * notification earlier in the day - that check is handled by sendEveningReminderNotification.
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
        // Check if it's 5 PM in the user's timezone
        if (!isEveningNotificationTime(userTimezone)) {
          stats.skippedWrongTime++;
          continue;
        }

        // Check if user has an active subscription
        if (!hasActiveSubscription(userData.billing)) {
          stats.skippedNoSubscription++;
          continue;
        }

        // Skip weekends - no evening check-in on Saturday/Sunday
        if (isWeekendInTimezone(userTimezone)) {
          stats.skippedWeekend++;
          continue;
        }

        // Get today's date in the user's timezone
        const today = getTodayInTimezone(userTimezone);

        // Check if user already completed evening check-in today
        const eveningCheckInRef = adminDb
          .collection('users')
          .doc(userId)
          .collection('eveningCheckins')
          .doc(today);
        
        const eveningCheckInDoc = await eveningCheckInRef.get();
        
        if (eveningCheckInDoc.exists && eveningCheckInDoc.data()?.completedAt) {
          // Already completed evening check-in, skip
          stats.skippedAlreadyCheckedIn++;
          continue;
        }

        // Send notification (will be skipped if user already has an evening notification)
        const notificationId = await sendEveningReminderNotification(userId);
        
        if (notificationId) {
          stats.notificationsSent++;
          console.log(`[CRON_EVENING] Sent notification to ${userId} (${getDebugTimeString(userTimezone)})`);
        } else {
          stats.skippedAlreadyNotified++;
        }
      } catch (userError) {
        console.error(`[CRON_EVENING] Error processing user ${userId}:`, userError);
        stats.errors++;
      }
    }

    console.log('[CRON_EVENING] Completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Evening notifications cron completed',
      stats,
    });
  } catch (error) {
    console.error('[CRON_EVENING] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process evening notifications';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
