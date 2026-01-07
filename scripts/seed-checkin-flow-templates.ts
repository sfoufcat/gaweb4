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
  // Note: No completion step - PlanDayStep has rocket animation and navigates home directly
];

const EVENING_TEMPLATE_STEPS: Omit<CheckInStep, 'id' | 'flowId' | 'createdAt' | 'updatedAt'>[] = [
  {
    order: 0,
    type: 'evening_task_review',
    name: 'Task Review',
    config: {
      type: 'evening_task_review',
      config: {
        heading: 'How did today go?',
        completedMessage: 'Amazing! You completed all your tasks!',
        partialMessage: 'Great effort! Every step counts.',
        noTasksMessage: 'No tasks were planned for today.',
        showTaskList: true,
        allowTaskEdit: true,
      },
    },
  },
  {
    order: 1,
    type: 'evening_mood',
    name: 'Day Evaluation',
    config: {
      type: 'evening_mood',
      config: {
        question: 'How was your day overall?',
        options: [
          { value: 'tough_day', label: 'Tough day', gradient: 'linear-gradient(180deg, rgba(180, 80, 60, 0.8) 0%, rgba(120, 50, 40, 0.9) 100%)' },
          { value: 'mixed', label: 'Mixed', gradient: 'linear-gradient(180deg, rgba(180, 130, 100, 0.8) 0%, rgba(140, 100, 80, 0.9) 100%)' },
          { value: 'steady', label: 'Steady', gradient: 'linear-gradient(180deg, rgba(140, 160, 140, 0.8) 0%, rgba(100, 120, 100, 0.9) 100%)' },
          { value: 'good_day', label: 'Good day', gradient: 'linear-gradient(180deg, rgba(100, 160, 130, 0.8) 0%, rgba(70, 130, 100, 0.9) 100%)' },
          { value: 'great_day', label: 'Great day!', gradient: 'linear-gradient(180deg, rgba(60, 140, 100, 0.8) 0%, rgba(40, 110, 80, 0.9) 100%)' },
        ],
      },
    },
  },
  {
    order: 2,
    type: 'evening_reflection',
    name: 'Evening Reflection',
    config: {
      type: 'evening_reflection',
      config: {
        question: "Anything you'd like to reflect on?",
        placeholder: 'What stood out today — something you learned, noticed, felt grateful for, or that helped you move forward...',
        fieldName: 'reflectionText',
        showSkip: true,
        enableVoice: true,
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
        flowType: 'evening',
        confettiCount: 100,
      },
    },
  },
];

const WEEKLY_TEMPLATE_STEPS: Omit<CheckInStep, 'id' | 'flowId' | 'createdAt' | 'updatedAt'>[] = [
  {
    order: 0,
    type: 'on_track_scale',
    name: 'On Track Check',
    config: {
      type: 'on_track_scale',
      config: {
        question: 'Are you on track to achieve your goal?',
        subheading: 'Reflect on your week',
        options: [
          { value: 'off_track', label: 'No', gradient: 'linear-gradient(180deg, rgba(180, 80, 60, 0.8) 0%, rgba(120, 50, 40, 0.9) 100%)' },
          { value: 'not_sure', label: 'Not sure', gradient: 'linear-gradient(180deg, rgba(140, 130, 110, 0.8) 0%, rgba(100, 90, 80, 0.9) 100%)' },
          { value: 'on_track', label: 'Yes', gradient: 'linear-gradient(180deg, rgba(60, 140, 100, 0.8) 0%, rgba(40, 100, 70, 0.9) 100%)' },
        ],
      },
    },
  },
  {
    order: 1,
    type: 'momentum_progress',
    name: 'Goal Progress',
    config: {
      type: 'momentum_progress',
      config: {
        question: 'How are you progressing toward your goal?',
        showGoal: true,
        goalAchievedThreshold: 100,
        enableMomentum: true,
        enableAudioFeedback: true,
      },
    },
  },
  {
    order: 2,
    type: 'voice_text',
    name: 'What Went Well',
    config: {
      type: 'voice_text',
      config: {
        question: 'What went well?',
        placeholder: "Write about what you're proud of this week...",
        fieldName: 'whatWentWell',
        isRequired: false,
        enableVoice: true,
      },
    },
  },
  {
    order: 3,
    type: 'voice_text',
    name: 'Biggest Obstacles',
    config: {
      type: 'voice_text',
      config: {
        question: "What's been your biggest obstacle?",
        placeholder: "Share what's been challenging...",
        fieldName: 'biggestObstacles',
        isRequired: false,
        enableVoice: true,
      },
    },
  },
  {
    order: 4,
    type: 'voice_text',
    name: 'Next Week Plan',
    config: {
      type: 'voice_text',
      config: {
        question: 'What will you do differently next week?',
        placeholder: 'Share your plan for improvement...',
        fieldName: 'nextWeekPlan',
        isRequired: false,
        enableVoice: true,
      },
    },
  },
  {
    order: 5,
    type: 'weekly_focus',
    name: 'Weekly Focus',
    config: {
      type: 'weekly_focus',
      config: {
        question: "What's your focus for next week?",
        placeholder: 'What will you prioritize?',
        fieldName: 'publicFocus',
        showAiSuggestion: true,
        showPublicBadge: true,
        showShareButton: true,
        showSkipButton: true,
      },
    },
  },
  {
    order: 6,
    type: 'goal_achieved',
    name: 'Week Closed',
    config: {
      type: 'goal_achieved',
      config: {
        heading: 'Great work reflecting on your week!',
        description: "Small steps lead to big wins—let's make next week even better.",
        emoji: '🎉',
        flowType: 'weekly',
        isGoalAchieved: false,
      },
    },
    conditions: [
      { field: 'goalAchieved', operator: 'neq', value: true },
    ],
  },
  {
    order: 7,
    type: 'goal_achieved',
    name: 'Goal Achieved',
    config: {
      type: 'goal_achieved',
      config: {
        heading: 'Goal achieved — well done!',
        emoji: '💫',
        flowType: 'weekly',
        isGoalAchieved: true,
      },
    },
    conditions: [
      { field: 'goalAchieved', operator: 'eq', value: true },
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

// Parse command line arguments
const args = process.argv.slice(2);
const shouldUpdateTemplates = args.includes('--update-templates');

async function seedTemplates() {
  console.log('🌱 Seeding check-in flow templates...\n');

  if (shouldUpdateTemplates) {
    console.log('⚠️  UPDATE MODE - Will update existing templates with latest step definitions\n');
  }

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
      const existingDoc = existingQuery.docs[0];
      
      if (shouldUpdateTemplates) {
        // Update existing template with latest steps
        const existingData = existingDoc.data();
        const newVersion = (existingData.version || 1) + 1;
        
        await existingDoc.ref.update({
          name: template.name,
          description: template.description,
          defaultSteps: template.steps,
          version: newVersion,
          updatedAt: now,
        });
        
        console.log(`  🔄 Updated template "${template.name}" to v${newVersion} (${existingDoc.id})`);
        templatesCreated.push(existingDoc.id);
      } else {
        console.log(`  ⏭️  Template "${template.name}" already exists, skipping... (use --update-templates to update)`);
        templatesCreated.push(existingDoc.id);
      }
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

