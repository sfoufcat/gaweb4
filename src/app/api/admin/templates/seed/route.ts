/**
 * Admin API: Seed Templates
 * 
 * POST /api/admin/templates/seed - Seed program templates into Firestore
 * 
 * This is a protected admin-only endpoint that creates initial program templates.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

// Template data
const TEMPLATES = [
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
      'A repeatable system that generates 10+ qualified leads per week',
      'Confidence in discovery calls with a 40%+ close rate',
      'Clear positioning that attracts your ideal clients',
      'Automated follow-up sequences that nurture leads',
      'A content strategy that builds authority in your niche',
    ],
    features: [
      { title: 'Lead Generation Playbook', description: 'Step-by-step outreach templates and scripts' },
      { title: 'Discovery Call Framework', description: 'Proven structure to qualify and close clients' },
      { title: 'Pipeline Management System', description: 'Track and nurture every opportunity' },
      { title: 'Weekly Group Calls', description: 'Live coaching and hot seat opportunities' },
    ],
    faqs: [
      { question: 'How much time do I need to commit?', answer: 'Plan for 1-2 hours daily for outreach and learning, plus weekly group calls.' },
      { question: 'What if I\'m just starting out?', answer: 'This program works for new coaches too. We\'ll help you define your niche and offer first.' },
      { question: 'Is there a money-back guarantee?', answer: 'Yes, if you complete all tasks in the first 30 days and don\'t see results, we\'ll refund you.' },
    ],
  },
  {
    name: '21-Day Atomic Habits Implementation',
    slug: '21-day-atomic-habits',
    description: 'Transform your daily routines using the proven principles from Atomic Habits. This program guides you through building keystone habits, breaking bad ones, and creating systems for lasting change.',
    previewDescription: 'Build 3 keystone habits that stick using science-backed behavior design principles.',
    category: 'habits',
    tags: ['habits', 'productivity', 'behavior change', 'routines', 'self-improvement'],
    lengthDays: 21,
    type: 'individual',
    suggestedPriceInCents: 29700,
    featured: true,
    defaultHabits: [
      { title: 'Morning habit stack', frequency: 'daily' },
      { title: 'Evening reflection', frequency: 'daily' },
      { title: 'Habit tracking review', frequency: 'daily' },
    ],
    keyOutcomes: [
      '3 keystone habits established and running on autopilot',
      'Understanding of habit loops and how to design them',
      'Environment optimized to support your goals',
      'A personalized habit stacking system',
      'Tools to break unwanted habits effectively',
    ],
    features: [
      { title: 'Daily Habit Lessons', description: '10-minute lessons on habit science' },
      { title: 'Habit Design Worksheets', description: 'Plan and track your habit stacks' },
      { title: 'Environment Audit Guide', description: 'Optimize your space for success' },
    ],
    faqs: [
      { question: 'What habits can I build?', answer: 'Any habits you choose! Common ones include exercise, meditation, reading, journaling, or professional skills.' },
      { question: 'What if I miss a day?', answer: 'No problem. The program teaches you the "never miss twice" principle and how to recover from slips.' },
    ],
  },
  {
    name: '30-Day Launch Sprint',
    slug: '30-day-launch-sprint',
    description: 'Take your idea from concept to launched product in 30 days. This intensive program provides daily tasks, accountability, and proven frameworks to help you ship faster.',
    previewDescription: 'Launch your product, course, or service in 30 days with a proven sprint framework.',
    category: 'business',
    tags: ['launch', 'product', 'startup', 'entrepreneurship', 'shipping'],
    lengthDays: 30,
    type: 'group',
    suggestedPriceInCents: 49700,
    featured: false,
    defaultHabits: [
      { title: 'Daily shipping (make progress)', frequency: 'daily' },
      { title: 'Share update in community', frequency: 'daily' },
    ],
    keyOutcomes: [
      'A launched product, course, or service',
      'Your first customers or users',
      'A repeatable launch playbook',
      'Lessons learned for your next launch',
    ],
    features: [
      { title: 'Daily Sprint Tasks', description: 'Clear action items to keep momentum' },
      { title: 'Launch Checklist', description: 'Everything you need before going live' },
      { title: 'Community Accountability', description: 'Build in public with fellow launchers' },
    ],
    faqs: [
      { question: 'What can I launch?', answer: 'Digital products, courses, services, apps, newsletters - anything you want to put into the world.' },
      { question: 'What if I need more time?', answer: 'The program teaches you to launch an MVP. You can always iterate and improve after launch.' },
    ],
  },
  {
    name: '30-Day Confidence Builder',
    slug: '30-day-confidence-builder',
    description: 'Develop unshakeable self-confidence through daily practices, mindset work, and progressive challenges. This program combines psychology-backed techniques with practical exercises.',
    previewDescription: 'Build lasting confidence through daily mindset practices and progressive challenges.',
    category: 'mindset',
    tags: ['confidence', 'mindset', 'self-esteem', 'personal growth', 'psychology'],
    lengthDays: 30,
    type: 'individual',
    suggestedPriceInCents: 19700,
    featured: false,
    defaultHabits: [
      { title: 'Morning affirmations', frequency: 'daily' },
      { title: 'Daily confidence challenge', frequency: 'daily' },
      { title: 'Evening wins journal', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Stronger sense of self-worth and value',
      'Ability to handle rejection and setbacks',
      'Comfort speaking up and sharing opinions',
      'Reduced social anxiety in challenging situations',
    ],
    features: [
      { title: 'Daily Confidence Lessons', description: 'Psychology-backed techniques' },
      { title: 'Progressive Challenges', description: 'Gradually expand your comfort zone' },
      { title: 'Mindset Reframe Toolkit', description: 'Transform negative self-talk' },
    ],
    faqs: [
      { question: 'I have severe anxiety. Is this for me?', answer: 'This program is for general confidence building. If you have clinical anxiety, please work with a therapist alongside this program.' },
    ],
  },
  {
    name: '7-Day Energy Reset',
    slug: '7-day-energy-reset',
    description: 'Reset your energy levels in just one week. This short program focuses on sleep, nutrition, movement, and stress management to help you feel more vibrant and focused.',
    previewDescription: 'Boost your energy and vitality in just 7 days with science-backed wellness practices.',
    category: 'health',
    tags: ['energy', 'health', 'wellness', 'sleep', 'nutrition'],
    lengthDays: 7,
    type: 'individual',
    suggestedPriceInCents: 0,
    featured: true,
    defaultHabits: [
      { title: 'Morning sunlight (10 mins)', frequency: 'daily' },
      { title: 'Movement break every 2 hours', frequency: 'daily' },
      { title: 'No screens 1 hour before bed', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Better sleep quality and morning energy',
      'Reduced afternoon energy crashes',
      'Simple nutrition habits for sustained energy',
      'Stress management techniques that work',
    ],
    features: [
      { title: 'Daily Energy Protocols', description: 'Simple routines for maximum energy' },
      { title: 'Sleep Optimization Guide', description: 'Improve sleep quality immediately' },
      { title: 'Quick Energy Recipes', description: 'Meals that fuel, not drain' },
    ],
    faqs: [
      { question: 'Do I need to buy supplements?', answer: 'No! This program focuses on lifestyle changes, not supplements.' },
    ],
  },
  {
    name: '60-Day Peak Performance Protocol',
    slug: '60-day-peak-performance',
    description: 'Optimize every area of your life for peak performance. This comprehensive program covers physical health, mental clarity, emotional intelligence, and professional excellence.',
    previewDescription: 'Achieve peak performance in health, mind, and career with a comprehensive 60-day protocol.',
    category: 'productivity',
    tags: ['performance', 'optimization', 'health', 'productivity', 'excellence'],
    lengthDays: 60,
    type: 'group',
    suggestedPriceInCents: 79700,
    featured: false,
    defaultHabits: [
      { title: 'Morning routine (exercise + meditation)', frequency: 'daily' },
      { title: 'Deep work block (2+ hours)', frequency: 'weekday' },
      { title: 'Weekly review and planning', frequency: 'custom' },
    ],
    keyOutcomes: [
      'Optimized morning and evening routines',
      'Doubled deep work capacity',
      'Better physical fitness and energy',
      'Enhanced focus and mental clarity',
      'Improved emotional regulation',
    ],
    features: [
      { title: 'Comprehensive Assessment', description: 'Identify your performance gaps' },
      { title: 'Custom Protocol Design', description: 'Personalized optimization plan' },
      { title: 'Biweekly Coaching Calls', description: 'Troubleshoot and adjust your protocol' },
      { title: 'Performance Tracking Tools', description: 'Measure what matters' },
    ],
    faqs: [
      { question: 'How much time does this take?', answer: 'Plan for 2-3 hours daily including exercise, deep work, and learning.' },
      { question: 'Can I customize the protocol?', answer: 'Absolutely. The program provides a framework you can adapt to your life and goals.' },
    ],
  },
  {
    name: '30-Day Content Creator Launchpad',
    slug: '30-day-content-creator',
    description: 'Launch your content creation journey with a sustainable system. Learn to create, batch, and distribute content that builds your audience and establishes your authority.',
    previewDescription: 'Build a sustainable content creation system and grow your audience in 30 days.',
    category: 'business',
    tags: ['content', 'social media', 'creator', 'audience', 'marketing'],
    lengthDays: 30,
    type: 'group',
    suggestedPriceInCents: 39700,
    featured: false,
    defaultHabits: [
      { title: 'Create one piece of content', frequency: 'weekday' },
      { title: 'Engage with audience (15 mins)', frequency: 'daily' },
      { title: 'Content ideas capture', frequency: 'daily' },
    ],
    keyOutcomes: [
      '30 pieces of content published',
      'A sustainable content creation system',
      'Your unique content voice and style',
      'A growing audience of engaged followers',
      'Repurposing skills to maximize reach',
    ],
    features: [
      { title: 'Content Strategy Framework', description: 'Plan content that resonates' },
      { title: 'Batching & Scheduling System', description: 'Create more in less time' },
      { title: 'Platform-Specific Guides', description: 'Optimize for each platform' },
    ],
    faqs: [
      { question: 'What platforms does this cover?', answer: 'The principles work everywhere, with specific tactics for LinkedIn, Twitter, Instagram, and YouTube.' },
      { question: 'I\'m not a natural writer. Can I still do this?', answer: 'Yes! We\'ll help you find your format - whether that\'s writing, video, audio, or visual content.' },
    ],
  },
  {
    name: '14-Day Digital Detox',
    slug: '14-day-digital-detox',
    description: 'Reclaim your attention and rebuild a healthy relationship with technology. This program guides you through a progressive digital declutter while building better habits.',
    previewDescription: 'Reclaim your attention and build a healthier relationship with technology.',
    category: 'mindset',
    tags: ['digital wellness', 'attention', 'focus', 'mindfulness', 'technology'],
    lengthDays: 14,
    type: 'individual',
    suggestedPriceInCents: 0,
    featured: false,
    defaultHabits: [
      { title: 'Phone-free morning (first hour)', frequency: 'daily' },
      { title: 'Single-tasking blocks', frequency: 'daily' },
      { title: 'Tech-free evening wind-down', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Reduced screen time and phone pickups',
      'Longer attention span and focus',
      'Better sleep without late-night scrolling',
      'More present in conversations and activities',
      'A sustainable digital wellness routine',
    ],
    features: [
      { title: 'Progressive Detox Protocol', description: 'Gradually reduce digital dependency' },
      { title: 'App Audit Worksheet', description: 'Identify what stays and what goes' },
      { title: 'Replacement Activities Guide', description: 'Fill the void meaningfully' },
    ],
    faqs: [
      { question: 'Do I have to quit social media?', answer: 'No! The goal is intentional use, not elimination. You\'ll define your own boundaries.' },
      { question: 'What about work requirements?', answer: 'We account for necessary work tech use. The focus is on reducing mindless consumption.' },
    ],
  },
  {
    name: '21-Day Morning Routine Mastery',
    slug: '21-day-morning-routine',
    description: 'Design and implement a powerful morning routine that sets you up for success every day. Based on research and the practices of high performers.',
    previewDescription: 'Create a powerful morning routine that transforms your energy and productivity.',
    category: 'productivity',
    tags: ['morning routine', 'productivity', 'habits', 'energy', 'success'],
    lengthDays: 21,
    type: 'individual',
    suggestedPriceInCents: 19700,
    featured: false,
    defaultHabits: [
      { title: 'Wake at chosen time', frequency: 'daily' },
      { title: 'Complete morning routine', frequency: 'daily' },
      { title: 'Evening preparation', frequency: 'daily' },
    ],
    keyOutcomes: [
      'A personalized morning routine that sticks',
      'Consistent wake-up time without hitting snooze',
      'More energy and focus throughout the day',
      'A sense of accomplishment before most people wake up',
      'Better evening habits that support morning success',
    ],
    features: [
      { title: 'Routine Design Workshop', description: 'Build your ideal morning' },
      { title: 'Wake-Up Training Protocol', description: 'Become a morning person' },
      { title: 'Evening Routine Guide', description: 'Set tomorrow up for success' },
    ],
    faqs: [
      { question: 'I\'m not a morning person. Can this work for me?', answer: 'Absolutely! The program includes specific techniques to shift your chronotype gradually.' },
      { question: 'How long should my routine be?', answer: 'That\'s up to you. We\'ll help you design one that fits your life, whether it\'s 20 minutes or 2 hours.' },
    ],
  },
  {
    name: '21-Day Relationship Reboot',
    slug: '21-day-relationship-reboot',
    description: 'Strengthen your most important relationships through daily communication exercises, quality time practices, and conflict resolution skills.',
    previewDescription: 'Deepen your connections and improve communication in all your relationships.',
    category: 'relationships',
    tags: ['relationships', 'communication', 'connection', 'love', 'family'],
    lengthDays: 21,
    type: 'individual',
    suggestedPriceInCents: 29700,
    featured: false,
    defaultHabits: [
      { title: 'Daily appreciation expression', frequency: 'daily' },
      { title: 'Quality time (undistracted)', frequency: 'daily' },
      { title: 'Active listening practice', frequency: 'daily' },
    ],
    keyOutcomes: [
      'Deeper emotional connection with loved ones',
      'Better conflict resolution skills',
      'Improved communication patterns',
      'More quality time and shared experiences',
      'Stronger appreciation and gratitude practices',
    ],
    features: [
      { title: 'Communication Exercises', description: 'Daily practices for better connection' },
      { title: 'Conflict Resolution Framework', description: 'Navigate disagreements constructively' },
      { title: 'Quality Time Ideas', description: 'Meaningful activities for any relationship' },
    ],
    faqs: [
      { question: 'What types of relationships does this cover?', answer: 'Romantic partners, family, friendships, and professional relationships - the principles apply to all.' },
      { question: 'Does my partner need to participate?', answer: 'It helps, but you can see improvements even when practicing alone.' },
    ],
  },
];

// Simple day generator for each template
function generateDays(template: typeof TEMPLATES[0]) {
  const days = [];
  for (let i = 1; i <= template.lengthDays; i++) {
    const weekNum = Math.ceil(i / 7);
    days.push({
      dayIndex: i,
      title: `Day ${i}: ${getDayTitle(template.category, i, weekNum)}`,
      summary: getDaySummary(template.category, i, weekNum),
      dailyPrompt: getDailyPrompt(template.category, i),
      tasks: generateDayTasks(template.category, i, weekNum),
    });
  }
  return days;
}

function getDayTitle(category: string, day: number, week: number): string {
  const titles: Record<string, string[]> = {
    business: ['Foundation', 'Strategy', 'Outreach', 'Follow-up', 'Optimization', 'Scaling', 'Review'],
    habits: ['Awareness', 'Design', 'Implementation', 'Tracking', 'Refinement', 'Stacking', 'Automation'],
    mindset: ['Self-Assessment', 'Reframing', 'Practice', 'Challenge', 'Integration', 'Growth', 'Reflection'],
    health: ['Assessment', 'Nutrition', 'Movement', 'Sleep', 'Recovery', 'Energy', 'Balance'],
    productivity: ['Audit', 'Planning', 'Focus', 'Execution', 'Review', 'Optimization', 'Mastery'],
    relationships: ['Connection', 'Communication', 'Quality Time', 'Appreciation', 'Resolution', 'Growth', 'Celebration'],
  };
  const dayOfWeek = ((day - 1) % 7);
  return titles[category]?.[dayOfWeek] || 'Progress';
}

function getDaySummary(category: string, day: number, week: number): string {
  return `Week ${week} - Focus on building momentum and implementing key ${category} strategies.`;
}

function getDailyPrompt(category: string, day: number): string {
  const prompts: Record<string, string[]> = {
    business: [
      'What is one prospect you can reach out to today?',
      'How can you add value to someone in your network today?',
      'What objection do you need to prepare for?',
    ],
    habits: [
      'What will make today a win for your habits?',
      'How can you make your target habit easier today?',
      'What obstacle might get in your way, and how will you overcome it?',
    ],
    mindset: [
      'What is one limiting belief you can challenge today?',
      'How can you practice courage today?',
      'What are you grateful for right now?',
    ],
    health: [
      'How will you move your body today?',
      'What one healthy choice can you make for your next meal?',
      'How will you prioritize rest today?',
    ],
    productivity: [
      'What is your most important task today?',
      'How can you protect your focus time?',
      'What can you eliminate or delegate?',
    ],
    relationships: [
      'Who can you show appreciation to today?',
      'How can you be more present in your interactions?',
      'What is one way you can listen better today?',
    ],
  };
  const promptSet = prompts[category] || prompts.habits;
  return promptSet[day % promptSet.length];
}

function generateDayTasks(category: string, day: number, week: number) {
  const baseTasks = [
    { label: 'Complete daily lesson', type: 'learning', isPrimary: true, estimatedMinutes: 15 },
    { label: 'Practice exercise', type: 'task', isPrimary: true, estimatedMinutes: 30 },
    { label: 'Reflect and journal', type: 'task', isPrimary: false, estimatedMinutes: 10 },
  ];
  
  // Add category-specific tasks
  const categoryTasks: Record<string, { label: string; type: string; isPrimary: boolean; estimatedMinutes: number }[]> = {
    business: [
      { label: 'Reach out to 5 prospects', type: 'task', isPrimary: true, estimatedMinutes: 45 },
    ],
    habits: [
      { label: 'Track all habits', type: 'habit', isPrimary: true, estimatedMinutes: 5 },
    ],
    health: [
      { label: 'Complete workout', type: 'task', isPrimary: true, estimatedMinutes: 45 },
    ],
    productivity: [
      { label: 'Complete deep work session', type: 'task', isPrimary: true, estimatedMinutes: 120 },
    ],
  };

  return [...baseTasks, ...(categoryTasks[category] || [])];
}

export async function POST() {
  try {
    const authResult = await auth();
    const { userId } = authResult;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin (you can enhance this check)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log('[SEED_TEMPLATES] Starting template seeding...');
    
    const results = {
      created: [] as string[],
      skipped: [] as string[],
      errors: [] as string[],
    };

    for (const templateData of TEMPLATES) {
      try {
        // Check if template already exists by slug
        const existingQuery = await adminDb
          .collection('program_templates')
          .where('slug', '==', templateData.slug)
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          console.log(`[SEED_TEMPLATES] Skipping existing: ${templateData.name}`);
          results.skipped.push(templateData.name);
          continue;
        }

        console.log(`[SEED_TEMPLATES] Creating: ${templateData.name}`);
        
        // Create template document
        const templateRef = adminDb.collection('program_templates').doc();
        const templateId = templateRef.id;
        const now = new Date().toISOString();
        
        await templateRef.set({
          id: templateId,
          ...templateData,
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
        const days = generateDays(templateData);
        
        const batch = adminDb.batch();
        for (const day of days) {
          const dayRef = adminDb.collection('template_days').doc();
          batch.set(dayRef, {
            id: dayRef.id,
            templateId,
            ...day,
          });
        }
        
        await batch.commit();
        
        console.log(`[SEED_TEMPLATES] Created: ${templateData.name} with ${days.length} days`);
        results.created.push(templateData.name);
        
      } catch (error) {
        console.error(`[SEED_TEMPLATES] Error creating ${templateData.name}:`, error);
        results.errors.push(`${templateData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Template seeding complete',
      results,
    });

  } catch (error) {
    console.error('[SEED_TEMPLATES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to seed templates' },
      { status: 500 }
    );
  }
}

