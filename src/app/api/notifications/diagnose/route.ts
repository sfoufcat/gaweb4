import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { hasAnyEveningNotificationForToday } from '@/lib/notifications';
import { 
  isEveningNotificationTime, 
  isMorningNotificationTime,
  getCurrentHourInTimezone,
  getTodayInTimezone,
  getDebugTimeString,
  DEFAULT_TIMEZONE,
  EVENING_NOTIFICATION_HOUR,
  MORNING_NOTIFICATION_HOUR,
} from '@/lib/timezone';
import type { BillingInfo } from '@/types';

/**
 * Check if user has an active subscription (same logic as cron job)
 */
function hasActiveSubscription(billing?: BillingInfo): boolean {
  if (!billing || !billing.status) return true;
  
  if (billing.status === 'active' || billing.status === 'trialing') {
    return true;
  }
  
  if (billing.status === 'canceled' && billing.currentPeriodEnd) {
    const endDate = new Date(billing.currentPeriodEnd);
    const now = new Date();
    return endDate > now;
  }
  
  return false;
}

/**
 * GET /api/notifications/diagnose
 * 
 * Diagnostic endpoint to check why evening notifications might not be delivered.
 * Returns detailed information about all conditions checked by the notification cron.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({
        error: 'User not found in database',
        userId,
        recommendation: 'Your user profile may not be synced. Try logging out and back in.',
      }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const storedTimezone = userData.timezone || null;
    const effectiveTimezone = storedTimezone || DEFAULT_TIMEZONE;
    
    // Get current time info in user's timezone
    const currentHour = getCurrentHourInTimezone(effectiveTimezone);
    const today = getTodayInTimezone(effectiveTimezone);
    const debugTimeString = getDebugTimeString(effectiveTimezone);
    
    // Check all conditions for evening notification
    const isEveningTime = isEveningNotificationTime(effectiveTimezone);
    const isMorningTime = isMorningNotificationTime(effectiveTimezone);
    const hasOnboarding = userData.hasCompletedOnboarding === true;
    const hasSubscription = hasActiveSubscription(userData.billing);
    
    // Check if evening check-in already completed
    const eveningCheckInRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('eveningCheckins')
      .doc(today);
    const eveningCheckInDoc = await eveningCheckInRef.get();
    const hasCompletedEveningCheckIn = eveningCheckInDoc.exists && eveningCheckInDoc.data()?.completedAt;
    
    // Check if any evening notification already exists for today
    const hasEveningNotification = await hasAnyEveningNotificationForToday(userId, effectiveTimezone);

    // Determine what would happen if cron ran now
    const wouldReceiveNotification = 
      isEveningTime && 
      hasOnboarding && 
      hasSubscription && 
      !hasCompletedEveningCheckIn && 
      !hasEveningNotification;

    // Build diagnosis object
    const diagnosis = {
      userId,
      currentTime: {
        utc: new Date().toISOString(),
        inYourTimezone: debugTimeString,
        currentHour,
        today,
      },
      timezone: {
        stored: storedTimezone,
        effective: effectiveTimezone,
        isDefaultUTC: !storedTimezone,
        recommendation: !storedTimezone 
          ? 'Your timezone is not set. Visit the app to auto-detect it, or it will default to UTC.'
          : null,
      },
      conditions: {
        isEveningNotificationTime: {
          value: isEveningTime,
          detail: `Current hour is ${currentHour}, evening notification sends at hour ${EVENING_NOTIFICATION_HOUR} (5 PM)`,
          hoursUntilEvening: isEveningTime ? 0 : (EVENING_NOTIFICATION_HOUR - currentHour + 24) % 24,
        },
        isMorningNotificationTime: {
          value: isMorningTime,
          detail: `Morning notification sends at hour ${MORNING_NOTIFICATION_HOUR} (7 AM)`,
        },
        hasCompletedOnboarding: {
          value: hasOnboarding,
          detail: hasOnboarding 
            ? 'Onboarding is complete' 
            : 'You must complete onboarding to receive notifications',
        },
        hasActiveSubscription: {
          value: hasSubscription,
          billingStatus: userData.billing?.status || 'no billing data (legacy user)',
          detail: hasSubscription 
            ? 'Subscription is active' 
            : 'No active subscription found',
        },
        hasNotCompletedEveningCheckIn: {
          value: !hasCompletedEveningCheckIn,
          detail: hasCompletedEveningCheckIn 
            ? 'You already completed evening check-in today - no reminder needed' 
            : 'Evening check-in not yet completed today',
        },
        hasNoEveningNotificationToday: {
          value: !hasEveningNotification,
          detail: hasEveningNotification 
            ? 'You already have an evening notification for today (either "tasks completed" or "reminder")' 
            : 'No evening notification sent yet today',
        },
      },
      summary: {
        wouldReceiveNotificationNow: wouldReceiveNotification,
        failingConditions: [] as string[],
        recommendation: '',
      },
    };

    // Identify failing conditions
    if (!isEveningTime) {
      diagnosis.summary.failingConditions.push(`Not evening time (current: ${currentHour}:00, target: ${EVENING_NOTIFICATION_HOUR}:00)`);
    }
    if (!hasOnboarding) {
      diagnosis.summary.failingConditions.push('Onboarding not completed');
    }
    if (!hasSubscription) {
      diagnosis.summary.failingConditions.push('No active subscription');
    }
    if (hasCompletedEveningCheckIn) {
      diagnosis.summary.failingConditions.push('Evening check-in already completed today');
    }
    if (hasEveningNotification) {
      diagnosis.summary.failingConditions.push('Evening notification already sent today');
    }

    // Generate recommendation
    if (wouldReceiveNotification) {
      diagnosis.summary.recommendation = 'All conditions pass. If the cron job runs now, you would receive the notification.';
    } else if (!storedTimezone) {
      diagnosis.summary.recommendation = 'Your timezone is not set. The system defaults to UTC. Visit the app to auto-detect your timezone.';
    } else if (!isEveningTime) {
      const hoursUntil = (EVENING_NOTIFICATION_HOUR - currentHour + 24) % 24;
      diagnosis.summary.recommendation = `Wait ${hoursUntil} hour(s) for the evening notification window (5 PM in ${effectiveTimezone}).`;
    } else if (hasEveningNotification) {
      diagnosis.summary.recommendation = 'You already received an evening notification today. Check your notification panel.';
    } else if (hasCompletedEveningCheckIn) {
      diagnosis.summary.recommendation = 'You already did your evening check-in today, so no reminder was needed.';
    } else if (!hasOnboarding) {
      diagnosis.summary.recommendation = 'Complete onboarding to start receiving notifications.';
    } else if (!hasSubscription) {
      diagnosis.summary.recommendation = 'An active subscription is required for notifications.';
    }

    return NextResponse.json(diagnosis);

  } catch (error) {
    console.error('[DIAGNOSE_NOTIFICATION] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to diagnose notifications';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}






