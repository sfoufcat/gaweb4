/**
 * Seed Script: Program Templates
 * 
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-templates.ts
 * Or: npx tsx scripts/seed-templates.ts
 * 
 * Seeds 10 fully-built program templates with complete content
 * 
 * Prerequisites:
 * - Firebase CLI logged in (firebase login)
 * - GOOGLE_APPLICATION_CREDENTIALS env var set, OR
 * - Running on Google Cloud with default credentials
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local if it exists
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  // Try service account credentials first, fall back to application default
  const hasServiceAccount = process.env.FIREBASE_PROJECT_ID && 
                            process.env.FIREBASE_CLIENT_EMAIL && 
                            process.env.FIREBASE_PRIVATE_KEY;
  
  if (hasServiceAccount) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // Use application default credentials (works if logged into Firebase CLI or on GCP)
    initializeApp({
      credential: applicationDefault(),
      projectId: 'gawebdev2-3191a',
    });
  }
}

const db = getFirestore();

// Types
interface ProgramTaskTemplate {
  label: string;
  type?: 'task' | 'habit' | 'learning' | 'admin';
  isPrimary: boolean;
  estimatedMinutes?: number;
  notes?: string;
  tag?: string;
}

interface ProgramHabitTemplate {
  title: string;
  description?: string;
  frequency: 'daily' | 'weekday' | 'custom';
}

interface ProgramFeature {
  icon?: string;
  title: string;
  description?: string;
}

interface ProgramFAQ {
  question: string;
  answer: string;
}

interface TemplateData {
  name: string;
  slug: string;
  description: string;
  previewDescription: string;
  category: 'business' | 'habits' | 'mindset' | 'health' | 'productivity' | 'relationships';
  tags: string[];
  lengthDays: number;
  type: 'group' | 'individual';
  suggestedPriceInCents: number;
  defaultHabits: ProgramHabitTemplate[];
  keyOutcomes: string[];
  features: ProgramFeature[];
  faqs: ProgramFAQ[];
  featured: boolean;
  // Day generator function
  generateDays: () => DayData[];
}

interface DayData {
  dayIndex: number;
  title: string;
  summary: string;
  dailyPrompt: string;
  tasks: ProgramTaskTemplate[];
}

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

const TEMPLATES: TemplateData[] = [
  // 1. 90-Day Client Acquisition Machine
  {
    name: '90-Day Client Acquisition Machine',
    slug: '90-day-client-acquisition',
    description: 'A comprehensive program designed to help coaches, consultants, and service providers build a predictable client acquisition system. Over 90 days, you\'ll master lead generation, discovery calls, and follow-up systems.',
    previewDescription: 'Build a predictable system to land 5+ ideal clients every month with proven outreach and sales strategies.',
    category: 'business',
    tags: ['clients', 'sales', 'lead generation', 'consulting', 'revenue'],
    lengthDays: 90,
    type: 'group',
    suggestedPriceInCents: 99700,
    featured: true,
    defaultHabits: [
      { title: 'Daily outreach (5 new contacts)', frequency: 'weekday' },
      { title: 'Review pipeline and follow up', frequency: 'daily' },
      { title: 'Content creation (15 mins)', frequency: 'weekday' },
    ],
    keyOutcomes: [
      'Build a consistent lead generation system that works on autopilot',
      'Master discovery calls that convert at 30%+ close rate',
      'Create content that attracts your ideal clients',
      'Develop a follow-up system so no lead falls through the cracks',
      'Hit your first (or next) $10K month',
      'Build a network of referral partners',
    ],
    features: [
      { icon: 'list-checks', title: '90 Daily Action Tasks', description: 'Clear, bite-sized actions every day' },
      { icon: 'users', title: 'Private Community', description: 'Connect with others on the same journey' },
      { icon: 'message-circle', title: 'Direct Coach Access', description: 'Get feedback when you need it' },
      { icon: 'target', title: 'Weekly Milestones', description: 'Track your progress with clear checkpoints' },
      { icon: 'file-text', title: 'Swipe Files & Templates', description: 'Proven scripts and templates to use' },
    ],
    faqs: [
      { question: 'How much time do I need per day?', answer: 'Plan for 30-60 minutes of focused action. Some days are lighter (15 mins), some require deeper work (90 mins).' },
      { question: 'What if I fall behind?', answer: 'Life happens! The program is self-paced. You can pause and catch up. The key is consistency over perfection.' },
      { question: 'Is there a refund policy?', answer: 'Yes, we offer a 14-day satisfaction guarantee. If you\'re not seeing value, reach out for a full refund.' },
      { question: 'What niche is this for?', answer: 'This works for any service-based business: coaches, consultants, agencies, freelancers, and B2B service providers.' },
      { question: 'Do I need prior sales experience?', answer: 'No! We start with fundamentals and build up. Whether you\'re new or experienced, you\'ll find actionable strategies.' },
    ],
    generateDays: () => generate90DayClientAcquisition(),
  },

  // 2. 21-Day Atomic Habits Implementation
  {
    name: '21-Day Atomic Habits Implementation',
    slug: '21-day-atomic-habits',
    description: 'Transform your daily routines using the proven principles from Atomic Habits. This program guides you through implementing habit stacking, environment design, and identity-based habit change.',
    previewDescription: 'Build lasting habits that stick using science-backed strategies from Atomic Habits.',
    category: 'habits',
    tags: ['habits', 'routines', 'behavior change', 'productivity', 'self-improvement'],
    lengthDays: 21,
    type: 'individual',
    suggestedPriceInCents: 29700,
    featured: true,
    defaultHabits: [
      { title: 'Morning habit stack (5 mins)', frequency: 'daily' },
      { title: 'Evening reflection', frequency: 'daily' },
      { title: 'Habit tracker update', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Identify and eliminate habits holding you back',
      'Design your environment for automatic success',
      'Master habit stacking to build powerful routines',
      'Create identity-based habits that last',
      'Build a morning routine that energizes your day',
    ],
    features: [
      { icon: 'calendar', title: '21 Guided Days', description: 'Step-by-step implementation' },
      { icon: 'brain', title: 'Science-Based Methods', description: 'Proven behavior change strategies' },
      { icon: 'layout', title: 'Habit Tracker', description: 'Visual progress tracking' },
      { icon: 'refresh-cw', title: 'Review Checkpoints', description: 'Weekly reviews for course correction' },
    ],
    faqs: [
      { question: 'Why 21 days?', answer: 'Research shows it takes about 21 days to form the initial neural pathways for a new habit. This program gets you past the critical first phase.' },
      { question: 'What habits should I focus on?', answer: 'We\'ll help you identify your "keystone habits" — the ones that create positive cascades in other areas of your life.' },
      { question: 'Is this based on the book?', answer: 'Inspired by Atomic Habits principles, but with practical daily actions and additional frameworks for implementation.' },
    ],
    generateDays: () => generate21DayHabits(),
  },

  // 3. 30-Day Launch Sprint
  {
    name: '30-Day Launch Sprint',
    slug: '30-day-launch-sprint',
    description: 'Launch your product, course, or service in 30 days with a proven sprint methodology. From positioning to pre-launch buzz to launch week execution.',
    previewDescription: 'Launch your next offer in 30 days with a battle-tested sprint framework.',
    category: 'business',
    tags: ['launch', 'marketing', 'product', 'course', 'sales'],
    lengthDays: 30,
    type: 'group',
    suggestedPriceInCents: 49700,
    featured: false,
    defaultHabits: [
      { title: 'Launch task completion', frequency: 'daily' },
      { title: 'Audience engagement (10 mins)', frequency: 'weekday' },
    ],
    keyOutcomes: [
      'Clarify your offer positioning and pricing',
      'Build pre-launch buzz and waitlist',
      'Create compelling launch content',
      'Execute a high-converting launch week',
      'Develop a repeatable launch playbook',
    ],
    features: [
      { icon: 'rocket', title: 'Launch Playbook', description: 'Day-by-day launch checklist' },
      { icon: 'file-text', title: 'Email Templates', description: 'Proven launch email sequences' },
      { icon: 'bar-chart-2', title: 'KPI Tracker', description: 'Track your launch metrics' },
    ],
    faqs: [
      { question: 'What if I don\'t have an audience yet?', answer: 'Week 1 focuses on rapid audience building. You\'ll learn guerrilla tactics to build launch momentum from scratch.' },
      { question: 'Can I use this for physical products?', answer: 'This is optimized for digital products and services. Physical product launches have different logistics.' },
    ],
    generateDays: () => generate30DayLaunch(),
  },

  // 4. 30-Day Confidence Builder
  {
    name: '30-Day Confidence Builder',
    slug: '30-day-confidence',
    description: 'Develop unshakeable self-confidence through daily mindset exercises, challenges, and reflection. Perfect for anyone looking to show up more boldly in their career and life.',
    previewDescription: 'Build genuine, lasting confidence through daily mindset exercises and real-world challenges.',
    category: 'mindset',
    tags: ['confidence', 'mindset', 'self-improvement', 'personal growth'],
    lengthDays: 30,
    type: 'individual',
    suggestedPriceInCents: 19700,
    featured: false,
    defaultHabits: [
      { title: 'Morning affirmations', frequency: 'daily' },
      { title: 'Confidence journaling', frequency: 'daily' },
      { title: 'One bold action', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Identify and reframe limiting beliefs',
      'Build a confident internal dialogue',
      'Take action despite fear',
      'Handle rejection and setbacks gracefully',
      'Project confidence in any situation',
    ],
    features: [
      { icon: 'heart', title: 'Daily Mindset Work', description: 'Rewire your internal narrative' },
      { icon: 'zap', title: 'Confidence Challenges', description: 'Real-world practice' },
      { icon: 'book-open', title: 'Reflection Prompts', description: 'Deep self-awareness exercises' },
    ],
    faqs: [
      { question: 'I\'m very introverted. Will this work for me?', answer: 'Absolutely! Confidence isn\'t about being extroverted. It\'s about feeling comfortable in your own skin. This program meets you where you are.' },
      { question: 'What kind of challenges are involved?', answer: 'Graduated challenges from small (compliment a stranger) to bigger (give a presentation). You control the pace.' },
    ],
    generateDays: () => generate30DayConfidence(),
  },

  // 5. 21-Day Niche Clarity
  {
    name: '21-Day Niche Clarity Sprint',
    slug: '21-day-niche-clarity',
    description: 'Finally nail down your niche, ideal client, and positioning. Stop being a generalist and become the go-to expert in your space.',
    previewDescription: 'Define your profitable niche and become the go-to expert in 21 days.',
    category: 'business',
    tags: ['niche', 'positioning', 'ideal client', 'branding', 'strategy'],
    lengthDays: 21,
    type: 'individual',
    suggestedPriceInCents: 19700,
    featured: false,
    defaultHabits: [
      { title: 'Niche research (15 mins)', frequency: 'weekday' },
      { title: 'Ideal client interview/outreach', frequency: 'weekday' },
    ],
    keyOutcomes: [
      'Identify your most profitable niche',
      'Create a detailed ideal client avatar',
      'Craft your unique positioning statement',
      'Validate your niche with real prospects',
      'Build your authority content plan',
    ],
    features: [
      { icon: 'target', title: 'Niche Selection Framework', description: 'Data-driven niche analysis' },
      { icon: 'user', title: 'Avatar Builder', description: 'Deep ideal client research' },
      { icon: 'message-square', title: 'Validation Scripts', description: 'Test your niche with real people' },
    ],
    faqs: [
      { question: 'What if I have multiple interests?', answer: 'We\'ll help you find the intersection of your skills, passions, and market demand. You don\'t have to give up variety.' },
      { question: 'I\'ve tried niching down before and it felt limiting.', answer: 'Good niching actually creates more freedom. You\'ll see why by Day 7.' },
    ],
    generateDays: () => generate21DayNiche(),
  },

  // 6. 7-Day Energy Reset
  {
    name: '7-Day Energy Reset',
    slug: '7-day-energy-reset',
    description: 'A quick but powerful reset to boost your energy levels through sleep optimization, nutrition basics, movement, and stress management.',
    previewDescription: 'Reset your energy in one week with simple sleep, nutrition, and movement upgrades.',
    category: 'health',
    tags: ['energy', 'sleep', 'nutrition', 'wellness', 'health'],
    lengthDays: 7,
    type: 'individual',
    suggestedPriceInCents: 0,
    featured: true,
    defaultHabits: [
      { title: 'Morning sunlight (10 mins)', frequency: 'daily' },
      { title: 'Movement break', frequency: 'daily' },
      { title: 'Wind-down routine', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Optimize your sleep for better recovery',
      'Identify energy-draining foods and habits',
      'Build a sustainable movement practice',
      'Manage stress with simple techniques',
      'Create an energy-boosting daily rhythm',
    ],
    features: [
      { icon: 'sun', title: 'Quick Daily Actions', description: '15-20 minute daily commitment' },
      { icon: 'moon', title: 'Sleep Optimization', description: 'Science-based sleep hacks' },
      { icon: 'activity', title: 'Energy Audit', description: 'Identify what drains you' },
    ],
    faqs: [
      { question: 'Is this a diet program?', answer: 'No strict diets. We focus on energy-boosting nutrition principles, not calorie counting.' },
      { question: 'I only have 7 days?', answer: 'This is designed as a reset — a foundation you can build on. Many participants repeat it quarterly.' },
    ],
    generateDays: () => generate7DayEnergy(),
  },

  // 7. 60-Day Peak Performance Protocol
  {
    name: '60-Day Peak Performance Protocol',
    slug: '60-day-peak-performance',
    description: 'A comprehensive system for achieving and maintaining peak mental and physical performance. Combines mindset training, energy management, and productivity systems.',
    previewDescription: 'Unlock your peak performance with this comprehensive 60-day mind-body protocol.',
    category: 'mindset',
    tags: ['performance', 'productivity', 'mindset', 'energy', 'focus'],
    lengthDays: 60,
    type: 'group',
    suggestedPriceInCents: 79700,
    featured: false,
    defaultHabits: [
      { title: 'Morning prime (20 mins)', frequency: 'daily' },
      { title: 'Deep work block (90 mins)', frequency: 'weekday' },
      { title: 'Evening review', frequency: 'daily' },
      { title: 'Weekly planning session', frequency: 'custom' },
    ],
    keyOutcomes: [
      'Design your optimal daily performance routine',
      'Master energy management across the day',
      'Achieve consistent deep work states',
      'Build mental resilience and recovery practices',
      'Create sustainable high performance habits',
    ],
    features: [
      { icon: 'trending-up', title: '60-Day Progression', description: 'Graduated intensity and complexity' },
      { icon: 'brain', title: 'Mental Training', description: 'Focus, resilience, and clarity' },
      { icon: 'battery-charging', title: 'Energy Systems', description: 'Physical and mental energy optimization' },
      { icon: 'clipboard', title: 'Weekly Reviews', description: 'Data-driven performance tracking' },
    ],
    faqs: [
      { question: 'Is this for athletes?', answer: 'This is designed for knowledge workers and entrepreneurs who want to perform at their best mentally and physically.' },
      { question: 'How much time per day?', answer: 'Expect 45-90 minutes daily, depending on the phase. Deep work time doesn\'t count — that\'s work you\'d do anyway.' },
    ],
    generateDays: () => generate60DayPeakPerformance(),
  },

  // 8. 30-Day Content Creator Launchpad
  {
    name: '30-Day Content Creator Launchpad',
    slug: '30-day-content-creator',
    description: 'Launch your content creation journey with a proven 30-day system. Build your content muscle, find your voice, and create a sustainable publishing rhythm.',
    previewDescription: 'Build your content creation habit and find your unique voice in 30 days.',
    category: 'business',
    tags: ['content', 'creator', 'writing', 'social media', 'audience'],
    lengthDays: 30,
    type: 'group',
    suggestedPriceInCents: 29700,
    featured: false,
    defaultHabits: [
      { title: 'Capture ideas (ongoing)', frequency: 'daily' },
      { title: 'Content creation session', frequency: 'weekday' },
      { title: 'Engage with audience (10 mins)', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Develop a consistent content creation habit',
      'Find your unique content voice and angle',
      'Build a content idea bank that never runs dry',
      'Master repurposing for multiple platforms',
      'Create your first 30 pieces of content',
    ],
    features: [
      { icon: 'pen-tool', title: 'Daily Prompts', description: 'Never face a blank page' },
      { icon: 'layers', title: 'Content Templates', description: 'Proven frameworks to use' },
      { icon: 'share-2', title: 'Distribution Guides', description: 'Get your content seen' },
    ],
    faqs: [
      { question: 'Which platform should I focus on?', answer: 'We\'ll help you choose based on your goals and audience. The principles work across platforms.' },
      { question: 'I\'m not a good writer.', answer: 'Content creation is a skill you build. Day 1 you is supposed to be worse than Day 30 you!' },
    ],
    generateDays: () => generate30DayContentCreator(),
  },

  // 9. 14-Day Digital Detox
  {
    name: '14-Day Digital Detox',
    slug: '14-day-digital-detox',
    description: 'Reclaim your attention and reduce digital overwhelm with this structured 14-day detox. Not about quitting tech — about building a healthier relationship with it.',
    previewDescription: 'Reclaim your attention and build a healthier relationship with technology.',
    category: 'productivity',
    tags: ['digital wellness', 'focus', 'attention', 'screen time', 'mindfulness'],
    lengthDays: 14,
    type: 'individual',
    suggestedPriceInCents: 0,
    featured: false,
    defaultHabits: [
      { title: 'Phone-free morning (first hour)', frequency: 'daily' },
      { title: 'Notification audit', frequency: 'daily' },
      { title: 'Screen-free wind-down', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Identify your digital triggers and time sinks',
      'Create phone-free rituals for better focus',
      'Reduce notification overload',
      'Build intentional technology boundaries',
      'Reclaim hours of productive time weekly',
    ],
    features: [
      { icon: 'smartphone-off', title: 'Gradual Approach', description: 'Not cold turkey — sustainable change' },
      { icon: 'clock', title: 'Time Audits', description: 'See where your attention goes' },
      { icon: 'shield', title: 'Boundary Scripts', description: 'Handle FOMO and social pressure' },
    ],
    faqs: [
      { question: 'Do I have to quit social media?', answer: 'No! This is about intentional use, not abstinence. You\'ll learn to use tech on your terms.' },
      { question: 'My job requires constant connectivity.', answer: 'We\'ll work with your constraints. Even small boundaries make a big difference.' },
    ],
    generateDays: () => generate14DayDigitalDetox(),
  },

  // 10. 21-Day Morning Routine Mastery
  {
    name: '21-Day Morning Routine Mastery',
    slug: '21-day-morning-routine',
    description: 'Design and implement your perfect morning routine. Move from chaotic mornings to a powerful ritual that sets you up for daily success.',
    previewDescription: 'Design and lock in a morning routine that energizes and focuses your entire day.',
    category: 'habits',
    tags: ['morning routine', 'habits', 'productivity', 'wellness', 'routine'],
    lengthDays: 21,
    type: 'individual',
    suggestedPriceInCents: 19700,
    featured: false,
    defaultHabits: [
      { title: 'Wake at consistent time', frequency: 'daily' },
      { title: 'Morning routine execution', frequency: 'daily' },
      { title: 'Evening prep for morning', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Wake up earlier without feeling tired',
      'Build a morning routine that fits your life',
      'Increase morning energy and focus',
      'Eliminate morning decision fatigue',
      'Create momentum that lasts all day',
    ],
    features: [
      { icon: 'sunrise', title: 'Wake-Up Optimization', description: 'Science of better waking' },
      { icon: 'layout', title: 'Routine Builder', description: 'Customize your perfect morning' },
      { icon: 'check-circle', title: 'Habit Stacking', description: 'Build powerful sequences' },
    ],
    faqs: [
      { question: 'I\'m not a morning person.', answer: 'Neither were most of our successful participants! We\'ll work with your chronotype, not against it.' },
      { question: 'How early do I need to wake up?', answer: 'That\'s up to you. The key is consistency and intentionality, not a specific time.' },
    ],
    generateDays: () => generate21DayMorningRoutine(),
  },
];

// ============================================================================
// DAY GENERATORS
// ============================================================================

function generate90DayClientAcquisition(): DayData[] {
  const days: DayData[] = [];
  
  // Phase 1: Foundation (Days 1-30)
  const phase1Themes = [
    'Define your ideal client avatar',
    'Map your client\'s journey',
    'Craft your unique value proposition',
    'Set up your CRM system',
    'Create your outreach templates',
    'Build your LinkedIn profile',
    'Identify 100 prospects',
    'Write your introduction script',
    'Practice your pitch',
    'Start your first outreach batch',
    'Follow up on cold leads',
    'Track and optimize messages',
    'Schedule discovery calls',
    'Prepare discovery call framework',
    'Complete your first discovery call',
    'Handle objections practice',
    'Refine your offer',
    'Create case study template',
    'Build referral ask script',
    'Review and optimize week 1-2',
    'Content strategy planning',
    'Create your first content piece',
    'Build email sequence',
    'Set up lead magnet',
    'Automate follow-up',
    'Partnership outreach',
    'Review metrics',
    'Optimize conversion points',
    'Scale outreach',
    'Phase 1 review and planning',
  ];
  
  for (let i = 1; i <= 30; i++) {
    days.push({
      dayIndex: i,
      title: phase1Themes[i - 1],
      summary: `Foundation phase - ${phase1Themes[i - 1]}`,
      dailyPrompt: `Day ${i}: Focus on ${phase1Themes[i - 1]}. Take imperfect action today.`,
      tasks: generateBusinessTasks(i, 'foundation'),
    });
  }
  
  // Phase 2: Scale (Days 31-60)
  for (let i = 31; i <= 60; i++) {
    days.push({
      dayIndex: i,
      title: `Scale Phase - Day ${i - 30}`,
      summary: 'Scaling your outreach and conversion systems',
      dailyPrompt: `Day ${i}: Time to scale what's working. Double down on your best channels.`,
      tasks: generateBusinessTasks(i, 'scale'),
    });
  }
  
  // Phase 3: Optimize (Days 61-90)
  for (let i = 61; i <= 90; i++) {
    days.push({
      dayIndex: i,
      title: `Optimize Phase - Day ${i - 60}`,
      summary: 'Fine-tuning for predictable results',
      dailyPrompt: `Day ${i}: Optimization phase. Small improvements compound into big results.`,
      tasks: generateBusinessTasks(i, 'optimize'),
    });
  }
  
  return days;
}

function generateBusinessTasks(day: number, phase: string): ProgramTaskTemplate[] {
  const baseTasks: ProgramTaskTemplate[] = [
    { label: 'Complete daily outreach (5 contacts)', isPrimary: true, estimatedMinutes: 30, tag: 'outreach' },
    { label: 'Update CRM with notes', isPrimary: false, estimatedMinutes: 10, tag: 'admin' },
  ];
  
  if (phase === 'foundation' && day <= 10) {
    baseTasks.push({ label: 'Complete day\'s training module', isPrimary: true, estimatedMinutes: 20, tag: 'learning' });
  }
  
  if (day % 7 === 0) {
    baseTasks.push({ label: 'Weekly review and planning', isPrimary: true, estimatedMinutes: 30, tag: 'review' });
  }
  
  if (phase === 'scale') {
    baseTasks.push({ label: 'Analyze conversion metrics', isPrimary: false, estimatedMinutes: 15, tag: 'analytics' });
  }
  
  return baseTasks;
}

function generate21DayHabits(): DayData[] {
  const themes = [
    'Habit audit - what\'s working, what\'s not',
    'Define your keystone habit',
    'Design your environment',
    'Make it obvious',
    'Habit stacking basics',
    'Create your morning stack',
    'Weekly review',
    'Make it attractive',
    'Temptation bundling',
    'Join a community',
    'Make it easy',
    'Two-minute rule',
    'Reduce friction',
    'Weekly review',
    'Make it satisfying',
    'Habit tracking setup',
    'Celebrate small wins',
    'Never miss twice',
    'Identity-based habits',
    'Rewrite your story',
    'Final integration',
  ];
  
  return themes.map((theme, i) => ({
    dayIndex: i + 1,
    title: theme,
    summary: `Day ${i + 1} of habit transformation`,
    dailyPrompt: `Today's focus: ${theme}. Small steps lead to big changes.`,
    tasks: [
      { label: `Complete: ${theme}`, isPrimary: true, estimatedMinutes: 20 },
      { label: 'Update habit tracker', isPrimary: true, estimatedMinutes: 5 },
      { label: 'Evening reflection', isPrimary: false, estimatedMinutes: 10 },
    ],
  }));
}

function generate30DayLaunch(): DayData[] {
  const phases = {
    'Week 1': 'Positioning & Offer',
    'Week 2': 'Content & Buzz',
    'Week 3': 'Pre-Launch',
    'Week 4': 'Launch Week',
    'Week 5': 'Wrap-up',
  };
  
  return Array.from({ length: 30 }, (_, i) => {
    const week = Math.ceil((i + 1) / 7);
    const weekPhase = Object.values(phases)[Math.min(week - 1, 4)];
    
    return {
      dayIndex: i + 1,
      title: `${weekPhase} - Day ${((i) % 7) + 1}`,
      summary: `Launch sprint day ${i + 1}`,
      dailyPrompt: `Launch Day ${i + 1}: Execute your ${weekPhase.toLowerCase()} tasks with focus.`,
      tasks: [
        { label: 'Primary launch task', isPrimary: true, estimatedMinutes: 45 },
        { label: 'Audience engagement', isPrimary: true, estimatedMinutes: 15 },
        { label: 'Track launch metrics', isPrimary: false, estimatedMinutes: 10 },
      ],
    };
  });
}

function generate30DayConfidence(): DayData[] {
  return Array.from({ length: 30 }, (_, i) => ({
    dayIndex: i + 1,
    title: `Confidence Day ${i + 1}`,
    summary: 'Building unshakeable self-confidence',
    dailyPrompt: `Day ${i + 1}: Your confidence grows with every small act of courage.`,
    tasks: [
      { label: 'Morning affirmations', isPrimary: true, estimatedMinutes: 5 },
      { label: 'Daily confidence challenge', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Reflection journaling', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Celebrate one win', isPrimary: false, estimatedMinutes: 5 },
    ],
  }));
}

function generate21DayNiche(): DayData[] {
  const themes = [
    'Skills and expertise inventory',
    'Passion and interest mapping',
    'Market demand research',
    'Competitor analysis',
    'Niche intersection exercise',
    'Initial niche hypotheses',
    'Week 1 review',
    'Ideal client research',
    'Pain point discovery',
    'Client interviews prep',
    'Conduct first interviews',
    'Analyze interview data',
    'Avatar creation',
    'Week 2 review',
    'Positioning statement draft',
    'Unique mechanism',
    'Authority content plan',
    'Test messaging',
    'Refine positioning',
    'Final validation',
    'Niche declaration',
  ];
  
  return themes.map((theme, i) => ({
    dayIndex: i + 1,
    title: theme,
    summary: `Niche clarity - ${theme}`,
    dailyPrompt: `Day ${i + 1}: ${theme}. Clarity comes from action, not just thinking.`,
    tasks: [
      { label: `Complete: ${theme}`, isPrimary: true, estimatedMinutes: 30 },
      { label: 'Document insights', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Research task', isPrimary: false, estimatedMinutes: 15 },
    ],
  }));
}

function generate7DayEnergy(): DayData[] {
  const themes = [
    'Energy audit and baseline',
    'Sleep foundation',
    'Morning light and movement',
    'Nutrition basics',
    'Stress management',
    'Movement optimization',
    'Integration and planning',
  ];
  
  return themes.map((theme, i) => ({
    dayIndex: i + 1,
    title: theme,
    summary: `Energy reset - ${theme}`,
    dailyPrompt: `Day ${i + 1}: ${theme}. Small changes, big energy gains.`,
    tasks: [
      { label: `Complete: ${theme}`, isPrimary: true, estimatedMinutes: 20 },
      { label: 'Energy tracking', isPrimary: true, estimatedMinutes: 5 },
      { label: 'Implement one change', isPrimary: true, estimatedMinutes: 10 },
    ],
  }));
}

function generate60DayPeakPerformance(): DayData[] {
  return Array.from({ length: 60 }, (_, i) => {
    const phase = i < 20 ? 'Foundation' : i < 40 ? 'Building' : 'Mastery';
    
    return {
      dayIndex: i + 1,
      title: `${phase} Phase - Day ${i + 1}`,
      summary: `Peak performance ${phase.toLowerCase()} phase`,
      dailyPrompt: `Day ${i + 1}: ${phase} phase. Consistency is your superpower.`,
      tasks: [
        { label: 'Morning prime routine', isPrimary: true, estimatedMinutes: 20 },
        { label: 'Deep work session', isPrimary: true, estimatedMinutes: 90 },
        { label: 'Energy management check', isPrimary: true, estimatedMinutes: 10 },
        { label: 'Evening review', isPrimary: false, estimatedMinutes: 10 },
        ...(i % 7 === 6 ? [{ label: 'Weekly planning', isPrimary: true, estimatedMinutes: 30 }] : []),
      ],
    };
  });
}

function generate30DayContentCreator(): DayData[] {
  return Array.from({ length: 30 }, (_, i) => ({
    dayIndex: i + 1,
    title: `Content Day ${i + 1}`,
    summary: 'Building your content creation muscle',
    dailyPrompt: `Day ${i + 1}: Create something. Publish something. Learn something.`,
    tasks: [
      { label: 'Capture 3 content ideas', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Create one piece of content', isPrimary: true, estimatedMinutes: 30 },
      { label: 'Engage with audience', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Review analytics', isPrimary: false, estimatedMinutes: 5 },
    ],
  }));
}

function generate14DayDigitalDetox(): DayData[] {
  const themes = [
    'Screen time audit',
    'Notification cleanse',
    'Phone-free morning',
    'App usage limits',
    'Social media boundaries',
    'Email batching',
    'Week 1 review',
    'Phone-free meals',
    'Digital sunset routine',
    'Boredom tolerance',
    'Mindful scrolling',
    'Focus blocks',
    'Tech-free activity',
    'New relationship with tech',
  ];
  
  return themes.map((theme, i) => ({
    dayIndex: i + 1,
    title: theme,
    summary: `Digital detox - ${theme}`,
    dailyPrompt: `Day ${i + 1}: ${theme}. Reclaim your attention.`,
    tasks: [
      { label: `Complete: ${theme}`, isPrimary: true, estimatedMinutes: 15 },
      { label: 'Track screen time', isPrimary: true, estimatedMinutes: 5 },
      { label: 'Reflection', isPrimary: false, estimatedMinutes: 5 },
    ],
  }));
}

function generate21DayMorningRoutine(): DayData[] {
  const themes = [
    'Current morning audit',
    'Ideal morning vision',
    'Wake time optimization',
    'First 5 minutes design',
    'Hydration habit',
    'Movement addition',
    'Week 1 review',
    'Mindset practice',
    'Priority setting',
    'Environment prep',
    'Evening routine link',
    'Energy management',
    'Adaptation practice',
    'Week 2 review',
    'Refinement',
    'Speed run practice',
    'Weekend variation',
    'Travel adaptation',
    'Obstacle planning',
    'Habit locking',
    'Morning mastery celebration',
  ];
  
  return themes.map((theme, i) => ({
    dayIndex: i + 1,
    title: theme,
    summary: `Morning mastery - ${theme}`,
    dailyPrompt: `Day ${i + 1}: ${theme}. Win the morning, win the day.`,
    tasks: [
      { label: 'Execute morning routine', isPrimary: true, estimatedMinutes: 30 },
      { label: `Complete: ${theme}`, isPrimary: true, estimatedMinutes: 15 },
      { label: 'Evening prep for tomorrow', isPrimary: true, estimatedMinutes: 10 },
    ],
  }));
}

// ============================================================================
// SEEDING FUNCTION
// ============================================================================

async function seedTemplates() {
  console.log('🌱 Starting template seeding...\n');
  
  for (const templateData of TEMPLATES) {
    try {
      // Check if template already exists by slug
      const existingQuery = await db
        .collection('program_templates')
        .where('slug', '==', templateData.slug)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        console.log(`⏭️  Skipping existing template: ${templateData.name}`);
        continue;
      }

      console.log(`📦 Creating template: ${templateData.name}`);
      
      // Create template document
      const templateRef = db.collection('program_templates').doc();
      const templateId = templateRef.id;
      const now = new Date().toISOString();
      
      const { generateDays, ...templateFields } = templateData;
      
      await templateRef.set({
        id: templateId,
        ...templateFields,
        testimonials: [],
        showEnrollmentCount: true,
        showCurriculum: true,
        usageCount: 0,
        createdBy: 'platform',
        status: 'published',
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      });
      
      // Generate and create days
      const days = generateDays();
      console.log(`   📅 Creating ${days.length} days...`);
      
      const batch = db.batch();
      
      for (const day of days) {
        const dayRef = db.collection('template_days').doc();
        batch.set(dayRef, {
          id: dayRef.id,
          templateId,
          ...day,
        });
      }
      
      await batch.commit();
      
      console.log(`   ✅ Created: ${templateData.name} (${templateId})\n`);
      
    } catch (error) {
      console.error(`   ❌ Error creating ${templateData.name}:`, error);
    }
  }
  
  console.log('\n🎉 Template seeding complete!');
}

// Run the seeding
seedTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });

