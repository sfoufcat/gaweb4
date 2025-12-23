/**
 * Migration Script: Orphan Premium Squads to Standard
 * 
 * This script migrates premium squads that have no associated program
 * to standard squads. This ensures the squad-program architecture is clean:
 * - Premium squads should always be tied to programs
 * - Standard squads are coach-created standalone communities
 * 
 * Migration logic:
 * 1. Find all squads where isPremium = true AND programId is null/missing
 * 2. Set isPremium = false for these squads
 * 3. Update user references from premiumSquadId to standardSquadId
 * 
 * Run with: npx ts-node -r tsconfig-paths/register scripts/migrate-orphan-premium-squads.ts
 * 
 * Options:
 * --dry-run     Preview changes without writing to database
 * --verbose     Show detailed progress
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
function getFirebaseAdmin(): App {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;
  
  // Try to load from environment
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.'
    );
  }
  
  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

interface MigrationStats {
  totalSquads: number;
  orphanPremiumSquads: number;
  squadsConverted: number;
  usersUpdated: number;
  errors: number;
}

async function migrateOrphanPremiumSquads(dryRun: boolean = false, verbose: boolean = false): Promise<MigrationStats> {
  const app = getFirebaseAdmin();
  const db = getFirestore(app);
  
  const stats: MigrationStats = {
    totalSquads: 0,
    orphanPremiumSquads: 0,
    squadsConverted: 0,
    usersUpdated: 0,
    errors: 0,
  };
  
  console.log('\n🚀 Starting Orphan Premium Squads Migration');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}\n`);
  
  // Get all premium squads
  const premiumSquadsSnapshot = await db.collection('squads')
    .where('isPremium', '==', true)
    .get();
  
  stats.totalSquads = premiumSquadsSnapshot.size;
  console.log(`Found ${stats.totalSquads} premium squads to check\n`);
  
  // Filter to find orphan premium squads (no programId)
  const orphanSquads = premiumSquadsSnapshot.docs.filter(doc => {
    const data = doc.data();
    return !data.programId; // null, undefined, or empty string
  });
  
  stats.orphanPremiumSquads = orphanSquads.length;
  console.log(`Found ${stats.orphanPremiumSquads} orphan premium squads (no programId)\n`);
  
  if (stats.orphanPremiumSquads === 0) {
    console.log('✅ No orphan premium squads found. Nothing to migrate.\n');
    return stats;
  }
  
  // Process each orphan squad
  for (const squadDoc of orphanSquads) {
    const squadId = squadDoc.id;
    const squadData = squadDoc.data();
    
    try {
      if (verbose) {
        console.log(`\n→ Processing squad: ${squadData.name} (${squadId})`);
        console.log(`  - Current: isPremium=${squadData.isPremium}, programId=${squadData.programId || 'null'}`);
      }
      
      // Step 1: Update the squad to standard
      if (!dryRun) {
        await db.collection('squads').doc(squadId).update({
          isPremium: false,
          updatedAt: new Date().toISOString(),
        });
      }
      
      stats.squadsConverted++;
      if (verbose) {
        console.log(`  ✓ Squad converted to standard (isPremium: false)`);
      }
      
      // Step 2: Find users with this squad as premiumSquadId and move to standardSquadId
      const usersWithThisSquad = await db.collection('users')
        .where('premiumSquadId', '==', squadId)
        .get();
      
      if (verbose && usersWithThisSquad.size > 0) {
        console.log(`  → Found ${usersWithThisSquad.size} users with this as premiumSquadId`);
      }
      
      for (const userDoc of usersWithThisSquad.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        // Check if user already has a different standard squad
        if (userData.standardSquadId && userData.standardSquadId !== squadId) {
          if (verbose) {
            console.log(`  ⚠ User ${userId} already has standardSquadId=${userData.standardSquadId}, skipping`);
          }
          continue;
        }
        
        if (!dryRun) {
          await db.collection('users').doc(userId).update({
            standardSquadId: squadId,
            premiumSquadId: null, // Clear the premium reference
            updatedAt: new Date().toISOString(),
          });
        }
        
        stats.usersUpdated++;
        if (verbose) {
          console.log(`  ✓ User ${userId}: premiumSquadId → standardSquadId`);
        }
      }
      
      // Step 3: Also update org_memberships if they exist
      const membershipsWithThisSquad = await db.collection('org_memberships')
        .where('premiumSquadId', '==', squadId)
        .get();
      
      for (const membershipDoc of membershipsWithThisSquad.docs) {
        const membershipData = membershipDoc.data();
        
        // Check if membership already has a different standard squad
        if (membershipData.squadId && membershipData.squadId !== squadId) {
          continue;
        }
        
        if (!dryRun) {
          await membershipDoc.ref.update({
            squadId: squadId, // Set as standard squad
            premiumSquadId: null, // Clear premium reference
            updatedAt: new Date().toISOString(),
          });
        }
        
        if (verbose) {
          console.log(`  ✓ Updated org_membership for user ${membershipData.userId}`);
        }
      }
      
    } catch (error) {
      stats.errors++;
      console.error(`✗ Squad ${squadId}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  try {
    const stats = await migrateOrphanPremiumSquads(dryRun, verbose);
    
    console.log('\n📊 Migration Summary');
    console.log('═'.repeat(50));
    console.log(`Total premium squads checked:     ${stats.totalSquads}`);
    console.log(`Orphan premium squads found:      ${stats.orphanPremiumSquads}`);
    console.log(`Squads converted to standard:     ${stats.squadsConverted}`);
    console.log(`User references updated:          ${stats.usersUpdated}`);
    console.log(`Errors:                           ${stats.errors}`);
    console.log('═'.repeat(50));
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made.');
      console.log('Run without --dry-run to apply changes.\n');
    } else {
      console.log('\n✅ Migration complete!\n');
    }
    
    process.exit(stats.errors > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();

