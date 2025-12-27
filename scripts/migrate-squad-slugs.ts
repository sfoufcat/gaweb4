/**
 * Squad Slug and Organization Migration Script
 * 
 * This script fixes legacy squads that are missing:
 * - slug (required for funnel links)
 * - organizationId (required for org-scoped queries)
 * 
 * Run with: doppler run -- npx tsx scripts/migrate-squad-slugs.ts
 * 
 * Options:
 *   --dry-run    Preview changes without making them
 *   --batch=N    Process N documents at a time (default: 50)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClerkClient } from '@clerk/backend';

// =============================================================================
// CONFIGURATION
// =============================================================================

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchArg = args.find(a => a.startsWith('--batch='));
const BATCH_SIZE = batchArg ? parseInt(batchArg.split('=')[1]) : 50;

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
  console.error('❌ CLERK_SECRET_KEY not set.');
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: clerkSecretKey });

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const prefix = isDryRun ? '[DRY RUN] ' : '';
  const icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };
  console.log(`${icons[type]} ${prefix}${message}`);
}

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
}

/**
 * Check if a slug is unique within an organization
 */
async function isSlugUnique(slug: string, organizationId: string | null, excludeSquadId: string): Promise<boolean> {
  let query = db.collection('squads').where('slug', '==', slug);
  
  if (organizationId) {
    query = query.where('organizationId', '==', organizationId);
  }
  
  const snapshot = await query.get();
  
  // Slug is unique if no docs found, or only doc found is the one we're updating
  return snapshot.empty || (snapshot.docs.length === 1 && snapshot.docs[0].id === excludeSquadId);
}

/**
 * Generate a unique slug for a squad
 */
async function generateUniqueSlug(name: string, organizationId: string | null, squadId: string): Promise<string> {
  let baseSlug = generateSlug(name);
  
  if (!baseSlug) {
    baseSlug = 'squad';
  }
  
  let slug = baseSlug;
  let counter = 1;
  
  while (!(await isSlugUnique(slug, organizationId, squadId))) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    
    if (counter > 100) {
      // Fallback: use squad ID
      slug = `squad-${squadId.substring(0, 8)}`;
      break;
    }
  }
  
  return slug;
}

/**
 * Try to find organizationId for a squad through various methods
 */
async function findOrganizationId(squad: { id: string; coachId?: string; programId?: string }): Promise<string | null> {
  // Method 1: If squad has a coachId, get the coach's organization
  if (squad.coachId) {
    try {
      const memberships = await clerk.users.getOrganizationMembershipList({
        userId: squad.coachId,
      });
      
      if (memberships.data.length > 0) {
        // Return the first organization (or the one where they're admin/owner)
        const adminMembership = memberships.data.find(
          m => m.role === 'org:admin' || m.role === 'admin'
        );
        return adminMembership?.organization.id || memberships.data[0].organization.id;
      }
    } catch (err) {
      log(`Could not fetch org for coach ${squad.coachId}: ${err}`, 'warn');
    }
  }
  
  // Method 2: If squad has a programId, get the program's organization
  if (squad.programId) {
    const programDoc = await db.collection('programs').doc(squad.programId).get();
    if (programDoc.exists) {
      const programData = programDoc.data();
      if (programData?.organizationId) {
        return programData.organizationId;
      }
    }
  }
  
  // Method 3: Check if any squad member belongs to an organization
  const membersSnapshot = await db.collection('squadMembers')
    .where('squadId', '==', squad.id)
    .limit(5)
    .get();
  
  for (const memberDoc of membersSnapshot.docs) {
    const memberData = memberDoc.data();
    if (memberData.userId) {
      try {
        const memberships = await clerk.users.getOrganizationMembershipList({
          userId: memberData.userId,
        });
        
        if (memberships.data.length > 0) {
          return memberships.data[0].organization.id;
        }
      } catch {
        // User might not exist in Clerk anymore
      }
    }
  }
  
  return null;
}

// =============================================================================
// MAIN MIGRATION
// =============================================================================

