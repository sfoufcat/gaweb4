import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { FlowSession, ProgramInvite, Program, ProgramEnrollment, NewProgramEnrollmentStatus, ProgramHabitTemplate, FrequencyType } from '@/types';
import { addUserToOrganization } from '@/lib/clerk-organizations';
import { assignUserToSquad, updateUserSquadReference } from '@/lib/squad-assignment';

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
    let assignedSquadId: string | null = targetSquadId;
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

    // Auto-assign to squad for group programs
    // This finds an existing squad with capacity or creates a new one
    if (program.type === 'group') {
      try {
        const squadResult = await assignUserToSquad({
          userId,
          programId: session.programId,
          cohortId: assignedCohortId,
          organizationId: session.organizationId,
          program,
          targetSquadId,
        });
        
        if (squadResult.squadId) {
          assignedSquadId = squadResult.squadId;
          console.log(`[FUNNEL_COMPLETE] Assigned user ${userId} to squad ${assignedSquadId} (new: ${squadResult.isNewSquad})`);
        }
      } catch (squadErr) {
        // Non-fatal - user is still enrolled, just not in a squad yet
        console.error(`[FUNNEL_COMPLETE] Failed to assign squad (non-fatal):`, squadErr);
      }
    }

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
      amountPaid: invite?.paymentStatus === 'pre_paid' ? 0 : (program.priceInCents || 0),
      status: enrollmentStatus,
      startedAt,
      lastAssignedDayIndex: 0,
      createdAt: now,
      updatedAt: now,
      // Only add optional payment fields if they have values
      ...(stripePaymentIntentId && { stripePaymentIntentId, paidAt: now }),
      ...(stripeCheckoutSessionId && { stripeCheckoutSessionId }),
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

    // Update user's squad reference if assigned
    // This is done separately to properly handle premium vs standard squad fields
    if (assignedSquadId) {
      try {
        await updateUserSquadReference(userId, assignedSquadId, true); // Premium squad for paid programs
      } catch (squadRefErr) {
        console.error(`[FUNNEL_COMPLETE] Failed to update squad reference (non-fatal):`, squadRefErr);
      }
    }

    // Add user to the Clerk organization as a member
    // This gives them proper org membership for access control
    if (session.organizationId) {
      try {
        await addUserToOrganization(userId, session.organizationId, 'org:member');
        console.log(`[FUNNEL_COMPLETE] Added user ${userId} to organization ${session.organizationId}`);
      } catch (orgError) {
        // Log but don't fail - user is still enrolled in the program
        console.error(`[FUNNEL_COMPLETE] Failed to add user to org (non-fatal):`, orgError);
      }
    }

    console.log(`[FUNNEL_COMPLETE] User ${userId} enrolled in program ${session.programId}, enrollment ${enrollmentRef.id}`);

    // Create habits from program defaults
    if (program.defaultHabits && program.defaultHabits.length > 0) {
      try {
        const habitIds = await createHabitsFromProgramDefaults(
          userId,
          session.organizationId,
          session.programId,
          program.defaultHabits
        );
        console.log(`[FUNNEL_COMPLETE] Created ${habitIds.length} habits for user ${userId} from program defaults`);
      } catch (habitErr) {
        // Non-fatal - user is still enrolled
        console.error(`[FUNNEL_COMPLETE] Failed to create habits (non-fatal):`, habitErr);
      }
    }

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

/**
 * Create habits from program default habits
 * 
 * This creates actual habit documents for the user based on the program's
 * defaultHabits templates. Only creates up to 3 habits (respects habit limit).
 */
async function createHabitsFromProgramDefaults(
  userId: string,
  organizationId: string,
  programId: string,
  defaultHabits: ProgramHabitTemplate[]
): Promise<string[]> {
  const now = new Date().toISOString();
  const habitIds: string[] = [];

  // Check existing habit count for user in this org
  const existingSnapshot = await adminDb
    .collection('habits')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .where('archived', '==', false)
    .get();

  const existingCount = existingSnapshot.size;
  const maxHabits = 3;
  const spotsAvailable = Math.max(0, maxHabits - existingCount);

  if (spotsAvailable === 0) {
    console.log(`[FUNNEL_COMPLETE] User ${userId} already has ${existingCount} habits, skipping default creation`);
    return habitIds;
  }

  // Only create as many as we have room for
  const habitsToCreate = defaultHabits.slice(0, spotsAvailable);

  for (const template of habitsToCreate) {
    // Map frequency to the Habit format
    let frequencyType: FrequencyType = 'daily';
    let frequencyValue: number | number[] = 1;

    if (template.frequency === 'daily') {
      frequencyType = 'daily';
      frequencyValue = 1;
    } else if (template.frequency === 'weekday') {
      frequencyType = 'specific_days';
      frequencyValue = [1, 2, 3, 4, 5]; // Mon-Fri
    } else if (template.frequency === 'custom') {
      frequencyType = 'specific_days';
      frequencyValue = [1, 3, 5]; // Mon, Wed, Fri default
    }

    const habitData = {
      userId,
      organizationId,
      text: template.title,
      linkedRoutine: template.description || null,
      frequencyType,
      frequencyValue,
      reminder: null,
      targetRepetitions: null,
      progress: {
        currentCount: 0,
        lastCompletedDate: null,
        completionDates: [],
        skipDates: [],
      },
      archived: false,
      status: 'active',
      source: 'program_default' as const,
      programId, // Link habit to its source program
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('habits').add(habitData);
    habitIds.push(docRef.id);
  }

  return habitIds;
}

