/**
 * Seed Check-in Flow Templates
 * 
 * This script creates the global check-in flow templates and ensures
 * all organizations have their default flow instances.
 * 
 * Usage:
 *   npx ts-node scripts/seed-checkin-flow-templates.ts
 * 
 * What it does:
 * 1. Creates/updates CheckInFlowTemplate documents for morning, evening, weekly
 * 2. For each organization, creates OrgCheckInFlow instances if they don't exist
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { CheckInFlowTemplate, OrgCheckInFlow, CheckInStep, CheckInStepType } from '../src/types';

// Initialize Firebase Admin using env vars (same as the app)
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials. Make sure to run with: doppler run -- npx tsx scripts/seed-checkin-flow-templates.ts');
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
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// =============================================================================
// TEMPLATE DEFINITIONS
// =============================================================================

const MORNING_TEMPLATE_STEPS: Omit<CheckInStep, 'id' | 'flowId' | 'createdAt' | 'updatedAt'>[] = [
  {
    order: 0,
    type: 'mood_scale',
    name: 'Emotional Check-in',
    config: {
      type: 'mood_scale',
      config: {
        question: 'How are you feeling today?',
        scaleType: 'emotional_state',
        options: [
          { value: 'low_stuck', label: 'Low / Stuck', color: 'linear-gradient(180deg, #2C1810 0%, #1A0A0A 50%, #0A0505 100%)' },
          { value: 'uneasy', label: 'Uneasy', color: 'linear-gradient(180deg, #4A2828 0%, #2C1818 50%, #1A0A0A 100%)' },
          { value: 'uncertain', label: 'Uncertain', color: 'linear-gradient(180deg, #7A9B9B 0%, #9B8B7B 50%, #B87A6A 100%)' },
          { value: 'neutral', label: 'Neutral', color: 'linear-gradient(180deg, #8BA89B 0%, #A8A090 50%, #B8A088 100%)' },
          { value: 'steady', label: 'Steady', color: 'linear-gradient(180deg, #6B9BAB 0%, #8BB8A8 50%, #A8C8B8 100%)' },
          { value: 'confident', label: 'Confident', color: 'linear-gradient(180deg, #5BBBAB 0%, #7BD8C8 50%, #A8E8D8 100%)' },
          { value: 'energized', label: 'Energized', color: 'linear-gradient(180deg, #4BDBD0 0%, #7BC8F0 50%, #B8D8FF 100%)' },
        ],
        skipCondition: {
          values: ['confident', 'energized'],
          skipToStepId: 'visualization', // Skip breathing and reframe
        },
      },
    },
  },
  {
    order: 1,
    type: 'explainer',
    name: 'Acceptance',
    config: {
      type: 'explainer',
      config: {
        heading: 'It\'s okay to feel this way',
        body: 'Take a moment to acknowledge your feelings without judgment. This is the first step to creating a positive shift in your day.',
        ctaText: 'Continue',
      },
    },
    conditions: [
      { field: 'emotionalState', operator: 'in', value: ['low_stuck', 'uneasy', 'uncertain', 'neutral', 'steady'] },
    ],
  },
  {
    order: 2,
    type: 'breathing',
    name: 'Calming Breath',
    config: {
      type: 'breathing',
      config: {
        heading: 'Take a calming breath',
        description: 'Follow the circle to reset your nervous system',
        pattern: { inhale: 4, hold: 2, exhale: 6 },
        cycles: 3,
      },
    },
    conditions: [
      { field: 'emotionalState', operator: 'in', value: ['low_stuck', 'uneasy', 'uncertain', 'neutral', 'steady'] },
    ],
  },
  {
    order: 3,
    type: 'reframe_input',
    name: 'Reframe Input',
    config: {
      type: 'reframe_input',
      config: {
        heading: 'What\'s on your mind?',
        placeholder: 'Share any thoughts or worries that are weighing on you...',
      },
    },
    conditions: [
      { field: 'emotionalState', operator: 'in', value: ['low_stuck', 'uneasy', 'uncertain'] },
    ],
  },
  {
    order: 4,
    type: 'ai_reframe',
    name: 'Reframe Response',
    config: {
      type: 'ai_reframe',
      config: {
        heading: 'A different perspective',
        loadingMessage: 'Finding a helpful perspective...',
      },
    },
    conditions: [
      { field: 'emotionalState', operator: 'in', value: ['low_stuck', 'uneasy', 'uncertain'] },
    ],
  },
  {
    order: 5,
    type: 'visualization',
    name: 'Manifestation',
    config: {
      type: 'visualization',
      config: {
        heading: 'Visualize your success',
        showGoal: true,
        showIdentity: true,
        durationSeconds: 60,
      },
    },
  },
  {
    order: 6,
    type: 'task_planner',
    name: 'Plan Your Day',
    config: {
      type: 'task_planner',
      config: {
        heading: 'Plan your day',
        description: 'What do you want to accomplish today?',
        showProgramTasks: true,
        allowAddTasks: true,
        showBacklog: true,
      },
    },
  },
  {
    order: 7,
    type: 'completion',
    name: 'Ready to Go',
    config: {
      type: 'completion',
      config: {
        heading: 'You\'re ready! 🚀',
        subheading: 'Go make today count.',
        showConfetti: true,
        buttonText: 'Start my day',
        variant: 'great_job',
      },
    },
  },
];

const EVENING_TEMPLATE_STEPS: Omit<CheckInStep, 'id' | 'flowId' | 'createdAt' | 'updatedAt'>[] = [
  {
    order: 0,
    type: 'task_review',
    name: 'Task Review',
    config: {
      type: 'task_review',
      config: {
        heading: 'How did you do today?',
        completedMessage: 'Amazing! You completed all your tasks! 🎉',
        partialMessage: 'Great effort! Every step counts.',
        noTasksMessage: 'No tasks were planned for today.',
      },
    },
  },
  {
    order: 1,
    type: 'mood_scale',
    name: 'Day Evaluation',
    config: {
      type: 'mood_scale',
      config: {
        question: 'How was your day overall?',
        scaleType: 'custom',
        options: [
          { value: 'tough', label: 'Tough day' },
          { value: 'okay', label: 'It was okay' },
          { value: 'good', label: 'Good day' },
          { value: 'great', label: 'Great day!' },
        ],
      },
    },
  },
  {
    order: 2,
    type: 'open_text',
    name: 'Evening Reflection',
    config: {
      type: 'open_text',
      config: {
        question: 'What\'s one thing you\'re grateful for today?',
        placeholder: 'Write your reflection...',
        fieldName: 'eveningReflection',
        isRequired: false,
      },
    },
  },
  {
    order: 3,
    type: 'completion',
    name: 'Day Closed',
    config: {
      type: 'completion',
      config: {
        heading: 'Day closed ✨',
        subheading: 'Rest, reset, and come back tomorrow with fresh energy.',
        showConfetti: true,
        buttonText: 'Finish day',
        variant: 'day_closed',
      },
    },
  },
];

const WEEKLY_TEMPLATE_STEPS: Omit<CheckInStep, 'id' | 'flowId' | 'createdAt' | 'updatedAt'>[] = [
  {
    order: 0,
    type: 'progress_scale',
    name: 'Goal Progress',
    config: {
      type: 'progress_scale',
      config: {
        question: 'Are you on track to achieve your goal?',
        description: 'Reflect on your progress this week',
        showGoal: true,
        goalAchievedThreshold: 100,
      },
    },
  },
  {
    order: 1,
    type: 'mood_scale',
    name: 'Week Evaluation',
    config: {
      type: 'mood_scale',
      config: {
        question: 'How do you feel about your week?',
        scaleType: 'on_track',
        options: [
          { value: 'off_track', label: 'Off track' },
          { value: 'not_sure', label: 'Not sure' },
          { value: 'on_track', label: 'On track' },
        ],
      },
    },
  },
  {
    order: 2,
    type: 'open_text',
    name: 'What Went Well',
    config: {
      type: 'open_text',
      config: {
        question: 'What went well this week?',
        placeholder: 'Share your wins, big or small...',
        fieldName: 'wentWell',
        isRequired: false,
      },
    },
  },
  {
    order: 3,
    type: 'open_text',
    name: 'Obstacles',
    config: {
      type: 'open_text',
      config: {
        question: 'What obstacles did you face?',
        placeholder: 'What got in your way?',
        fieldName: 'obstacles',
        isRequired: false,
      },
    },
  },
  {
    order: 4,
    type: 'open_text',
    name: 'Do Differently',
    config: {
      type: 'open_text',
      config: {
        question: 'What would you do differently?',
        placeholder: 'What lessons will you take forward?',
        fieldName: 'doDifferently',
        isRequired: false,
      },
    },
  },
  {
    order: 5,
    type: 'open_text',
    name: 'Next Week Focus',
    config: {
      type: 'open_text',
      config: {
        question: 'What\'s your main focus for next week?',
        placeholder: 'What will you prioritize?',
        fieldName: 'nextWeekFocus',
        isRequired: false,
      },
    },
  },
  {
    order: 6,
    type: 'completion',
    name: 'Week Closed',
    config: {
      type: 'completion',
      config: {
        heading: 'Great work reflecting! 🎉',
        subheading: 'Small steps lead to big wins—let\'s make next week even better.',
        showConfetti: true,
        buttonText: 'Close my week',
        variant: 'week_closed',
      },
    },
  },
  {
    order: 7,
    type: 'goal_achieved',
    name: 'Goal Achieved',
    config: {
      type: 'goal_achieved',
      config: {
        heading: 'Goal achieved — well done! 💫',
        description: 'You reached your goal — that\'s a milestone worth celebrating. Your effort and consistency are really paying off.\n\nIf you\'re ready, set a new goal to keep your momentum going. Or skip for now and enjoy the win — you\'ve earned it.',
        showCreateNewGoal: true,
        showSkipOption: true,
      },
    },
    conditions: [
      { field: 'weeklyProgress', operator: 'gte', value: 100 },
    ],
  },
];

const TEMPLATES: { key: 'morning' | 'evening' | 'weekly'; name: string; description: string; steps: typeof MORNING_TEMPLATE_STEPS }[] = [
  {
    key: 'morning',
    name: 'Morning Check-in',
    description: 'Start your day with intention. Includes emotional check-in, breathing, reframe with AI, visualization, and task planning.',
    steps: MORNING_TEMPLATE_STEPS,
  },
  {
    key: 'evening',
    name: 'Evening Check-in',
    description: 'Close your day mindfully. Review tasks, evaluate your day, and reflect on gratitude.',
    steps: EVENING_TEMPLATE_STEPS,
  },
  {
    key: 'weekly',
    name: 'Weekly Reflection',
    description: 'Reflect on your week. Track goal progress, celebrate wins, identify obstacles, and set focus for next week.',
    steps: WEEKLY_TEMPLATE_STEPS,
  },
];

// =============================================================================
// MAIN SCRIPT
// =============================================================================

async function seedTemplates() {
  console.log('🌱 Seeding check-in flow templates...\n');

  const now = new Date().toISOString();
  const templatesCreated: string[] = [];

  for (const template of TEMPLATES) {
    // Check if template already exists
    const existingQuery = await db
      .collection('checkInFlowTemplates')
      .where('key', '==', template.key)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      console.log(`  ⏭️  Template "${template.name}" already exists, skipping...`);
      templatesCreated.push(existingQuery.docs[0].id);
      continue;
    }

    // Create template
    const templateData: Omit<CheckInFlowTemplate, 'id'> = {
      key: template.key,
      name: template.name,
      description: template.description,
      defaultSteps: template.steps,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('checkInFlowTemplates').add(templateData);
    console.log(`  ✅ Created template "${template.name}" (${docRef.id})`);
    templatesCreated.push(docRef.id);
  }

  console.log(`\n📋 Templates ready: ${templatesCreated.length}\n`);
  return templatesCreated;
}

async function ensureOrgFlows() {
  console.log('🏢 Ensuring organization check-in flows...\n');

  // Get all templates
  const templatesSnapshot = await db.collection('checkInFlowTemplates').get();
  const templates = new Map<string, CheckInFlowTemplate>();
  templatesSnapshot.docs.forEach(doc => {
    templates.set(doc.data().key, { id: doc.id, ...doc.data() } as CheckInFlowTemplate);
  });

  // Get all organizations (from Clerk sync or other source)
  // For this script, we'll look for organizations that have users
  const usersSnapshot = await db.collection('users').get();
  const orgIds = new Set<string>();
  
  usersSnapshot.docs.forEach(doc => {
    const orgId = doc.data().organizationId;
    if (orgId) {
      orgIds.add(orgId);
    }
  });

  console.log(`  Found ${orgIds.size} organizations with users\n`);

  let created = 0;
  let skipped = 0;

  for (const orgId of orgIds) {
    // Check existing flows for this org
    const existingFlowsSnapshot = await db
      .collection('orgCheckInFlows')
      .where('organizationId', '==', orgId)
      .where('isSystemDefault', '==', true)
      .get();

    const existingTypes = new Set<string>();
    existingFlowsSnapshot.docs.forEach(doc => {
      existingTypes.add(doc.data().type);
    });

    // Create missing flows
    for (const [key, template] of templates) {
      if (existingTypes.has(key)) {
        skipped++;
        continue;
      }

      const now = new Date().toISOString();

      // Create the flow
      const flowData: Omit<OrgCheckInFlow, 'id'> = {
        organizationId: orgId,
        name: template.name,
        type: key as 'morning' | 'evening' | 'weekly',
        description: template.description,
        enabled: true,
        stepCount: template.defaultSteps.length,
        createdFromTemplateId: template.id,
        templateVersion: template.version,
        isSystemDefault: true,
        createdByUserId: 'system',
        createdAt: now,
        updatedAt: now,
      };

      const flowRef = await db.collection('orgCheckInFlows').add(flowData);

      // Create steps
      const batch = db.batch();
      template.defaultSteps.forEach((step, index) => {
        const stepRef = db
          .collection('orgCheckInFlows')
          .doc(flowRef.id)
          .collection('steps')
          .doc();

        batch.set(stepRef, {
          flowId: flowRef.id,
          order: step.order ?? index,
          type: step.type,
          name: step.name,
          config: step.config,
          conditions: step.conditions,
          conditionLogic: step.conditionLogic,
          createdAt: now,
          updatedAt: now,
        });
      });

      await batch.commit();
      created++;
      console.log(`  ✅ Created ${key} flow for org ${orgId.substring(0, 8)}...`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  - Created: ${created} flows`);
  console.log(`  - Skipped (already exist): ${skipped} flows\n`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('CHECK-IN FLOW TEMPLATES SEED SCRIPT');
  console.log('='.repeat(60));
  console.log('');

  try {
    await seedTemplates();
    await ensureOrgFlows();

    console.log('✅ Seed completed successfully!\n');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();

