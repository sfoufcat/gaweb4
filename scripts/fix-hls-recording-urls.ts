/**
 * Script to fix events that have HLS playlist URLs instead of direct MP4 URLs
 *
 * Problem: Groq's Whisper API cannot process HLS streams (.m3u8). Events with
 * bunnyVideoId should have their recordingUrl set to the direct MP4 URL (/original).
 *
 * Run with: doppler run -- npx ts-node scripts/fix-hls-recording-urls.ts
 *
 * Options:
 *   --dry-run    Show what would be updated without making changes (default)
 *   --execute    Actually perform the updates
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Bunny config from env
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || 'vz-0775a2c7-585.b-cdn.net';
const BUNNY_API_BASE = 'https://video.bunnycdn.com/library';

// Initialize Firebase Admin
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = getFirestore();

interface BunnyVideoResponse {
  guid: string;
  status: number;
  length: number;
}

/**
 * Get direct MP4 URL for a Bunny video
 */
async function getDirectVideoUrl(videoId: string): Promise<string | null> {
  if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
    console.error('Missing BUNNY_STREAM_API_KEY or BUNNY_LIBRARY_ID');
    return null;
  }

  try {
    const response = await fetch(`${BUNNY_API_BASE}/${BUNNY_LIBRARY_ID}/videos/${videoId}`, {
      method: 'GET',
      headers: {
        AccessKey: BUNNY_API_KEY,
      },
    });

    if (!response.ok) {
      console.warn(`  Failed to get video ${videoId}: ${response.status}`);
      return null;
    }

    const video: BunnyVideoResponse = await response.json();

    if (video.status !== 4) {
      console.warn(`  Video ${videoId} not finished encoding (status: ${video.status})`);
      return null;
    }

    return `https://${BUNNY_CDN_HOSTNAME}/${videoId}/original`;
  } catch (error) {
    console.error(`  Error fetching video ${videoId}:`, error);
    return null;
  }
}

async function main() {
  const dryRun = !process.argv.includes('--execute');

  console.log(`\n🔧 Fix HLS Recording URLs`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --execute to apply changes)' : 'EXECUTE'}\n`);

  // Find events with bunnyVideoId that have HLS recordingUrl
  const snapshot = await db.collection('events')
    .where('bunnyVideoId', '!=', null)
    .get();

  console.log(`Found ${snapshot.size} events with bunnyVideoId\n`);

  let needsFix = 0;
  let fixed = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { bunnyVideoId, recordingUrl, title } = data;

    // Skip if recordingUrl is not HLS
    if (!recordingUrl?.endsWith('.m3u8')) {
      continue;
    }

    needsFix++;
    console.log(`📹 Event: ${doc.id}`);
    console.log(`   Title: ${title || '(no title)'}`);
    console.log(`   Bunny ID: ${bunnyVideoId}`);
    console.log(`   Current URL: ${recordingUrl}`);

    // Get direct URL
    const directUrl = await getDirectVideoUrl(bunnyVideoId);

    if (!directUrl) {
      console.log(`   ❌ Could not get direct URL\n`);
      errors++;
      continue;
    }

    console.log(`   New URL: ${directUrl}`);

    if (!dryRun) {
      try {
        await doc.ref.update({
          recordingUrl: directUrl,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`   ✅ Updated\n`);
        fixed++;
      } catch (error) {
        console.error(`   ❌ Failed to update:`, error);
        errors++;
      }
    } else {
      console.log(`   ⏭️ Would update (dry run)\n`);
      fixed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total events with bunnyVideoId: ${snapshot.size}`);
  console.log(`   Events needing fix: ${needsFix}`);
  console.log(`   ${dryRun ? 'Would fix' : 'Fixed'}: ${fixed}`);
  console.log(`   Errors: ${errors}`);

  if (dryRun && needsFix > 0) {
    console.log(`\n💡 Run with --execute to apply changes`);
  }
}

main().catch(console.error);
