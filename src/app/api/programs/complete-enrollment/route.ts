/**
 * Complete Program Enrollment API
 *
 * POST /api/programs/complete-enrollment
 *
 * Called after successful payment in the embedded checkout modal.
 * Creates the enrollment record and sets up squad/coaching relationships.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStreamServerClient } from '@/lib/stream-server';
import { syncAllProgramTasks } from '@/lib/program-engine';
import { ensureCohortInstanceExists, ensureEnrollmentInstanceExists } from '@/lib/program-instances';
import { generateCoachingChannelId } from '@/lib/chat-server';
import Stripe from 'stripe';
import type {
  Program,
  ProgramCohort,
  ProgramEnrollment,
  Squad,
  OrgSettings,
  ClientCoachingData,
} from '@/types';
import { checkExistingEnrollment } from '@/lib/enrollment-check';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

interface CompleteEnrollmentRequest {
  programId: string;
  paymentIntentId: string;
  cohortId?: string;
  joinCommunity?: boolean;
  startDate?: string;
}

/**
 * Find or create a squad for a group program cohort
 */
async function findOrCreateSquad(
  program: Program,
  cohort: ProgramCohort,
  userId: string
): Promise<string> {
  const squadCapacity = program.squadCapacity || 10;

  const squadsSnapshot = await adminDb
    .collection('squads')
    .where('cohortId', '==', cohort.id)
    .get();

  for (const doc of squadsSnapshot.docs) {
    const squad = doc.data() as Squad;
    const memberCount = squad.memberIds?.length || 0;
    const capacity = squad.capacity || squadCapacity;

    if (memberCount < capacity) {
      return doc.id;
    }
  }

  // Create new squad
  const squadNumber = squadsSnapshot.size + 1;
  const squadName = `${program.name} - ${cohort.name} - Squad ${squadNumber}`;
  const inviteCode = `GA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const now = new Date().toISOString();
  const squadData: Omit<Squad, 'id'> = {
    name: squadName,
    description: `Squad for ${program.name} (${cohort.name})`,
    avatarUrl: program.coverImageUrl || '',
    visibility: 'private',
    timezone: 'UTC',
    memberIds: [],
    inviteCode,
    hasCoach: true,
    coachId: null,
    organizationId: program.organizationId,
    programId: program.id,
    cohortId: cohort.id,
    capacity: squadCapacity,
    isAutoCreated: true,
    squadNumber,
    createdAt: now,
    updatedAt: now,
  };

  const squadRef = await adminDb.collection('squads').add(squadData);

  try {
    const streamClient = await getStreamServerClient();
    const channelId = `squad-${squadRef.id}`;

    const channel = streamClient.channel('messaging', channelId, {
      name: squadName,
      image: program.coverImageUrl || undefined,
      squad_id: squadRef.id,
      created_by_id: userId,
    } as Record<string, unknown>);
    await channel.create();

    await squadRef.update({ chatChannelId: channelId });
  } catch (chatError) {
    console.error(`[COMPLETE_ENROLLMENT] Failed to create chat channel:`, chatError);
  }

  return squadRef.id;
}

async function addUserToSquad(
  userId: string,
  squadId: string,
  clerkUser: { firstName?: string | null; lastName?: string | null; imageUrl?: string }
): Promise<void> {
  const now = new Date().toISOString();

  await adminDb.collection('squads').doc(squadId).update({
    memberIds: FieldValue.arrayUnion(userId),
    updatedAt: now,
  });

  // Check if squadMember record already exists
  const existingMember = await adminDb
    .collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (!existingMember.empty) {
    return;
  }

  await adminDb.collection('squadMembers').add({
    squadId,
    userId,
    roleInSquad: 'member',
    firstName: clerkUser.firstName || '',
    lastName: clerkUser.lastName || '',
    imageUrl: clerkUser.imageUrl || '',
    createdAt: now,
    updatedAt: now,
  });

  try {
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    const chatChannelId = squadDoc.data()?.chatChannelId;

    if (chatChannelId) {
      const streamClient = await getStreamServerClient();

      await streamClient.upsertUser({
        id: userId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
        image: clerkUser.imageUrl,
      });

      const channel = streamClient.channel('messaging', chatChannelId);
      await channel.addMembers([userId]);
    }
  } catch (chatError) {
    console.error(`[COMPLETE_ENROLLMENT] Failed to add user to squad chat:`, chatError);
  }
}

async function createCoachingRelationship(
  userId: string,
  program: Program,
  clerkUser: { firstName?: string | null; lastName?: string | null; imageUrl?: string; email?: string }
): Promise<void> {
  const now = new Date().toISOString();

  const clerk = await clerkClient();
  const memberships = await clerk.organizations.getOrganizationMembershipList({
    organizationId: program.organizationId,
    limit: 100,
  });

  let coachId: string | null = null;
  for (const membership of memberships.data) {
    if (membership.role === 'org:admin') {
      coachId = membership.publicUserData?.userId || null;
      break;
    }
  }

  if (!coachId) {
    console.warn(`[COMPLETE_ENROLLMENT] No coach found for organization ${program.organizationId}`);
    return;
  }

  // Update Clerk user metadata
  try {
    const currentUser = await clerk.users.getUser(userId);
    const existingMetadata = (currentUser.publicMetadata as Record<string, unknown>) || {};

    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existingMetadata,
        coaching: true,
        coachingStatus: 'active',
        coachId,
      },
    });
  } catch (metadataError) {
    console.error(`[COMPLETE_ENROLLMENT] Failed to update Clerk metadata:`, metadataError);
  }

  let chatChannelId: string | null = null;
  try {
    const streamClient = await getStreamServerClient();
    chatChannelId = generateCoachingChannelId(userId, coachId);

    const coachClerkUser = await clerk.users.getUser(coachId);
    await streamClient.upsertUsers([
      {
        id: userId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Client',
        image: clerkUser.imageUrl,
      },
      {
        id: coachId,
        name: `${coachClerkUser.firstName || ''} ${coachClerkUser.lastName || ''}`.trim() || 'Coach',
        image: coachClerkUser.imageUrl,
      },
    ]);

    const channel = streamClient.channel('messaging', chatChannelId, {
      members: [userId, coachId],
      created_by_id: userId,
      name: `${clerkUser.firstName || 'Client'} - Coaching`,
    } as Record<string, unknown>);
    await channel.create();
  } catch (chatError) {
    console.error(`[COMPLETE_ENROLLMENT] Failed to create coaching chat:`, chatError);
  }

  // Create coaching data
  const coachingDocId = `${program.organizationId}_${userId}`;
  const coachingData: Omit<ClientCoachingData, 'id'> = {
    userId,
    organizationId: program.organizationId,
    coachId,
    coachingPlan: 'monthly',
    startDate: now.split('T')[0],
    focusAreas: [],
    actionItems: [],
    nextCall: {
      datetime: null,
      timezone: 'America/New_York',
      location: 'Chat',
    },
    sessionHistory: [],
    resources: [],
    privateNotes: [],
    chatChannelId: chatChannelId || undefined,
    cachedUserFirstName: clerkUser.firstName || '',
    cachedUserLastName: clerkUser.lastName || '',
    cachedUserEmail: clerkUser.email || '',
    cachedUserImageUrl: clerkUser.imageUrl || '',
    cachedDataUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection('clientCoachingData').doc(coachingDocId).set(coachingData);

  // Update user document
  const userDocRef = adminDb.collection('users').doc(userId);
  const userDoc = await userDocRef.get();

  if (userDoc.exists) {
    await userDocRef.update({
      coachId,
      coaching: true,
      coachingStatus: 'active',
      updatedAt: now,
    });
  } else {
    await userDocRef.set({
      id: userId,
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      email: clerkUser.email || '',
      imageUrl: clerkUser.imageUrl || '',
      coachId,
      coaching: true,
      coachingStatus: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Update org_memberships
  const membershipDocId = `${program.organizationId}_${userId}`;
  const membershipRef = adminDb.collection('org_memberships').doc(membershipDocId);
  const existingMembership = await membershipRef.get();

  if (existingMembership.exists) {
    await membershipRef.update({
      coachId,
      coaching: true,
      coachingStatus: 'active',
      updatedAt: now,
    });
  } else {
    await membershipRef.set({
      id: membershipDocId,
      userId,
      organizationId: program.organizationId,
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      email: clerkUser.email || '',
      imageUrl: clerkUser.imageUrl || '',
      coachId,
      coaching: true,
      coachingStatus: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`[COMPLETE_ENROLLMENT] Created coaching relationship: user ${userId} with coach ${coachId}`);
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CompleteEnrollmentRequest;
    const { programId, paymentIntentId, cohortId, joinCommunity = true, startDate } = body;

    if (!programId || !paymentIntentId) {
      return NextResponse.json({ error: 'Program ID and Payment Intent ID are required' }, { status: 400 });
    }

    // Check if enrollment already exists for this payment
    const existingEnrollment = await adminDb
      .collection('program_enrollments')
      .where('stripePaymentIntentId', '==', paymentIntentId)
      .limit(1)
      .get();

    if (!existingEnrollment.empty) {
      const enrollment = existingEnrollment.docs[0].data() as ProgramEnrollment;
      return NextResponse.json({
        success: true,
        enrollmentId: existingEnrollment.docs[0].id,
        status: enrollment.status,
        squadId: enrollment.squadId,
        message: 'Enrollment already completed',
      });
    }

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const program = { id: programDoc.id, ...programDoc.data() } as Program;

    // Get org settings for Stripe verification
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(program.organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    if (!orgSettings?.stripeConnectAccountId) {
      return NextResponse.json({ error: 'Payment configuration error' }, { status: 400 });
    }

    // Verify payment intent
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      stripeAccount: orgSettings.stripeConnectAccountId,
    });

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    // Verify this payment belongs to the current user
    if (paymentIntent.metadata?.userId !== userId) {
      return NextResponse.json({ error: 'Payment does not belong to this user' }, { status: 403 });
    }

    // Check for existing active enrollment
    const enrollmentCheck = await checkExistingEnrollment(userId, programId, cohortId || null);
    if (enrollmentCheck.exists && !enrollmentCheck.allowReEnrollment) {
      return NextResponse.json({
        success: true,
        alreadyEnrolled: true,
        enrollmentId: enrollmentCheck.enrollment!.id,
        status: enrollmentCheck.enrollment!.status,
        squadId: enrollmentCheck.enrollment!.squadId,
        message: enrollmentCheck.reason || 'You are already enrolled in this program',
        programName: program.name,
      });
    }

    // Get cohort for group programs
    let cohort: ProgramCohort | null = null;
    if (cohortId) {
      const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
      if (cohortDoc.exists) {
        cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;
      }
    }

    // Get user info
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    // Create enrollment
    const now = new Date().toISOString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startedAt: string;
    let status: 'upcoming' | 'active';

    if (cohort) {
      // Group program - start on cohort start date
      const cohortStart = new Date(cohort.startDate);

      if (cohortStart > today) {
        startedAt = cohort.startDate;
        status = 'upcoming';
      } else {
        startedAt = now.split('T')[0];
        status = 'active';
      }
    } else {
      // Individual program
      if (startDate) {
        startedAt = startDate;
        const selectedDate = new Date(startDate);
        status = selectedDate > today ? 'upcoming' : 'active';
      } else if (program.defaultStartDate) {
        startedAt = program.defaultStartDate;
        const defaultDate = new Date(program.defaultStartDate);
        status = defaultDate > today ? 'upcoming' : 'active';
      } else {
        const hour = new Date().getHours();
        if (hour < 12) {
          startedAt = now.split('T')[0];
        } else {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          startedAt = tomorrow.toISOString().split('T')[0];
        }
        status = 'active';
      }
    }

    // Find or create squad for group programs
    let squadId: string | null = null;
    if (program.type === 'group' && cohort) {
      squadId = await findOrCreateSquad(program, cohort, userId);
      await addUserToSquad(userId, squadId, clerkUser);
    }

    // Auto-RSVP user to existing cohort events
    if (cohort?.id) {
      try {
        const eventsSnapshot = await adminDb
          .collection('events')
          .where('cohortId', '==', cohort.id)
          .where('eventType', '==', 'cohort_call')
          .get();

        const nowDate = new Date();
        for (const eventDoc of eventsSnapshot.docs) {
          const event = eventDoc.data();
          // Skip past/canceled events
          const eventEnd = event.endDateTime ? new Date(event.endDateTime) : null;
          if (event.status === 'canceled' || (eventEnd && eventEnd < nowDate)) continue;

          // Add user to attendees
          await eventDoc.ref.update({
            attendeeIds: FieldValue.arrayUnion(userId),
          });
        }
        console.log(`[COMPLETE_ENROLLMENT] Auto-RSVPed user ${userId} to ${eventsSnapshot.size} cohort events`);
      } catch (rsvpError) {
        console.error('[COMPLETE_ENROLLMENT] Auto-RSVP error:', rsvpError);
        // Continue - don't fail enrollment
      }
    }

    // Create enrollment record
    const enrollmentData: Omit<ProgramEnrollment, 'id'> = {
      userId,
      programId: program.id,
      organizationId: program.organizationId,
      cohortId: cohort?.id || null,
      squadId,
      stripePaymentIntentId: paymentIntentId,
      amountPaid: paymentIntent.amount,
      paidAt: now,
      status,
      startedAt,
      lastAssignedDayIndex: 0,
      createdAt: now,
      updatedAt: now,
    };

    const enrollmentRef = await adminDb.collection('program_enrollments').add(enrollmentData);

    // Update cohort enrollment count
    if (cohort) {
      await adminDb.collection('program_cohorts').doc(cohort.id).update({
        currentEnrollment: FieldValue.increment(1),
        updatedAt: now,
      });
    }

    // For individual programs, create coaching relationship
    if (program.type === 'individual') {
      await createCoachingRelationship(userId, program, {
        ...clerkUser,
        email: clerkUser.emailAddresses?.[0]?.emailAddress,
      });

      // Add to client community squad if enabled and user opted in
      if (program.clientCommunitySquadId && joinCommunity) {
        try {
          await addUserToSquad(userId, program.clientCommunitySquadId, clerkUser);

          await adminDb.collection('program_enrollments').doc(enrollmentRef.id).update({
            joinedCommunity: true,
          });

          console.log(`[COMPLETE_ENROLLMENT] Added user ${userId} to client community squad ${program.clientCommunitySquadId}`);
        } catch (communityError) {
          console.error(`[COMPLETE_ENROLLMENT] Failed to add user to community squad:`, communityError);
        }
      }
    }

    // Record discount usage if applicable
    if (paymentIntent.metadata?.discountCode) {
      await recordDiscountUsage(
        paymentIntent.metadata.discountCode,
        program.organizationId,
        programId,
        userId,
        paymentIntent.amount,
        parseInt(paymentIntent.metadata.discountAmountCents || '0', 10)
      );
    }

    console.log(`[COMPLETE_ENROLLMENT] Created enrollment ${enrollmentRef.id} for user ${userId} in program ${program.id}`);

    // Ensure program_instances exists and sync ALL program tasks if enrollment is active
    // This ensures entire program tasks are synced immediately without blocking response
    if (status === 'active') {
      // Fire-and-forget: run sync in background without blocking response
      setImmediate(async () => {
        try {
          // Ensure program_instances document exists before syncing
          if (cohort?.id) {
            await ensureCohortInstanceExists(program.id, cohort.id, program.organizationId);
            console.log(`[COMPLETE_ENROLLMENT] Ensured cohort instance exists for cohortId: ${cohort.id}`);
          } else {
            await ensureEnrollmentInstanceExists(program.id, enrollmentRef.id, program.organizationId);
            console.log(`[COMPLETE_ENROLLMENT] Ensured enrollment instance exists for enrollmentId: ${enrollmentRef.id}`);
          }

          console.log(`[COMPLETE_ENROLLMENT] Starting background sync of all tasks for enrollment ${enrollmentRef.id}`);
          const syncResult = await syncAllProgramTasks({
            userId,
            enrollmentId: enrollmentRef.id,
            mode: 'fill-empty',
          });
          console.log(`[COMPLETE_ENROLLMENT] Background sync completed:`, {
            enrollmentId: enrollmentRef.id,
            tasksCreated: syncResult.tasksCreated,
            daysProcessed: syncResult.daysProcessed,
            totalDays: syncResult.totalDays,
          });
        } catch (syncError) {
          console.error(`[COMPLETE_ENROLLMENT] Background sync failed for enrollment ${enrollmentRef.id}:`, syncError);
        }
      });
    }

    return NextResponse.json({
      success: true,
      enrollmentId: enrollmentRef.id,
      squadId,
      status,
      startedAt,
      programName: program.name,
      cohortName: cohort?.name,
      message:
        status === 'upcoming'
          ? `Enrolled! Program starts on ${cohort?.startDate || startedAt}`
          : 'Enrolled! Your program starts now',
    });
  } catch (error) {
    console.error('[COMPLETE_ENROLLMENT] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to complete enrollment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Record discount code usage
 */
async function recordDiscountUsage(
  code: string,
  organizationId: string,
  programId: string,
  userId: string,
  finalAmountCents: number,
  discountAmountCents: number
): Promise<void> {
  try {
    const discountsSnapshot = await adminDb
      .collection('discount_codes')
      .where('organizationId', '==', organizationId)
      .where('code', '==', code.toUpperCase())
      .limit(1)
      .get();

    if (discountsSnapshot.empty) return;

    const discountDoc = discountsSnapshot.docs[0];
    const now = new Date().toISOString();

    // Increment use count
    await discountDoc.ref.update({
      useCount: FieldValue.increment(1),
      updatedAt: now,
    });

    // Record usage
    await adminDb.collection('discount_usages').add({
      discountCodeId: discountDoc.id,
      organizationId,
      programId,
      squadId: null,
      userId,
      originalAmountCents: finalAmountCents + discountAmountCents,
      discountAmountCents,
      finalAmountCents,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('[RECORD_DISCOUNT_USAGE] Error:', error);
  }
}
