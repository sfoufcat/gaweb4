/**
 * Migrate Existing Recordings to Bunny Storage
 *
 * Finds events with recording URLs that aren't on Bunny CDN and
 * re-downloads + uploads them to Bunny for permanent storage.
 *
 * POST /api/admin/migrate-recordings
 * Body: { dryRun?: boolean, limit?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { storeRecordingToBunny } from '@/lib/recording-storage';
import { getZoomRecordings } from '@/lib/integrations/zoom';
import { getGoogleDriveDownloadInfo } from '@/lib/integrations/google-drive';
import type { ClerkPublicMetadata, UserRole } from '@/types';

interface MigrationResult {
  eventId: string;
  provider: string;
  status: 'success' | 'failed' | 'skipped';
  oldUrl?: string;
  newUrl?: string;
  error?: string;
}

function isBunnyUrl(url: string): boolean {
  return url.includes('.b-cdn.net') || url.includes('bunnycdn');
}

export async function POST(request: NextRequest) {
  try {
    // Auth check - require super_admin
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole };
    if (publicMetadata?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun ?? true; // Default to dry run for safety
    const limit = body.limit ?? 10;

    console.log(`[MIGRATE_RECORDINGS] Starting migration (dryRun: ${dryRun}, limit: ${limit})`);

    // Find events with recording URLs that aren't Bunny URLs
    const snapshot = await adminDb.collection('events')
      .orderBy('updatedAt', 'desc')
      .limit(500)
      .get();

    const eventsToMigrate = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((event: any) => event.recordingUrl && !isBunnyUrl(event.recordingUrl))
      .slice(0, limit);

    console.log(`[MIGRATE_RECORDINGS] Found ${eventsToMigrate.length} events with non-Bunny recording URLs`);

    if (eventsToMigrate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All recordings are already on Bunny!',
        results: [],
      });
    }

    const results: MigrationResult[] = [];

    for (const event of eventsToMigrate as any[]) {
      const { id: eventId, recordingUrl, meetingProvider, organizationId, externalMeetingId } = event;

      console.log(`[MIGRATE_RECORDINGS] Processing event ${eventId} (${meetingProvider || 'stream'})...`);

      if (!organizationId) {
        results.push({
          eventId,
          provider: meetingProvider || 'unknown',
          status: 'skipped',
          error: 'No organizationId',
        });
        continue;
      }

      if (dryRun) {
        results.push({
          eventId,
          provider: meetingProvider || 'stream',
          status: 'skipped',
          oldUrl: recordingUrl.substring(0, 80),
          error: 'Dry run - would migrate',
        });
        continue;
      }

      try {
        let newUrl: string;

        if (meetingProvider === 'zoom' && externalMeetingId) {
          // Re-fetch from Zoom with auth
          const zoomResult = await getZoomRecordings(organizationId, externalMeetingId);
          if (!zoomResult.success || !zoomResult.downloadInfo) {
            throw new Error(zoomResult.error || 'No Zoom download info available');
          }
          newUrl = await storeRecordingToBunny(
            zoomResult.downloadInfo.url,
            organizationId,
            eventId,
            { Authorization: `Bearer ${zoomResult.downloadInfo.accessToken}` }
          );
        } else if (meetingProvider === 'google_meet') {
          // For Google Meet, we need the fileId - try to extract from URL or skip
          throw new Error('Google Meet migration requires manual intervention');
        } else {
          // Stream or unknown - try direct download
          newUrl = await storeRecordingToBunny(recordingUrl, organizationId, eventId);
        }

        // Update the event
        await adminDb.collection('events').doc(eventId).update({
          recordingUrl: newUrl,
          updatedAt: FieldValue.serverTimestamp(),
        });

        results.push({
          eventId,
          provider: meetingProvider || 'stream',
          status: 'success',
          oldUrl: recordingUrl.substring(0, 80),
          newUrl,
        });

        console.log(`[MIGRATE_RECORDINGS] ✅ Migrated ${eventId} to ${newUrl}`);

      } catch (error) {
        results.push({
          eventId,
          provider: meetingProvider || 'stream',
          status: 'failed',
          oldUrl: recordingUrl.substring(0, 80),
          error: error instanceof Error ? error.message : String(error),
        });

        console.error(`[MIGRATE_RECORDINGS] ❌ Failed ${eventId}:`, error);
      }

      // Rate limit to avoid overwhelming Bunny
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const summary = {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    };

    console.log(`[MIGRATE_RECORDINGS] Complete:`, summary);

    return NextResponse.json({
      success: true,
      dryRun,
      summary,
      results,
    });

  } catch (error) {
    console.error('[MIGRATE_RECORDINGS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
