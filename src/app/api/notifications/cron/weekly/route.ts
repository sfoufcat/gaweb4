import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendWeeklyReflectionNotification } from '@/lib/notifications';
import { 
  isWeekendNotificationTime, 
  getDebugTimeString,
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
 * GET/POST /api/notifications/cron/weekly
 * 
 * Timezone-aware weekly reflection notification cron.
 * 
 * This job should run EVERY HOUR (e.g., "0 * * * *" in cron syntax).
 * For each user, it checks if their local time is Saturday or Sunday at 9 AM
 * and sends the weekly reflection notification.
 * 
 * Note: Users can also receive this notification after completing their
 * Friday evening check-in (handled separately in the evening check-in API).
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
      skippedNoSubscription: 0,
      skippedAlreadyReflected: 0,
      skippedAlreadyNotified: 0,
      errors: 0,
    };

    // Get all active users with their timezone
    const usersSnapshot = await adminDb
      .collection('users')
      .where('hasCompletedOnboarding', '==', true)
      .limit(500) // Process in batches for production
      .get();

    // Calculate week ID for checking completions
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekId = monday.toISOString().split('T')[0];

    for (const userDoc of usersSnapshot.docs) {
      stats.processed++;
      const userId = userDoc.id;
      const userData = userDoc.data();
      const userTimezone = userData.timezone || DEFAULT_TIMEZONE;

      try {
        // Check if it's weekend morning (9 AM) in the user's timezone
        if (!isWeekendNotificationTime(userTimezone)) {
          stats.skippedWrongTime++;
          continue;
        }

        // Check if user has an active subscription
        if (!hasActiveSubscription(userData.billing)) {
          stats.skippedNoSubscription++;
          continue;
        }

        // Check if user already completed weekly reflection this week
        const weeklyReflectionRef = adminDb
          .collection('users')
          .doc(userId)
          .collection('weeklyReflections')
          .doc(weekId);
        
        const weeklyReflectionDoc = await weeklyReflectionRef.get();
        
        if (weeklyReflectionDoc.exists && weeklyReflectionDoc.data()?.completedAt) {
          // Already completed weekly reflection, skip
          stats.skippedAlreadyReflected++;
          continue;
        }

        // Send notification (will be skipped if user already has one this week)
        const notificationId = await sendWeeklyReflectionNotification(userId, false);
        
        if (notificationId) {
          stats.notificationsSent++;
          console.log(`[CRON_WEEKLY] Sent notification to ${userId} (${getDebugTimeString(userTimezone)})`);
        } else {
          stats.skippedAlreadyNotified++;
        }
      } catch (userError) {
        console.error(`[CRON_WEEKLY] Error processing user ${userId}:`, userError);
        stats.errors++;
      }
    }

    console.log('[CRON_WEEKLY] Completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Weekly notifications cron completed',
      stats,
    });
  } catch (error) {
    console.error('[CRON_WEEKLY] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process weekly notifications';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