interface MigrationStats {
  total: number;
  needsSlug: number;
  needsOrgId: number;
  updatedSlug: number;
  updatedOrgId: number;
  skipped: number;
  errors: number;
}

async function migrateSquads(): Promise<void> {
  console.log('\n========================================');
  console.log('  Squad Slug & Organization Migration');
  console.log('========================================\n');
  
  if (isDryRun) {
    log('Running in DRY RUN mode - no changes will be made', 'warn');
  }
  
  const stats: MigrationStats = {
    total: 0,
    needsSlug: 0,
    needsOrgId: 0,
    updatedSlug: 0,
    updatedOrgId: 0,
    skipped: 0,
    errors: 0,
  };
  
  // Fetch all squads
  log('Fetching all squads...', 'info');
  const squadsSnapshot = await db.collection('squads').get();
  stats.total = squadsSnapshot.docs.length;
  
  log(`Found ${stats.total} squads to check`, 'info');
  
  // Process in batches
  const batches: FirebaseFirestore.DocumentSnapshot[][] = [];
  for (let i = 0; i < squadsSnapshot.docs.length; i += BATCH_SIZE) {
    batches.push(squadsSnapshot.docs.slice(i, i + BATCH_SIZE));
  }
  
  let batchNum = 0;
  for (const batch of batches) {
    batchNum++;
    log(`Processing batch ${batchNum}/${batches.length}...`, 'info');
    
    for (const doc of batch) {
      const squadId = doc.id;
      const data = doc.data();
      if (!data) continue;
      const squadName = data.name || 'Unnamed Squad';
      
      const updates: Record<string, unknown> = {};
      let needsUpdate = false;
      
      // Check if slug is missing
      if (!data.slug) {
        stats.needsSlug++;
        const newSlug = await generateUniqueSlug(squadName, data.organizationId || null, squadId);
        updates.slug = newSlug;
        needsUpdate = true;
        log(`  Squad "${squadName}" (${squadId}): Adding slug "${newSlug}"`, 'info');
      }
      
      // Check if organizationId is missing
      if (!data.organizationId) {
        stats.needsOrgId++;
        const orgId = await findOrganizationId({
          id: squadId,
          coachId: data.coachId,
          programId: data.programId,
        });
        
        if (orgId) {
          updates.organizationId = orgId;
          needsUpdate = true;
          log(`  Squad "${squadName}" (${squadId}): Adding organizationId "${orgId}"`, 'info');
        } else {
          log(`  Squad "${squadName}" (${squadId}): Could not determine organizationId`, 'warn');
        }
      }
      
      // Apply updates
      if (needsUpdate) {
        updates.updatedAt = new Date().toISOString();
        
        if (!isDryRun) {
          try {
            await db.collection('squads').doc(squadId).update(updates);
            
            if (updates.slug) stats.updatedSlug++;
            if (updates.organizationId) stats.updatedOrgId++;
          } catch (err) {
            log(`  Failed to update squad ${squadId}: ${err}`, 'error');
            stats.errors++;
          }
        } else {
          if (updates.slug) stats.updatedSlug++;
          if (updates.organizationId) stats.updatedOrgId++;
        }
      } else {
        stats.skipped++;
      }
    }
  }
  
  // Print summary
  console.log('\n========================================');
  console.log('  Migration Summary');
  console.log('========================================\n');
  
  console.log(`Total squads checked:     ${stats.total}`);
  console.log(`Squads missing slug:      ${stats.needsSlug}`);
  console.log(`Squads missing orgId:     ${stats.needsOrgId}`);
  console.log(`Slugs added:              ${stats.updatedSlug}`);
  console.log(`Organization IDs added:   ${stats.updatedOrgId}`);
  console.log(`Skipped (already ok):     ${stats.skipped}`);
  console.log(`Errors:                   ${stats.errors}`);
  
  if (isDryRun) {
    console.log('\n⚠️  This was a DRY RUN. Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Migration complete!');
  }
}

// Run the migration
migrateSquads().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

