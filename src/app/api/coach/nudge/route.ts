/**
 * Nudge API
 *
 * POST /api/coach/nudge
 * Sends a nudge (push notification / chat message) to a client who needs attention
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';

interface NudgeRequest {
  userId: string;
  programId: string;
  message?: string; // Optional custom message, defaults to a friendly reminder
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId: coachId } = await requireCoachWithOrg();
    const body = (await request.json()) as NudgeRequest;
    const { userId, programId, message } = body;

    if (!userId || !programId) {
      return NextResponse.json(
        { error: 'userId and programId are required' },
        { status: 400 }
      );
    }

    // Verify the user is enrolled in this program and coach has access
    const enrollmentSnapshot = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('organizationId', '==', organizationId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (enrollmentSnapshot.empty) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Get program details
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const programName = programDoc.data()?.name || 'your program';

    // Get coach details
    const coachDoc = await adminDb.collection('users').doc(coachId).get();
    const coachData = coachDoc.exists ? coachDoc.data() : {};
    const coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || 'Your Coach';

    // Default nudge message
    const nudgeMessage = message || `Hey! ${coachName} noticed you might need some support with ${programName}. You've got this! 💪`;

    // Create a notification record
    const notificationRef = adminDb.collection('notifications').doc();
    await notificationRef.set({
      id: notificationRef.id,
      userId, // Recipient
      organizationId,
      type: 'nudge',
      title: 'Coach Check-in',
      body: nudgeMessage,
      data: {
        programId,
        coachId,
        sentAt: new Date().toISOString(),
      },
      read: false,
      createdAt: new Date().toISOString(),
    });

    // TODO: Integrate with push notification service (e.g., Firebase Cloud Messaging)
    // For now, we just create the notification record which can be polled/displayed in-app

    // Log the nudge action
    console.log(`[NUDGE] Coach ${coachId} nudged user ${userId} for program ${programId}`);

    return NextResponse.json({
      success: true,
      message: 'Nudge sent successfully',
      notificationId: notificationRef.id,
    });
  } catch (error) {
    console.error('[NUDGE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to send nudge' }, { status: 500 });
  }
}
