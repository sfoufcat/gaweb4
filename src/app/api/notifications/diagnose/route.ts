import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { 
  hasAnyEveningNotificationForToday, 
  hasNotificationForToday,
  hasWeeklyReflectionNotificationForThisWeek,
  getUserNotifications,
} from '@/lib/notifications';
import { 
  isEveningNotificationTime, 
  isMorningNotificationTime,
  isWeekendNotificationTime,
  isWeekendInTimezone,
  getCurrentHourInTimezone,
  getCurrentDayInTimezone,
  getTodayInTimezone,
  getDebugTimeString,
  DEFAULT_TIMEZONE,
  EVENING_NOTIFICATION_HOUR,
  MORNING_NOTIFICATION_HOUR,
  WEEKEND_NOTIFICATION_HOUR,
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * GET /api/notifications/diagnose
 * 
 * Comprehensive diagnostic endpoint to check why notifications might not be delivered.
 * Returns detailed information about all conditions checked by morning, evening, and weekly cron jobs.
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
    const organizationId = userData.primaryOrganizationId || null;
    
    // Get current time info in user's timezone
    const currentHour = getCurrentHourInTimezone(effectiveTimezone);
    const currentDay = getCurrentDayInTimezone(effectiveTimezone);
    const today = getTodayInTimezone(effectiveTimezone);
    const debugTimeString = getDebugTimeString(effectiveTimezone);
    const isWeekend = isWeekendInTimezone(effectiveTimezone);
    
    // Check all timing conditions
    const isEveningTime = isEveningNotificationTime(effectiveTimezone);
    const isMorningTime = isMorningNotificationTime(effectiveTimezone);
    const isWeekendTime = isWeekendNotificationTime(effectiveTimezone);
    const hasOnboarding = userData.hasCompletedOnboarding === true;
    const hasSubscription = hasActiveSubscription(userData.billing);
    
    // Check morning check-in status
    const morningCheckInRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('checkins')
      .doc(today);
    const morningCheckInDoc = await morningCheckInRef.get();
    const hasCompletedMorningCheckIn = morningCheckInDoc.exists && morningCheckInDoc.data()?.completedAt;
    
    // Check evening check-in status
    const eveningCheckInRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('eveningCheckins')
      .doc(today);
    const eveningCheckInDoc = await eveningCheckInRef.get();
    const hasCompletedEveningCheckIn = eveningCheckInDoc.exists && eveningCheckInDoc.data()?.completedAt;
    
    // Check notification status (scoped by organization)
    const hasMorningNotification = await hasNotificationForToday(userId, 'morning_checkin', effectiveTimezone, organizationId || undefined);
    const hasEveningNotification = await hasAnyEveningNotificationForToday(userId, effectiveTimezone, organizationId || undefined);
    const hasWeeklyNotification = await hasWeeklyReflectionNotificationForThisWeek(userId, organizationId || undefined);

    // Get recent notifications
    const recentNotifications = await getUserNotifications(userId, 10, organizationId || undefined);

    // Get squad memberships
    const squadMemberships = await adminDb
      .collection('squadMembers')
      .where('userId', '==', userId)
      .get();
    
    const squads = await Promise.all(
      squadMemberships.docs.map(async (doc) => {
        const data = doc.data();
        const squadDoc = await adminDb.collection('squads').doc(data.squadId).get();
        return {
          squadId: data.squadId,
          squadName: squadDoc.exists ? squadDoc.data()?.name : 'Unknown',
          hasChatChannel: squadDoc.exists ? !!squadDoc.data()?.chatChannelId : false,
        };
      })
    );

    // Determine what would happen if each cron ran now
    const wouldReceiveMorningNotification = 
      isMorningTime && 
      hasOnboarding && 
      hasSubscription && 
      !isWeekend &&
      !hasCompletedMorningCheckIn && 
      !hasMorningNotification;

    const wouldReceiveEveningNotification = 
      isEveningTime && 
      hasOnboarding && 
      hasSubscription && 
      !isWeekend &&
      !hasCompletedEveningCheckIn && 
      !hasEveningNotification;

    const wouldReceiveWeeklyNotification =
      isWeekendTime &&
      hasOnboarding &&
      hasSubscription &&
      !hasWeeklyNotification;

    // Build diagnosis object
    const diagnosis = {
      userId,
      organizationId,
      currentTime: {
        utc: new Date().toISOString(),
        inYourTimezone: debugTimeString,
        currentHour,
        currentDay: DAY_NAMES[currentDay],
        today,
        isWeekend,
      },
      timezone: {
        stored: storedTimezone,
        effective: effectiveTimezone,
        isDefaultUTC: !storedTimezone,
        warning: !storedTimezone 
          ? 'Your timezone is not set! Notifications will fire at wrong times. Visit the app to auto-detect it.'
          : null,
      },
      userStatus: {
        hasCompletedOnboarding: hasOnboarding,
        billingStatus: userData.billing?.status || 'no billing data (legacy user)',
        hasActiveSubscription: hasSubscription,
        email: userData.email || 'no email',
      },
      morningNotification: {
        targetHour: `${MORNING_NOTIFICATION_HOUR}:00 (7 AM)`,
        currentHour: `${currentHour}:00`,
        hoursUntil: isMorningTime ? 0 : (MORNING_NOTIFICATION_HOUR - currentHour + 24) % 24,
        checks: {
          isCorrectTime: isMorningTime,
          isWeekday: !isWeekend,
          hasCompletedOnboarding: hasOnboarding,
          hasActiveSubscription: hasSubscription,
          hasNotCompletedCheckIn: !hasCompletedMorningCheckIn,
          hasNoNotificationToday: !hasMorningNotification,
        },
        wouldReceiveNow: wouldReceiveMorningNotification,
        reason: !wouldReceiveMorningNotification ? getMorningBlockReason({
          isMorningTime, isWeekend, hasOnboarding, hasSubscription, 
          hasCompletedMorningCheckIn, hasMorningNotification
        }) : 'All conditions pass',
      },
      eveningNotification: {
        targetHour: `${EVENING_NOTIFICATION_HOUR}:00 (5 PM)`,
        currentHour: `${currentHour}:00`,
        hoursUntil: isEveningTime ? 0 : (EVENING_NOTIFICATION_HOUR - currentHour + 24) % 24,
        checks: {
          isCorrectTime: isEveningTime,
          isWeekday: !isWeekend,
          hasCompletedOnboarding: hasOnboarding,
          hasActiveSubscription: hasSubscription,
          hasNotCompletedCheckIn: !hasCompletedEveningCheckIn,
          hasNoNotificationToday: !hasEveningNotification,
        },
        wouldReceiveNow: wouldReceiveEveningNotification,
        reason: !wouldReceiveEveningNotification ? getEveningBlockReason({
          isEveningTime, isWeekend, hasOnboarding, hasSubscription,
          hasCompletedEveningCheckIn, hasEveningNotification
        }) : 'All conditions pass',
      },
      weeklyNotification: {
        targetTime: `${WEEKEND_NOTIFICATION_HOUR}:00 (9 AM) on Saturday/Sunday`,
        currentTime: `${DAY_NAMES[currentDay]} ${currentHour}:00`,
        checks: {
          isWeekendMorning: isWeekendTime,
          hasCompletedOnboarding: hasOnboarding,
          hasActiveSubscription: hasSubscription,
          hasNoNotificationThisWeek: !hasWeeklyNotification,
        },
        wouldReceiveNow: wouldReceiveWeeklyNotification,
        reason: !wouldReceiveWeeklyNotification ? getWeeklyBlockReason({
          isWeekendTime, hasOnboarding, hasSubscription, hasWeeklyNotification
        }) : 'All conditions pass',
      },
      squadMemberships: {
        count: squads.length,
        squads,
        note: squads.length > 1 
          ? `You are in ${squads.length} squads. Check-in notifications will be sent to ALL squad chats.`
          : squads.length === 1
          ? 'You are in 1 squad.'
          : 'You are not in any squad.',
      },
      recentNotifications: recentNotifications.map(n => ({
        type: n.type,
        title: n.title,
        createdAt: n.createdAt,
        read: n.read,
      })),
      summary: {
        issues: [] as string[],
        recommendations: [] as string[],
      },
    };

    // Build summary
    if (!storedTimezone) {
      diagnosis.summary.issues.push('Timezone not set - defaulting to UTC');
      diagnosis.summary.recommendations.push('Set your timezone in profile settings or visit the app to auto-detect it');
    }
    if (!hasOnboarding) {
      diagnosis.summary.issues.push('Onboarding not completed');
      diagnosis.summary.recommendations.push('Complete the onboarding flow to receive notifications');
    }
    if (!hasSubscription) {
      diagnosis.summary.issues.push('No active subscription');
      diagnosis.summary.recommendations.push('An active subscription is required for notifications');
    }
    if (!organizationId) {
      diagnosis.summary.issues.push('No organization ID set');
      diagnosis.summary.recommendations.push('Your account may not be properly linked to an organization');
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

function getMorningBlockReason(checks: {
  isMorningTime: boolean;
  isWeekend: boolean;
  hasOnboarding: boolean;
  hasSubscription: boolean;
  hasCompletedMorningCheckIn: boolean;
  hasMorningNotification: boolean;
}): string {
  if (checks.isWeekend) return 'Skipped on weekends';
  if (!checks.isMorningTime) return 'Not 7 AM yet';
  if (!checks.hasOnboarding) return 'Onboarding not completed';
  if (!checks.hasSubscription) return 'No active subscription';
  if (checks.hasCompletedMorningCheckIn) return 'Already completed morning check-in today';
  if (checks.hasMorningNotification) return 'Already sent notification today';
  return 'Unknown';
}

function getEveningBlockReason(checks: {
  isEveningTime: boolean;
  isWeekend: boolean;
  hasOnboarding: boolean;
  hasSubscription: boolean;
  hasCompletedEveningCheckIn: boolean;
  hasEveningNotification: boolean;
}): string {
  if (checks.isWeekend) return 'Skipped on weekends';
  if (!checks.isEveningTime) return 'Not 5 PM yet';
  if (!checks.hasOnboarding) return 'Onboarding not completed';
  if (!checks.hasSubscription) return 'No active subscription';
  if (checks.hasCompletedEveningCheckIn) return 'Already completed evening check-in today';
  if (checks.hasEveningNotification) return 'Already sent notification today';
  return 'Unknown';
}

function getWeeklyBlockReason(checks: {
  isWeekendTime: boolean;
  hasOnboarding: boolean;
  hasSubscription: boolean;
  hasWeeklyNotification: boolean;
}): string {
  if (!checks.isWeekendTime) return 'Not weekend morning (9 AM Sat/Sun)';
  if (!checks.hasOnboarding) return 'Onboarding not completed';
  if (!checks.hasSubscription) return 'No active subscription';
  if (checks.hasWeeklyNotification) return 'Already sent weekly notification this week';
  return 'Unknown';
}






