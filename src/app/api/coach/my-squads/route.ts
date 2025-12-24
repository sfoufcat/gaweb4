import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { Squad, ClerkPublicMetadata, OrgRole } from '@/types';

interface SquadWithDetails extends Squad {
  coachName?: string;
  coachImageUrl?: string;
  memberCount: number;
}

/**
 * GET /api/coach/my-squads
 * Fetches squads where the current user is the assigned coach (coachId === userId)
 * 
 * Used by org coaches to see only their assigned squads (limited view)
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get role and orgRole from session claims
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole as OrgRole | undefined;

    // Check if user can access coach dashboard
    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    console.log(`[MY_SQUADS] Fetching squads for coach: ${userId}`);

    // Fetch squads where this user is the coach
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('coachId', '==', userId)
      .get();

    const squads: SquadWithDetails[] = [];
    const squadIds = squadsSnapshot.docs.map(doc => doc.id);

    console.log(`[MY_SQUADS] Found ${squadIds.length} squads for coach ${userId}`);

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

    // Get current user's details for coach info
    const client = await clerkClient();
    const currentUser = await client.users.getUser(userId);
    const coachName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown';
    const coachImageUrl = currentUser.imageUrl || '';

    // Build squads array
    squadsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      squads.push({
        id: doc.id,
        name: data.name || '',
        avatarUrl: data.avatarUrl || '',
        description: data.description,
        visibility: data.visibility || 'public',
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
        trackId: data.track,
        coachName,
        coachImageUrl,
        memberCount: memberCounts.get(doc.id) || 0,
      } as SquadWithDetails);
    });

    // Sort by creation date (newest first)
    squads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ 
      squads,
      totalCount: squads.length,
    });
  } catch (error) {
    console.error('[MY_SQUADS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}


