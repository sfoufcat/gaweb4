/**
 * My Content API
 * 
 * GET /api/my-content - Get all content the user has purchased or has access to
 * 
 * Returns:
 * - Directly purchased content (user_content_purchases)
 * - Content included in enrolled programs
 * - Program enrollments
 * - Squad memberships
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { withDemoMode } from '@/lib/demo-api';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { 
  ContentPurchase,
  ProgramEnrollment,
  ContentPurchaseType,
} from '@/types';
import type { MyContentItem } from '@/types/discover';

// Collection mapping for content types
const CONTENT_COLLECTIONS: Record<ContentPurchaseType, string> = {
  event: 'events',
  article: 'articles',
  course: 'courses',
  download: 'program_downloads',
  link: 'program_links',
  video: 'discover_videos',
};

interface ContentDetails {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  thumbnailUrl?: string;
  organizationId?: string;
}

/**
 * Fetch content details from Firestore
 */
async function getContentDetails(
  contentType: ContentPurchaseType,
  contentId: string
): Promise<ContentDetails | null> {
  const collection = CONTENT_COLLECTIONS[contentType];
  if (!collection) return null;

  const doc = await adminDb.collection(collection).doc(contentId).get();
  if (!doc.exists) return null;

  const data = doc.data();
  return {
    id: doc.id,
    title: data?.title || data?.name || 'Untitled',
    description: data?.description || data?.shortDescription || data?.longDescription,
    coverImageUrl: data?.coverImageUrl,
    thumbnailUrl: data?.thumbnailUrl,
    organizationId: data?.organizationId,
  };
}

/**
 * GET /api/my-content
 * 
 * Query params:
 * - type?: 'all' | 'programs' | 'squads' | 'content' - Filter by type (default: 'all')
 */
