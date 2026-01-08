/**
 * Migration: Fix Steady State Conditions in Morning Check-in Flows
 *
 * This script removes 'steady' from the emotional state conditions for
 * acceptance (explainer) and breathing steps in morning check-in flows.
 *
 * Previously, 'steady' was incorrectly included in the conditions which
 * caused conditional steps (breathing, acceptance) to show for users
 * who selected 'steady'. These steps should only show for 'neutral' and below.
 *
 * Usage:
 *   doppler run -- npx tsx scripts/migrate-fix-steady-state-conditions.ts
 *
 * Options:
 *   --dry-run    Preview changes without making them
 *   --org=<id>   Only migrate a specific organization
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const orgArg = args.find(a => a.startsWith('--org='));
const targetOrgId = orgArg ? orgArg.split('=')[1] : null;

// The states that SHOULD trigger conditional steps (neutral and below)
const CORRECT_STATES = ['low_stuck', 'uneasy', 'uncertain', 'neutral'];

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials. Run with: doppler run -- npx tsx scripts/migrate-fix-steady-state-conditions.ts');
    console.error({ hasProjectId: !!projectId, hasClientEmail: !!clientEmail, hasPrivateKey: !!privateKey });
    process.exit(1);
  }

  try {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized\n');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

interface StepCondition {
  field: string;
  operator: string;
  value: string[];
}

async function migrateFixSteadyStateConditions() {
  console.log('🔄 Migration: Fix Steady State Conditions in Morning Check-in Flows\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  if (targetOrgId) {
    console.log(`🎯 Targeting specific org: ${targetOrgId}\n`);
  }

  // Get all morning check-in flows (both org flows and templates)
  let flowsQuery = db
    .collection('orgCheckInFlows')
    .where('type', '==', 'morning');

  if (targetOrgId) {
    flowsQuery = flowsQuery.where('organizationId', '==', targetOrgId);
  }

  const flowsSnapshot = await flowsQuery.get();

  console.log(`📦 Found ${flowsSnapshot.size} morning check-in flows\n`);

  let updatedSteps = 0;
  let skippedSteps = 0;
  let errors = 0;

  // Process each flow
  for (const flowDoc of flowsSnapshot.docs) {
    const flowId = flowDoc.id;
    const flowData = flowDoc.data();
    const orgId = flowData.organizationId || 'unknown';

    console.log(`\n🔧 Processing flow ${flowId} (org: ${orgId.substring(0, 8)}...)`);

    try {
      // Get all steps for this flow
      const stepsSnapshot = await db
        .collection('orgCheckInFlows')
        .doc(flowId)
        .collection('steps')
        .get();

      for (const stepDoc of stepsSnapshot.docs) {
        const stepData = stepDoc.data();
        const stepType = stepData.type;

        // Only process explainer (acceptance) and breathing steps
        if (stepType !== 'explainer' && stepType !== 'breathing') {
          continue;
        }

        const conditions = stepData.conditions as StepCondition[] | undefined;

        if (!conditions || conditions.length === 0) {
          console.log(`   ⏭️  ${stepType} step has no conditions, skipping`);
          skippedSteps++;
          continue;
        }

        // Check if any condition has 'steady' in the emotionalState field
        let needsUpdate = false;
        const updatedConditions = conditions.map(condition => {
          if (
            condition.field === 'emotionalState' &&
            condition.operator === 'in' &&
            Array.isArray(condition.value) &&
            condition.value.includes('steady')
          ) {
            needsUpdate = true;
            return {
              ...condition,
              value: CORRECT_STATES,
            };
          }
          return condition;
        });

        if (!needsUpdate) {
          console.log(`   ✓ ${stepType} step already has correct conditions`);
          skippedSteps++;
          continue;
        }

        console.log(`   📝 Updating ${stepType} step conditions...`);
        console.log(`      Before: ${JSON.stringify(conditions.map(c => c.value))}`);
        console.log(`      After:  ${JSON.stringify(updatedConditions.map(c => c.value))}`);

        if (!isDryRun) {
          await stepDoc.ref.update({
            conditions: updatedConditions,
            updatedAt: new Date().toISOString(),
          });
          console.log(`   ✅ Updated ${stepType} step`);
        } else {
          console.log(`   [DRY RUN] Would update ${stepType} step`);
        }

        updatedSteps++;
      }
    } catch (error) {
      console.error(`   ❌ Error processing flow ${flowId}:`, error);
      errors++;
    }
  }

  // Also update the templates
  console.log('\n📋 Checking templates...');

  const templatesSnapshot = await db
    .collection('checkInFlowTemplates')
    .where('key', '==', 'morning')
    .get();

  for (const templateDoc of templatesSnapshot.docs) {
    const templateData = templateDoc.data();
    const defaultSteps = templateData.defaultSteps as Array<{
      type: string;
      conditions?: StepCondition[];
    }>;

    if (!defaultSteps) continue;

    let templateNeedsUpdate = false;
    const updatedDefaultSteps = defaultSteps.map(step => {
      if (step.type !== 'explainer' && step.type !== 'breathing') {
        return step;
      }

      if (!step.conditions) return step;

      const updatedConditions = step.conditions.map(condition => {
        if (
          condition.field === 'emotionalState' &&
          condition.operator === 'in' &&
          Array.isArray(condition.value) &&
          condition.value.includes('steady')
        ) {
          templateNeedsUpdate = true;
          return {
            ...condition,
            value: CORRECT_STATES,
          };
        }
        return condition;
      });

      return {
        ...step,
        conditions: updatedConditions,
      };
    });

    if (templateNeedsUpdate) {
      console.log(`   📝 Updating morning template conditions...`);

      if (!isDryRun) {
        await templateDoc.ref.update({
          defaultSteps: updatedDefaultSteps,
          updatedAt: new Date().toISOString(),
        });
        console.log(`   ✅ Updated morning template`);
      } else {
        console.log(`   [DRY RUN] Would update morning template`);
      }
    } else {
      console.log(`   ✓ Morning template already has correct conditions`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   Steps updated: ${updatedSteps}`);
  console.log(`   Steps skipped (already correct): ${skippedSteps}`);
  if (errors > 0) {
    console.log(`   Errors: ${errors}`);
  }
  if (isDryRun) {
    console.log('\n⚠️  DRY RUN - No actual changes were made');
    console.log('   Run without --dry-run to apply changes');
  }
  console.log('='.repeat(50) + '\n');
}

// Run the migration
migrateFixSteadyStateConditions()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
