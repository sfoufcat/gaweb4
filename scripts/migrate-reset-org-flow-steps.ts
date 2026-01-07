/**
 * Migration: Reset Org Check-in Flow Steps
 *
 * This script deletes all existing steps from system default org check-in flows
 * and re-creates them from the current templates.
 *
 * Usage:
 *   doppler run -- npx tsx scripts/migrate-reset-org-flow-steps.ts
 *
 * Options:
 *   --dry-run    Preview changes without making them
 *   --org=<id>   Only migrate a specific organization
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { CheckInStep, OrgCheckInFlow, CheckInFlowTemplate } from '../src/types';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const orgArg = args.find(a => a.startsWith('--org='));
const targetOrgId = orgArg ? orgArg.split('=')[1] : null;

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials. Run with: doppler run -- npx tsx scripts/migrate-reset-org-flow-steps.ts');
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

async function migrateOrgFlowSteps() {
  console.log('🔄 Migration: Reset Org Check-in Flow Steps\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  if (targetOrgId) {
    console.log(`🎯 Targeting specific org: ${targetOrgId}\n`);
  }

  // Get all templates to use as source of truth
  const templatesSnapshot = await db.collection('checkInFlowTemplates').get();
  const templates = new Map<string, CheckInFlowTemplate>();

  templatesSnapshot.docs.forEach(doc => {
    const data = doc.data() as Omit<CheckInFlowTemplate, 'id'>;
    templates.set(data.key, { id: doc.id, ...data } as CheckInFlowTemplate);
  });

  console.log(`📋 Found ${templates.size} templates: ${Array.from(templates.keys()).join(', ')}\n`);

  // Get all system default org flows
  let flowsQuery = db
    .collection('orgCheckInFlows')
    .where('isSystemDefault', '==', true);

  if (targetOrgId) {
    flowsQuery = flowsQuery.where('organizationId', '==', targetOrgId);
  }

  const flowsSnapshot = await flowsQuery.get();

  console.log(`📦 Found ${flowsSnapshot.size} system default org flows to migrate\n`);

  let migratedFlows = 0;
  let deletedSteps = 0;
  let createdSteps = 0;
  let errors = 0;

  for (const flowDoc of flowsSnapshot.docs) {
    const flow = flowDoc.data() as OrgCheckInFlow;
    const flowId = flowDoc.id;
    const template = templates.get(flow.type);

    if (!template) {
      console.log(`⚠️  No template found for flow type "${flow.type}" (flow ${flowId}), skipping`);
      continue;
    }

    console.log(`\n🔧 Processing ${flow.type} flow for org ${flow.organizationId.substring(0, 8)}...`);

    try {
      // Get existing steps
      const existingStepsSnapshot = await db
        .collection('orgCheckInFlows')
        .doc(flowId)
        .collection('steps')
        .get();

      console.log(`   Found ${existingStepsSnapshot.size} existing steps`);

      if (!isDryRun) {
        // Delete existing steps in batches
        const deleteBatch = db.batch();
        existingStepsSnapshot.docs.forEach(doc => {
          deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        deletedSteps += existingStepsSnapshot.size;
        console.log(`   ✓ Deleted ${existingStepsSnapshot.size} steps`);

        // Create new steps from template
        const now = new Date().toISOString();
        const createBatch = db.batch();

        template.defaultSteps.forEach((step, index) => {
          const stepRef = db
            .collection('orgCheckInFlows')
            .doc(flowId)
            .collection('steps')
            .doc();

          createBatch.set(stepRef, {
            flowId,
            order: step.order ?? index,
            type: step.type,
            name: step.name,
            config: step.config,
            conditions: step.conditions || null,
            conditionLogic: step.conditionLogic || null,
            enabled: true,
            createdAt: now,
            updatedAt: now,
          });
        });

        await createBatch.commit();
        createdSteps += template.defaultSteps.length;
        console.log(`   ✓ Created ${template.defaultSteps.length} steps from template`);

        // Update flow metadata
        await flowDoc.ref.update({
          stepCount: template.defaultSteps.length,
          templateVersion: template.version,
          updatedAt: now,
        });
      } else {
        console.log(`   [DRY RUN] Would delete ${existingStepsSnapshot.size} steps`);
        console.log(`   [DRY RUN] Would create ${template.defaultSteps.length} steps from template`);
        deletedSteps += existingStepsSnapshot.size;
        createdSteps += template.defaultSteps.length;
      }

      migratedFlows++;
    } catch (error) {
      console.error(`   ❌ Error processing flow ${flowId}:`, error);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   Flows processed: ${migratedFlows}`);
  console.log(`   Steps deleted: ${deletedSteps}`);
  console.log(`   Steps created: ${createdSteps}`);
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
migrateOrgFlowSteps()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
