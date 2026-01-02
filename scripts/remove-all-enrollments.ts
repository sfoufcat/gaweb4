/**
 * Remove All Program Enrollments Script
 * 
 * This script stops all active program enrollments for ALL users
 * and deletes their program-generated tasks.
 * 
 * Use this when:
 * - You need to reset all users from their programs
 * - Programs are being restructured
 * - Manual intervention is needed to clear enrollments
 * 
 * Usage:
 *   doppler run -- npx tsx scripts/remove-all-enrollments.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ Missing Firebase environment variables');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

interface EnrollmentDoc {
  id: string;
  userId: string;
  programId: string;
  status: 'active' | 'completed' | 'stopped';
}

async function removeAllEnrollments(): Promise<void> {
  console.log('\n🔍 Finding all active program enrollments...\n');

  // Step 1: Get all active enrollments
  const enrollmentsSnapshot = await db
    .collection('starter_program_enrollments')
    .where('status', '==', 'active')
    .get();

  if (enrollmentsSnapshot.empty) {
    console.log('✅ No active enrollments found. Nothing to do.');
    return;
  }

  console.log(`📋 Found ${enrollmentsSnapshot.size} active enrollment(s)\n`);

  const enrollments: EnrollmentDoc[] = enrollmentsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as EnrollmentDoc));

  let totalTasksDeleted = 0;
  let enrollmentsStopped = 0;
  const now = new Date().toISOString();

  // Step 2: Process each enrollment
  for (const enrollment of enrollments) {
    console.log(`--- Processing enrollment ${enrollment.id} ---`);
    console.log(`    User: ${enrollment.userId}`);
    console.log(`    Program: ${enrollment.programId}`);

    // Delete program-generated tasks for this enrollment
    const tasksSnapshot = await db
      .collection('tasks')
      .where('userId', '==', enrollment.userId)
      .where('programEnrollmentId', '==', enrollment.id)
      .get();

    if (!tasksSnapshot.empty) {
      const batch = db.batch();
      tasksSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`    ✅ Deleted ${tasksSnapshot.size} program task(s)`);
      totalTasksDeleted += tasksSnapshot.size;
    } else {
      console.log(`    ℹ️  No program tasks to delete`);
    }

    // Mark enrollment as stopped
    await db.collection('starter_program_enrollments').doc(enrollment.id).update({
      status: 'stopped',
      updatedAt: now,
    });
    console.log(`    ✅ Enrollment stopped\n`);
    enrollmentsStopped++;
  }

  // Final summary
  console.log('========================================');
  console.log('✅ REMOVAL COMPLETE');
  console.log('========================================');
  console.log(`   Enrollments stopped: ${enrollmentsStopped}`);
  console.log(`   Tasks deleted: ${totalTasksDeleted}`);
  console.log('\n   All users have been removed from their programs.\n');
}

removeAllEnrollments()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });











