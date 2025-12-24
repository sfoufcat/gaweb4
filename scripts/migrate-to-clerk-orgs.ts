/**
 * Migrate Users to Full Clerk Organizations
 * 
 * This script migrates users to become actual Clerk Organization members.
 * 
 * What it does:
 * 1. Finds all users with publicMetadata.organizationId
 * 2. Adds them as org:member to that organization (if not already)
 * 3. Finds users in squads that have organizationId and adds them to that org
 * 
 * Usage:
 * 1. Set CLERK_SECRET_KEY in your environment (via Doppler or .env.local)
 * 2. Run: doppler run -- npx tsx scripts/migrate-to-clerk-orgs.ts
 * 
 * Options:
 * --dry-run: Preview changes without making them
 */

import { createClerkClient } from '@clerk/backend';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (if not already done)
const initAdmin = () => {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      console.error('\n❌ Error: Firebase credentials not found in environment');
      console.log('   Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
      console.log('💡 Make sure to run with Doppler:');
      console.log('   doppler run -- npx tsx scripts/migrate-to-clerk-orgs.ts\n');
      process.exit(1);
    }
  }
};

initAdmin();
const db = getFirestore();

interface MigrationStats {
  usersChecked: number;
  usersWithOrgId: number;
  usersAlreadyMembers: number;
  usersMigrated: number;
  usersFromSquads: number;
  errors: number;
}

async function migrateToClerkOrgs() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Migrate Users to Full Clerk Organizations');
  console.log('═══════════════════════════════════════════════════════════');
  
  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Initialize Clerk
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.error('\n❌ Error: CLERK_SECRET_KEY not found');
    console.log('   Run: doppler run -- npx tsx scripts/migrate-to-clerk-orgs.ts\n');
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey: clerkSecretKey });

  const stats: MigrationStats = {
    usersChecked: 0,
    usersWithOrgId: 0,
    usersAlreadyMembers: 0,
    usersMigrated: 0,
    usersFromSquads: 0,
    errors: 0,
  };

  // Cache for org memberships to avoid repeated API calls
  const orgMembershipCache = new Map<string, Set<string>>();

  async function getOrgMembers(organizationId: string): Promise<Set<string>> {
    if (orgMembershipCache.has(organizationId)) {
      return orgMembershipCache.get(organizationId)!;
    }

    try {
      const memberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId,
        limit: 500,
      });
      
      const memberIds = new Set(
        memberships.data
          .map(m => m.publicUserData?.userId)
          .filter((id): id is string => !!id)
      );
      
      orgMembershipCache.set(organizationId, memberIds);
      return memberIds;
    } catch (error) {
      console.error(`   ⚠️  Error fetching org ${organizationId} members:`, error);
      return new Set();
    }
  }

  async function addUserToOrg(
    userId: string, 
    organizationId: string, 
    source: string
  ): Promise<boolean> {
    try {
      const existingMembers = await getOrgMembers(organizationId);
      
      if (existingMembers.has(userId)) {
        console.log(`   ⏭️  ${userId} already member of ${organizationId}`);
        stats.usersAlreadyMembers++;
        return false;
      }

      if (isDryRun) {
        console.log(`   📝 Would add ${userId} to ${organizationId} (${source})`);
        stats.usersMigrated++;
        return true;
      }

      // Add as org member
      await clerk.organizations.createOrganizationMembership({
        organizationId,
        userId,
        role: 'org:member',
      });

      // Update cache
      existingMembers.add(userId);
      
      console.log(`   ✅ Added ${userId} to ${organizationId} (${source})`);
      stats.usersMigrated++;
      return true;
    } catch (error) {
      console.error(`   ❌ Error adding ${userId} to ${organizationId}:`, error);
      stats.errors++;
      return false;
    }
  }

  // =========================================================================
  // STEP 1: Migrate users with publicMetadata.organizationId
  // =========================================================================
  console.log('\n📋 Step 1: Migrating users with publicMetadata.organizationId...\n');

  let offset = 0;
  const batchSize = 100;
  let hasMore = true;

  while (hasMore) {
    const { data: users, totalCount } = await clerk.users.getUserList({
      limit: batchSize,
      offset,
    });

    if (users.length === 0) {
      hasMore = false;
      break;
    }

    for (const user of users) {
      stats.usersChecked++;
      
      const metadata = user.publicMetadata as { organizationId?: string };
      if (metadata?.organizationId) {
        stats.usersWithOrgId++;
        console.log(`\n👤 User: ${user.emailAddresses[0]?.emailAddress || user.id}`);
        console.log(`   Has organizationId: ${metadata.organizationId}`);
        
        await addUserToOrg(user.id, metadata.organizationId, 'publicMetadata');
      }
    }

    offset += batchSize;
    hasMore = offset < totalCount;
    
    if (hasMore) {
      console.log(`   ... checked ${offset}/${totalCount} users`);
    }
  }

  // =========================================================================
  // STEP 2: Find users in squads with organizationId and add them
  // =========================================================================
  console.log('\n📋 Step 2: Migrating users in organization squads...\n');

  // Get all squads with organizationId
  const squadsSnapshot = await db.collection('squads')
    .where('organizationId', '!=', null)
    .get();

  console.log(`   Found ${squadsSnapshot.size} squads with organizationId`);

  for (const squadDoc of squadsSnapshot.docs) {
    const squadData = squadDoc.data();
    const squadOrgId = squadData.organizationId;
    const squadName = squadData.name || squadDoc.id;
    const memberIds: string[] = squadData.memberIds || [];

    if (!squadOrgId || memberIds.length === 0) continue;

    console.log(`\n🏋️ Squad: ${squadName} (org: ${squadOrgId})`);
    console.log(`   Members: ${memberIds.length}`);

    for (const memberId of memberIds) {
      // Check if this user exists in Clerk
      try {
        await clerk.users.getUser(memberId);
        
        const added = await addUserToOrg(memberId, squadOrgId, `squad:${squadName}`);
        if (added) {
          stats.usersFromSquads++;
        }
      } catch (error) {
        // User might not exist in Clerk
        console.log(`   ⚠️  User ${memberId} not found in Clerk, skipping`);
      }
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Migration Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n   Users checked:          ${stats.usersChecked}`);
  console.log(`   Users with orgId:       ${stats.usersWithOrgId}`);
  console.log(`   Already org members:    ${stats.usersAlreadyMembers}`);
  console.log(`   Migrated from metadata: ${stats.usersMigrated - stats.usersFromSquads}`);
  console.log(`   Migrated from squads:   ${stats.usersFromSquads}`);
  console.log(`   Total migrated:         ${stats.usersMigrated}`);
  console.log(`   Errors:                 ${stats.errors}`);

  if (isDryRun) {
    console.log('\n🔍 This was a DRY RUN - no changes were made');
    console.log('   Remove --dry-run to perform the actual migration\n');
  } else {
    console.log('\n✅ Migration complete!\n');
    console.log('💡 Next steps:');
    console.log('   1. Users may need to sign out and back in to get new JWT');
    console.log('   2. Test coach dashboard Users tab');
    console.log('   3. Verify org-scoped content filtering\n');
  }
}

// Run the script
migrateToClerkOrgs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

