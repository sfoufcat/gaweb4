/**
 * Verify Program Payment API
 * 
 * POST /api/programs/verify-payment - Verify Stripe checkout session and complete enrollment
 * 
 * Called from the success page after Stripe redirect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStreamServerClient } from '@/lib/stream-server';
import Stripe from 'stripe';
import type { 
  Program, 
  ProgramCohort, 
  ProgramEnrollment, 
  Squad, 
  OrgSettings,
  ClientCoachingData,
} from '@/types';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
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
    isPremium: false,
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
    });
    await channel.create();
    
    await squadRef.update({ chatChannelId: channelId });
  } catch (chatError) {
    console.error(`[VERIFY_PAYMENT] Failed to create chat channel:`, chatError);
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
    console.error(`[VERIFY_PAYMENT] Failed to add user to squad chat:`, chatError);
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
    console.warn(`[VERIFY_PAYMENT] No coach found for organization ${program.organizationId}`);
    return;
  }

  let chatChannelId: string | null = null;
  try {
    const streamClient = await getStreamServerClient();
    chatChannelId = `coaching-${userId}-${coachId}`;
    
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
    });
    await channel.create();
  } catch (chatError) {
    console.error(`[VERIFY_PAYMENT] Failed to create coaching chat:`, chatError);
  }

  const coachingData: Omit<ClientCoachingData, 'id'> = {
    userId,
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
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection('client_coaching_data').doc(userId).set(coachingData);

  await adminDb.collection('users').doc(userId).update({
    coachId,
    updatedAt: now,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Check if enrollment already exists for this session
    const existingEnrollment = await adminDb
      .collection('program_enrollments')
      .where('stripeCheckoutSessionId', '==', sessionId)
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

    const stripe = getStripe();

    // Get session metadata to find the Connect account
    // First, try to get from our expected metadata structure
    const tempSession = await stripe.checkout.sessions.retrieve(sessionId);
    const organizationId = tempSession.metadata?.organizationId;
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    // Get the Connect account ID
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;
    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;

    if (!stripeConnectAccountId) {
      return NextResponse.json({ error: 'Payment configuration error' }, { status: 400 });
    }

    // Retrieve session from Connect account
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      { stripeAccount: stripeConnectAccountId }
    );

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    // Verify this session belongs to the current user
    if (session.metadata?.userId !== userId) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 });
    }

    const programId = session.metadata?.programId;
    const cohortId = session.metadata?.cohortId || null;

    if (!programId) {
      return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
    }

    // Get program and cohort
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const program = { id: programDoc.id, ...programDoc.data() } as Program;

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
    
    let startedAt: string;
    let status: 'upcoming' | 'active';
    
    if (cohort) {
      const cohortStart = new Date(cohort.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (cohortStart > today) {
        startedAt = cohort.startDate;
        status = 'upcoming';
      } else {
        startedAt = now.split('T')[0];
        status = 'active';
      }
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

    // Find or create squad for group programs
    let squadId: string | null = null;
    if (program.type === 'group' && cohort) {
      squadId = await findOrCreateSquad(program, cohort, userId);
      await addUserToSquad(userId, squadId, clerkUser);
    }

    // Create enrollment
    const enrollmentData: Omit<ProgramEnrollment, 'id'> = {
      userId,
      programId: program.id,
      organizationId: program.organizationId,
      cohortId: cohort?.id || null,
      squadId,
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: session.payment_intent as string,
      amountPaid: session.amount_total || program.priceInCents,
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
    }

    console.log(`[VERIFY_PAYMENT] Created enrollment ${enrollmentRef.id} for user ${userId} in program ${program.id}`);

    return NextResponse.json({
      success: true,
      enrollmentId: enrollmentRef.id,
      squadId,
      status,
      startedAt,
      programName: program.name,
      cohortName: cohort?.name,
      message: status === 'upcoming' 
        ? `Enrolled! Program starts on ${cohort?.startDate}`
        : 'Enrolled! Your program starts now',
    });
  } catch (error) {
    console.error('[VERIFY_PAYMENT] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to verify payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

