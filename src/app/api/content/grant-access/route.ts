/**
 * Content Access Grant API
 * 
 * POST /api/content/grant-access - Grant access to content after funnel completion
 * 
 * This API is called when a user completes a content funnel to grant them access
 * to the purchased/unlocked content. It creates a content purchase record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { 
  ContentPurchase,
  FunnelContentType,
} from '@/types';

// Collection mapping for content types
const CONTENT_COLLECTIONS: Record<FunnelContentType, string> = {
  article: 'articles',
  course: 'courses',
  event: 'events',
  download: 'downloads',
  link: 'links',
  video: 'discover_videos',
};

// Map FunnelContentType to ContentPurchaseType (they're the same but different type aliases)
type ContentPurchaseType = 'event' | 'article' | 'course' | 'download' | 'link' | 'video';

/**
 * Check if user has already purchased this content
 */
async function hasExistingPurchase(
  userId: string,
  contentType: ContentPurchaseType,
  contentId: string
): Promise<boolean> {
  const purchaseSnapshot = await adminDb
    .collection('user_content_purchases')
    .where('userId', '==', userId)
    .where('contentType', '==', contentType)
    .where('contentId', '==', contentId)
    .limit(1)
    .get();

  return !purchaseSnapshot.empty;
}

/**
 * POST /api/content/grant-access
 * 
 * Body:
 * - contentType: 'event' | 'article' | 'course' | 'download' | 'link'
 * - contentId: string
 * - sessionId?: string (funnel session ID for tracking)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contentType, contentId, sessionId } = body as {
      contentType: FunnelContentType;
      contentId: string;
      sessionId?: string;
    };

    // Validate input
    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'Missing required fields: contentType and contentId' },
        { status: 400 }
      );
    }

    const collection = CONTENT_COLLECTIONS[contentType];
    if (!collection) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // Get content data
    const contentDoc = await adminDb.collection(collection).doc(contentId).get();
    if (!contentDoc.exists) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    const contentData = contentDoc.data();
    const organizationId = contentData?.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Content is not properly configured' },
        { status: 400 }
      );
    }

    // Check if already purchased
    const alreadyPurchased = await hasExistingPurchase(userId, contentType, contentId);
    if (alreadyPurchased) {
      // Already has access, just return success
      return NextResponse.json({
        success: true,
        message: 'You already have access to this content',
        alreadyOwned: true,
      });
    }

    // Verify the funnel session if provided
    if (sessionId) {
      const sessionDoc = await adminDb.collection('flow_sessions').doc(sessionId).get();
      if (!sessionDoc.exists) {
        console.warn(`[CONTENT_GRANT_ACCESS] Session ${sessionId} not found`);
        // Don't fail, just log the warning
      } else {
        const sessionData = sessionDoc.data();
        // Could add additional validation here (e.g., check if session belongs to user)
        console.log(`[CONTENT_GRANT_ACCESS] Granting access via session ${sessionId}, funnel ${sessionData?.funnelId}`);
      }
    }

    // Create purchase record (this grants access)
    const now = new Date().toISOString();
    
    const purchaseData: Omit<ContentPurchase, 'id'> = {
      userId,
      contentType,
      contentId,
      organizationId,
      amountPaid: contentData?.priceInCents || 0,
      currency: contentData?.currency || 'usd',
      purchasedAt: now,
      createdAt: now,
      // Track that this came from a funnel
      ...(sessionId && { funnelSessionId: sessionId }),
    };

    const docRef = await adminDb.collection('user_content_purchases').add(purchaseData);

    console.log(`[CONTENT_GRANT_ACCESS] Created purchase ${docRef.id} for user ${userId}, ${contentType}/${contentId}`);

    return NextResponse.json({
      success: true,
      purchaseId: docRef.id,
      message: 'Content access granted',
    });

  } catch (error) {
    console.error('[CONTENT_GRANT_ACCESS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

