import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import { getStreamServerClient } from '@/lib/stream-server';
import type { Squad, UserTrack, SquadVisibility } from '@/types';

interface SquadWithDetails extends Squad {
  coachName?: string;
  coachImageUrl?: string;
  memberCount: number;
}

/**
 * GET /api/admin/squads
 * Fetches all squads with coach names and member counts (admin/super_admin only)
 */
export async function GET() {
  try {
    // Check authorization (throws if not admin)
    await requireAdmin();

    // Fetch all squads
    const squadsSnapshot = await adminDb.collection('squads').get();
    const squads: SquadWithDetails[] = [];

    // Fetch member counts for all squads
    const membersSnapshot = await adminDb.collection('squadMembers').get();
    const memberCounts = new Map<string, number>();
    
    membersSnapshot.forEach((doc) => {
      const data = doc.data();
      const squadId = data.squadId;
      memberCounts.set(squadId, (memberCounts.get(squadId) || 0) + 1);
    });

    // Collect all coach IDs to fetch their names
    const coachIds = new Set<string>();
    squadsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.coachId) {
        coachIds.add(data.coachId);
      }
    });

    // Fetch coach details from Clerk
    const coachDetails = new Map<string, { name: string; imageUrl: string }>();
    if (coachIds.size > 0) {
      const client = await clerkClient();
      for (const coachId of coachIds) {
        try {
          const user = await client.users.getUser(coachId);
          const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
          coachDetails.set(coachId, {
            name,
            imageUrl: user.imageUrl || '',
          });
        } catch (err) {
          console.error(`Failed to fetch coach ${coachId}:`, err);
          coachDetails.set(coachId, { name: 'Unknown', imageUrl: '' });
        }
      }
    }

    squadsSnapshot.forEach((doc) => {
      const data = doc.data();
      const coachInfo = data.coachId ? coachDetails.get(data.coachId) : null;
      
      squads.push({
        id: doc.id,
        ...data,
        coachName: coachInfo?.name || undefined,
        coachImageUrl: coachInfo?.imageUrl || undefined,
        memberCount: memberCounts.get(doc.id) || 0,
      } as SquadWithDetails);
    });

    // Sort by creation date (newest first)
    squads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ squads });
  } catch (error) {
    console.error('[ADMIN_SQUADS_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * Generate a unique invite code for private squads
 * Format: GA-XXXXXX (6 alphanumeric characters)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: I, O, 0, 1
  let code = 'GA-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/admin/squads
 * Creates a new squad (admin/super_admin only)
 */
export async function POST(req: Request) {
  try {
    // Check authorization (throws if not admin)
    await requireAdmin();
    
    // Get the admin's userId for Stream Chat operations
    const { auth } = await import('@clerk/nextjs/server');
    const { userId: adminUserId } = await auth();
    if (!adminUserId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { name, description, avatarUrl, visibility, timezone, isPremium, coachId, trackId } = body as {
      name: string;
      description?: string;
      avatarUrl?: string;
      visibility?: SquadVisibility;
      timezone?: string;
      isPremium?: boolean;
      coachId?: string | null;
      trackId?: UserTrack | null;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Squad name is required' }, { status: 400 });
    }

    // Validate premium squad requirements
    if (isPremium && !coachId) {
      return NextResponse.json({ error: 'Premium squads require a coach' }, { status: 400 });
    }

    // Generate invite code for private squads
    let inviteCode: string | undefined;
    const squadVisibility = (visibility || 'public') as SquadVisibility;
    if (squadVisibility === 'private') {
      // Ensure unique invite code
      let isUnique = false;
      while (!isUnique) {
        inviteCode = generateInviteCode();
        const existing = await adminDb.collection('squads')
          .where('inviteCode', '==', inviteCode)
          .limit(1)
          .get();
        isUnique = existing.empty;
      }
    }

    // Get the creator's organizationId for multi-tenancy
    const clerk = await clerkClient();
    const adminClerkUser = await clerk.users.getUser(adminUserId);
    const organizationId = (adminClerkUser.publicMetadata as { organizationId?: string })?.organizationId || null;

    // Create squad in Firestore first to get the ID
    const now = new Date().toISOString();
    const squadRef = await adminDb.collection('squads').add({
      name: name.trim(),
      description: description?.trim() || '',
      avatarUrl: avatarUrl || '',
      visibility: squadVisibility,
      timezone: timezone || 'UTC',
      memberIds: [],
      inviteCode: inviteCode || undefined,
      isPremium: !!isPremium,
      coachId: coachId || null,
      trackId: trackId || null, // null means visible to all tracks
      organizationId, // Multi-tenancy: scope to creator's organization
      createdAt: now,
      updatedAt: now,
    });

    // Create Stream Chat channel for the squad
    const streamClient = await getStreamServerClient();
    const channelId = `squad-${squadRef.id}`;

    // Create the admin user in Stream if they don't exist (adminClerkUser already fetched above)
    await streamClient.upsertUser({
      id: adminUserId,
      name: `${adminClerkUser.firstName || ''} ${adminClerkUser.lastName || ''}`.trim() || 'Admin',
      image: adminClerkUser.imageUrl,
    });

    // If there's a coach, upsert them in Stream too
    const initialMembers = [adminUserId];
    if (coachId && coachId !== adminUserId) {
      const coachClerkUser = await clerk.users.getUser(coachId);
      await streamClient.upsertUser({
        id: coachId,
        name: `${coachClerkUser.firstName || ''} ${coachClerkUser.lastName || ''}`.trim() || 'Coach',
        image: coachClerkUser.imageUrl,
      });
      initialMembers.push(coachId);
    }

    // Create the squad group chat channel
    // Using 'messaging' type for group chat (Stream's team type requires additional config)
    const channel = streamClient.channel('messaging', channelId, {
      members: initialMembers,
      created_by_id: adminUserId,
      name: name.trim(),
      image: avatarUrl || undefined,
      // Flag to identify this as a squad channel (enables calling)
      isSquadChannel: true,
    } as Record<string, unknown>);
    await channel.create();

    // Update squad with chatChannelId
    await squadRef.update({
      chatChannelId: channelId,
    });

    const squadData: Partial<Squad> = {
      name: name.trim(),
      description: description?.trim() || '',
      avatarUrl: avatarUrl || '',
      visibility: squadVisibility,
      timezone: timezone || 'UTC',
      memberIds: [],
      inviteCode,
      isPremium: !!isPremium,
      coachId: coachId || null,
      trackId: trackId || null,
      chatChannelId: channelId,
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({ 
      success: true, 
      squad: { id: squadRef.id, ...squadData } 
    });
  } catch (error) {
    console.error('[ADMIN_SQUADS_CREATE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}

