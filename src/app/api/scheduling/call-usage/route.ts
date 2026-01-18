/**
 * API Route: Call Usage Tracking for Program Allowances
 *
 * GET /api/scheduling/call-usage?enrollmentId=xxx
 * Returns the client's current call usage for a specific enrollment.
 *
 * POST /api/scheduling/call-usage
 * Deducts a call from the client's allowance (called when call completes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ProgramEnrollment, Program } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

interface CallUsageResponse {
  // Monthly allowance
  monthlyAllowance: number;
  callsUsedInWindow: number;
  callsRemaining: number;
  windowResetDate: string;
  daysUntilReset: number;
  // Weekly limit (optional)
  weeklyLimit: number | null;
  callsThisWeek: number;
  weeklyRemaining: number | null;
  weekResetDate: string;
  // Extra call pricing
  pricePerExtraCallCents: number | null;
  // Program info
  programId: string;
  programName: string;
  enrollmentId: string;
}

interface DeductCallRequest {
  enrollmentId: string;
  eventId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the start of the current week (Monday 00:00:00 UTC)
 */
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the next Monday (start of next week)
 */
function getNextMonday(date: Date = new Date()): Date {
  const weekStart = getWeekStart(date);
  weekStart.setUTCDate(weekStart.getUTCDate() + 7);
  return weekStart;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Calculate rolling 30-day window data
 */
function calculateWindow(enrollment: ProgramEnrollment): {
  windowStart: string;
  callsInWindow: number;
  shouldReset: boolean;
} {
  const now = new Date();
  const callUsage = enrollment.callUsage;

  if (!callUsage?.windowStart) {
    // No existing window - start from enrollment start date or now
    const startDate = enrollment.startedAt || enrollment.createdAt;
    return {
      windowStart: startDate,
      callsInWindow: 0,
      shouldReset: false,
    };
  }

  const windowStart = new Date(callUsage.windowStart);
  const windowEnd = addDays(windowStart, 30);

  // If window has expired, reset to today
  if (now > windowEnd) {
    return {
      windowStart: now.toISOString(),
      callsInWindow: 0,
      shouldReset: true,
    };
  }

  return {
    windowStart: callUsage.windowStart,
    callsInWindow: callUsage.callsInWindow || 0,
    shouldReset: false,
  };
}

/**
 * Calculate weekly usage data
 */
function calculateWeeklyUsage(enrollment: ProgramEnrollment): {
  weekStart: string;
  callsThisWeek: number;
  shouldReset: boolean;
} {
  const currentWeekStart = getWeekStart();
  const callUsage = enrollment.callUsage;

  if (!callUsage?.weekStart) {
    // No existing week data - start fresh
    return {
      weekStart: currentWeekStart.toISOString(),
      callsThisWeek: 0,
      shouldReset: false,
    };
  }

  const storedWeekStart = new Date(callUsage.weekStart);

  // If we're in a new week, reset
  if (currentWeekStart > storedWeekStart) {
    return {
      weekStart: currentWeekStart.toISOString(),
      callsThisWeek: 0,
      shouldReset: true,
    };
  }

  return {
    weekStart: callUsage.weekStart,
    callsThisWeek: callUsage.callsThisWeek || 0,
    shouldReset: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET - Fetch call usage for an enrollment
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');

    if (!enrollmentId) {
      return NextResponse.json(
        { error: 'enrollmentId is required' },
        { status: 400 }
      );
    }

    // Fetch enrollment
    const enrollmentDoc = await adminDb
      .collection('program_enrollments')
      .doc(enrollmentId)
      .get();

    if (!enrollmentDoc.exists) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    const enrollment = {
      id: enrollmentDoc.id,
      ...enrollmentDoc.data(),
    } as ProgramEnrollment;

    // Verify user has access to this enrollment
    if (enrollment.userId !== userId) {
      // Check if user is a coach in this org
      const orgDoc = await adminDb
        .collection('organizations')
        .doc(enrollment.organizationId)
        .get();

      const orgData = orgDoc.data();
      const coachIds = orgData?.coachIds || [];
      const ownerId = orgData?.ownerId;

      if (!coachIds.includes(userId) && ownerId !== userId) {
        return NextResponse.json(
          { error: 'Forbidden - not authorized to view this enrollment' },
          { status: 403 }
        );
      }
    }

    // Fetch program for allowance settings
    const programDoc = await adminDb
      .collection('programs')
      .doc(enrollment.programId)
      .get();

    if (!programDoc.exists) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const program = programDoc.data() as Program;

    // Only individual programs have call allowances
    if (program.type !== 'individual') {
      return NextResponse.json(
        { error: 'Call allowances only apply to individual programs' },
        { status: 400 }
      );
    }

    // Calculate current usage
    const windowData = calculateWindow(enrollment);
    const weeklyData = calculateWeeklyUsage(enrollment);

    const monthlyAllowance = program.callCreditsPerMonth || 0;
    const weeklyLimit = program.maxCallsPerWeek || null;

    const now = new Date();
    const windowResetDate = addDays(new Date(windowData.windowStart), 30);
    const daysUntilReset = Math.ceil(
      (windowResetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const callsRemaining = Math.max(0, monthlyAllowance - windowData.callsInWindow);
    const weeklyRemaining = weeklyLimit !== null
      ? Math.max(0, weeklyLimit - weeklyData.callsThisWeek)
      : null;

    const response: CallUsageResponse = {
      monthlyAllowance,
      callsUsedInWindow: windowData.callsInWindow,
      callsRemaining,
      windowResetDate: windowResetDate.toISOString(),
      daysUntilReset,
      weeklyLimit,
      callsThisWeek: weeklyData.callsThisWeek,
      weeklyRemaining,
      weekResetDate: getNextMonday().toISOString(),
      pricePerExtraCallCents: program.pricePerExtraCallCents || null,
      programId: program.id || programDoc.id,
      programName: program.name,
      enrollmentId: enrollment.id,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[CALL_USAGE_GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST - Deduct call from allowance
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: DeductCallRequest = await request.json();
    const { enrollmentId, eventId } = body;

    if (!enrollmentId || !eventId) {
      return NextResponse.json(
        { error: 'enrollmentId and eventId are required' },
        { status: 400 }
      );
    }

    // Use a transaction to safely update counters
    const result = await adminDb.runTransaction(async (transaction) => {
      // Fetch enrollment
      const enrollmentRef = adminDb
        .collection('program_enrollments')
        .doc(enrollmentId);
      const enrollmentDoc = await transaction.get(enrollmentRef);

      if (!enrollmentDoc.exists) {
        throw new Error('Enrollment not found');
      }

      const enrollment = {
        id: enrollmentDoc.id,
        ...enrollmentDoc.data(),
      } as ProgramEnrollment;

      // Fetch event to check if already deducted
      const eventRef = adminDb.collection('events').doc(eventId);
      const eventDoc = await transaction.get(eventRef);

      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();

      // If already deducted, skip
      if (eventData?.callUsageDeducted) {
        return { alreadyDeducted: true };
      }

      // Calculate window (and reset if expired)
      const windowData = calculateWindow(enrollment);
      const weeklyData = calculateWeeklyUsage(enrollment);

      const now = new Date().toISOString();

      // Build updated callUsage
      const updatedCallUsage = {
        windowStart: windowData.windowStart,
        callsInWindow: windowData.callsInWindow + 1,
        weekStart: weeklyData.weekStart,
        callsThisWeek: weeklyData.callsThisWeek + 1,
        lastCallAt: now,
      };

      // Update enrollment
      transaction.update(enrollmentRef, {
        callUsage: updatedCallUsage,
        updatedAt: now,
      });

      // Mark event as deducted
      transaction.update(eventRef, {
        callUsageDeducted: true,
      });

      return {
        alreadyDeducted: false,
        newCallsInWindow: updatedCallUsage.callsInWindow,
        newCallsThisWeek: updatedCallUsage.callsThisWeek,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('[CALL_USAGE_POST] Error:', error);

    if (error instanceof Error) {
      if (error.message === 'Enrollment not found') {
        return NextResponse.json(
          { error: 'Enrollment not found' },
          { status: 404 }
        );
      }
      if (error.message === 'Event not found') {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
