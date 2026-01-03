import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { getDemoSquads } from '@/lib/demo-data';
import type { Squad, UserTrack } from '@/types';

interface CoachInfo {
  id: string;
  name: string;
  imageUrl: string;
}

interface PublicSquad extends Squad {
  memberCount: number;
  memberAvatars: string[];
  coach?: CoachInfo | null;
}

/**
 * GET /api/squad/discover
 * Fetches public squads for the discovery page.
 * 
 * DUAL SQUAD SUPPORT:
 * - Premium users see BOTH premium squads AND standard squads
 * - Standard users see only standard squads
 * - Squads user is already in are excluded
 * 
 * Response structure for premium users:
 * - premiumSquads: Premium squads grouped by track
 * - standardSquads: Standard squads grouped by track
 * 
 * Response structure for standard users:
 * - trackSquads: Standard squads matching user's track
 * - generalSquads: Standard squads with no track
 * - otherTrackSquads: Standard squads with different track
 * 
 * Query params:
 * - search: Filter by squad name (case-insensitive)
 * - sort: 'most_active' | 'most_members' | 'newest' | 'alphabetical'
 */
export async function GET(req: Request) {
  try {
    // Demo mode: return demo squads
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const demoSquads = getDemoSquads();
      const publicSquads = demoSquads.map(s => ({
        ...s,
        memberCount: Math.floor(Math.random() * 15) + 3,
        memberAvatars: [
          'https://ui-avatars.com/api/?name=Sarah+J&background=7c9885&color=fff&size=64&bold=true',
          'https://ui-avatars.com/api/?name=Mike+W&background=6b7db3&color=fff&size=64&bold=true',
          'https://ui-avatars.com/api/?name=Emma+D&background=b87a5e&color=fff&size=64&bold=true',
        ],
        coach: null,
      }));
      
      return demoResponse({
        trackSquads: [],
        generalSquads: publicSquads,
        otherTrackSquads: [],
        premiumSquads: [],
        standardSquads: publicSquads,
        userTrack: null,
      });
    }

    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get user's track from Clerk session (tier deprecated)
    const publicMetadata = sessionClaims?.publicMetadata as { track?: UserTrack } | undefined;
    const userTrack = publicMetadata?.track || null;

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const sort = searchParams.get('sort') || 'most_active';

    // Get user's current squad IDs to exclude them from results
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const currentSquadIds = new Set<string>();
    
    // Add squadIds array
    if (userData?.squadIds && Array.isArray(userData.squadIds)) {
      userData.squadIds.forEach((id: string) => currentSquadIds.add(id));
    }
    // Legacy fields
    if (userData?.standardSquadId) currentSquadIds.add(userData.standardSquadId);
    if (userData?.premiumSquadId) currentSquadIds.add(userData.premiumSquadId);
    if (userData?.squadId) currentSquadIds.add(userData.squadId);

    // Helper to process squads from a query
    async function processSquads(squadsSnapshot: FirebaseFirestore.QuerySnapshot): Promise<PublicSquad[]> {
      const squads: PublicSquad[] = [];
      
      for (const doc of squadsSnapshot.docs) {
        // Skip squads user is already in
        if (currentSquadIds.has(doc.id)) {
          continue;
        }
        
        const data = doc.data() as Squad;
        
        // Apply search filter
        if (search && !data.name.toLowerCase().includes(search)) {
          continue;
        }

        // Get member count from squadMembers collection
        const membersSnapshot = await adminDb.collection('squadMembers')
          .where('squadId', '==', doc.id)
          .get();
        
        // Filter out coach from members for avatar display
        const nonCoachMembers = membersSnapshot.docs.filter(
          memberDoc => memberDoc.data().userId !== data.coachId
        );
        const memberCount = nonCoachMembers.length;
        
        // Skip squads that are at capacity
        if (memberCount >= MAX_SQUAD_MEMBERS) {
          continue;
        }
        
        // Fetch first 4 member avatars from squadMembers (excluding coach)
        const memberAvatars: string[] = [];
        const memberDocs = nonCoachMembers.slice(0, 4);
        
        for (const memberDoc of memberDocs) {
          const memberData = memberDoc.data();
          if (memberData.imageUrl) {
            memberAvatars.push(memberData.imageUrl);
          } else if (memberData.userId) {
            const memberUserDoc = await adminDb.collection('users').doc(memberData.userId).get();
            if (memberUserDoc.exists) {
              const memberUserData = memberUserDoc.data();
              memberAvatars.push(memberUserData?.avatarUrl || memberUserData?.imageUrl || '');
            }
          }
        }

        // Fetch coach info for coached squads
        let coach: CoachInfo | null = null;
        const hasCoach = !!data.coachId;
        if (hasCoach && data.coachId) {
          const coachDoc = await adminDb.collection('users').doc(data.coachId).get();
          if (coachDoc.exists) {
            const coachData = coachDoc.data();
            coach = {
              id: data.coachId,
              name: `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || 'Coach',
              imageUrl: coachData?.avatarUrl || coachData?.imageUrl || '',
            };
          }
        }

        squads.push({
          ...data,
          id: doc.id,
          memberCount,
          memberAvatars,
          coach,
        });
      }
      
      return squads;
    }

    // Sort function
    const sortSquads = (list: PublicSquad[]) => {
      switch (sort) {
        case 'most_active':
          return [...list].sort((a, b) => {
            const aScore = a.avgAlignment || a.memberCount;
            const bScore = b.avgAlignment || b.memberCount;
            return bScore - aScore;
          });
        case 'most_members':
          return [...list].sort((a, b) => b.memberCount - a.memberCount);
        case 'newest':
          return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        case 'alphabetical':
          return [...list].sort((a, b) => a.name.localeCompare(b.name));
        default:
          return list;
      }
    };

    // Group squads by track
    const groupByTrack = (squads: PublicSquad[]) => {
      const trackSquads = userTrack 
        ? sortSquads(squads.filter(s => s.trackId === userTrack))
        : [];
      const generalSquads = sortSquads(squads.filter(s => !s.trackId));
      const otherTrackSquads = sortSquads(squads.filter(s => s.trackId && s.trackId !== userTrack));
      return { trackSquads, generalSquads, otherTrackSquads };
    };

    // All users can see all public squads (tier restrictions removed)
    let query: FirebaseFirestore.Query = adminDb.collection('squads')
      .where('visibility', '==', 'public');
    
    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }
    
    const squadsSnapshot = await query.get();

    const squads = await processSquads(squadsSnapshot);
    
    // Separate into coached and non-coached squads
    const coachedSquads = squads.filter(s => !!s.coachId);
    const nonCoachedSquads = squads.filter(s => !s.coachId);
    
    // Group each type by track
    const coachedGrouped = groupByTrack(coachedSquads);
    const nonCoachedGrouped = groupByTrack(nonCoachedSquads);

    return NextResponse.json({
      // Coached squads grouped (squads with a coach)
      coachedTrackSquads: coachedGrouped.trackSquads,
      coachedGeneralSquads: coachedGrouped.generalSquads,
      coachedOtherTrackSquads: coachedGrouped.otherTrackSquads,
      // Non-coached squads grouped (peer-led squads)
      peerTrackSquads: nonCoachedGrouped.trackSquads,
      peerGeneralSquads: nonCoachedGrouped.generalSquads,
      peerOtherTrackSquads: nonCoachedGrouped.otherTrackSquads,
      // Legacy format for backward compatibility (combined)
      trackSquads: [...coachedGrouped.trackSquads, ...nonCoachedGrouped.trackSquads],
      generalSquads: [...coachedGrouped.generalSquads, ...nonCoachedGrouped.generalSquads],
      otherTrackSquads: [...coachedGrouped.otherTrackSquads, ...nonCoachedGrouped.otherTrackSquads],
      // User info
      userTrack,
    });
  } catch (error) {
    console.error('[SQUAD_DISCOVER_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
