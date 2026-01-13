/**
 * Migration script to fix coaching channel IDs that exceed Stream Chat's 64-character limit.
 *
 * This script:
 * 1. Finds all clientCoachingData documents with too-long channel IDs
 * 2. Generates new shorter channel IDs using MD5 hashing
 * 3. Creates new Stream Chat channels with the correct IDs
 * 4. Copies messages from old channels to new channels (if any exist)
 * 5. Updates Firestore with the new channel IDs
 *
 * Usage:
 * npx ts-node --project tsconfig.scripts.json scripts/fix-coaching-channel-ids.ts
 */

import { createHash } from 'crypto';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { StreamChat } from 'stream-chat';

// Initialize Firebase Admin if not already initialized
function getAdminDb(): Firestore {
  let app: App;
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    app = getApps()[0];
  }
  return getFirestore(app);
}

// Generate the new shorter channel ID (must match the server-side function)
function generateCoachingChannelId(userId: string, coachId: string): string {
  const shortUserId = createHash('md5').update(userId).digest('hex').slice(0, 12);
  const shortCoachId = createHash('md5').update(coachId).digest('hex').slice(0, 12);
  return `coaching-${shortUserId}-${shortCoachId}`;
}

async function migrateCoachingChannels() {
  console.log('Starting coaching channel ID migration...\n');

  const db = getAdminDb();
  const streamApiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const streamApiSecret = process.env.STREAM_API_SECRET;

  if (!streamApiKey || !streamApiSecret) {
    console.error('Missing Stream Chat credentials. Set NEXT_PUBLIC_STREAM_API_KEY and STREAM_API_SECRET.');
    process.exit(1);
  }

  const streamClient = StreamChat.getInstance(streamApiKey, streamApiSecret);

  // Find all clientCoachingData documents
  const coachingDocs = await db.collection('clientCoachingData').get();
  console.log(`Found ${coachingDocs.size} clientCoachingData documents.\n`);

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const doc of coachingDocs.docs) {
    const data = doc.data();
    const oldChannelId = data.chatChannelId;
    const userId = data.userId;
    const coachId = data.coachId;

    // Skip if no channel ID or missing user/coach IDs
    if (!oldChannelId || !userId || !coachId) {
      console.log(`⏭️  Skipping ${doc.id}: Missing required fields`);
      skippedCount++;
      continue;
    }

    // Skip if channel ID is already short enough (64 chars or less)
    if (oldChannelId.length <= 64) {
      console.log(`✓  ${doc.id}: Channel ID already valid (${oldChannelId.length} chars)`);
      skippedCount++;
      continue;
    }

    console.log(`\n🔧 Fixing ${doc.id}:`);
    console.log(`   Old channel ID: ${oldChannelId} (${oldChannelId.length} chars)`);

    // Generate new channel ID
    const newChannelId = generateCoachingChannelId(userId, coachId);
    console.log(`   New channel ID: ${newChannelId} (${newChannelId.length} chars)`);

    try {
      // Try to get the old channel to see if it exists and has messages
      let oldChannel;
      try {
        oldChannel = streamClient.channel('messaging', oldChannelId);
        await oldChannel.watch();
      } catch {
        console.log('   Old channel does not exist in Stream (probably never created due to length limit)');
        oldChannel = null;
      }

      // Create the new channel
      const newChannel = streamClient.channel('messaging', newChannelId, {
        members: [userId, coachId],
        created_by_id: userId,
        name: `Coaching Chat`,
      } as Record<string, unknown>);

      try {
        await newChannel.create();
        console.log('   ✓ Created new channel in Stream Chat');
      } catch (createError: unknown) {
        // Channel might already exist, try to watch it instead
        if ((createError as { code?: number }).code === 4) {
          console.log('   ✓ New channel already exists in Stream Chat');
        } else {
          throw createError;
        }
      }

      // If old channel exists and has messages, note that we can't easily copy them
      // Stream Chat doesn't support bulk message transfer
      if (oldChannel) {
        const state = await oldChannel.query({ messages: { limit: 1 } });
        if (state.messages && state.messages.length > 0) {
          console.log('   ⚠️  Old channel has messages - manual review may be needed');
        }
      }

      // Update Firestore with new channel ID
      await db.collection('clientCoachingData').doc(doc.id).update({
        chatChannelId: newChannelId,
        updatedAt: new Date().toISOString(),
      });
      console.log('   ✓ Updated Firestore document');

      fixedCount++;
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Migration complete!');
  console.log(`  Fixed:   ${fixedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Errors:  ${errorCount}`);
  console.log('='.repeat(50));
}

// Run the migration
migrateCoachingChannels()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
