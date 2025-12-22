import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import { getEffectiveOrgId } from '@/lib/tenant/context';
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
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get user's subscription tier and track from Clerk session
    const publicMetadata = sessionClaims?.publicMetadata as { tier?: string; track?: UserTrack } | undefined;
    const userTier = publicMetadata?.tier || 'standard';
    const userTrack = publicMetadata?.track || null;
    const isPremiumUser = userTier === 'premium';

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const sort = searchParams.get('sort') || 'most_active';

    // Get user's current squad IDs to exclude them from results
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const currentSquadIds = new Set<string>();
    
    if (userData?.standardSquadId) currentSquadIds.add(userData.standardSquadId);
    if (userData?.premiumSquadId) currentSquadIds.add(userData.premiumSquadId);
    if (userData?.squadId) currentSquadIds.add(userData.squadId); // Legacy field

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

        // Fetch coach info for premium squads
        let coach: CoachInfo | null = null;
        if (data.isPremium && data.coachId) {
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

    if (isPremiumUser) {
      // Premium users see BOTH premium and standard squads
      // Build queries - filter by org if user has one
      let premiumQuery: FirebaseFirestore.Query = adminDb.collection('squads')
        .where('visibility', '==', 'public')
        .where('isPremium', '==', true);
      let standardQuery: FirebaseFirestore.Query = adminDb.collection('squads')
        .where('visibility', '==', 'public')
        .where('isPremium', '==', false);
      
      if (organizationId) {
        premiumQuery = premiumQuery.where('organizationId', '==', organizationId);
        standardQuery = standardQuery.where('organizationId', '==', organizationId);
      }
      
      const [premiumSnapshot, standardSnapshot] = await Promise.all([
        premiumQuery.get(),
        standardQuery.get(),
      ]);

      const [premiumSquadsList, standardSquadsList] = await Promise.all([
        processSquads(premiumSnapshot),
        processSquads(standardSnapshot),
      ]);

      // Group each type by track
      const premiumGrouped = groupByTrack(premiumSquadsList);
      const standardGrouped = groupByTrack(standardSquadsList);

      return NextResponse.json({
        // Premium squads grouped
        premiumTrackSquads: premiumGrouped.trackSquads,
        premiumGeneralSquads: premiumGrouped.generalSquads,
        premiumOtherTrackSquads: premiumGrouped.otherTrackSquads,
        // Standard squads grouped
        standardTrackSquads: standardGrouped.trackSquads,
        standardGeneralSquads: standardGrouped.generalSquads,
        standardOtherTrackSquads: standardGrouped.otherTrackSquads,
        // Legacy format for backward compatibility (combined)
        trackSquads: [...premiumGrouped.trackSquads, ...standardGrouped.trackSquads],
        generalSquads: [...premiumGrouped.generalSquads, ...standardGrouped.generalSquads],
        otherTrackSquads: [...premiumGrouped.otherTrackSquads, ...standardGrouped.otherTrackSquads],
        // User info
        userTier,
        isPremiumUser,
        userTrack,
        // Flag for UI to know to show separate sections
        hasDualSquadView: true,
      });
    } else {
      // Standard users see only standard squads
      let query: FirebaseFirestore.Query = adminDb.collection('squads')
        .where('visibility', '==', 'public')
        .where('isPremium', '==', false);
      
      if (organizationId) {
        query = query.where('organizationId', '==', organizationId);
      }
      
      const squadsSnapshot = await query.get();

      const squads = await processSquads(squadsSnapshot);
      const grouped = groupByTrack(squads);

      return NextResponse.json({ 
        trackSquads: grouped.trackSquads,
        generalSquads: grouped.generalSquads,
        otherTrackSquads: grouped.otherTrackSquads,
        userTier,
        isPremiumUser,
        userTrack,
        hasDualSquadView: false,
      });
    }
  } catch (error) {
    console.error('[SQUAD_DISCOVER_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
