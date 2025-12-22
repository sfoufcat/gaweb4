/**
 * Organization-Scoped Data Migration Script
 * 
 * This script migrates existing data to the new organization-scoped structure:
 * 
 * 1. Add organizationId to existing tasks, habits, notifications
 * 2. Migrate user subcollection check-ins to top-level collections:
 *    - users/{userId}/checkins -> morning_checkins (with organizationId)
 *    - users/{userId}/eveningCheckins -> evening_checkins (with organizationId)
 *    - users/{userId}/weeklyReflections -> weekly_reflections (with organizationId)
 *    - users/{userId}/reflections -> reflections (with organizationId)
 * 3. Migrate user-level goal/profile data to org_memberships:
 *    - goal, goalStartDate, targetDate, identity, bio -> org_memberships
 * 4. Add organizationId to userAlignment documents
 * 5. Add organizationId to clientCoachingData
 * 
 * Run with: doppler run -- npx tsx scripts/migrate-data-to-org-scoped.ts
 * 
 * Options:
 *   --dry-run    Preview changes without making them
 *   --batch=N    Process N documents at a time (default: 100)
 *   --only=X     Only run specific migration (tasks|habits|notifications|checkins|goals|alignment|coaching)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, WriteBatch } from 'firebase-admin/firestore';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchArg = args.find(a => a.startsWith('--batch='));
const BATCH_SIZE = batchArg ? parseInt(batchArg.split('=')[1]) : 100;
const onlyArg = args.find(a => a.startsWith('--only='));
const ONLY_MIGRATION = onlyArg ? onlyArg.split('=')[1] : null;

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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const prefix = isDryRun ? '[DRY RUN] ' : '';
  const icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };
  console.log(`${icons[type]} ${prefix}${message}`);
}

interface MigrationStats {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
}

function createStats(): MigrationStats {
  return { processed: 0, updated: 0, skipped: 0, errors: 0 };
}

async function getUserOrganizationId(userId: string): Promise<string | null> {
  // First, check the user document for primaryOrganizationId
  const userDoc = await db.collection('users').doc(userId).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData?.primaryOrganizationId) {
      return userData.primaryOrganizationId;
    }
  }
  
  // Fallback: check org_memberships
  const membershipQuery = await db.collection('org_memberships')
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  
  if (!membershipQuery.empty) {
    return membershipQuery.docs[0].data().organizationId;
  }
  
  return null;
}

// Cache user organization mappings to reduce reads
const userOrgCache = new Map<string, string | null>();

async function getCachedUserOrgId(userId: string): Promise<string | null> {
  if (userOrgCache.has(userId)) {
    return userOrgCache.get(userId) || null;
  }
  const orgId = await getUserOrganizationId(userId);
  userOrgCache.set(userId, orgId);
  return orgId;
}

// =============================================================================
// MIGRATION: TASKS
// =============================================================================

async function migrateTasks(): Promise<MigrationStats> {
  log('Starting tasks migration...');
  const stats = createStats();
  
  // Get all tasks without organizationId
  const tasksSnapshot = await db.collection('tasks').get();
  
  log(`Found ${tasksSnapshot.size} total tasks`);
  
  let batch = db.batch();
  let batchCount = 0;
  
  for (const taskDoc of tasksSnapshot.docs) {
    stats.processed++;
    const taskData = taskDoc.data();
    
    // Skip if already has organizationId
    if (taskData.organizationId) {
      stats.skipped++;
      continue;
    }
    
    const userId = taskData.userId;
    if (!userId) {
      log(`  Task ${taskDoc.id} has no userId, skipping`, 'warn');
      stats.skipped++;
      continue;
    }
    
    const orgId = await getCachedUserOrgId(userId);
    if (!orgId) {
      log(`  Could not find organization for user ${userId}, skipping task ${taskDoc.id}`, 'warn');
      stats.skipped++;
      continue;
    }
    
    if (!isDryRun) {
      batch.update(taskDoc.ref, { organizationId: orgId });
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        log(`  Committed batch of ${BATCH_SIZE} tasks...`);
      }
    }
    stats.updated++;
  }
  
  // Commit remaining
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
    log(`  Committed final batch of ${batchCount} tasks`);
  }
  
  log(`Tasks migration complete: ${stats.updated} updated, ${stats.skipped} skipped`, 'success');
  return stats;
}

// =============================================================================
// MIGRATION: HABITS
// =============================================================================

async function migrateHabits(): Promise<MigrationStats> {
  log('Starting habits migration...');
  const stats = createStats();
  
  const habitsSnapshot = await db.collection('habits').get();
  log(`Found ${habitsSnapshot.size} total habits`);
  
  let batch = db.batch();
  let batchCount = 0;
  
  for (const habitDoc of habitsSnapshot.docs) {
    stats.processed++;
    const habitData = habitDoc.data();
    
    if (habitData.organizationId) {
      stats.skipped++;
      continue;
    }
    
    const userId = habitData.userId;
    if (!userId) {
      stats.skipped++;
      continue;
    }
    
    const orgId = await getCachedUserOrgId(userId);
    if (!orgId) {
      stats.skipped++;
      continue;
    }
    
    if (!isDryRun) {
      batch.update(habitDoc.ref, { organizationId: orgId });
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        log(`  Committed batch of ${BATCH_SIZE} habits...`);
      }
    }
    stats.updated++;
  }
  
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }
  
  log(`Habits migration complete: ${stats.updated} updated, ${stats.skipped} skipped`, 'success');
  return stats;
}

// =============================================================================
// MIGRATION: NOTIFICATIONS
// =============================================================================

async function migrateNotifications(): Promise<MigrationStats> {
  log('Starting notifications migration...');
  const stats = createStats();
  
  const notificationsSnapshot = await db.collection('notifications').get();
  log(`Found ${notificationsSnapshot.size} total notifications`);
  
  let batch = db.batch();
  let batchCount = 0;
  
  for (const notifDoc of notificationsSnapshot.docs) {
    stats.processed++;
    const notifData = notifDoc.data();
    
    if (notifData.organizationId) {
      stats.skipped++;
      continue;
    }
    
    const userId = notifData.userId;
    if (!userId) {
      stats.skipped++;
      continue;
    }
    
    const orgId = await getCachedUserOrgId(userId);
    if (!orgId) {
      stats.skipped++;
      continue;
    }
    
    if (!isDryRun) {
      batch.update(notifDoc.ref, { organizationId: orgId });
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        log(`  Committed batch of ${BATCH_SIZE} notifications...`);
      }
    }
    stats.updated++;
  }
  
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }
  
  log(`Notifications migration complete: ${stats.updated} updated, ${stats.skipped} skipped`, 'success');
  return stats;
}

// =============================================================================
// MIGRATION: CHECK-INS (Subcollections to Top-Level)
// =============================================================================

async function migrateCheckins(): Promise<MigrationStats> {
  log('Starting check-ins migration (subcollections to top-level)...');
  const stats = createStats();
  
  // Get all users
  const usersSnapshot = await db.collection('users').get();
  log(`Found ${usersSnapshot.size} users to process`);
  
  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const orgId = await getCachedUserOrgId(userId);
    
    if (!orgId) {
      log(`  No organization found for user ${userId}, skipping`, 'warn');
      stats.skipped++;
      continue;
    }
    
    // Migrate morning check-ins
    const morningCheckinsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('checkins')
      .get();
    
    for (const checkinDoc of morningCheckinsSnapshot.docs) {
      stats.processed++;
      const data = checkinDoc.data();
      
      // Check if already migrated
      const existingDoc = await db
        .collection('morning_checkins')
        .where('userId', '==', userId)
        .where('organizationId', '==', orgId)
        .where('date', '==', data.date || checkinDoc.id)
        .limit(1)
        .get();
      
      if (!existingDoc.empty) {
        stats.skipped++;
        continue;
      }
      
      if (!isDryRun) {
        await db.collection('morning_checkins').add({
          ...data,
          userId,
          organizationId: orgId,
          date: data.date || checkinDoc.id,
        });
      }
      stats.updated++;
    }
    
    // Migrate evening check-ins
    const eveningCheckinsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('eveningCheckins')
      .get();
    
    for (const checkinDoc of eveningCheckinsSnapshot.docs) {
      stats.processed++;
      const data = checkinDoc.data();
      
      const existingDoc = await db
        .collection('evening_checkins')
        .where('userId', '==', userId)
        .where('organizationId', '==', orgId)
        .where('date', '==', data.date || checkinDoc.id)
        .limit(1)
        .get();
      
      if (!existingDoc.empty) {
        stats.skipped++;
        continue;
      }
      
      if (!isDryRun) {
        await db.collection('evening_checkins').add({
          ...data,
          userId,
          organizationId: orgId,
          date: data.date || checkinDoc.id,
        });
      }
      stats.updated++;
    }
    
    // Migrate weekly reflections
    const weeklyReflectionsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('weeklyReflections')
      .get();
    
    for (const reflectionDoc of weeklyReflectionsSnapshot.docs) {
      stats.processed++;
      const data = reflectionDoc.data();
      
      const existingDoc = await db
        .collection('weekly_reflections')
        .where('userId', '==', userId)
        .where('organizationId', '==', orgId)
        .where('weekEndDate', '==', data.weekEndDate || reflectionDoc.id)
        .limit(1)
        .get();
      
      if (!existingDoc.empty) {
        stats.skipped++;
        continue;
      }
      
      if (!isDryRun) {
        await db.collection('weekly_reflections').add({
          ...data,
          userId,
          organizationId: orgId,
        });
      }
      stats.updated++;
    }
    
    // Migrate reflections
    const reflectionsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('reflections')
      .get();
    
    for (const reflectionDoc of reflectionsSnapshot.docs) {
      stats.processed++;
      const data = reflectionDoc.data();
      
      if (!isDryRun) {
        await db.collection('reflections').add({
          ...data,
          userId,
          organizationId: orgId,
        });
      }
      stats.updated++;
    }
    
    log(`  Processed check-ins for user ${userId}`);
  }
  
  log(`Check-ins migration complete: ${stats.updated} migrated, ${stats.skipped} skipped`, 'success');
  return stats;
}

// =============================================================================
// MIGRATION: GOALS/PROFILE TO ORG_MEMBERSHIPS
// =============================================================================

async function migrateGoals(): Promise<MigrationStats> {
  log('Starting goals/profile migration to org_memberships...');
  const stats = createStats();
  
  const usersSnapshot = await db.collection('users').get();
  log(`Found ${usersSnapshot.size} users to process`);
  
  for (const userDoc of usersSnapshot.docs) {
    stats.processed++;
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    // Get user's primary organization
    const orgId = userData.primaryOrganizationId || await getCachedUserOrgId(userId);
    
    if (!orgId) {
      stats.skipped++;
      continue;
    }
    
    // Find the org_membership document
    const membershipDoc = await db
      .collection('org_memberships')
      .doc(`${orgId}_${userId}`)
      .get();
    
    if (!membershipDoc.exists) {
      // Try to find by query
      const membershipQuery = await db.collection('org_memberships')
        .where('userId', '==', userId)
        .where('organizationId', '==', orgId)
        .limit(1)
        .get();
      
      if (membershipQuery.empty) {
        log(`  No org_membership found for user ${userId} in org ${orgId}`, 'warn');
        stats.skipped++;
        continue;
      }
    }
    
    // Build update data with goal/profile fields
    const updateData: Record<string, unknown> = {};
    
    if (userData.goal) updateData.goal = userData.goal;
    if (userData.goalStartDate) updateData.goalStartDate = userData.goalStartDate;
    if (userData.targetDate) updateData.targetDate = userData.targetDate;
    if (userData.goalHistory) updateData.goalHistory = userData.goalHistory;
    if (userData.identity) updateData.identity = userData.identity;
    if (userData.bio) updateData.bio = userData.bio;
    if (userData.weeklyFocus) updateData.weeklyFocus = userData.weeklyFocus;
    if (userData.onboardingStatus) updateData.onboardingStatus = userData.onboardingStatus;
    if (userData.hasCompletedOnboarding !== undefined) {
      updateData.hasCompletedOnboarding = userData.hasCompletedOnboarding;
    }
    if (userData.firstName) updateData.firstName = userData.firstName;
    if (userData.lastName) updateData.lastName = userData.lastName;
    if (userData.imageUrl) updateData.imageUrl = userData.imageUrl;
    if (userData.timezone) updateData.timezone = userData.timezone;
    
    // Squad IDs
    if (userData.standardSquadId) updateData.standardSquadId = userData.standardSquadId;
    if (userData.premiumSquadId) updateData.premiumSquadId = userData.premiumSquadId;
    if (userData.primarySquadId) updateData.primarySquadId = userData.primarySquadId;
    
    if (Object.keys(updateData).length === 0) {
      stats.skipped++;
      continue;
    }
    
    if (!isDryRun) {
      const membershipRef = membershipDoc.exists 
        ? membershipDoc.ref 
        : db.collection('org_memberships').doc(`${orgId}_${userId}`);
      
      if (membershipDoc.exists) {
        await membershipRef.update({
          ...updateData,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new membership with the data
        await membershipRef.set({
          userId,
          organizationId: orgId,
          ...updateData,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    
    stats.updated++;
    log(`  Migrated profile data for user ${userId}`);
  }
  
  log(`Goals/profile migration complete: ${stats.updated} updated, ${stats.skipped} skipped`, 'success');
  return stats;
}

// =============================================================================
// MIGRATION: USER ALIGNMENT
// =============================================================================

async function migrateAlignment(): Promise<MigrationStats> {
  log('Starting userAlignment migration...');
  const stats = createStats();
  
  const alignmentSnapshot = await db.collection('userAlignment').get();
  log(`Found ${alignmentSnapshot.size} alignment documents`);
  
  let batch = db.batch();
  let batchCount = 0;
  
  for (const alignmentDoc of alignmentSnapshot.docs) {
    stats.processed++;
    const data = alignmentDoc.data();
    
    if (data.organizationId) {
      stats.skipped++;
      continue;
    }
    
    const userId = data.userId;
    if (!userId) {
      stats.skipped++;
      continue;
    }
    
    const orgId = await getCachedUserOrgId(userId);
    if (!orgId) {
      stats.skipped++;
      continue;
    }
    
    if (!isDryRun) {
      batch.update(alignmentDoc.ref, { organizationId: orgId });
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    stats.updated++;
  }
  
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }
  
  log(`Alignment migration complete: ${stats.updated} updated, ${stats.skipped} skipped`, 'success');
  return stats;
}

// =============================================================================
// MIGRATION: CLIENT COACHING DATA
// =============================================================================

async function migrateCoaching(): Promise<MigrationStats> {
  log('Starting clientCoachingData migration...');
  const stats = createStats();
  
  const coachingSnapshot = await db.collection('clientCoachingData').get();
  log(`Found ${coachingSnapshot.size} coaching documents`);
  
  let batch = db.batch();
  let batchCount = 0;
  
  for (const coachingDoc of coachingSnapshot.docs) {
    stats.processed++;
    const data = coachingDoc.data();
    
    if (data.organizationId) {
      stats.skipped++;
      continue;
    }
    
    const clientId = data.clientId;
    if (!clientId) {
      stats.skipped++;
      continue;
    }
    
    const orgId = await getCachedUserOrgId(clientId);
    if (!orgId) {
      stats.skipped++;
      continue;
    }
    
    if (!isDryRun) {
      batch.update(coachingDoc.ref, { organizationId: orgId });
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    stats.updated++;
  }
  
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }
  
  log(`Coaching migration complete: ${stats.updated} updated, ${stats.skipped} skipped`, 'success');
  return stats;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Organization-Scoped Data Migration Script');
  console.log('='.repeat(60));
  console.log('');
  
  if (isDryRun) {
    log('Running in DRY RUN mode - no changes will be made', 'warn');
    console.log('');
  }
  
  if (ONLY_MIGRATION) {
    log(`Only running migration: ${ONLY_MIGRATION}`, 'info');
    console.log('');
  }
  
  const allStats: Record<string, MigrationStats> = {};
  
  try {
    // Run migrations based on --only flag or all
    if (!ONLY_MIGRATION || ONLY_MIGRATION === 'tasks') {
      console.log('');
      log('=== TASKS MIGRATION ===', 'info');
      allStats.tasks = await migrateTasks();
    }
    
    if (!ONLY_MIGRATION || ONLY_MIGRATION === 'habits') {
      console.log('');
      log('=== HABITS MIGRATION ===', 'info');
      allStats.habits = await migrateHabits();
    }
    
    if (!ONLY_MIGRATION || ONLY_MIGRATION === 'notifications') {
      console.log('');
      log('=== NOTIFICATIONS MIGRATION ===', 'info');
      allStats.notifications = await migrateNotifications();
    }
    
    if (!ONLY_MIGRATION || ONLY_MIGRATION === 'checkins') {
      console.log('');
      log('=== CHECK-INS MIGRATION ===', 'info');
      allStats.checkins = await migrateCheckins();
    }
    
    if (!ONLY_MIGRATION || ONLY_MIGRATION === 'goals') {
      console.log('');
      log('=== GOALS/PROFILE MIGRATION ===', 'info');
      allStats.goals = await migrateGoals();
    }
    
    if (!ONLY_MIGRATION || ONLY_MIGRATION === 'alignment') {
      console.log('');
      log('=== ALIGNMENT MIGRATION ===', 'info');
      allStats.alignment = await migrateAlignment();
    }
    
    if (!ONLY_MIGRATION || ONLY_MIGRATION === 'coaching') {
      console.log('');
      log('=== COACHING MIGRATION ===', 'info');
      allStats.coaching = await migrateCoaching();
    }
    
    // Print summary
    console.log('');
    console.log('='.repeat(60));
    log('MIGRATION SUMMARY', 'success');
    console.log('='.repeat(60));
    
    for (const [name, stats] of Object.entries(allStats)) {
      console.log(`  ${name.padEnd(15)}: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors`);
    }
    
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

