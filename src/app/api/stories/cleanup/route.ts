import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET/POST /api/stories/cleanup
 * 
 * Cron job to delete expired stories from Firestore.
 * 
 * Stories have a 24-hour TTL. This job queries for stories where
 * expiresAt < now and deletes them in batches.
 * 
 * Should run hourly: "0 * * * *"
 * 
 * Security: Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  try {
    // Validate cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON_STORIES_CLEANUP] Starting expired stories cleanup...');

    const now = new Date();
    let totalDeleted = 0;
    let batchCount = 0;
    const MAX_BATCHES = 10; // Safety limit to prevent runaway deletions
    const BATCH_SIZE = 100;

    // Delete in batches until no more expired stories or we hit the limit
    while (batchCount < MAX_BATCHES) {
      // Query for expired stories
      const expiredStoriesSnapshot = await adminDb
        .collection('feed_stories')
        .where('expiresAt', '<', now)
        .limit(BATCH_SIZE)
        .get();

      if (expiredStoriesSnapshot.empty) {
        console.log('[CRON_STORIES_CLEANUP] No more expired stories to delete');
        break;
      }

      // Delete documents in batch
      const batch = adminDb.batch();
      expiredStoriesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      const deletedCount = expiredStoriesSnapshot.docs.length;
      totalDeleted += deletedCount;
      batchCount++;

      console.log(`[CRON_STORIES_CLEANUP] Deleted batch ${batchCount}: ${deletedCount} stories`);

      // If we got fewer than BATCH_SIZE, we're done
      if (deletedCount < BATCH_SIZE) {
        break;
      }
    }

    console.log(`[CRON_STORIES_CLEANUP] Completed. Total deleted: ${totalDeleted} stories in ${batchCount} batches`);

    return NextResponse.json({
      success: true,
      message: 'Story cleanup cron completed',
      stats: {
        deletedCount: totalDeleted,
        batchesProcessed: batchCount,
      },
    });
  } catch (error) {
    console.error('[CRON_STORIES_CLEANUP] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cleanup expired stories';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}









