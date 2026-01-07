/**
 * Migrate Check-in Flows to New Step Types
 *
 * This script migrates existing evening and weekly check-in flows
 * to use the new step types (evening_task_review, evening_mood, etc.)
 *
 * Usage:
 *   doppler run -- npx tsx scripts/migrate-checkin-flows.ts
 *
 *   Options:
 *   --dry-run    Preview changes without applying them
 *   --verbose    Show detailed migration information
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { CheckInStepType } from '../src/types';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Initialize Firebase Admin using env vars
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials. Make sure to run with: doppler run -- npx tsx scripts/migrate-checkin-flows.ts');
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
    console.log('Firebase Admin initialized');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// =============================================================================
// MIGRATION MAPPINGS
// =============================================================================

interface StepMigration {
  oldType: string;
  newType: CheckInStepType;
  flowTypes: ('evening' | 'weekly')[];
  configTransform?: (oldConfig: Record<string, unknown>) => Record<string, unknown>;
}

// Step type migrations for evening flow
const EVENING_MIGRATIONS: StepMigration[] = [
  {
    oldType: 'task_review',
    newType: 'evening_task_review',
    flowTypes: ['evening'],
    configTransform: (config) => ({
      ...config,
      showTaskList: true,
      allowTaskEdit: true,
    }),
  },
  {
    oldType: 'mood_scale',
    newType: 'evening_mood',
    flowTypes: ['evening'],
    configTransform: (config) => {
      // Transform generic mood_scale to 5-state evening mood
      return {
        question: config.question || 'How was your day overall?',
        options: [
          { value: 'tough_day', label: 'Tough day', gradient: 'linear-gradient(180deg, rgba(180, 80, 60, 0.8) 0%, rgba(120, 50, 40, 0.9) 100%)' },
          { value: 'mixed', label: 'Mixed', gradient: 'linear-gradient(180deg, rgba(180, 130, 100, 0.8) 0%, rgba(140, 100, 80, 0.9) 100%)' },
          { value: 'steady', label: 'Steady', gradient: 'linear-gradient(180deg, rgba(140, 160, 140, 0.8) 0%, rgba(100, 120, 100, 0.9) 100%)' },
          { value: 'good_day', label: 'Good day', gradient: 'linear-gradient(180deg, rgba(100, 160, 130, 0.8) 0%, rgba(70, 130, 100, 0.9) 100%)' },
          { value: 'great_day', label: 'Great day!', gradient: 'linear-gradient(180deg, rgba(60, 140, 100, 0.8) 0%, rgba(40, 110, 80, 0.9) 100%)' },
        ],
      };
    },
  },
  {
    oldType: 'open_text',
    newType: 'evening_reflection',
    flowTypes: ['evening'],
    configTransform: (config) => ({
      question: config.question || "Anything you'd like to reflect on?",
      placeholder: config.placeholder || 'What stood out today — something you learned, noticed, felt grateful for, or that helped you move forward...',
      fieldName: 'reflectionText',
      showSkip: true,
      enableVoice: true,
    }),
  },
];

// Step type migrations for weekly flow
const WEEKLY_MIGRATIONS: StepMigration[] = [
  {
    oldType: 'progress_scale',
    newType: 'on_track_scale',
    flowTypes: ['weekly'],
    configTransform: (config) => ({
      question: 'Are you on track to achieve your goal?',
      subheading: 'Reflect on your week',
      options: [
        { value: 'off_track', label: 'No', gradient: 'linear-gradient(180deg, rgba(180, 80, 60, 0.8) 0%, rgba(120, 50, 40, 0.9) 100%)' },
        { value: 'not_sure', label: 'Not sure', gradient: 'linear-gradient(180deg, rgba(140, 130, 110, 0.8) 0%, rgba(100, 90, 80, 0.9) 100%)' },
        { value: 'on_track', label: 'Yes', gradient: 'linear-gradient(180deg, rgba(60, 140, 100, 0.8) 0%, rgba(40, 100, 70, 0.9) 100%)' },
      ],
    }),
  },
  {
    oldType: 'mood_scale',
    newType: 'momentum_progress',
    flowTypes: ['weekly'],
    configTransform: (config) => ({
      question: 'How are you progressing toward your goal?',
      showGoal: true,
      goalAchievedThreshold: 100,
      enableMomentum: true,
      enableAudioFeedback: true,
    }),
  },
];

// Open text field mappings for weekly flow
const WEEKLY_OPEN_TEXT_MAPPINGS: Record<string, { newType: CheckInStepType; fieldName: string; question: string; placeholder: string }> = {
  'wentWell': {
    newType: 'voice_text',
    fieldName: 'whatWentWell',
    question: 'What went well?',
    placeholder: "Write about what you're proud of this week...",
  },
  'obstacles': {
    newType: 'voice_text',
    fieldName: 'biggestObstacles',
    question: "What's been your biggest obstacle?",
    placeholder: "Share what's been challenging...",
  },
  'doDifferently': {
    newType: 'voice_text',
    fieldName: 'nextWeekPlan',
    question: 'What will you do differently next week?',
    placeholder: 'Share your plan for improvement...',
  },
  'nextWeekFocus': {
    newType: 'weekly_focus',
    fieldName: 'publicFocus',
    question: "What's your focus for next week?",
    placeholder: 'What will you prioritize?',
  },
};

// =============================================================================
// MIGRATION FUNCTIONS
// =============================================================================

interface MigrationResult {
  flowId: string;
  orgId: string;
  flowType: string;
  stepsUpdated: number;
  changes: string[];
}

async function migrateStep(
  stepRef: FirebaseFirestore.DocumentReference,
  stepData: Record<string, unknown>,
  flowType: 'evening' | 'weekly'
): Promise<{ updated: boolean; change: string | null }> {
  const stepType = stepData.type as string;
  const config = (stepData.config as { config?: Record<string, unknown> })?.config || {};

  let migration: StepMigration | undefined;
  let newConfig: Record<string, unknown> = config;
  let newType: CheckInStepType = stepType as CheckInStepType;

  // Check evening migrations
  if (flowType === 'evening') {
    migration = EVENING_MIGRATIONS.find(m => m.oldType === stepType);
    if (migration) {
      newType = migration.newType;
      newConfig = migration.configTransform ? migration.configTransform(config) : config;
    }

    // Special handling for completion step in evening flow
    if (stepType === 'completion') {
      newConfig = {
        ...config,
        flowType: 'evening',
        confettiCount: 100,
      };

      if (!isDryRun) {
        await stepRef.update({
          'config.config': newConfig,
        });
      }
      return { updated: true, change: `Updated completion step config for evening flow` };
    }
  }

  // Check weekly migrations
  if (flowType === 'weekly') {
    migration = WEEKLY_MIGRATIONS.find(m => m.oldType === stepType);
    if (migration) {
      newType = migration.newType;
      newConfig = migration.configTransform ? migration.configTransform(config) : config;
    }

    // Handle open_text to voice_text/weekly_focus conversion
    if (stepType === 'open_text') {
      const fieldName = config.fieldName as string;
      const mapping = WEEKLY_OPEN_TEXT_MAPPINGS[fieldName];
      if (mapping) {
        newType = mapping.newType;
        newConfig = {
          question: mapping.question,
          placeholder: mapping.placeholder,
          fieldName: mapping.fieldName,
          isRequired: false,
          enableVoice: true,
          ...(mapping.newType === 'weekly_focus' && {
            showAiSuggestion: true,
            showPublicBadge: true,
            showShareButton: true,
            showSkipButton: true,
          }),
        };
      }
    }

    // Special handling for completion step - convert to goal_achieved
    if (stepType === 'completion') {
      newType = 'goal_achieved';
      newConfig = {
        heading: config.heading || 'Great work reflecting on your week!',
        description: config.subheading || "Small steps lead to big wins—let's make next week even better.",
        emoji: '🎉',
        flowType: 'weekly',
        isGoalAchieved: false,
      };
    }

    // Update goal_achieved step to include new fields
    if (stepType === 'goal_achieved') {
      newConfig = {
        ...config,
        emoji: config.emoji || '💫',
        flowType: 'weekly',
        isGoalAchieved: true,
      };
    }
  }

  // Apply migration if type changed or config changed
  if (newType !== stepType || JSON.stringify(newConfig) !== JSON.stringify(config)) {
    if (!isDryRun) {
      await stepRef.update({
        type: newType,
        'config.type': newType,
        'config.config': newConfig,
      });
    }
    return {
      updated: true,
      change: `${stepType} → ${newType}${newType === stepType ? ' (config updated)' : ''}`
    };
  }

  return { updated: false, change: null };
}

async function migrateFlow(flowDoc: FirebaseFirestore.DocumentSnapshot): Promise<MigrationResult | null> {
  const flowData = flowDoc.data();
  if (!flowData) return null;

  const flowType = flowData.type as 'evening' | 'weekly';
  if (flowType !== 'evening' && flowType !== 'weekly') {
    return null; // Skip morning flows
  }

  const result: MigrationResult = {
    flowId: flowDoc.id,
    orgId: flowData.organizationId,
    flowType,
    stepsUpdated: 0,
    changes: [],
  };

  // Get all steps for this flow
  const stepsSnapshot = await flowDoc.ref.collection('steps').get();

  for (const stepDoc of stepsSnapshot.docs) {
    const stepData = stepDoc.data();
    const { updated, change } = await migrateStep(stepDoc.ref, stepData, flowType);

    if (updated && change) {
      result.stepsUpdated++;
      result.changes.push(change);
    }
  }

  return result.stepsUpdated > 0 ? result : null;
}

async function migrateTemplates(): Promise<number> {
  console.log('\n📋 Migrating flow templates...\n');

  const templatesSnapshot = await db.collection('checkInFlowTemplates').get();
  let updated = 0;

  for (const templateDoc of templatesSnapshot.docs) {
    const data = templateDoc.data();
    const templateType = data.key as string;

    if (templateType !== 'evening' && templateType !== 'weekly') {
      continue;
    }

    // Update defaultSteps with new types
    const defaultSteps = data.defaultSteps as Array<Record<string, unknown>>;
    if (!defaultSteps) continue;

    let hasChanges = false;
    const newSteps = defaultSteps.map((step) => {
      const stepType = step.type as string;
      const config = (step.config as { config?: Record<string, unknown> })?.config || {};

      // Find applicable migration
      const migrations = templateType === 'evening' ? EVENING_MIGRATIONS : WEEKLY_MIGRATIONS;
      const migration = migrations.find(m => m.oldType === stepType);

      if (migration) {
        hasChanges = true;
        const newConfig = migration.configTransform ? migration.configTransform(config) : config;
        return {
          ...step,
          type: migration.newType,
          config: {
            type: migration.newType,
            config: newConfig,
          },
        };
      }

      return step;
    });

    if (hasChanges) {
      if (!isDryRun) {
        await templateDoc.ref.update({
          defaultSteps: newSteps,
          updatedAt: new Date().toISOString(),
        });
      }
      updated++;
      console.log(`  ${isDryRun ? '[DRY-RUN] Would update' : 'Updated'} template: ${templateType}`);
    }
  }

  return updated;
}

async function main() {
  console.log('='.repeat(60));
  console.log('CHECK-IN FLOW MIGRATION SCRIPT');
  console.log('='.repeat(60));
  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be applied\n');
  }

  try {
    // Migrate templates first
    const templatesUpdated = await migrateTemplates();

    // Get all org check-in flows
    console.log('\n🔄 Migrating organization flows...\n');

    const flowsSnapshot = await db.collection('orgCheckInFlows').get();
    console.log(`  Found ${flowsSnapshot.size} total flows\n`);

    const results: MigrationResult[] = [];
    let skipped = 0;

    for (const flowDoc of flowsSnapshot.docs) {
      const result = await migrateFlow(flowDoc);
      if (result) {
        results.push(result);
        if (isVerbose) {
          console.log(`  ${isDryRun ? '[DRY-RUN]' : '✓'} Flow ${result.flowId.substring(0, 8)}... (${result.flowType})`);
          result.changes.forEach(c => console.log(`    - ${c}`));
        }
      } else {
        skipped++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nTemplates updated: ${templatesUpdated}`);
    console.log(`Flows migrated: ${results.length}`);
    console.log(`Flows skipped (no changes needed): ${skipped}`);
    console.log(`Total steps updated: ${results.reduce((sum, r) => sum + r.stepsUpdated, 0)}`);

    if (isDryRun) {
      console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.\n');
    } else {
      console.log('\n✅ Migration completed successfully!\n');
    }

  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
