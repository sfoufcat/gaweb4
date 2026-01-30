/**
 * Stream Chat Coach Roles Migration Script
 *
 * Updates existing super_coach users to have 'admin' role in Stream Chat.
 * This fixes the "ReadChannel permission denied" error for coaches.
 *
 * Run with: npx ts-node --project tsconfig.json scripts/migrate-stream-coach-roles.ts
 *
 * Options:
 *   --dry-run    Preview changes without making them
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { StreamChat } from 'stream-chat';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.error('❌ Firebase credentials not set.');
      process.exit(1);
    }

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
}

const db = getFirestore();

// Initialize Stream Chat
const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error('❌ Stream API credentials not set. Need NEXT_PUBLIC_STREAM_API_KEY and STREAM_API_SECRET');
  process.exit(1);
}

const streamClient = StreamChat.getInstance(apiKey, apiSecret);

// =============================================================================
// MAIN MIGRATION
// =============================================================================

async function migrate() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Stream Chat Coach Roles Migration');
  console.log('='.repeat(60));
  console.log('');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Find all users with orgRole = 'super_coach'
  console.log('📋 Finding super_coach users...\n');

  const membershipsSnapshot = await db
    .collection('org_memberships')
    .where('orgRole', '==', 'super_coach')
    .get();

  const superCoachUserIds = new Set<string>();
  membershipsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.userId) {
      superCoachUserIds.add(data.userId);
    }
  });

  console.log(`Found ${superCoachUserIds.size} super_coach users\n`);

  if (superCoachUserIds.size === 0) {
    console.log('✅ No super_coach users to migrate');
    return;
  }

  // Update each user in Stream
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const userId of superCoachUserIds) {
    try {
      // Check current role in Stream
      const { users } = await streamClient.queryUsers({ id: userId });

      if (users.length === 0) {
        console.log(`⏭️  User ${userId} not found in Stream (will be created on next login)`);
        skipped++;
        continue;
      }

      const currentRole = users[0].role;

      if (currentRole === 'admin') {
        console.log(`✓  User ${userId} already has admin role`);
        skipped++;
        continue;
      }

      if (isDryRun) {
        console.log(`🔍 Would update ${userId}: ${currentRole || 'user'} → admin`);
        updated++;
      } else {
        await streamClient.upsertUser({
          id: userId,
          role: 'admin',
        });
        console.log(`✅ Updated ${userId}: ${currentRole || 'user'} → admin`);
        updated++;
      }
    } catch (error) {
      console.error(`❌ Failed to update ${userId}:`, error);
      failed++;
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('  Migration Summary');
  console.log('='.repeat(60));
  console.log(`  Total super_coaches: ${superCoachUserIds.size}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (already admin or not in Stream): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\n🔍 This was a dry run. Run without --dry-run to apply changes.');
  }
}

// Run the migration
migrate()
  .then(() => {
    console.log('\n✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
