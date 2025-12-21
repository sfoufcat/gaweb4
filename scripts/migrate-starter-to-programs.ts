/**
 * Migration Script: StarterProgram to Program
 * 
 * This script migrates data from the old StarterProgram system to the new Program system.
 * 
 * Changes:
 * - starter_programs → programs (with additional fields for the new system)
 * - starter_program_days → program_days (structure remains similar)
 * - starter_program_enrollments → program_enrollments (with new status field)
 * 
 * Usage:
 *   npx ts-node scripts/migrate-starter-to-programs.ts
 * 
 * Options:
 *   --dry-run: Preview changes without writing to database
 *   --org=<orgId>: Migrate only programs for a specific organization
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const app = getApps().length === 0 
  ? initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  : getApps()[0];

const db = getFirestore(app);

// Parse command line args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const orgArg = args.find(a => a.startsWith('--org='));
const targetOrgId = orgArg?.split('=')[1];

interface StarterProgram {
  id: string;
  track: string;
  slug: string;
  name: string;
  description: string;
  lengthDays: number;
  programOrder: number;
  isDefaultForTrack: boolean;
  defaultHabits?: Array<{ title: string; description?: string; frequency: string }>;
  isActive?: boolean;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

interface StarterProgramDay {
  id: string;
  programId: string;
  dayIndex: number;
  title?: string;
  summary?: string;
  dailyPrompt?: string;
  tasks: Array<{
    label: string;
    type?: string;
    isPrimary: boolean;
    estimatedMinutes?: number;
    notes?: string;
    tag?: string;
  }>;
  habits?: Array<{ title: string; description?: string; frequency: string }>;
  createdAt: string;
  updatedAt: string;
}

interface StarterProgramEnrollment {
  id: string;
  userId: string;
  programId: string;
  startedAt: string;
  status: string;
  lastAssignedDayIndex: number;
  createdAt: string;
  updatedAt: string;
}

async function migratePrograms() {
  console.log('🚀 Starting StarterProgram to Program migration...');
  console.log(isDryRun ? '   (DRY RUN - no changes will be made)' : '');
  console.log(targetOrgId ? `   (Targeting organization: ${targetOrgId})` : '   (All organizations)');
  console.log('');

  const stats = {
    programs: { migrated: 0, skipped: 0, errors: 0 },
    days: { migrated: 0, skipped: 0, errors: 0 },
    enrollments: { migrated: 0, skipped: 0, errors: 0 },
  };

  // 1. Migrate StarterPrograms to Programs
  console.log('📚 Migrating StarterPrograms...');
  
  let programsQuery: FirebaseFirestore.Query = db.collection('starter_programs');
  if (targetOrgId) {
    programsQuery = programsQuery.where('organizationId', '==', targetOrgId);
  }
  
  const starterProgramsSnapshot = await programsQuery.get();
  
  // Create a mapping of old ID to new ID
  const programIdMapping: Record<string, string> = {};
  
  for (const doc of starterProgramsSnapshot.docs) {
    const oldProgram = { id: doc.id, ...doc.data() } as StarterProgram;
    
    try {
      // Check if already migrated (by slug + orgId)
      const existingQuery = await db.collection('programs')
        .where('slug', '==', oldProgram.slug)
        .where('organizationId', '==', oldProgram.organizationId || '')
        .limit(1)
        .get();
      
      if (!existingQuery.empty) {
        console.log(`   ⏭️  Skipping "${oldProgram.name}" (already migrated)`);
        programIdMapping[oldProgram.id] = existingQuery.docs[0].id;
        stats.programs.skipped++;
        continue;
      }

      // Create new Program document
      const newProgram = {
        organizationId: oldProgram.organizationId || '',
        coachId: null, // Will be set by org admin
        
        // Basic info
        name: oldProgram.name,
        slug: oldProgram.slug,
        description: oldProgram.description,
        coverImageUrl: '', // Can be added later
        
        // Type and settings - StarterPrograms are individual by default
        type: 'individual',
        lengthDays: oldProgram.lengthDays,
        
        // Pricing - free by default (coaches can set prices later)
        priceInCents: 0,
        currency: 'usd',
        
        // Squad settings (only for group programs)
        squadCapacity: 10,
        
        // Default habits from old program
        defaultHabits: oldProgram.defaultHabits?.map(h => ({
          title: h.title,
          description: h.description || '',
          frequency: h.frequency || 'daily',
        })) || [],
        
        // Status
        isActive: oldProgram.isActive !== false,
        isPublished: false, // Requires coach to publish
        
        // Legacy reference
        migratedFromStarterProgramId: oldProgram.id,
        legacyTrack: oldProgram.track,
        legacyProgramOrder: oldProgram.programOrder,
        
        // Timestamps
        createdAt: oldProgram.createdAt,
        updatedAt: new Date().toISOString(),
      };

      if (isDryRun) {
        console.log(`   ✅ Would migrate: "${oldProgram.name}" → Program (${oldProgram.lengthDays} days)`);
        // Generate a fake ID for mapping
        programIdMapping[oldProgram.id] = `new_${oldProgram.id}`;
      } else {
        const newRef = await db.collection('programs').add(newProgram);
        programIdMapping[oldProgram.id] = newRef.id;
        console.log(`   ✅ Migrated: "${oldProgram.name}" → ${newRef.id}`);
      }
      
      stats.programs.migrated++;
    } catch (error) {
      console.error(`   ❌ Error migrating "${oldProgram.name}":`, error);
      stats.programs.errors++;
    }
  }

  console.log('');
  
  // 2. Migrate StarterProgramDays to ProgramDays
  console.log('📅 Migrating Program Days...');
  
  const daysSnapshot = await db.collection('starter_program_days').get();
  
  for (const doc of daysSnapshot.docs) {
    const oldDay = { id: doc.id, ...doc.data() } as StarterProgramDay;
    
    // Only migrate if we have a mapping for the parent program
    const newProgramId = programIdMapping[oldDay.programId];
    if (!newProgramId) {
      console.log(`   ⏭️  Skipping day ${oldDay.dayIndex} (parent program not migrated)`);
      stats.days.skipped++;
      continue;
    }
    
    try {
      // Check if already migrated
      const existingQuery = await db.collection('program_days')
        .where('programId', '==', newProgramId)
        .where('dayIndex', '==', oldDay.dayIndex)
        .limit(1)
        .get();
      
      if (!existingQuery.empty) {
        console.log(`   ⏭️  Skipping day ${oldDay.dayIndex} (already migrated)`);
        stats.days.skipped++;
        continue;
      }

      const newDay = {
        programId: newProgramId,
        dayIndex: oldDay.dayIndex,
        title: oldDay.title || `Day ${oldDay.dayIndex}`,
        summary: oldDay.summary || '',
        dailyPrompt: oldDay.dailyPrompt || '',
        
        // Convert task templates
        tasks: oldDay.tasks?.map(t => ({
          label: t.label,
          type: t.type || 'task',
          isPrimary: t.isPrimary,
          estimatedMinutes: t.estimatedMinutes || 0,
          notes: t.notes || '',
          tag: t.tag || '',
        })) || [],
        
        // Convert habit templates
        habits: oldDay.habits?.map(h => ({
          title: h.title,
          description: h.description || '',
          frequency: h.frequency || 'daily',
        })) || [],
        
        // Legacy reference
        migratedFromStarterProgramDayId: oldDay.id,
        
        // Timestamps
        createdAt: oldDay.createdAt,
        updatedAt: new Date().toISOString(),
      };

      if (isDryRun) {
        console.log(`   ✅ Would migrate: Day ${oldDay.dayIndex} → ProgramDay`);
      } else {
        await db.collection('program_days').add(newDay);
        console.log(`   ✅ Migrated: Day ${oldDay.dayIndex}`);
      }
      
      stats.days.migrated++;
    } catch (error) {
      console.error(`   ❌ Error migrating day ${oldDay.dayIndex}:`, error);
      stats.days.errors++;
    }
  }

  console.log('');
  
  // 3. Migrate StarterProgramEnrollments to ProgramEnrollments
  console.log('👤 Migrating Enrollments...');
  
  const enrollmentsSnapshot = await db.collection('starter_program_enrollments').get();
  
  for (const doc of enrollmentsSnapshot.docs) {
    const oldEnrollment = { id: doc.id, ...doc.data() } as StarterProgramEnrollment;
    
    // Only migrate if we have a mapping for the parent program
    const newProgramId = programIdMapping[oldEnrollment.programId];
    if (!newProgramId) {
      console.log(`   ⏭️  Skipping enrollment for user ${oldEnrollment.userId} (parent program not migrated)`);
      stats.enrollments.skipped++;
      continue;
    }
    
    try {
      // Check if already migrated
      const existingQuery = await db.collection('program_enrollments')
        .where('userId', '==', oldEnrollment.userId)
        .where('programId', '==', newProgramId)
        .limit(1)
        .get();
      
      if (!existingQuery.empty) {
        console.log(`   ⏭️  Skipping enrollment for user ${oldEnrollment.userId} (already migrated)`);
        stats.enrollments.skipped++;
        continue;
      }

      // Map old status to new status
      let newStatus: string;
      switch (oldEnrollment.status) {
        case 'active':
          newStatus = 'active';
          break;
        case 'completed':
          newStatus = 'completed';
          break;
        default:
          newStatus = 'stopped';
      }

      const newEnrollment = {
        userId: oldEnrollment.userId,
        programId: newProgramId,
        organizationId: '', // Will be populated from program
        
        // No cohort for individual programs
        cohortId: null,
        squadId: null,
        
        // Financials (migrated enrollments are grandfathered in)
        amountPaid: 0,
        paidAt: null,
        stripePaymentIntentId: null,
        
        // Status
        status: newStatus,
        startedAt: oldEnrollment.startedAt,
        completedAt: oldEnrollment.status === 'completed' ? oldEnrollment.updatedAt : null,
        
        // Progress
        lastAssignedDayIndex: oldEnrollment.lastAssignedDayIndex,
        
        // Legacy reference
        migratedFromStarterProgramEnrollmentId: oldEnrollment.id,
        
        // Timestamps
        createdAt: oldEnrollment.createdAt,
        updatedAt: new Date().toISOString(),
      };

      if (isDryRun) {
        console.log(`   ✅ Would migrate: Enrollment for user ${oldEnrollment.userId} (${oldEnrollment.status})`);
      } else {
        await db.collection('program_enrollments').add(newEnrollment);
        console.log(`   ✅ Migrated: Enrollment for user ${oldEnrollment.userId}`);
      }
      
      stats.enrollments.migrated++;
    } catch (error) {
      console.error(`   ❌ Error migrating enrollment for user ${oldEnrollment.userId}:`, error);
      stats.enrollments.errors++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('Migration Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Programs:    ${stats.programs.migrated} migrated, ${stats.programs.skipped} skipped, ${stats.programs.errors} errors`);
  console.log(`Days:        ${stats.days.migrated} migrated, ${stats.days.skipped} skipped, ${stats.days.errors} errors`);
  console.log(`Enrollments: ${stats.enrollments.migrated} migrated, ${stats.enrollments.skipped} skipped, ${stats.enrollments.errors} errors`);
  console.log('═══════════════════════════════════════');
  
  if (isDryRun) {
    console.log('');
    console.log('⚠️  This was a dry run. Run without --dry-run to apply changes.');
  }
}

// Run the migration
migratePrograms()
  .then(() => {
    console.log('');
    console.log('✨ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });

