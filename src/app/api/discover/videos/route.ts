/**
 * API Route: Get Discover Videos
 *
 * GET /api/discover/videos - Get all published videos
 *
 * Multi-tenancy: If user belongs to an organization, only show org's videos.
 * Otherwise, show all videos (default GA experience).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { getThumbnailUrl } from '@/lib/bunny-stream';

export async function GET() {
  try {
    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();

    let query: FirebaseFirestore.Query = adminDb.collection('discover_videos');

    if (organizationId) {
      // User belongs to an org - show only their org's content
      query = query.where('organizationId', '==', organizationId);
    }
    // else: no org = show all content (global GA experience)

    // Only return ready videos (encoding complete)
    query = query.where('videoStatus', '==', 'ready');

    const videosSnapshot = await query.get();

    const videos = await Promise.all(
      videosSnapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Use custom thumbnail if available, otherwise get Bunny auto-generated
        let thumbnailUrl = data.customThumbnailUrl;
        if (!thumbnailUrl && data.bunnyVideoId) {
          thumbnailUrl = getThumbnailUrl(data.bunnyVideoId);
        }

        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          thumbnailUrl,
          durationSeconds: data.durationSeconds,
          priceInCents: data.priceInCents,
          currency: data.currency || 'usd',
          purchaseType: data.purchaseType || 'one-time',
          isPublic: data.isPublic !== false,
          coachName: data.coachName,
          coachImageUrl: data.coachImageUrl,
          order: data.order || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
        };
      })
    );

    // Sort by order, then by createdAt descending
    videos.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime();
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('[DISCOVER_VIDEOS] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch videos', videos: [] }, { status: 500 });
  }
}
