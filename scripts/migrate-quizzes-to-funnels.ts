/**
 * Migration Script: Quizzes to Funnels
 * 
 * This script migrates existing quiz configurations to the new funnel system.
 * 
 * Usage:
 * npx tsx scripts/migrate-quizzes-to-funnels.ts [--dry-run]
 * 
 * Options:
 * --dry-run: Show what would be migrated without actually migrating
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials:');
    console.error('  FIREBASE_PROJECT_ID:', projectId ? '✓' : '✗');
    console.error('  FIREBASE_CLIENT_EMAIL:', clientEmail ? '✓' : '✗');
    console.error('  FIREBASE_PRIVATE_KEY:', privateKey ? '✓' : '✗');
    console.error('\nMake sure these are set in your .env.local file');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const isDryRun = process.argv.includes('--dry-run');

interface Quiz {
  id: string;
  slug: string;
  title: string;
  trackId?: string;
  isActive: boolean;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

interface QuizStep {
  id: string;
  quizId: string;
  type: string;
  question: string;
  options?: Array<{
    id: string;
    label: string;
    value: string;
    emoji?: string;
    description?: string;
    order: number;
  }>;
  order: number;
  createdAt: string;
  updatedAt: string;
}

async function migrateQuizzes() {
  console.log('🚀 Starting quiz to funnel migration...');
  if (isDryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  // Get all quizzes
  const quizzesSnapshot = await db.collection('quizzes').get();
  console.log(`Found ${quizzesSnapshot.size} quizzes to migrate\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const quizDoc of quizzesSnapshot.docs) {
    const quiz = { id: quizDoc.id, ...quizDoc.data() } as Quiz;
    console.log(`\n📝 Processing quiz: ${quiz.title} (${quiz.slug})`);

    try {
      // Check if funnel already exists for this quiz
      const existingFunnel = await db
        .collection('funnels')
        .where('slug', '==', quiz.slug)
        .limit(1)
        .get();

      if (!existingFunnel.empty) {
        console.log(`  ⏭️ Skipping - Funnel already exists for slug "${quiz.slug}"`);
        skippedCount++;
        continue;
      }

      // Get quiz steps
      const stepsSnapshot = await db
        .collection('quizzes')
        .doc(quiz.id)
        .collection('steps')
        .orderBy('order', 'asc')
        .get();

      const steps = stepsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as QuizStep[];

      console.log(`  📊 Found ${steps.length} steps`);

      // Find or create a program for this quiz
      // For now, we'll look for a program with the same track or create a placeholder
      let programId = '';
      
      if (quiz.trackId) {
        const programsSnapshot = await db
          .collection('programs')
          .where('track', '==', quiz.trackId)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (!programsSnapshot.empty) {
          programId = programsSnapshot.docs[0].id;
          console.log(`  ✅ Found program: ${programsSnapshot.docs[0].data().name}`);
        }
      }

      if (!programId) {
        console.log(`  ⚠️ No matching program found - creating placeholder`);
        
        if (!isDryRun) {
          const placeholderProgram = await db.collection('programs').add({
            name: quiz.title,
            slug: quiz.slug,
            description: `Migrated from quiz: ${quiz.title}`,
            track: quiz.trackId || 'general',
            organizationId: quiz.organizationId || 'platform',
            isActive: quiz.isActive,
            lengthDays: 90,
            type: 'individual',
            priceInCents: 0,
            currency: 'usd',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          programId = placeholderProgram.id;
        } else {
          programId = 'placeholder-program-id';
        }
      }

      // Create funnel
      const now = new Date().toISOString();
      const funnelData = {
        organizationId: quiz.organizationId || 'platform',
        programId,
        slug: quiz.slug,
        name: quiz.title,
        description: `Migrated from quiz: ${quiz.title}`,
        isDefault: true,
        isActive: quiz.isActive,
        accessType: 'public',
        defaultPaymentStatus: 'required',
        stepCount: steps.length + 3, // Quiz steps + signup + payment + success
        createdAt: quiz.createdAt || now,
        updatedAt: now,
      };

      console.log(`  📦 Creating funnel: ${funnelData.name}`);

      if (!isDryRun) {
        const funnelRef = await db.collection('funnels').add(funnelData);

        // Create funnel steps
        const batch = db.batch();
        let stepOrder = 0;

        // Convert quiz steps to funnel question steps
        for (const quizStep of steps) {
          const stepRef = db.collection('funnels').doc(funnelRef.id).collection('steps').doc();
          
          batch.set(stepRef, {
            funnelId: funnelRef.id,
            order: stepOrder++,
            type: 'question',
            config: {
              type: 'question',
              config: {
                questionType: 'single_choice',
                question: quizStep.question,
                fieldName: `quiz_${quizStep.id}`,
                options: quizStep.options || [],
              },
            },
            createdAt: quizStep.createdAt || now,
            updatedAt: now,
          });
        }

        // Add goal setting step
        const goalStepRef = db.collection('funnels').doc(funnelRef.id).collection('steps').doc();
        batch.set(goalStepRef, {
          funnelId: funnelRef.id,
          order: stepOrder++,
          type: 'goal_setting',
          config: {
            type: 'goal_setting',
            config: {
              examples: ['grow to 10k followers', 'make $1,000 from content'],
              timelineDays: 90,
            },
          },
          createdAt: now,
          updatedAt: now,
        });

        // Add signup step
        const signupStepRef = db.collection('funnels').doc(funnelRef.id).collection('steps').doc();
        batch.set(signupStepRef, {
          funnelId: funnelRef.id,
          order: stepOrder++,
          type: 'signup',
          config: {
            type: 'signup',
            config: {
              showSocialLogin: true,
            },
          },
          createdAt: now,
          updatedAt: now,
        });

        // Add payment step
        const paymentStepRef = db.collection('funnels').doc(funnelRef.id).collection('steps').doc();
        batch.set(paymentStepRef, {
          funnelId: funnelRef.id,
          order: stepOrder++,
          type: 'payment',
          config: {
            type: 'payment',
            config: {
              useProgramPricing: true,
            },
          },
          createdAt: now,
          updatedAt: now,
        });

        // Add success step
        const successStepRef = db.collection('funnels').doc(funnelRef.id).collection('steps').doc();
        batch.set(successStepRef, {
          funnelId: funnelRef.id,
          order: stepOrder,
          type: 'success',
          config: {
            type: 'success',
            config: {
              showConfetti: true,
              redirectDelay: 3000,
            },
          },
          createdAt: now,
          updatedAt: now,
        });

        await batch.commit();
        console.log(`  ✅ Created funnel with ${stepOrder + 1} steps`);
      } else {
        console.log(`  📋 Would create funnel with ${steps.length + 4} steps`);
      }

      migratedCount++;
    } catch (error) {
      console.error(`  ❌ Error migrating quiz:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`  ✅ Migrated: ${migratedCount}`);
  console.log(`  ⏭️ Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  
  if (isDryRun) {
    console.log('\n📋 This was a dry run. Run without --dry-run to apply changes.');
  }
}

// Run migration
migrateQuizzes().then(() => {
  console.log('\n✨ Migration complete!');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

