import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Squad, UserTrack, SquadVisibility } from '@/types';

interface SquadWithDetails extends Squad {
  coachName?: string;
  coachImageUrl?: string;
  memberCount: number;
}

/**
 * GET /api/coach/org-squads
 * Fetches all squads belonging to the coach's organization
 * 
 * For multi-tenancy: Only returns squads with matching organizationId
 */
export async function GET() {
  try {
    // Check authorization and get organizationId
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_SQUADS] Fetching squads for organization: ${organizationId}`);

    // Fetch squads that belong to this organization
    // Note: For backwards compatibility, also include squads where coachId matches
    // a user in this organization (migration path for existing data)
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('organizationId', '==', organizationId)
      .get();

    const squads: SquadWithDetails[] = [];
    const squadIds = squadsSnapshot.docs.map(doc => doc.id);

    console.log(`[COACH_ORG_SQUADS] Found ${squadIds.length} squads in organization ${organizationId}`);

    // Fetch member counts for these squads
    const memberCounts = new Map<string, number>();
    if (squadIds.length > 0) {
      // Batch in chunks of 10
      for (let i = 0; i < squadIds.length; i += 10) {
        const chunk = squadIds.slice(i, i + 10);
        const membersSnapshot = await adminDb
          .collection('squadMembers')
          .where('squadId', 'in', chunk)
          .get();
        
        membersSnapshot.forEach((doc) => {
          const data = doc.data();
          const squadId = data.squadId;
          memberCounts.set(squadId, (memberCounts.get(squadId) || 0) + 1);
        });
      }
    }

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
          console.error(`[COACH_ORG_SQUADS] Failed to fetch coach ${coachId}:`, err);
          coachDetails.set(coachId, { name: 'Unknown', imageUrl: '' });
        }
      }
    }

    // Build squads array
    squadsSnapshot.forEach((doc) => {
      const data = doc.data();
      const coachInfo = data.coachId ? coachDetails.get(data.coachId) : null;
      
      squads.push({
        id: doc.id,
        name: data.name || '',
        avatarUrl: data.avatarUrl || '',
        description: data.description,
        visibility: (data.visibility as SquadVisibility) || 'public',
        timezone: data.timezone || 'UTC',
        memberIds: data.memberIds || [],
        inviteCode: data.inviteCode,
        isPremium: data.isPremium || false,
        coachId: data.coachId || null,
        organizationId: data.organizationId,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        streak: data.streak,
        avgAlignment: data.avgAlignment,
        chatChannelId: data.chatChannelId,
        track: data.track as UserTrack | undefined,
        coachName: coachInfo?.name,
        coachImageUrl: coachInfo?.imageUrl,
        memberCount: memberCounts.get(doc.id) || 0,
      } as SquadWithDetails);
    });

    // Sort by creation date (newest first)
    squads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ 
      squads,
      totalCount: squads.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_SQUADS_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
