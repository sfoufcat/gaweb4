import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { FlowSession, ProgramInvite, Program, ProgramEnrollment, NewProgramEnrollmentStatus } from '@/types';

/**
 * POST /api/funnel/complete
 * Complete a funnel and enroll the user in the program
 * 
 * Body:
 * - flowSessionId: string (required)
 * - stripePaymentIntentId?: string (if payment was made)
 * 
 * This handles:
 * 1. Validating the flow session is complete
 * 2. Creating the program enrollment
 * 3. Assigning to squad/cohort (for group programs)
 * 4. Updating invite usage count
 * 5. Creating/updating user record
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - must be authenticated' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { flowSessionId, stripePaymentIntentId, stripeCheckoutSessionId } = body;

    if (!flowSessionId) {
      return NextResponse.json(
        { error: 'Flow session ID is required' },
        { status: 400 }
      );
    }

    // Get the flow session
    const sessionRef = adminDb.collection('flow_sessions').doc(flowSessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: 'Flow session not found' },
        { status: 404 }
      );
    }

    const session = sessionDoc.data() as FlowSession;

    // Check if session has been linked to a user
    if (!session.userId) {
      console.error(`[FUNNEL_COMPLETE] Session ${flowSessionId} not linked to any user`);
      return NextResponse.json(
        { error: 'Session not linked to user. Please sign up again.' },
        { status: 400 }
      );
    }

    // Verify session belongs to this user
    if (session.userId !== userId) {
      return NextResponse.json(
        { error: 'This flow session does not belong to you' },
        { status: 403 }
      );
    }

    // Check if already completed
    if (session.completedAt) {
      // Return existing enrollment info
      const existingEnrollment = await adminDb
        .collection('program_enrollments')
        .where('userId', '==', userId)
        .where('programId', '==', session.programId)
        .where('status', 'in', ['upcoming', 'active'])
        .limit(1)
        .get();

      if (!existingEnrollment.empty) {
        return NextResponse.json({
          success: true,
          alreadyCompleted: true,
          enrollment: { id: existingEnrollment.docs[0].id, ...existingEnrollment.docs[0].data() },
        });
      }
    }

    // Get program details
    const programDoc = await adminDb.collection('programs').doc(session.programId).get();
    if (!programDoc.exists) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const program = programDoc.data() as Program;

    // Handle invite if present
    let invite: ProgramInvite | null = null;
    let targetSquadId: string | null = null;
    let targetCohortId: string | null = null;

    if (session.inviteId) {
      const inviteDoc = await adminDb.collection('program_invites').doc(session.inviteId).get();
      if (inviteDoc.exists) {
        invite = inviteDoc.data() as ProgramInvite;
        targetSquadId = invite.targetSquadId || null;
        targetCohortId = invite.targetCohortId || null;

        // Update invite usage
        await adminDb.collection('program_invites').doc(session.inviteId).update({
          useCount: FieldValue.increment(1),
          usedBy: userId,
          usedAt: new Date().toISOString(),
        });
      }
    }

    // For group programs, find or assign squad/cohort
    const assignedSquadId: string | null = targetSquadId;
    let assignedCohortId: string | null = targetCohortId;

    if (program.type === 'group' && !assignedCohortId) {
      // Find active cohort with enrollment open
      const cohortsSnapshot = await adminDb
        .collection('program_cohorts')
        .where('programId', '==', session.programId)
        .where('enrollmentOpen', '==', true)
        .where('status', 'in', ['upcoming', 'active'])
        .orderBy('startDate', 'asc')
        .limit(1)
        .get();

      if (!cohortsSnapshot.empty) {
        const cohort = cohortsSnapshot.docs[0];
        assignedCohortId = cohort.id;

        // Update cohort enrollment count
        await cohort.ref.update({
          currentEnrollment: FieldValue.increment(1),
        });
      }
    }

    // TODO: Auto-assign to squad within cohort if not specified
    // This would involve finding a squad with available capacity

    // Determine enrollment status
    let enrollmentStatus: NewProgramEnrollmentStatus = 'active';
    let startedAt = new Date().toISOString();

    if (assignedCohortId) {
      // Check if cohort has started
      const cohortDoc = await adminDb.collection('program_cohorts').doc(assignedCohortId).get();
      if (cohortDoc.exists) {
        const cohortData = cohortDoc.data();
        if (cohortData?.startDate && new Date(cohortData.startDate) > new Date()) {
          enrollmentStatus = 'upcoming';
          startedAt = cohortData.startDate;
        }
      }
    }

    // Create program enrollment
    const now = new Date().toISOString();
    const enrollmentData: Omit<ProgramEnrollment, 'id'> = {
      userId,
      programId: session.programId,
      organizationId: session.organizationId,
      cohortId: assignedCohortId,
      squadId: assignedSquadId,
      stripePaymentIntentId: stripePaymentIntentId || null,
      stripeCheckoutSessionId: stripeCheckoutSessionId || null,
      paidAt: stripePaymentIntentId ? now : null,
      amountPaid: invite?.paymentStatus === 'pre_paid' ? 0 : (program.priceInCents || 0),
      status: enrollmentStatus,
      startedAt,
      lastAssignedDayIndex: 0,
      createdAt: now,
      updatedAt: now,
    };

    const enrollmentRef = await adminDb.collection('program_enrollments').add(enrollmentData);

    // Mark flow session as completed
    await sessionRef.update({
      completedAt: now,
      updatedAt: now,
    });

    // Update/create user record with program enrollment reference
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    // Get user info from Clerk
    let clerkUser;
    try {
      const clerk = await clerkClient();
      clerkUser = await clerk.users.getUser(userId);
    } catch (clerkError) {
      console.error('[FUNNEL_COMPLETE] Clerk API error:', clerkError);
      return NextResponse.json(
        { error: 'Failed to fetch user information from authentication provider' },
        { status: 500 }
      );
    }

    const userUpdate: Record<string, unknown> = {
      // Basic info from Clerk
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl || '',
      // Add to organization
      organizationId: session.organizationId,
      // Program enrollment reference
      currentProgramEnrollmentId: enrollmentRef.id,
      currentProgramId: session.programId,
      // Flow session data (goal, identity, etc.)
      ...extractUserDataFromSession(session.data),
      // Timestamps
      updatedAt: now,
    };

    if (!userDoc.exists) {
      userUpdate.createdAt = now;
      userUpdate.id = userId;
    }

    await userRef.set(userUpdate, { merge: true });

    console.log(`[FUNNEL_COMPLETE] User ${userId} enrolled in program ${session.programId}, enrollment ${enrollmentRef.id}`);

    return NextResponse.json({
      success: true,
      enrollment: {
        id: enrollmentRef.id,
        ...enrollmentData,
      },
      assignedSquadId,
      assignedCohortId,
    });
  } catch (error) {
    console.error('[FUNNEL_COMPLETE]', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to complete funnel: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * Extract user-relevant data from flow session data
 */
function extractUserDataFromSession(data: Record<string, unknown>): Record<string, unknown> {
  const userFields: Record<string, unknown> = {};

  // Standard fields that should be saved to user record
  if (data.goal) userFields.goal = data.goal;
  if (data.goalTargetDate) userFields.goalTargetDate = data.goalTargetDate;
  if (data.goalSummary) userFields.goalSummary = data.goalSummary;
  if (data.identity) userFields.identity = data.identity;
  if (data.workdayStyle) userFields.workdayStyle = data.workdayStyle;
  if (data.businessStage) userFields.businessStage = data.businessStage;
  if (data.obstacles) userFields.obstacles = data.obstacles;
  if (data.goalImpact) userFields.goalImpact = data.goalImpact;
  if (data.supportNeeds) userFields.supportNeeds = data.supportNeeds;

  return userFields;
}

