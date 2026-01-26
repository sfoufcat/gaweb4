/**
 * Script to fix videos stuck in "encoding" or "uploading" status
 * Run with: doppler run -- npx ts-node scripts/fix-stuck-videos.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
// Inline the playback URL function to avoid module resolution issues
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || 'vz-c3b7b48f-13d.b-cdn.net';

function getPlaybackUrl(videoId: string): string {
  return `https://${BUNNY_CDN_HOSTNAME}/${videoId}/playlist.m3u8`;
}

// Initialize Firebase Admin using individual env vars
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

async function main() {
  // Find videos stuck in encoding/uploading status
  const snapshot = await db.collection('discover_videos')
    .where('videoStatus', 'in', ['encoding', 'uploading'])
    .get();

  console.log(`Found ${snapshot.size} videos in encoding/uploading status:\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`- ID: ${doc.id}`);
    console.log(`  Title: ${data.title || '(no title)'}`);
    console.log(`  Bunny ID: ${data.bunnyVideoId}`);
    console.log(`  Status: ${data.videoStatus}`);
    console.log(`  Org: ${data.organizationId}`);

    if (data.bunnyVideoId) {
      const playbackUrl = getPlaybackUrl(data.bunnyVideoId);
      console.log(`  Playback URL: ${playbackUrl}`);

      // Ask if we should fix this one
      console.log(`\n  Updating to 'ready' status...`);
      await doc.ref.update({
        videoStatus: 'ready',
        playbackUrl,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ Updated successfully\n`);
    }
    console.log('');
  }

  console.log('Done!');
}

main().catch(console.error);
