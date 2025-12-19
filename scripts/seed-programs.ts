/**
 * Seed Starter Programs
 * 
 * Run with: npx ts-node scripts/seed-programs.ts
 * Or with Doppler: doppler run -- npx ts-node scripts/seed-programs.ts
 * 
 * This script:
 * 1. Creates the starter_programs collection with program templates
 * 2. Creates the starter_program_days collection with daily task templates
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { CONTENT_CREATOR_PROGRAM, CONTENT_CREATOR_DAYS } from '../src/lib/programs/content-creator-30-day';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Firebase environment variables are not set');
    console.error('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    console.error('   Make sure to run with Doppler: doppler run -- npx tsx scripts/seed-programs.ts');
    process.exit(1);
  }
  
  try {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = getFirestore();

async function seedPrograms() {
  console.log('\n🌱 Seeding Starter Programs...\n');
  
  // ============================================================================
  // SEED CONTENT CREATOR PROGRAM
  // ============================================================================
  
  const programSlug = CONTENT_CREATOR_PROGRAM.slug;
  
  // Check if program already exists
  const existingProgramSnapshot = await db
    .collection('starter_programs')
    .where('slug', '==', programSlug)
    .limit(1)
    .get();
  
  let programId: string;
  
  if (!existingProgramSnapshot.empty) {
    programId = existingProgramSnapshot.docs[0].id;
    console.log(`📝 Program "${programSlug}" already exists (ID: ${programId})`);
    console.log('   Updating program data...');
    
    // Update existing program
    await db.collection('starter_programs').doc(programId).update({
      ...CONTENT_CREATOR_PROGRAM,
      updatedAt: new Date().toISOString(),
    });
  } else {
    // Create new program
    const now = new Date().toISOString();
    const programRef = await db.collection('starter_programs').add({
      ...CONTENT_CREATOR_PROGRAM,
      createdAt: now,
      updatedAt: now,
    });
    programId = programRef.id;
    console.log(`✅ Created program "${CONTENT_CREATOR_PROGRAM.name}" (ID: ${programId})`);
  }
  
  // ============================================================================
  // SEED PROGRAM DAYS
  // ============================================================================
  
  console.log(`\n📅 Seeding ${CONTENT_CREATOR_DAYS.length} program days...\n`);
  
  for (const day of CONTENT_CREATOR_DAYS) {
    // Check if day already exists
    const existingDaySnapshot = await db
      .collection('starter_program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '==', day.dayIndex)
      .limit(1)
      .get();
    
    const now = new Date().toISOString();
    
    if (!existingDaySnapshot.empty) {
      // Update existing day
      const dayId = existingDaySnapshot.docs[0].id;
      await db.collection('starter_program_days').doc(dayId).update({
        tasks: day.tasks,
        updatedAt: now,
      });
      console.log(`   Day ${day.dayIndex}: Updated (${day.tasks.length} tasks)`);
    } else {
      // Create new day
      await db.collection('starter_program_days').add({
        programId,
        dayIndex: day.dayIndex,
        tasks: day.tasks,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`   Day ${day.dayIndex}: Created (${day.tasks.length} tasks)`);
    }
  }
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  console.log('\n✅ Seeding complete!');
  console.log('   Program:', CONTENT_CREATOR_PROGRAM.name);
  console.log('   Track:', CONTENT_CREATOR_PROGRAM.track);
  console.log('   Length:', CONTENT_CREATOR_PROGRAM.lengthDays, 'days');
  console.log('   Default for track:', CONTENT_CREATOR_PROGRAM.isDefaultForTrack);
  
  // Count total tasks
  const totalTasks = CONTENT_CREATOR_DAYS.reduce((sum, day) => sum + day.tasks.length, 0);
  const primaryTasks = CONTENT_CREATOR_DAYS.reduce(
    (sum, day) => sum + day.tasks.filter(t => t.isPrimary).length, 
    0
  );
  const optionalTasks = totalTasks - primaryTasks;
  
  console.log('\n📊 Task Statistics:');
  console.log('   Total tasks:', totalTasks);
  console.log('   Primary tasks:', primaryTasks);
  console.log('   Optional tasks:', optionalTasks);
}

// Run the seeding
seedPrograms()
  .then(() => {
    console.log('\n🎉 Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error seeding programs:', error);
    process.exit(1);
  });

