import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import type { ClientCoachingData, FirebaseUser, Coach, CoachingPlanType, CoachingStatus } from '@/types';
import { StreamChat } from 'stream-chat';

const streamApiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const streamApiSecret = process.env.STREAM_API_SECRET!;

/**
 * GET /api/admin/coaching-clients
 * Fetches all users with coaching access for admin management
 */
export async function GET() {
  try {
    await requireAdmin();

    // Fetch all users from Clerk with coaching metadata
    const client = await clerkClient();
    const { data: allUsers } = await client.users.getUserList({
      limit: 500,
    });

    // Filter users with active coaching (check both new coachingStatus and legacy coaching flag)
    const coachingUsers = allUsers.filter((user) => {
      const metadata = user.publicMetadata as { 
        coaching?: boolean; 
        coachingStatus?: CoachingStatus;
      } | undefined;
      return metadata?.coachingStatus === 'active' || metadata?.coaching === true;
    });

    // Fetch coaching data and user details for each
    const clients = await Promise.all(
      coachingUsers.map(async (user) => {
        // Get Firebase user data
        const userDoc = await adminDb.collection('users').doc(user.id).get();
        const userData = userDoc.exists ? (userDoc.data() as FirebaseUser) : null;

        // Get coaching data
        const coachingDoc = await adminDb.collection('clientCoachingData').doc(user.id).get();
        const coachingData = coachingDoc.exists ? (coachingDoc.data() as ClientCoachingData) : null;

        // Get coach info if assigned
        let coach: Partial<Coach> | null = null;
        if (coachingData?.coachId) {
          const coachDoc = await adminDb.collection('coaches').doc(coachingData.coachId).get();
          if (coachDoc.exists) {
            const coachData = coachDoc.data() as Coach;
            coach = {
              id: coachDoc.id,
              name: coachData.name,
              firstName: coachData.firstName,
              lastName: coachData.lastName,
              imageUrl: coachData.imageUrl,
            };
          }
        }

        return {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed',
          imageUrl: user.imageUrl || '',
          timezone: userData?.timezone,
          coachId: (user.publicMetadata?.coachId as string) || coachingData?.coachId || null,
          coachingPlan: (user.publicMetadata?.coachingPlan as CoachingPlanType) || coachingData?.coachingPlan || null,
          hasCoachingData: !!coachingData,
          startDate: coachingData?.startDate,
          nextCallDateTime: coachingData?.nextCall?.datetime,
          coach,
          createdAt: user.createdAt,
        };
      })
    );

    // Sort by creation date (newest first)
    clients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('[ADMIN_COACHING_CLIENTS_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/coaching-clients
 * Assign a coach to a user and set up coaching data
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { userId, coachId, coachingPlan, organizationId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!coachId) {
      return NextResponse.json({ error: 'coachId is required' }, { status: 400 });
    }

    if (!coachingPlan || !['monthly', 'quarterly'].includes(coachingPlan)) {
      return NextResponse.json({ error: 'coachingPlan must be monthly or quarterly' }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const client = await clerkClient();

    // Verify user exists
    const user = await client.users.getUser(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify coach exists
    const coachDoc = await adminDb.collection('coaches').doc(coachId).get();
    if (!coachDoc.exists) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    const coach = coachDoc.data() as Coach;

    // Update Clerk metadata - set both new coachingStatus and legacy coaching flag
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        coaching: true, // Legacy flag
        coachingStatus: 'active' as CoachingStatus, // New field
        coachingPlan,
        coachId,
      },
    });

    // Check if coaching data already exists (using org-scoped ID)
    const coachingDocIdCheck = `${organizationId}_${userId}`;
    const existingCoachingDoc = await adminDb.collection('clientCoachingData').doc(coachingDocIdCheck).get();

    // Create or update 1:1 chat channel between coach and client
    let chatChannelId: string | undefined;
    if (streamApiKey && streamApiSecret) {
      try {
        const serverClient = StreamChat.getInstance(streamApiKey, streamApiSecret);
        
        // Create unique channel ID for this coach-client pair
        chatChannelId = `coaching-${userId}-${coachId}`.slice(0, 64);
        
        const channel = serverClient.channel('messaging', chatChannelId, {
          name: `Coaching: ${user.firstName || 'Client'}`,
          members: [userId, coachId],
          created_by_id: coachId,
        } as Record<string, unknown>);
        
        await channel.create();
        
        // Send welcome message from coach
        await channel.sendMessage({
          text: `👋 Welcome! I'm ${coach.name}, and I'll be your personal coach. I'm excited to work with you on your goals. Feel free to message me here anytime!`,
          user_id: coachId,
        });
      } catch (chatError) {
        console.error('[ADMIN_COACHING_CHAT_ERROR]', chatError);
        // Don't fail the assignment if chat fails
      }
    }

    // Use org-scoped document ID for multi-tenancy
    const coachingDocId = `${organizationId}_${userId}`;

    if (existingCoachingDoc.exists) {
      // Update existing coaching data
      await adminDb.collection('clientCoachingData').doc(coachingDocId).update({
        coachId,
        coachingPlan,
        ...(chatChannelId && { chatChannelId }),
        updatedAt: now,
      });
    } else {
      // Create new coaching data with organizationId for multi-tenancy
      const coachingData: ClientCoachingData = {
        id: coachingDocId,
        userId,
        organizationId,
        coachId,
        coachingPlan,
        startDate: now,
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
      };

      await adminDb.collection('clientCoachingData').doc(coachingDocId).set(coachingData);
    }

    return NextResponse.json({
      success: true,
      message: `Coach ${coach.name} assigned to user`,
      chatChannelId,
    });
  } catch (error) {
    console.error('[ADMIN_COACHING_ASSIGN_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

