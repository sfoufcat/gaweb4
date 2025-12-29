/**
 * Fix Platform Fee Script
 * 
 * This script updates all organizations with platformFeePercent: 10 to platformFeePercent: 1
 * 
 * The original migration script set platformFeePercent to 10 (10%), but the intended
 * platform fee is 1 (1%). This script corrects that for all existing organizations.
 * 
 * Run with: doppler run -- npx tsx scripts/fix-platform-fee.ts
 * 
 * Options:
 *   --dry-run    Preview changes without making them
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
    // Fallback to individual env vars
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!projectId || !clientEmail || !privateKey) {
      console.error('Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or individual vars.');
      process.exit(1);
    }
    
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
}

const db = getFirestore();

// =============================================================================
// LOGGING HELPERS
// =============================================================================

function log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
  const prefix = {
    info: '📋',
    success: '✅',
    warn: '⚠️',
    error: '❌',
  }[type];
  
  console.log(`${prefix} ${message}`);
}

// =============================================================================
// MAIN MIGRATION FUNCTION
// =============================================================================

async function fixPlatformFee() {
  log('='.repeat(60), 'info');
  log('Fix Platform Fee Script', 'info');
  log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`, 'info');
  log('='.repeat(60), 'info');
  
  // Query all org_settings documents
  const orgSettingsSnapshot = await db.collection('org_settings').get();
  
  log(`Found ${orgSettingsSnapshot.size} organization(s) in org_settings`, 'info');
  
  let updatedCount = 0;
  let skippedCount = 0;
  const updatedOrgs: string[] = [];
  
  for (const doc of orgSettingsSnapshot.docs) {
    const data = doc.data();
    const orgId = doc.id;
    const currentFee = data.platformFeePercent;
    
    if (currentFee === 10) {
      log(`Organization ${orgId}: platformFeePercent is ${currentFee}, will update to 1`, 'warn');
      
      if (!isDryRun) {
        await db.collection('org_settings').doc(orgId).update({
          platformFeePercent: 1,
          updatedAt: new Date().toISOString(),
        });
        log(`Organization ${orgId}: Updated platformFeePercent to 1`, 'success');
      } else {
        log(`[DRY RUN] Would update organization ${orgId} from ${currentFee}% to 1%`, 'info');
      }
      
      updatedCount++;
      updatedOrgs.push(orgId);
    } else {
      log(`Organization ${orgId}: platformFeePercent is ${currentFee}, no change needed`, 'info');
      skippedCount++;
    }
  }
  
  // Summary
  log('', 'info');
  log('='.repeat(60), 'info');
  log('Summary', 'info');
  log('='.repeat(60), 'info');
  log(`Total organizations: ${orgSettingsSnapshot.size}`, 'info');
  log(`Updated: ${updatedCount}`, updatedCount > 0 ? 'success' : 'info');
  log(`Skipped (already correct): ${skippedCount}`, 'info');
  
  if (updatedOrgs.length > 0) {
    log('', 'info');
    log('Organizations updated:', 'info');
    updatedOrgs.forEach(orgId => log(`  - ${orgId}`, 'info'));
  }
  
  if (isDryRun && updatedCount > 0) {
    log('', 'warn');
    log('This was a dry run. Run without --dry-run to apply changes.', 'warn');
  }
}

// =============================================================================
// RUN
// =============================================================================

fixPlatformFee()
  .then(() => {
    log('', 'info');
    log('Script completed successfully', 'success');
    process.exit(0);
  })
  .catch((error) => {
    log(`Script failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  });

