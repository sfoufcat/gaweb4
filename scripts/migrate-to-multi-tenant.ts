/**
 * Multi-Tenant Migration Script
 * 
 * This script migrates the existing single-tenant app to the multi-tenant architecture:
 * 
 * 1. Creates the "GrowthAddicts Platform" organization in Clerk
 * 2. Creates org_settings for the platform org
 * 3. Creates org_domains entry for the platform org
 * 4. Migrates all existing users without org membership to the platform org
 * 5. Creates org_memberships entries for all migrated users
 * 
 * Run with: npx ts-node --project tsconfig.json scripts/migrate-to-multi-tenant.ts
 * 
 * Options:
 *   --dry-run    Preview changes without making them
 *   --batch=N    Process N users at a time (default: 50)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClerkClient } from '@clerk/backend';
import type { OrgMembership, OrgSettings, UserTier, UserTrack, OrgRole } from '../src/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PLATFORM_ORG_NAME = 'GrowthAddicts Platform';
const PLATFORM_ORG_SLUG = 'growthaddicts-platform';
const PLATFORM_SUBDOMAIN = 'platform'; // For org_domains entry

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchArg = args.find(a => a.startsWith('--batch='));
const BATCH_SIZE = batchArg ? parseInt(batchArg.split('=')[1]) : 50;

// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize Firebase Admin
if (!getApps().length) {
  // Support both single JSON key and individual environment variables
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // Use individual environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!projectId || !clientEmail || !privateKey) {
      console.error('❌ Firebase credentials not set. Need either FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY');
      process.exit(1);
    }
    
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
}

const db = getFirestore();

// Initialize Clerk
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
if (!clerkSecretKey) {
  console.error('❌ CLERK_SECRET_KEY environment variable not set');
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: clerkSecretKey });

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const prefix = isDryRun ? '[DRY RUN] ' : '';
  const icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };
  console.log(`${icons[type]} ${prefix}${message}`);
}

// =============================================================================
// MIGRATION STEPS
// =============================================================================

async function createPlatformOrganization(): Promise<string> {
  log('Checking for existing platform organization...');
  
  // Check if org already exists by slug
  try {
    const existingOrgs = await clerk.organizations.getOrganizationList({
      query: PLATFORM_ORG_SLUG,
    });
    
    const existing = existingOrgs.data.find(org => org.slug === PLATFORM_ORG_SLUG);
    if (existing) {
      log(`Platform organization already exists: ${existing.id}`, 'success');
      return existing.id;
    }
  } catch (error) {
    // Organization not found, continue to create
  }
  
  if (isDryRun) {
    log(`Would create platform organization: ${PLATFORM_ORG_NAME} (${PLATFORM_ORG_SLUG})`);
    return 'dry-run-org-id';
  }
  
  log(`Creating platform organization: ${PLATFORM_ORG_NAME}`);
  
  const org = await clerk.organizations.createOrganization({
    name: PLATFORM_ORG_NAME,
    slug: PLATFORM_ORG_SLUG,
  });
  
  log(`Created platform organization: ${org.id}`, 'success');
  return org.id;
}

async function createPlatformOrgSettings(organizationId: string): Promise<void> {
  log('Checking org_settings for platform org...');
  
  const settingsRef = db.collection('org_settings').doc(organizationId);
  const settingsDoc = await settingsRef.get();
  
  if (settingsDoc.exists) {
    log('Platform org settings already exist', 'success');
    return;
  }
  
  const now = new Date().toISOString();
  const settings: OrgSettings = {
    id: organizationId,
    organizationId,
    billingMode: 'platform',
    allowExternalBilling: false,
    defaultTier: 'standard',
    defaultTrack: null,
    stripeConnectAccountId: null,
    stripeConnectStatus: 'not_connected',
    platformFeePercent: 10,
    requireApproval: false,
    autoJoinSquadId: null,
    welcomeMessage: null,
    createdAt: now,
    updatedAt: now,
  };
  
  if (isDryRun) {
    log('Would create platform org settings');
    return;
  }
  
  await settingsRef.set(settings);
  log('Created platform org settings', 'success');
}

async function createPlatformOrgDomain(organizationId: string): Promise<void> {
  log('Checking org_domains for platform org...');
  
  const domainsQuery = await db.collection('org_domains')
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();
  
  if (!domainsQuery.empty) {
    log('Platform org domain already exists', 'success');
    return;
  }
  
  const now = new Date().toISOString();
  const domainData = {
    organizationId,
    subdomain: PLATFORM_SUBDOMAIN,
    primaryDomain: `${PLATFORM_SUBDOMAIN}.growthaddicts.com`,
    createdAt: now,
    updatedAt: now,
  };
  
  if (isDryRun) {
    log(`Would create platform org domain: ${PLATFORM_SUBDOMAIN}.growthaddicts.com`);
    return;
  }
  
  await db.collection('org_domains').add(domainData);
  log(`Created platform org domain: ${PLATFORM_SUBDOMAIN}.growthaddicts.com`, 'success');
}

async function migrateExistingUsers(platformOrgId: string): Promise<void> {
  log('Fetching users without org membership...');
  
  // Get all users from Firebase
  const usersSnapshot = await db.collection('users').get();
  const totalUsers = usersSnapshot.size;
  log(`Found ${totalUsers} total users`);
  
  // Find users without org_memberships
  const usersToMigrate: Array<{
    id: string;
    tier: UserTier;
    track: UserTrack | null;
    squadId: string | null;
  }> = [];
  
  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    
    // Check if user already has any org_membership
    const membershipQuery = await db.collection('org_memberships')
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    if (membershipQuery.empty) {
      const userData = userDoc.data();
      usersToMigrate.push({
        id: userId,
        tier: (userData.tier as UserTier) || 'standard',
        track: (userData.track as UserTrack) || null,
        squadId: userData.standardSquadId || userData.squadId || null,
      });
    }
  }
  
  log(`Found ${usersToMigrate.length} users to migrate`);
  
  if (usersToMigrate.length === 0) {
    log('No users need migration', 'success');
    return;
  }
  
  // Process in batches
  let processed = 0;
  let errors = 0;
  
  for (let i = 0; i < usersToMigrate.length; i += BATCH_SIZE) {
    const batch = usersToMigrate.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(usersToMigrate.length / BATCH_SIZE);
    
    log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} users)...`);
    
    for (const user of batch) {
      try {
        await migrateUser(user, platformOrgId);
        processed++;
      } catch (error) {
        errors++;
        log(`Failed to migrate user ${user.id}: ${error}`, 'error');
      }
    }
    
    // Rate limiting - wait between batches
    if (i + BATCH_SIZE < usersToMigrate.length) {
      await sleep(1000);
    }
  }
  
  log(`Migration complete: ${processed} users migrated, ${errors} errors`, errors > 0 ? 'warn' : 'success');
}

async function migrateUser(
  user: { id: string; tier: UserTier; track: UserTrack | null; squadId: string | null },
  platformOrgId: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // Create org_membership
  const membership: Omit<OrgMembership, 'id'> = {
    userId: user.id,
    organizationId: platformOrgId,
    orgRole: 'member' as OrgRole,
    tier: user.tier,
    track: user.track,
    squadId: user.squadId,
    premiumSquadId: null,
    accessSource: 'platform_billing',
    accessExpiresAt: null,
    inviteCodeUsed: null,
    isActive: true,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  
  if (isDryRun) {
    log(`  Would migrate user ${user.id} (tier: ${user.tier}, track: ${user.track || 'none'})`);
    return;
  }
  
  // Create the membership document
  const membershipRef = await db.collection('org_memberships').add(membership);
  await membershipRef.update({ id: membershipRef.id });
  
  // Add user to Clerk organization
  try {
    await clerk.organizations.createOrganizationMembership({
      organizationId: platformOrgId,
      userId: user.id,
      role: 'org:member',
    });
  } catch (error: unknown) {
    // User might already be a member
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('already a member')) {
      throw error;
    }
  }
  
  // Update user's publicMetadata with primaryOrganizationId
  try {
    const clerkUser = await clerk.users.getUser(user.id);
    const currentMetadata = clerkUser.publicMetadata as Record<string, unknown>;
    
    await clerk.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...currentMetadata,
        primaryOrganizationId: platformOrgId,
        // Keep legacy field for backward compatibility
        organizationId: platformOrgId,
        orgRole: 'member',
      },
    });
  } catch (error) {
    log(`  Warning: Could not update Clerk metadata for ${user.id}`, 'warn');
  }
  
  // Update Firebase user with primaryOrganizationId
  await db.collection('users').doc(user.id).update({
    primaryOrganizationId: platformOrgId,
    updatedAt: now,
  });
  
  log(`  Migrated user ${user.id}`, 'success');
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Multi-Tenant Migration Script');
  console.log('='.repeat(60));
  console.log('');
  
  if (isDryRun) {
    log('Running in DRY RUN mode - no changes will be made', 'warn');
    console.log('');
  }
  
  try {
    // Step 1: Create platform organization
    const platformOrgId = await createPlatformOrganization();
    console.log('');
    
    // Step 2: Create org_settings
    await createPlatformOrgSettings(platformOrgId);
    console.log('');
    
    // Step 3: Create org_domains entry
    await createPlatformOrgDomain(platformOrgId);
    console.log('');
    
    // Step 4: Migrate existing users
    await migrateExistingUsers(platformOrgId);
    console.log('');
    
    console.log('='.repeat(60));
    log('Migration completed successfully!', 'success');
    console.log('='.repeat(60));
    console.log('');
    
    if (isDryRun) {
      log('This was a dry run. Run without --dry-run to apply changes.', 'info');
    }
  } catch (error) {
    console.log('');
    log(`Migration failed: ${error}`, 'error');
    process.exit(1);
  }
}

main().catch(console.error);

