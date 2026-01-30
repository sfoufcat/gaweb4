/**
 * Migrate Existing Recordings to Bunny Storage
 *
 * Finds events with recording URLs that aren't on Bunny CDN and
 * re-downloads + uploads them to Bunny for permanent storage.
 *
 * Usage:
 *   npx ts-node scripts/migrate-recordings-to-bunny.ts [--dry-run] [--limit N]
 *
 * Options:
 *   --dry-run   Show what would be migrated without making changes
 *   --limit N   Only process N events (for testing)
 */

import * as admin from 'firebase-admin';
import { storeRecordingToBunny } from '../src/lib/recording-storage';
import { getZoomRecordings } from '../src/lib/integrations/zoom';
import { getGoogleDriveDownloadInfo } from '../src/lib/integrations/google-drive';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

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

async function migrateRecordings(dryRun: boolean, limit?: number): Promise<void> {
  console.log('\n🎬 Migrating recordings to Bunny Storage');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`Limit: ${limit} events`);
  console.log('');

  // Find events with recording URLs that aren't Bunny URLs
  let query = db.collection('events')
    .where('recordingUrl', '!=', null)
    .orderBy('recordingUrl')
    .orderBy('updatedAt', 'desc');

  if (limit) {
    query = query.limit(limit * 3); // Fetch more since we'll filter
  }

  const snapshot = await query.get();

  const eventsToMigrate = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((event: any) => event.recordingUrl && !isBunnyUrl(event.recordingUrl))
    .slice(0, limit);

  console.log(`Found ${eventsToMigrate.length} events with non-Bunny recording URLs\n`);

  if (eventsToMigrate.length === 0) {
    console.log('✅ All recordings are already on Bunny!');
    return;
  }

  const results: MigrationResult[] = [];

  for (const event of eventsToMigrate as any[]) {
    const { id: eventId, recordingUrl, meetingProvider, organizationId, externalMeetingId } = event;

    console.log(`Processing event ${eventId} (${meetingProvider || 'stream'})...`);

    if (!organizationId) {
      results.push({
        eventId,
        provider: meetingProvider || 'unknown',
        status: 'skipped',
        error: 'No organizationId',
      });
      console.log(`  ⏭️  Skipped: No organizationId\n`);
      continue;
    }

    if (dryRun) {
      results.push({
        eventId,
        provider: meetingProvider || 'stream',
        status: 'skipped',
        oldUrl: recordingUrl.substring(0, 60) + '...',
        error: 'Dry run',
      });
      console.log(`  📋 Would migrate: ${recordingUrl.substring(0, 60)}...\n`);
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
        // For Google Meet, we'd need the fileId which we may not have stored
        // Try to download from the existing URL (may fail if it requires auth)
        throw new Error('Google Meet migration requires fileId - manual intervention needed');
      } else {
        // Stream or unknown - try direct download
        newUrl = await storeRecordingToBunny(recordingUrl, organizationId, eventId);
      }

      // Update the event
      await db.collection('events').doc(eventId).update({
        recordingUrl: newUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      results.push({
        eventId,
        provider: meetingProvider || 'stream',
        status: 'success',
        oldUrl: recordingUrl.substring(0, 60) + '...',
        newUrl,
      });
      console.log(`  ✅ Migrated to: ${newUrl}\n`);

    } catch (error) {
      results.push({
        eventId,
        provider: meetingProvider || 'stream',
        status: 'failed',
        oldUrl: recordingUrl.substring(0, 60) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`  ❌ Failed: ${error instanceof Error ? error.message : error}\n`);
    }

    // Rate limit to avoid overwhelming Bunny
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  if (failed > 0) {
    console.log('\nFailed events:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`  - ${r.eventId}: ${r.error}`));
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

migrateRecordings(dryRun, limit)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
