import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { FieldValue } from 'firebase-admin/firestore';
import type { StoryContentData } from '@/hooks/useStoryViewTracking';

/**
 * POST /api/story-views
 * Record that the current user viewed a story
 *
 * MULTI-TENANCY: Story views are scoped per organization
 *
 * Body:
 *   - storyOwnerId: string - ID of user whose story was viewed
 *   - contentData: StoryContentData - snapshot of content state when viewed
 */
export async function POST(request: NextRequest) {
  try {
    // Demo mode: simulate success but don't actually save
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoResponse({ success: true });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const { storyOwnerId, contentData } = body;

    if (!storyOwnerId || !contentData) {
      return NextResponse.json(
        { error: 'storyOwnerId and contentData are required' },
        { status: 400 }
      );
    }

    // Composite document ID ensures one record per viewer+owner+org
    const docId = `${userId}_${storyOwnerId}_${organizationId}`;

    await adminDb.collection('story_views').doc(docId).set({
      viewerId: userId,
      storyOwnerId,
      organizationId,
      contentData,
      viewedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording story view:', error);
    const message = error instanceof Error ? error.message : 'Failed to record story view';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/story-views
 * Get view status for the current user viewing one or more story owners
 *
 * MULTI-TENANCY: Only returns views within the current organization
 *
 * Query params:
 *   - storyOwnerIds: comma-separated list of user IDs to check
 */
export async function GET(request: NextRequest) {
  try {
    // Demo mode: return empty views (localStorage will be primary source)
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoResponse({ views: {} });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const storyOwnerIdsParam = searchParams.get('storyOwnerIds');

    if (!storyOwnerIdsParam) {
      return NextResponse.json({ error: 'storyOwnerIds query param required' }, { status: 400 });
    }

    const storyOwnerIds = storyOwnerIdsParam.split(',').filter(Boolean);

    if (storyOwnerIds.length === 0) {
      return NextResponse.json({ views: {} });
    }

    // Batch fetch all view records
    const views: Record<string, StoryContentData | null> = {};

    // Fetch in parallel
    const docPromises = storyOwnerIds.map(async (ownerId) => {
      const docId = `${userId}_${ownerId}_${organizationId}`;
      const doc = await adminDb.collection('story_views').doc(docId).get();
      return { ownerId, data: doc.exists ? doc.data() : null };
    });

    const results = await Promise.all(docPromises);

    for (const { ownerId, data } of results) {
      views[ownerId] = data?.contentData || null;
    }

    return NextResponse.json({ views });
  } catch (error) {
    console.error('Error fetching story views:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch story views';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