export async function GET(request: Request) {
  try {
    // Demo mode: return demo content
    const demoData = await withDemoMode('my-content');
    if (demoData) return demoData;
    
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') || 'all';

    // MULTI-TENANCY: Get organization context from tenant domain
    const organizationId = await getEffectiveOrgId();
    const isPlatformMode = !organizationId;
    
    console.log(`[MY_CONTENT] Fetching content for user ${userId}, org: ${organizationId || 'platform'}`);

    const myContent: MyContentItem[] = [];
    const seenContentIds = new Set<string>();

    // 1. Get direct content purchases
    if (typeFilter === 'all' || typeFilter === 'content') {
      const purchasesSnapshot = await adminDb
        .collection('user_content_purchases')
        .where('userId', '==', userId)
        .orderBy('purchasedAt', 'desc')
        .get();

      for (const doc of purchasesSnapshot.docs) {
        const purchase = doc.data() as ContentPurchase;
        
        // MULTI-TENANCY: Filter by organization on tenant domains
        if (!isPlatformMode && purchase.organizationId !== organizationId) {
          continue; // Skip content from other organizations
        }
        
        const contentKey = `${purchase.contentType}:${purchase.contentId}`;
        
        if (seenContentIds.has(contentKey)) continue;
        seenContentIds.add(contentKey);

        // Fetch content details
        const details = await getContentDetails(
          purchase.contentType,
          purchase.contentId
        );

        if (details) {
          myContent.push({
            id: doc.id,
            contentType: purchase.contentType,
            contentId: purchase.contentId,
            title: details.title,
            description: details.description,
            coverImageUrl: details.coverImageUrl,
            thumbnailUrl: details.thumbnailUrl,
            organizationId: purchase.organizationId,
            purchasedAt: purchase.purchasedAt,
            includedInProgramId: purchase.includedInProgramId,
            includedInProgramName: purchase.includedInProgramName,
          });
        }
      }
    }

    // 2. Get program enrollments
    if (typeFilter === 'all' || typeFilter === 'programs') {
      try {
        // Simplified query: get all enrollments for user, then filter in memory
        // This avoids complex composite index requirements with 'in' + 'orderBy'
        const enrollmentsSnapshot = await adminDb
          .collection('program_enrollments')
          .where('userId', '==', userId)
          .get();

        // Filter to valid statuses and current organization in memory
        const validStatuses = ['active', 'upcoming', 'completed'];
        const validEnrollments = enrollmentsSnapshot.docs
          .filter(doc => {
            const data = doc.data();
            const status = data.status;
            // MULTI-TENANCY: Filter by organization on tenant domains
            if (!isPlatformMode && data.organizationId !== organizationId) {
              return false; // Skip enrollments from other organizations
            }
            return validStatuses.includes(status);
          })
          .sort((a, b) => {
            const aDate = a.data().createdAt;
            const bDate = b.data().createdAt;
            // Convert Firestore Timestamps to milliseconds for comparison
            const aMillis = aDate?.toMillis?.() ?? 0;
            const bMillis = bDate?.toMillis?.() ?? 0;
            return bMillis - aMillis; // Descending
          });

        console.log(`[MY_CONTENT] Found ${validEnrollments.length} program enrollments for user ${userId}`);

        for (const doc of validEnrollments) {
          const enrollment = doc.data() as ProgramEnrollment;
          const contentKey = `program:${enrollment.programId}`;
          
          if (seenContentIds.has(contentKey)) continue;
          seenContentIds.add(contentKey);

          // Fetch program details
          const programDoc = await adminDb
            .collection('programs')
            .doc(enrollment.programId)
            .get();

          if (programDoc.exists) {
            const program = programDoc.data();
            
            // Get coach info
            let coachName: string | undefined;
            let coachImageUrl: string | undefined;
            
            if (program?.organizationId) {
              const orgSettingsDoc = await adminDb
                .collection('org_settings')
                .doc(program.organizationId)
                .get();
              
              if (orgSettingsDoc.exists) {
                const orgSettings = orgSettingsDoc.data();
                coachName = orgSettings?.coachDisplayName;
                coachImageUrl = orgSettings?.coachAvatarUrl;
              }
            }

            myContent.push({
              id: doc.id,
              contentType: 'program',
              contentId: enrollment.programId,
              title: program?.name || 'Unknown Program',
              description: program?.description,
              coverImageUrl: program?.coverImageUrl,
              organizationId: enrollment.organizationId,
              coachName,
              coachImageUrl,
              purchasedAt: enrollment.createdAt,
            });
          } else {
            console.warn(`[MY_CONTENT] Program ${enrollment.programId} not found for enrollment ${doc.id}`);
          }
        }
      } catch (enrollmentError) {
        console.error('[MY_CONTENT] Error fetching program enrollments:', enrollmentError);
        // Continue without throwing - we want to return partial results
      }
    }

    // 3. Get squad memberships
    if (typeFilter === 'all' || typeFilter === 'squads') {
      // Get user's squad IDs from user document
      const userDoc = await adminDb.collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const squadIds = userData?.squadIds || [];

      // Also check squadMembers collection for memberships
      const membershipSnapshot = await adminDb
        .collection('squadMembers')
        .where('userId', '==', userId)
        .get();

      const memberSquadIds = membershipSnapshot.docs.map(d => d.data().squadId);
      const allSquadIds = [...new Set([...squadIds, ...memberSquadIds])];

      for (const squadId of allSquadIds) {
        const contentKey = `squad:${squadId}`;
        
        if (seenContentIds.has(contentKey)) continue;
        seenContentIds.add(contentKey);

        // Fetch squad details
        const squadDoc = await adminDb.collection('squads').doc(squadId).get();

        if (squadDoc.exists) {
          const squad = squadDoc.data();
          
          // MULTI-TENANCY: Filter by organization on tenant domains
          if (!isPlatformMode && squad?.organizationId !== organizationId) {
            continue; // Skip squads from other organizations
          }
          
          // Get membership date from squadMembers
          const memberDoc = membershipSnapshot.docs.find(d => d.data().squadId === squadId);
          const memberData = memberDoc?.data();

          myContent.push({
            id: squadId,
            contentType: 'squad',
            contentId: squadId,
            title: squad?.name || 'Unknown Squad',
            description: squad?.description,
            coverImageUrl: squad?.avatarUrl,
            organizationId: squad?.organizationId,
            purchasedAt: memberData?.createdAt || squad?.createdAt || new Date().toISOString(),
          });
        }
      }
    }

    // Sort by purchase date (most recent first)
    myContent.sort((a, b) => 
      new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
    );

    return NextResponse.json({
      items: myContent,
      totalCount: myContent.length,
      counts: {
        programs: myContent.filter(i => i.contentType === 'program').length,
        squads: myContent.filter(i => i.contentType === 'squad').length,
        courses: myContent.filter(i => i.contentType === 'course').length,
        articles: myContent.filter(i => i.contentType === 'article').length,
        events: myContent.filter(i => i.contentType === 'event').length,
        downloads: myContent.filter(i => i.contentType === 'download').length,
        links: myContent.filter(i => i.contentType === 'link').length,
        videos: myContent.filter(i => i.contentType === 'video').length,
      },
    });

  } catch (error) {
    console.error('[MY_CONTENT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

