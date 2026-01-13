import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { generateCoachingChannelId } from '@/lib/chat-server';
import type { ClientCoachingData, Program, ProgramEnrollment } from '@/types';

/**
 * POST /api/user/sync-coaching-channel
 *
 * Creates or syncs the coaching chat channel for users enrolled in individual programs.
 * This is a backfill endpoint for users whose coaching channel wasn't created during enrollment.
 *
 * Returns:
 * - chatChannelId: The coaching channel ID (existing or newly created)
 * - created: Whether a new channel was created
 * - message: Status message
 */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({
        error: 'Organization context required',
        message: 'This endpoint only works on organization domains'
      }, { status: 400 });
    }

    // Check if user has an active individual program enrollment
    // Use simple userId query and filter in memory to avoid index requirements
    const allEnrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .get();

    // Filter to active enrollments in this org
    const enrollmentDocs = allEnrollmentsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.organizationId === organizationId && data.status === 'active';
    });

    const enrollmentsSnapshot = {
      empty: enrollmentDocs.length === 0,
      docs: enrollmentDocs
    };

    if (enrollmentsSnapshot.empty) {
      return NextResponse.json({
        error: 'No active enrollments',
        message: 'User has no active program enrollments in this organization'
      }, { status: 404 });
    }

    // Find an individual program enrollment
    let individualEnrollment: ProgramEnrollment | null = null;
    let program: Program | null = null;

    for (const doc of enrollmentsSnapshot.docs) {
      const enrollment = { id: doc.id, ...doc.data() } as ProgramEnrollment;
      const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();

      if (programDoc.exists) {
        const p = { id: programDoc.id, ...programDoc.data() } as Program;
        if (p.type === 'individual') {
          individualEnrollment = enrollment;
          program = p;
          break;
        }
      }
    }

    if (!individualEnrollment || !program) {
      return NextResponse.json({
        error: 'No individual program',
        message: 'User is not enrolled in any individual (1:1) programs'
      }, { status: 404 });
    }

    // Get the coach ID from the organization (super_coach/admin)
    const clerk = await clerkClient();
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId,
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
      return NextResponse.json({
        error: 'No coach found',
        message: 'Could not find org admin (coach) in the organization'
      }, { status: 400 });
    }

    // Check existing clientCoachingData
    const coachingDocId = `${organizationId}_${userId}`;
    const coachingDocRef = adminDb.collection('clientCoachingData').doc(coachingDocId);
    const coachingDoc = await coachingDocRef.get();

    let existingChannelId: string | null = null;
    if (coachingDoc.exists) {
      const data = coachingDoc.data() as ClientCoachingData;
      existingChannelId = data.chatChannelId || null;
    }

    // If channel already exists, verify it's valid in Stream Chat
    if (existingChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', existingChannelId);
        await channel.watch();

        // Channel exists and is valid
        return NextResponse.json({
          chatChannelId: existingChannelId,
          created: false,
          message: 'Coaching channel already exists'
        });
      } catch {
        // Channel doesn't exist in Stream, need to recreate
        console.log(`[SYNC_COACHING] Channel ${existingChannelId} not found in Stream, will recreate`);
      }
    }

    // Create the coaching channel
    // Note: clerk already initialized above when getting coach ID
    const streamClient = await getStreamServerClient();

    // Get user info
    const clerkUser = await clerk.users.getUser(userId);
    const coachUser = await clerk.users.getUser(coachId);

    // Upsert both users in Stream
    await streamClient.upsertUsers([
      {
        id: userId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Client',
        image: clerkUser.imageUrl,
      },
      {
        id: coachId,
        name: `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach',
        image: coachUser.imageUrl,
      },
    ]);

    // Create the channel with a shorter ID (Stream Chat has 64 char limit)
    // Use hashed user IDs to ensure uniqueness while staying under limit
    const chatChannelId = generateCoachingChannelId(userId, coachId);
    const channel = streamClient.channel('messaging', chatChannelId, {
      members: [userId, coachId],
      created_by_id: userId,
      name: `${clerkUser.firstName || 'Client'} - Coaching`,
    } as Record<string, unknown>);

    await channel.create();
    console.log(`[SYNC_COACHING] Created coaching channel ${chatChannelId}`);

    // Update or create the clientCoachingData document
    const now = new Date().toISOString();
    if (coachingDoc.exists) {
      await coachingDocRef.update({
        chatChannelId,
        updatedAt: now,
      });
    } else {
      await coachingDocRef.set({
        userId,
        organizationId,
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
        chatChannelId,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      chatChannelId,
      created: true,
      message: 'Coaching channel created successfully'
    });

  } catch (error) {
    console.error('[SYNC_COACHING_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({
      error: 'Internal Error',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}

/**
 * GET /api/user/sync-coaching-channel
 *
 * Check the current status of the coaching channel without modifying anything.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({
        organizationId: null,
        hasIndividualEnrollment: false,
        coachingDocExists: false,
        chatChannelId: null,
      });
    }

    // Check for individual enrollment
    // Use simple userId query and filter in memory to avoid index requirements
    const allEnrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .get();

    const enrollmentDocs = allEnrollmentsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.organizationId === organizationId && data.status === 'active';
    });

    let hasIndividualEnrollment = false;
    let programName: string | null = null;

    for (const doc of enrollmentDocs) {
      const enrollment = doc.data() as ProgramEnrollment;
      const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();

      if (programDoc.exists) {
        const program = programDoc.data() as Program;
        if (program.type === 'individual') {
          hasIndividualEnrollment = true;
          programName = program.name;
          break;
        }
      }
    }

    // Get coach ID from org membership
    let coachId: string | null = null;
    if (hasIndividualEnrollment) {
      const clerk = await clerkClient();
      const memberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId,
        limit: 100,
      });
      for (const membership of memberships.data) {
        if (membership.role === 'org:admin') {
          coachId = membership.publicUserData?.userId || null;
          break;
        }
      }
    }

    // Check clientCoachingData
    const coachingDocId = `${organizationId}_${userId}`;
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(coachingDocId).get();

    let coachingDocExists = false;
    let chatChannelId: string | null = null;

    if (coachingDoc.exists) {
      coachingDocExists = true;
      const data = coachingDoc.data() as ClientCoachingData;
      chatChannelId = data.chatChannelId || null;
    }

    return NextResponse.json({
      organizationId,
      hasIndividualEnrollment,
      programName,
      coachId,
      coachingDocId,
      coachingDocExists,
      chatChannelId,
      needsSync: hasIndividualEnrollment && !chatChannelId,
    });

  } catch (error) {
    console.error('[SYNC_COACHING_STATUS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
