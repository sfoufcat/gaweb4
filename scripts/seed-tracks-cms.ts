/**
 * Seed Tracks CMS Data
 * 
 * Run with: npx ts-node scripts/seed-tracks-cms.ts
 * Or with Doppler: doppler run -- npx ts-node scripts/seed-tracks-cms.ts
 * 
 * This script seeds:
 * 1. All 6 tracks with their labels, default habits, and weekly focus defaults
 * 2. 30-day Content Creator Starter Program with tasks for all 30 days
 * 3. Starter programs for other tracks (Day 1 & 2 templates)
 * 4. Example dynamic prompts for each track and type
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Firebase credentials not set. Required env vars:');
    console.error('   - FIREBASE_PROJECT_ID:', projectId ? '✓' : '✗');
    console.error('   - FIREBASE_CLIENT_EMAIL:', clientEmail ? '✓' : '✗');
    console.error('   - FIREBASE_PRIVATE_KEY:', privateKey ? '✓' : '✗');
    console.error('   Make sure to run with Doppler: doppler run -- npx ts-node scripts/seed-tracks-cms.ts');
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
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = getFirestore();

// ============================================================================
// TRACK DEFINITIONS (6 TRACKS)
// ============================================================================

interface TrackDefinition {
  slug: string;
  name: string;
  description: string;
  habitLabel: string;
  programBadgeLabel: string;
  defaultHabits: Array<{ title: string; description?: string }>;
  weeklyFocusDefaults: Record<number, string>;
}

const TRACKS: TrackDefinition[] = [
  {
    slug: 'content_creator',
    name: 'Content Creator',
    description: 'Build a consistent content engine across platforms and grow your audience.',
    habitLabel: 'Creator habits',
    programBadgeLabel: 'Creator starter program',
    defaultHabits: [
      { title: 'Publish at least 1 piece of content', description: 'Post or draft something for one platform every day.' },
      { title: 'Engage with your audience for 15 minutes', description: 'Reply to comments, DMs, or interact with your niche.' },
    ],
    weeklyFocusDefaults: {
      1: 'Ship simple content consistently',
      2: 'Improve hooks and titles',
      3: 'Focus on engagement and replies',
      4: 'Refine your best-performing formats',
    },
  },
  {
    slug: 'saas',
    name: 'SaaS Founder',
    description: 'Build momentum toward a functioning, validated SaaS product.',
    habitLabel: 'SaaS habits',
    programBadgeLabel: 'SaaS starter program',
    defaultHabits: [
      { title: 'Ship 1 micro-improvement daily', description: 'Fix a bug, tweak UX, or improve any small feature.' },
      { title: 'Talk to 1 user', description: 'Short call, DM, or email to understand user needs.' },
    ],
    weeklyFocusDefaults: {
      1: 'Validate the problem',
      2: 'Improve activation',
      3: 'Improve retention',
      4: 'Drive revenue',
    },
  },
  {
    slug: 'coach_consultant',
    name: 'Coach / Consultant',
    description: 'Build a validated offer and consistent lead flow.',
    habitLabel: 'Coach habits',
    programBadgeLabel: 'Coach starter program',
    defaultHabits: [
      { title: 'Share one insight publicly', description: 'Post a tip, story, or result on one platform.' },
      { title: 'Connect with 1 potential client', description: 'DM, email, or message someone who fits your ideal client.' },
    ],
    weeklyFocusDefaults: {
      1: 'Clarify positioning',
      2: 'Validate the offer',
      3: 'Improve sales flow',
      4: 'Strengthen client delivery',
    },
  },
  {
    slug: 'ecom',
    name: 'E-commerce Owner',
    description: 'Improve conversion and predictable performance.',
    habitLabel: 'E-commerce habits',
    programBadgeLabel: 'E-commerce starter program',
    defaultHabits: [
      { title: 'Review ad/account metrics', description: 'Check performance of your key campaigns daily.' },
      { title: 'Optimize 1 product listing/page', description: 'Tweak creatives, copy, or offer on one SKU or funnel.' },
    ],
    weeklyFocusDefaults: {
      1: 'Optimize product pages',
      2: 'Improve conversion rate',
      3: 'Test new creatives',
      4: 'Scale winning channels',
    },
  },
  {
    slug: 'agency',
    name: 'Agency Owner',
    description: 'Increase lead flow and strengthen fulfillment system.',
    habitLabel: 'Agency habits',
    programBadgeLabel: 'Agency starter program',
    defaultHabits: [
      { title: 'Daily lead gen (5 outreaches)', description: 'DMs, emails, or loom videos to high-fit prospects.' },
      { title: 'Improve 1 internal system', description: 'Document, delegate, or automate one workflow.' },
    ],
    weeklyFocusDefaults: {
      1: 'Book more calls',
      2: 'Improve fulfillment',
      3: 'Document repeatable processes',
      4: 'Strengthen client retention',
    },
  },
  {
    slug: 'community_builder',
    name: 'Community Builder',
    description: 'Build a thriving, engaged community with rituals.',
    habitLabel: 'Community habits',
    programBadgeLabel: 'Community starter program',
    defaultHabits: [
      { title: 'Start 1 conversation in your community', description: 'Post a discussion prompt or question.' },
      { title: 'Create 1 value post/message', description: 'Share helpful resources, insights, or celebrate members.' },
    ],
    weeklyFocusDefaults: {
      1: 'Define your member journey',
      2: 'Increase engagement',
      3: 'Add value-driven assets',
      4: 'Build recurring rituals',
    },
  },
];

// ============================================================================
// 30-DAY CONTENT CREATOR PROGRAM
// ============================================================================

interface ProgramDayDefinition {
  dayIndex: number;
  title: string;
  summary: string;
  dailyPrompt?: string;
  tasks: Array<{ label: string; isPrimary: boolean; estimatedMinutes?: number }>;
}

const CONTENT_CREATOR_30_DAY_PROGRAM: ProgramDayDefinition[] = [
  // Days 1-3: Orientation & Clarity
  {
    dayIndex: 1,
    title: 'Start simple and ship',
    summary: 'Clarify your platform, topic, and publish something simple.',
    dailyPrompt: 'Today is about starting. Don\'t overthink it—just get something out there.',
    tasks: [
      { label: 'Pick your primary platform (Twitter, YouTube, TikTok, etc.)', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Write down your content niche in 1 sentence', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Post 1 short piece of content (even if it feels "meh")', isPrimary: true, estimatedMinutes: 30 },
    ],
  },
  {
    dayIndex: 2,
    title: 'Know your audience',
    summary: 'Get clear on who you\'re creating for and what they need.',
    dailyPrompt: 'Great content speaks to someone specific. Who are you helping?',
    tasks: [
      { label: 'Describe your ideal audience member in 2-3 sentences', isPrimary: true, estimatedMinutes: 15 },
      { label: 'List 5 questions or problems your audience has', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Post 1 piece of content addressing one of those questions', isPrimary: true, estimatedMinutes: 30 },
    ],
  },
  {
    dayIndex: 3,
    title: 'Find your voice',
    summary: 'Experiment with your style and tone.',
    dailyPrompt: 'Your voice makes you memorable. Try something that feels natural.',
    tasks: [
      { label: 'Study 2 creators you admire—note what makes their style unique', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Write 3 different versions of a post in different tones', isPrimary: true, estimatedMinutes: 25 },
      { label: 'Post the version that feels most "you"', isPrimary: true, estimatedMinutes: 15 },
    ],
  },
  // Days 4-7: Simple shipping habit
  {
    dayIndex: 4,
    title: 'Ship daily',
    summary: 'Build the muscle of consistent shipping.',
    dailyPrompt: 'Velocity beats perfection. Ship something today.',
    tasks: [
      { label: 'Draft and post 1 short piece of content on your main topic', isPrimary: true, estimatedMinutes: 30 },
      { label: 'Engage with 5 comments or posts in your niche', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Write 3 content ideas for tomorrow', isPrimary: false, estimatedMinutes: 10 },
    ],
  },
  {
    dayIndex: 5,
    title: 'Repurpose and remix',
    summary: 'Learn to get more from less by repurposing content.',
    dailyPrompt: 'You don\'t always need new ideas—remix what you have.',
    tasks: [
      { label: 'Take an old post/idea and rewrite it with a new angle', isPrimary: true, estimatedMinutes: 25 },
      { label: 'Post the remixed content', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Reply to 5 comments or DMs from your audience', isPrimary: true, estimatedMinutes: 15 },
    ],
  },
  {
    dayIndex: 6,
    title: 'Batch create',
    summary: 'Create multiple pieces in one session for efficiency.',
    dailyPrompt: 'Batching saves time and builds momentum.',
    tasks: [
      { label: 'Block 30 minutes and write 3-5 short content pieces', isPrimary: true, estimatedMinutes: 35 },
      { label: 'Schedule or queue 2 posts for the next 2 days', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Post 1 piece today', isPrimary: true, estimatedMinutes: 5 },
    ],
  },
  {
    dayIndex: 7,
    title: 'Weekly review - Week 1',
    summary: 'Reflect on your first week and celebrate small wins.',
    dailyPrompt: 'You made it through week 1! Notice what worked.',
    tasks: [
      { label: 'Review your posts from this week—which got the best response?', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Write down 1 thing you learned about your content or audience', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Post 1 piece of content that builds on what worked', isPrimary: true, estimatedMinutes: 25 },
    ],
  },
  // Days 8-14: Improve hooks and formats
  {
    dayIndex: 8,
    title: 'Master the hook',
    summary: 'Learn to capture attention in the first line.',
    dailyPrompt: 'A great hook is 80% of the battle. Nail it today.',
    tasks: [
      { label: 'Study 5 high-performing posts—note their hooks', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Write 5 hook variations for your next piece', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Post using your best hook', isPrimary: true, estimatedMinutes: 15 },
    ],
  },
  {
    dayIndex: 9,
    title: 'Test different formats',
    summary: 'Try a new format you haven\'t used before.',
    dailyPrompt: 'Trying new formats helps you find what works for you.',
    tasks: [
      { label: 'Pick a format you haven\'t tried (thread, carousel, video, etc.)', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Create 1 piece in that new format', isPrimary: true, estimatedMinutes: 35 },
      { label: 'Post and note how it performs vs. your usual format', isPrimary: true, estimatedMinutes: 10 },
    ],
  },
  {
    dayIndex: 10,
    title: 'Headlines and titles',
    summary: 'Focus on titles that make people want to click.',
    dailyPrompt: 'If the title doesn\'t hook them, the content never gets seen.',
    tasks: [
      { label: 'Write 10 headline/title variations for your next piece', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Ask a friend or peer to pick the best one', isPrimary: false, estimatedMinutes: 10 },
      { label: 'Post using your winning title', isPrimary: true, estimatedMinutes: 20 },
    ],
  },
  {
    dayIndex: 11,
    title: 'Structure and flow',
    summary: 'Make your content easy to consume.',
    dailyPrompt: 'Clear structure keeps people reading to the end.',
    tasks: [
      { label: 'Outline your next piece with a clear intro-body-CTA structure', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Create and post 1 well-structured piece', isPrimary: true, estimatedMinutes: 30 },
      { label: 'Engage with 5 people in your niche', isPrimary: true, estimatedMinutes: 15 },
    ],
  },
  {
    dayIndex: 12,
    title: 'Add visuals',
    summary: 'Improve your content with images or graphics.',
    dailyPrompt: 'Visuals stop the scroll. Use them strategically.',
    tasks: [
      { label: 'Create a simple image or graphic for your next post', isPrimary: true, estimatedMinutes: 25 },
      { label: 'Post content with your visual', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Reply to 5 comments or DMs', isPrimary: true, estimatedMinutes: 10 },
    ],
  },
  {
    dayIndex: 13,
    title: 'Call to action',
    summary: 'Learn to end your content with purpose.',
    dailyPrompt: 'Every piece should tell people what to do next.',
    tasks: [
      { label: 'Study 5 creators—note how they end their posts (CTAs)', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Write 3 CTA variations for your next post', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Post with a clear CTA and track engagement', isPrimary: true, estimatedMinutes: 20 },
    ],
  },
  {
    dayIndex: 14,
    title: 'Weekly review - Week 2',
    summary: 'Review your hook and format experiments.',
    dailyPrompt: 'Week 2 done! What formats and hooks worked best?',
    tasks: [
      { label: 'Review week 2 posts—which hooks/formats performed best?', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Write 5 content ideas using your best-performing style', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Post 1 piece using what you learned', isPrimary: true, estimatedMinutes: 25 },
    ],
  },
  // Days 15-21: Engagement & feedback
  {
    dayIndex: 15,
    title: 'Engage before you create',
    summary: 'Build relationships by engaging first.',
    dailyPrompt: 'Engagement before creation builds genuine connections.',
    tasks: [
      { label: 'Spend 15 minutes engaging with others before posting', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Reply thoughtfully to 10 posts in your niche', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Post 1 piece of content', isPrimary: true, estimatedMinutes: 20 },
    ],
  },
  {
    dayIndex: 16,
    title: 'Ask questions',
    summary: 'Use questions to spark engagement and learn from your audience.',
    dailyPrompt: 'Questions invite conversation. Ask something genuine.',
    tasks: [
      { label: 'Post a question to your audience about their biggest challenge', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Reply to every response you receive', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Note common themes in their answers', isPrimary: false, estimatedMinutes: 10 },
    ],
  },
  {
    dayIndex: 17,
    title: 'DM conversations',
    summary: 'Move relationships beyond public comments.',
    dailyPrompt: 'Real connections often happen in DMs.',
    tasks: [
      { label: 'Send 5 genuine, non-salesy DMs to people in your niche', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Follow up on any ongoing DM conversations', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Post 1 piece of content', isPrimary: true, estimatedMinutes: 20 },
    ],
  },
  {
    dayIndex: 18,
    title: 'Collaboration',
    summary: 'Explore collaboration opportunities.',
    dailyPrompt: 'Collaboration expands your reach to new audiences.',
    tasks: [
      { label: 'List 5 creators you could collaborate with', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Reach out to 2 with a collaboration idea', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Post 1 piece of content', isPrimary: true, estimatedMinutes: 20 },
    ],
  },
  {
    dayIndex: 19,
    title: 'Listen and learn',
    summary: 'Use feedback to improve your content.',
    dailyPrompt: 'Your audience tells you what they want—listen closely.',
    tasks: [
      { label: 'Review all comments/replies from the past week', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Identify 1 piece of feedback you can act on', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Create content based on that feedback', isPrimary: true, estimatedMinutes: 25 },
    ],
  },
  {
    dayIndex: 20,
    title: 'Show appreciation',
    summary: 'Thank your supporters and early followers.',
    dailyPrompt: 'Gratitude builds loyalty. Appreciate your people.',
    tasks: [
      { label: 'Send a thank-you DM to 5 people who\'ve engaged with you', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Give a shoutout to a supporter in your next post', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Engage with 10 comments or posts', isPrimary: true, estimatedMinutes: 15 },
    ],
  },
  {
    dayIndex: 21,
    title: 'Weekly review - Week 3',
    summary: 'Reflect on your engagement experiments.',
    dailyPrompt: 'Week 3 done! Engagement is a skill—you\'re building it.',
    tasks: [
      { label: 'Review what engagement tactics worked best this week', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Note 1 new relationship you built', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Post 1 piece of content', isPrimary: true, estimatedMinutes: 25 },
    ],
  },
  // Days 22-30: Double down & systemize
  {
    dayIndex: 22,
    title: 'Find your winners',
    summary: 'Identify your best-performing content patterns.',
    dailyPrompt: 'Success leaves clues. Find yours.',
    tasks: [
      { label: 'Review all your posts—identify your top 3 performers', isPrimary: true, estimatedMinutes: 20 },
      { label: 'List what they have in common (topic, format, hook, etc.)', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Create a new post using those patterns', isPrimary: true, estimatedMinutes: 25 },
    ],
  },
  {
    dayIndex: 23,
    title: 'Double down',
    summary: 'Create more content in your winning style.',
    dailyPrompt: 'When you find what works, do more of it.',
    tasks: [
      { label: 'Write 3 posts in the style of your top performers', isPrimary: true, estimatedMinutes: 35 },
      { label: 'Post 1 today', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Schedule the other 2 for coming days', isPrimary: false, estimatedMinutes: 5 },
    ],
  },
  {
    dayIndex: 24,
    title: 'Build a content bank',
    summary: 'Create a backlog of ideas and drafts.',
    dailyPrompt: 'A content bank means you\'re never stuck.',
    tasks: [
      { label: 'Brainstorm 20 content ideas in 15 minutes', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Draft 2-3 of your best ideas', isPrimary: true, estimatedMinutes: 30 },
      { label: 'Post 1 piece of content', isPrimary: true, estimatedMinutes: 10 },
    ],
  },
  {
    dayIndex: 25,
    title: 'Content system',
    summary: 'Create a simple weekly content rhythm.',
    dailyPrompt: 'Systems make consistency easy.',
    tasks: [
      { label: 'Map out a simple weekly content schedule (e.g., Mon/Wed/Fri)', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Decide what type of content goes on each day', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Post 1 piece of content following your new system', isPrimary: true, estimatedMinutes: 20 },
    ],
  },
  {
    dayIndex: 26,
    title: 'Tools and workflow',
    summary: 'Optimize your tools for efficiency.',
    dailyPrompt: 'The right tools save time and reduce friction.',
    tasks: [
      { label: 'List all tools you use for content (scheduling, editing, etc.)', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Identify 1 tool or workflow you could improve', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Post 1 piece of content', isPrimary: true, estimatedMinutes: 20 },
    ],
  },
  {
    dayIndex: 27,
    title: 'Repurpose strategy',
    summary: 'Plan how to get maximum mileage from each piece.',
    dailyPrompt: 'One idea can become many pieces across platforms.',
    tasks: [
      { label: 'Take your best post and turn it into 2 other formats', isPrimary: true, estimatedMinutes: 30 },
      { label: 'Post 1 of the repurposed versions', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Save the other for another day/platform', isPrimary: false, estimatedMinutes: 5 },
    ],
  },
  {
    dayIndex: 28,
    title: 'Weekly review - Week 4',
    summary: 'Review your systems and what\'s working.',
    dailyPrompt: 'Week 4 done! You\'re building real systems.',
    tasks: [
      { label: 'Review your content system—is it sustainable?', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Note 1 thing you\'d adjust going forward', isPrimary: true, estimatedMinutes: 10 },
      { label: 'Post 1 piece of content', isPrimary: true, estimatedMinutes: 25 },
    ],
  },
  {
    dayIndex: 29,
    title: 'Reflect on your journey',
    summary: 'Look back on 30 days of growth.',
    dailyPrompt: 'You\'ve come further than you think.',
    tasks: [
      { label: 'Compare your Day 1 content to now—what improved?', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Write down your 3 biggest learnings from this program', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Post a reflection or milestone post', isPrimary: true, estimatedMinutes: 25 },
    ],
  },
  {
    dayIndex: 30,
    title: 'Plan your next 30 days',
    summary: 'Set yourself up for continued success.',
    dailyPrompt: 'Congratulations! Now let\'s keep the momentum going.',
    tasks: [
      { label: 'Set 1 content goal for the next 30 days', isPrimary: true, estimatedMinutes: 15 },
      { label: 'Plan your content for the next week using your system', isPrimary: true, estimatedMinutes: 20 },
      { label: 'Post 1 piece of content celebrating your 30-day milestone', isPrimary: true, estimatedMinutes: 20 },
    ],
  },
];

// ============================================================================
// 30-DAY SAAS FOUNDER PROGRAM
// ============================================================================

const SAAS_FOUNDER_30_DAY_PROGRAM: ProgramDayDefinition[] = [
  { dayIndex: 1, title: 'Define your target user', summary: 'Get crystal clear on who you are building for.', dailyPrompt: 'Clarity on your user drives everything else.', tasks: [{ label: 'Define your target user', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 2, title: 'Identify top 3 pains', summary: 'Understand the core problems your users face.', dailyPrompt: 'Focus on pains, not features.', tasks: [{ label: 'Identify top 3 pains', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 3, title: 'Draft one-sentence value prop', summary: 'Articulate your value in one clear sentence.', dailyPrompt: 'If you cannot say it simply, you do not understand it.', tasks: [{ label: 'Draft one-sentence value prop', isPrimary: true, estimatedMinutes: 15 }] },
  { dayIndex: 4, title: 'Write out your onboarding micro-flow', summary: 'Map the first experience users have with your product.', dailyPrompt: 'First impressions determine retention.', tasks: [{ label: 'Write out your onboarding micro-flow', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 5, title: 'Identify activation metric', summary: 'Define what success looks like for new users.', dailyPrompt: 'What action signals a user gets it?', tasks: [{ label: 'Identify activation metric', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 6, title: 'Interview 1 user', summary: 'Have a real conversation with someone in your target market.', dailyPrompt: 'Users know things you do not.', tasks: [{ label: 'Interview 1 user', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 7, title: 'Review insights', summary: 'Synthesize what you have learned this week.', dailyPrompt: 'Reflection turns data into direction.', tasks: [{ label: 'Review insights', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 8, title: 'Draft landing page hero', summary: 'Create a compelling hero section for your landing page.', dailyPrompt: 'Your hero is your first pitch.', tasks: [{ label: 'Draft landing page hero', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 9, title: 'Add 1 benefit block', summary: 'Highlight a key benefit on your landing page.', dailyPrompt: 'Benefits > Features.', tasks: [{ label: 'Add 1 benefit block', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 10, title: 'Add 1 credibility block', summary: 'Build trust with social proof or credentials.', dailyPrompt: 'Trust accelerates conversion.', tasks: [{ label: 'Add 1 credibility block', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 11, title: 'Create simple onboarding UI sketch', summary: 'Visualize your onboarding flow.', dailyPrompt: 'Sketch before you build.', tasks: [{ label: 'Create simple onboarding UI sketch', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 12, title: 'Build 1 screen', summary: 'Ship one piece of your onboarding.', dailyPrompt: 'Progress beats perfection.', tasks: [{ label: 'Build 1 screen', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 13, title: 'Improve 1 screen', summary: 'Iterate on something you have built.', dailyPrompt: 'Small improvements compound.', tasks: [{ label: 'Improve 1 screen', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 14, title: 'Push first working prototype', summary: 'Get something live and testable.', dailyPrompt: 'Ship it, then improve it.', tasks: [{ label: 'Push first working prototype', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 15, title: 'Send prototype to 1 user', summary: 'Get real feedback from a real user.', dailyPrompt: 'Feedback is a gift.', tasks: [{ label: 'Send prototype to 1 user', isPrimary: true, estimatedMinutes: 15 }] },
  { dayIndex: 16, title: 'Collect feedback', summary: 'Document what users say and observe.', dailyPrompt: 'Listen more than you talk.', tasks: [{ label: 'Collect feedback', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 17, title: 'Fix 1 friction point', summary: 'Remove one obstacle from the user journey.', dailyPrompt: 'Friction kills conversions.', tasks: [{ label: 'Fix 1 friction point', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 18, title: 'Improve activation step', summary: 'Optimize the moment users first get value.', dailyPrompt: 'Activation = retention.', tasks: [{ label: 'Improve activation step', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 19, title: 'Add simple email follow-up', summary: 'Create a touchpoint for new signups.', dailyPrompt: 'Follow-up shows you care.', tasks: [{ label: 'Add simple email follow-up', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 20, title: 'Document top user objections', summary: 'List reasons people do not convert.', dailyPrompt: 'Objections are opportunities.', tasks: [{ label: 'Document top user objections', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 21, title: 'Fix 1 objection', summary: 'Address one common objection in your messaging.', dailyPrompt: 'Solve their doubts proactively.', tasks: [{ label: 'Fix 1 objection', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 22, title: 'Improve onboarding again', summary: 'Another round of onboarding optimization.', dailyPrompt: 'Onboarding is never done.', tasks: [{ label: 'Improve onboarding again', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 23, title: 'Add retention hook', summary: 'Create a reason for users to come back.', dailyPrompt: 'Retention > acquisition.', tasks: [{ label: 'Add retention hook', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 24, title: 'Run small traffic test', summary: 'Send some traffic and observe behavior.', dailyPrompt: 'Real traffic reveals real issues.', tasks: [{ label: 'Run small traffic test', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 25, title: 'Refine messaging', summary: 'Improve your copy based on learnings.', dailyPrompt: 'Words matter.', tasks: [{ label: 'Refine messaging', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 26, title: 'Try alternative headline', summary: 'Test a different angle in your hero.', dailyPrompt: 'Headlines make or break attention.', tasks: [{ label: 'Try alternative headline', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 27, title: 'Improve demo video', summary: 'Make your product demo clearer or more compelling.', dailyPrompt: 'Show, do not tell.', tasks: [{ label: 'Improve demo video', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 28, title: 'Publish update', summary: 'Ship a product update and communicate it.', dailyPrompt: 'Momentum keeps users engaged.', tasks: [{ label: 'Publish update', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 29, title: 'Ask 1 user for testimonial', summary: 'Get social proof from a happy user.', dailyPrompt: 'Testimonials build trust.', tasks: [{ label: 'Ask 1 user for testimonial', isPrimary: true, estimatedMinutes: 15 }] },
  { dayIndex: 30, title: 'Review progress & set next 30-day goal', summary: 'Reflect on your progress and plan ahead.', dailyPrompt: 'Congratulations! Keep the momentum going.', tasks: [{ label: 'Review progress & set next 30-day goal', isPrimary: true, estimatedMinutes: 25 }] },
];

// ============================================================================
// 30-DAY COACH / CONSULTANT PROGRAM
// ============================================================================

const COACH_CONSULTANT_30_DAY_PROGRAM: ProgramDayDefinition[] = [
  { dayIndex: 1, title: 'Choose your niche', summary: 'Get specific about who you serve.', dailyPrompt: 'Specificity attracts.', tasks: [{ label: 'Choose your niche', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 2, title: 'List top 3 pains', summary: 'Understand your ideal client struggles.', dailyPrompt: 'Pain drives purchase.', tasks: [{ label: 'List top 3 pains', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 3, title: 'Write your transformation statement', summary: 'Articulate the change you create.', dailyPrompt: 'Transformation > information.', tasks: [{ label: 'Write your transformation statement', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 4, title: 'Define your signature framework', summary: 'Create a unique method or process.', dailyPrompt: 'A framework makes you memorable.', tasks: [{ label: 'Define your signature framework', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 5, title: 'Draft your offer', summary: 'Write out what you are selling.', dailyPrompt: 'Clarity converts.', tasks: [{ label: 'Draft your offer', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 6, title: 'Identify your 3 best lead sources', summary: 'Know where your clients hang out.', dailyPrompt: 'Fish where the fish are.', tasks: [{ label: 'Identify your 3 best lead sources', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 7, title: 'Create 1 value post', summary: 'Share something helpful publicly.', dailyPrompt: 'Value earns attention.', tasks: [{ label: 'Create 1 value post', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 8, title: 'DM 5 ideal clients', summary: 'Start conversations with potential clients.', dailyPrompt: 'Conversations create clients.', tasks: [{ label: 'DM 5 ideal clients', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 9, title: 'Create 1 short-form insight', summary: 'Share a quick, valuable tip.', dailyPrompt: 'Small value builds big trust.', tasks: [{ label: 'Create 1 short-form insight', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 10, title: 'Improve your profile bio', summary: 'Make your bio work harder for you.', dailyPrompt: 'Your bio is a silent salesperson.', tasks: [{ label: 'Improve your profile bio', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 11, title: 'Gather 3 credibility points', summary: 'Collect proof of your expertise.', dailyPrompt: 'Credibility reduces resistance.', tasks: [{ label: 'Gather 3 credibility points', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 12, title: 'Create value asset (PDF or carousel)', summary: 'Build a lead magnet or shareable asset.', dailyPrompt: 'Assets work while you sleep.', tasks: [{ label: 'Create value asset (PDF or carousel)', isPrimary: true, estimatedMinutes: 35 }] },
  { dayIndex: 13, title: 'DM 5 more ideal clients', summary: 'Continue building your pipeline.', dailyPrompt: 'Consistency beats intensity.', tasks: [{ label: 'DM 5 more ideal clients', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 14, title: 'Test 1 sales script variation', summary: 'Experiment with your pitch.', dailyPrompt: 'Testing reveals truth.', tasks: [{ label: 'Test 1 sales script variation', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 15, title: 'Publish 1 proof post', summary: 'Share a result or case study.', dailyPrompt: 'Proof persuades.', tasks: [{ label: 'Publish 1 proof post', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 16, title: 'Ask for feedback', summary: 'Get input from prospects or clients.', dailyPrompt: 'Feedback fuels improvement.', tasks: [{ label: 'Ask for feedback', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 17, title: 'Improve your calendar flow', summary: 'Make booking calls easier.', dailyPrompt: 'Friction kills conversions.', tasks: [{ label: 'Improve your calendar flow', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 18, title: 'Add an objection-handler snippet', summary: 'Prepare responses to common objections.', dailyPrompt: 'Preparation builds confidence.', tasks: [{ label: 'Add an objection-handler snippet', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 19, title: 'Simplify offer delivery', summary: 'Make delivering your service easier.', dailyPrompt: 'Simple scales.', tasks: [{ label: 'Simplify offer delivery', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 20, title: 'Share 1 behind-the-scenes', summary: 'Show the human side of your work.', dailyPrompt: 'Relatability builds connection.', tasks: [{ label: 'Share 1 behind-the-scenes', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 21, title: 'Record 1 short story/video', summary: 'Create video content to build trust.', dailyPrompt: 'Video builds familiarity.', tasks: [{ label: 'Record 1 short story/video', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 22, title: 'Document your client journey', summary: 'Map the experience clients have with you.', dailyPrompt: 'Great journeys create referrals.', tasks: [{ label: 'Document your client journey', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 23, title: 'Improve onboarding experience', summary: 'Make the first client touchpoints excellent.', dailyPrompt: 'First impressions last.', tasks: [{ label: 'Improve onboarding experience', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 24, title: 'Build 1 automation', summary: 'Automate a repetitive task.', dailyPrompt: 'Automation buys time.', tasks: [{ label: 'Build 1 automation', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 25, title: 'Add 1 guarantee or risk reversal', summary: 'Reduce risk for potential clients.', dailyPrompt: 'Lower risk = higher conversions.', tasks: [{ label: 'Add 1 guarantee or risk reversal', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 26, title: 'DM past leads', summary: 'Follow up with people who showed interest.', dailyPrompt: 'Follow-up is where money hides.', tasks: [{ label: 'DM past leads', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 27, title: 'Review sales calls', summary: 'Learn from your recent conversations.', dailyPrompt: 'Review reveals patterns.', tasks: [{ label: 'Review sales calls', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 28, title: 'Refine your pitch', summary: 'Improve how you present your offer.', dailyPrompt: 'Better pitch = better close rate.', tasks: [{ label: 'Refine your pitch', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 29, title: 'Publish another case story', summary: 'Share another client success.', dailyPrompt: 'Stories sell.', tasks: [{ label: 'Publish another case story', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 30, title: 'Plan next 30 days', summary: 'Set your goals for the next month.', dailyPrompt: 'Congratulations! Keep building momentum.', tasks: [{ label: 'Plan next 30 days', isPrimary: true, estimatedMinutes: 25 }] },
];

// ============================================================================
// 30-DAY E-COMMERCE OWNER PROGRAM
// ============================================================================

const ECOM_OWNER_30_DAY_PROGRAM: ProgramDayDefinition[] = [
  { dayIndex: 1, title: 'Analyze top product', summary: 'Understand what is working best.', dailyPrompt: 'Data reveals opportunity.', tasks: [{ label: 'Analyze top product', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 2, title: 'Improve first image', summary: 'Optimize your hero product image.', dailyPrompt: 'Images stop the scroll.', tasks: [{ label: 'Improve first image', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 3, title: 'Improve description', summary: 'Make your product copy more compelling.', dailyPrompt: 'Words drive conversions.', tasks: [{ label: 'Improve description', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 4, title: 'Improve price justification', summary: 'Help customers understand the value.', dailyPrompt: 'Price is relative to perceived value.', tasks: [{ label: 'Improve price justification', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 5, title: 'Update guarantee', summary: 'Strengthen your risk reversal.', dailyPrompt: 'Guarantees reduce hesitation.', tasks: [{ label: 'Update guarantee', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 6, title: 'Fix 1 checkout UX issue', summary: 'Remove friction from checkout.', dailyPrompt: 'Every click is a drop-off risk.', tasks: [{ label: 'Fix 1 checkout UX issue', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 7, title: 'Optimize shipping info', summary: 'Make shipping clear and compelling.', dailyPrompt: 'Shipping ambiguity kills sales.', tasks: [{ label: 'Optimize shipping info', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 8, title: 'Test 1 new creative', summary: 'Create a new ad image or video.', dailyPrompt: 'Creative fatigue is real.', tasks: [{ label: 'Test 1 new creative', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 9, title: 'Test 1 new headline', summary: 'Try a different angle in your ads.', dailyPrompt: 'Headlines make or break attention.', tasks: [{ label: 'Test 1 new headline', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 10, title: 'Test offer variation', summary: 'Experiment with pricing or bundles.', dailyPrompt: 'Offer innovation drives growth.', tasks: [{ label: 'Test offer variation', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 11, title: 'Add social proof block', summary: 'Display customer reviews prominently.', dailyPrompt: 'Social proof persuades.', tasks: [{ label: 'Add social proof block', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 12, title: 'Improve reviews layout', summary: 'Make reviews more visible and readable.', dailyPrompt: 'Reviews are your best salespeople.', tasks: [{ label: 'Improve reviews layout', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 13, title: 'Improve ad copy', summary: 'Refine your advertising messaging.', dailyPrompt: 'Better copy = lower CAC.', tasks: [{ label: 'Improve ad copy', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 14, title: 'Improve landing page speed', summary: 'Make your pages load faster.', dailyPrompt: 'Speed = conversions.', tasks: [{ label: 'Improve landing page speed', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 15, title: 'Test 1 upsell', summary: 'Add an upsell to increase AOV.', dailyPrompt: 'Upsells increase profitability.', tasks: [{ label: 'Test 1 upsell', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 16, title: 'Test 1 bundle', summary: 'Create a product bundle offer.', dailyPrompt: 'Bundles increase perceived value.', tasks: [{ label: 'Test 1 bundle', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 17, title: 'Add email popup', summary: 'Capture more email addresses.', dailyPrompt: 'Email is owned traffic.', tasks: [{ label: 'Add email popup', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 18, title: 'Improve popup copy', summary: 'Make your popup more compelling.', dailyPrompt: 'Good copy = higher opt-ins.', tasks: [{ label: 'Improve popup copy', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 19, title: 'Add abandoned cart email', summary: 'Recover lost sales automatically.', dailyPrompt: 'Abandoned carts are low-hanging fruit.', tasks: [{ label: 'Add abandoned cart email', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 20, title: 'Review metrics', summary: 'Analyze your key performance indicators.', dailyPrompt: 'What gets measured gets managed.', tasks: [{ label: 'Review metrics', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 21, title: 'Kill 1 underperforming ad', summary: 'Stop wasting money on losers.', dailyPrompt: 'Cut losers fast.', tasks: [{ label: 'Kill 1 underperforming ad', isPrimary: true, estimatedMinutes: 15 }] },
  { dayIndex: 22, title: 'Scale 1 winning ad', summary: 'Put more budget behind winners.', dailyPrompt: 'Scale what works.', tasks: [{ label: 'Scale 1 winning ad', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 23, title: 'Improve retention offer', summary: 'Give customers a reason to return.', dailyPrompt: 'Retention is cheaper than acquisition.', tasks: [{ label: 'Improve retention offer', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 24, title: 'Test 1 returning customer email', summary: 'Re-engage past customers.', dailyPrompt: 'Past customers are your warmest leads.', tasks: [{ label: 'Test 1 returning customer email', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 25, title: 'Improve packaging/experience', summary: 'Enhance the unboxing experience.', dailyPrompt: 'Experience creates word-of-mouth.', tasks: [{ label: 'Improve packaging/experience', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 26, title: 'Remove 1 friction point', summary: 'Simplify something in your funnel.', dailyPrompt: 'Friction is the enemy.', tasks: [{ label: 'Remove 1 friction point', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 27, title: 'Update UGC asset', summary: 'Refresh your user-generated content.', dailyPrompt: 'Fresh UGC keeps ads working.', tasks: [{ label: 'Update UGC asset', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 28, title: 'Add trust badges', summary: 'Display security and trust signals.', dailyPrompt: 'Trust badges reduce anxiety.', tasks: [{ label: 'Add trust badges', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 29, title: 'Re-run analysis', summary: 'Review all changes and their impact.', dailyPrompt: 'Analysis informs next steps.', tasks: [{ label: 'Re-run analysis', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 30, title: 'Plan scaling roadmap', summary: 'Set your strategy for the next phase.', dailyPrompt: 'Congratulations! Ready to scale.', tasks: [{ label: 'Plan scaling roadmap', isPrimary: true, estimatedMinutes: 25 }] },
];

// ============================================================================
// 30-DAY AGENCY OWNER PROGRAM
// ============================================================================

const AGENCY_OWNER_30_DAY_PROGRAM: ProgramDayDefinition[] = [
  { dayIndex: 1, title: 'Define your ideal client', summary: 'Get clear on who you serve best.', dailyPrompt: 'Clarity attracts the right clients.', tasks: [{ label: 'Define your ideal client', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 2, title: 'Improve your offer', summary: 'Make your service more compelling.', dailyPrompt: 'A great offer sells itself.', tasks: [{ label: 'Improve your offer', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 3, title: 'Improve your website hero', summary: 'Optimize your homepage first impression.', dailyPrompt: 'Your hero is your first pitch.', tasks: [{ label: 'Improve your website hero', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 4, title: 'Improve case study #1', summary: 'Make your best case study more compelling.', dailyPrompt: 'Results speak louder than words.', tasks: [{ label: 'Improve case study #1', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 5, title: 'DM 10 leads', summary: 'Start conversations with potential clients.', dailyPrompt: 'Outreach creates opportunity.', tasks: [{ label: 'DM 10 leads', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 6, title: 'Fix onboarding friction', summary: 'Make client onboarding smoother.', dailyPrompt: 'Smooth onboarding = happy clients.', tasks: [{ label: 'Fix onboarding friction', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 7, title: 'Improve one SOP', summary: 'Document or improve a process.', dailyPrompt: 'Systems create consistency.', tasks: [{ label: 'Improve one SOP', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 8, title: 'Create outreach script', summary: 'Build a repeatable outreach message.', dailyPrompt: 'Scripts scale outreach.', tasks: [{ label: 'Create outreach script', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 9, title: 'Send 10 emails', summary: 'Execute your outreach.', dailyPrompt: 'Volume creates conversations.', tasks: [{ label: 'Send 10 emails', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 10, title: 'Improve client reporting', summary: 'Make your reports more valuable.', dailyPrompt: 'Great reports build trust.', tasks: [{ label: 'Improve client reporting', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 11, title: 'Add upsell offer', summary: 'Create an additional service to sell.', dailyPrompt: 'Upsells increase LTV.', tasks: [{ label: 'Add upsell offer', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 12, title: 'Review client results', summary: 'Analyze how your clients are performing.', dailyPrompt: 'Results retain clients.', tasks: [{ label: 'Review client results', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 13, title: 'Improve delivery workflow', summary: 'Streamline how you deliver work.', dailyPrompt: 'Efficiency = profitability.', tasks: [{ label: 'Improve delivery workflow', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 14, title: 'Simplify pricing', summary: 'Make your pricing easier to understand.', dailyPrompt: 'Confusion kills conversions.', tasks: [{ label: 'Simplify pricing', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 15, title: 'Publish 1 proof post', summary: 'Share a client success publicly.', dailyPrompt: 'Proof builds credibility.', tasks: [{ label: 'Publish 1 proof post', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 16, title: 'Re-engage old leads', summary: 'Follow up with past prospects.', dailyPrompt: 'Old leads are warm leads.', tasks: [{ label: 'Re-engage old leads', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 17, title: 'Improve sales script', summary: 'Refine how you pitch on calls.', dailyPrompt: 'Better calls = better close rate.', tasks: [{ label: 'Improve sales script', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 18, title: 'Build 1 automation', summary: 'Automate a repetitive task.', dailyPrompt: 'Automation creates leverage.', tasks: [{ label: 'Build 1 automation', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 19, title: 'Record 1 testimonial', summary: 'Get video proof from a client.', dailyPrompt: 'Video testimonials convert.', tasks: [{ label: 'Record 1 testimonial', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 20, title: 'Fix 1 bottleneck', summary: 'Remove a constraint in your process.', dailyPrompt: 'Bottlenecks limit growth.', tasks: [{ label: 'Fix 1 bottleneck', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 21, title: 'DM 10 leads', summary: 'Continue building your pipeline.', dailyPrompt: 'Consistency wins.', tasks: [{ label: 'DM 10 leads', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 22, title: 'Improve calendar flow', summary: 'Make booking calls easier.', dailyPrompt: 'Friction kills bookings.', tasks: [{ label: 'Improve calendar flow', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 23, title: 'Test 1 service innovation', summary: 'Try something new in your delivery.', dailyPrompt: 'Innovation creates differentiation.', tasks: [{ label: 'Test 1 service innovation', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 24, title: 'Review performance', summary: 'Analyze your agency metrics.', dailyPrompt: 'What gets measured improves.', tasks: [{ label: 'Review performance', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 25, title: 'Improve reporting template', summary: 'Make reports easier to create.', dailyPrompt: 'Templates save time.', tasks: [{ label: 'Improve reporting template', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 26, title: 'DM 10 more leads', summary: 'Keep the outreach momentum.', dailyPrompt: 'Pipeline is everything.', tasks: [{ label: 'DM 10 more leads', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 27, title: 'Build 1 training module', summary: 'Create training for team or clients.', dailyPrompt: 'Training creates leverage.', tasks: [{ label: 'Build 1 training module', isPrimary: true, estimatedMinutes: 35 }] },
  { dayIndex: 28, title: 'Improve onboarding packet', summary: 'Enhance your new client materials.', dailyPrompt: 'Great onboarding sets expectations.', tasks: [{ label: 'Improve onboarding packet', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 29, title: 'Standardize fulfillment process', summary: 'Document your delivery system.', dailyPrompt: 'Standards enable scale.', tasks: [{ label: 'Standardize fulfillment process', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 30, title: 'Plan next 30 days', summary: 'Set your goals for next month.', dailyPrompt: 'Congratulations! Keep building.', tasks: [{ label: 'Plan next 30 days', isPrimary: true, estimatedMinutes: 25 }] },
];

// ============================================================================
// 30-DAY COMMUNITY BUILDER PROGRAM
// ============================================================================

const COMMUNITY_BUILDER_30_DAY_PROGRAM: ProgramDayDefinition[] = [
  { dayIndex: 1, title: 'Define target members', summary: 'Get clear on who your community serves.', dailyPrompt: 'Specificity attracts the right people.', tasks: [{ label: 'Define target members', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 2, title: 'Draft community promise', summary: 'Articulate what members will get.', dailyPrompt: 'A clear promise attracts members.', tasks: [{ label: 'Draft community promise', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 3, title: 'Define onboarding flow', summary: 'Map the new member experience.', dailyPrompt: 'First impressions determine retention.', tasks: [{ label: 'Define onboarding flow', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 4, title: 'Post welcome ritual', summary: 'Create a consistent way to welcome new members.', dailyPrompt: 'Welcome rituals build belonging.', tasks: [{ label: 'Post welcome ritual', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 5, title: 'Ask 1 question', summary: 'Spark a discussion with a thoughtful question.', dailyPrompt: 'Questions create engagement.', tasks: [{ label: 'Ask 1 question', isPrimary: true, estimatedMinutes: 15 }] },
  { dayIndex: 6, title: 'Start 1 conversation', summary: 'Initiate a meaningful discussion.', dailyPrompt: 'Conversations build community.', tasks: [{ label: 'Start 1 conversation', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 7, title: 'Add 1 value asset', summary: 'Create a resource for your members.', dailyPrompt: 'Value keeps members engaged.', tasks: [{ label: 'Add 1 value asset', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 8, title: 'DM 3 members', summary: 'Connect personally with members.', dailyPrompt: 'Personal touch builds loyalty.', tasks: [{ label: 'DM 3 members', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 9, title: 'Improve onboarding doc', summary: 'Make your welcome guide clearer.', dailyPrompt: 'Clear onboarding reduces confusion.', tasks: [{ label: 'Improve onboarding doc', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 10, title: 'Add 1 weekly ritual', summary: 'Create a recurring community event.', dailyPrompt: 'Rituals create rhythm.', tasks: [{ label: 'Add 1 weekly ritual', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 11, title: 'Improve welcome message', summary: 'Make your first touchpoint better.', dailyPrompt: 'First messages matter.', tasks: [{ label: 'Improve welcome message', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 12, title: 'Add 1 resource', summary: 'Provide another valuable asset.', dailyPrompt: 'Resources add value.', tasks: [{ label: 'Add 1 resource', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 13, title: 'Create member spotlight post', summary: 'Highlight an active community member.', dailyPrompt: 'Recognition motivates engagement.', tasks: [{ label: 'Create member spotlight post', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 14, title: 'Add engagement role labels', summary: 'Create roles or badges for members.', dailyPrompt: 'Labels create identity.', tasks: [{ label: 'Add engagement role labels', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 15, title: 'Improve discussion prompts', summary: 'Create better conversation starters.', dailyPrompt: 'Good prompts spark discussion.', tasks: [{ label: 'Improve discussion prompts', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 16, title: 'Add feedback form', summary: 'Give members a way to share input.', dailyPrompt: 'Feedback guides improvement.', tasks: [{ label: 'Add feedback form', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 17, title: 'DM inactive members', summary: 'Re-engage people who have gone quiet.', dailyPrompt: 'Reach out before they leave.', tasks: [{ label: 'DM inactive members', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 18, title: 'Start a new themed thread', summary: 'Create a focused discussion space.', dailyPrompt: 'Themes organize conversation.', tasks: [{ label: 'Start a new themed thread', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 19, title: 'Improve community guidelines', summary: 'Clarify expectations and norms.', dailyPrompt: 'Clear guidelines set culture.', tasks: [{ label: 'Improve community guidelines', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 20, title: 'Add gamification element', summary: 'Introduce points, levels, or rewards.', dailyPrompt: 'Gamification drives engagement.', tasks: [{ label: 'Add gamification element', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 21, title: 'Host a micro-event', summary: 'Run a small live session or AMA.', dailyPrompt: 'Events create energy.', tasks: [{ label: 'Host a micro-event', isPrimary: true, estimatedMinutes: 45 }] },
  { dayIndex: 22, title: 'Add replay/summary', summary: 'Document the event for those who missed it.', dailyPrompt: 'Replays extend value.', tasks: [{ label: 'Add replay/summary', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 23, title: 'Improve retention system', summary: 'Create ways to keep members engaged.', dailyPrompt: 'Retention is your real metric.', tasks: [{ label: 'Improve retention system', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 24, title: 'Add growth ritual', summary: 'Create a referral or invite system.', dailyPrompt: 'Members bring members.', tasks: [{ label: 'Add growth ritual', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 25, title: 'Ask for community suggestions', summary: 'Invite members to shape the community.', dailyPrompt: 'Co-creation builds ownership.', tasks: [{ label: 'Ask for community suggestions', isPrimary: true, estimatedMinutes: 20 }] },
  { dayIndex: 26, title: 'Review analytics', summary: 'Analyze your community metrics.', dailyPrompt: 'Data guides decisions.', tasks: [{ label: 'Review analytics', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 27, title: 'Improve welcome challenge', summary: 'Create an activation path for new members.', dailyPrompt: 'Challenges drive first actions.', tasks: [{ label: 'Improve welcome challenge', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 28, title: 'Add community wins board', summary: 'Create a space to celebrate member wins.', dailyPrompt: 'Wins inspire wins.', tasks: [{ label: 'Add community wins board', isPrimary: true, estimatedMinutes: 25 }] },
  { dayIndex: 29, title: 'Refresh onboarding', summary: 'Review and improve new member experience.', dailyPrompt: 'Onboarding is never done.', tasks: [{ label: 'Refresh onboarding', isPrimary: true, estimatedMinutes: 30 }] },
  { dayIndex: 30, title: 'Plan next 30 days', summary: 'Set your community goals for next month.', dailyPrompt: 'Congratulations! Keep building your tribe.', tasks: [{ label: 'Plan next 30 days', isPrimary: true, estimatedMinutes: 25 }] },
];

// ============================================================================
// DYNAMIC PROMPT DEFINITIONS
// ============================================================================

interface PromptConfig {
  track: string | null; // null = generic fallback
  type: 'morning' | 'evening' | 'weekly';
  slot: 'goal' | 'prompt' | 'quote';
  title: string;
  body: string;
  priority: number;
}

const DYNAMIC_PROMPTS: PromptConfig[] = [
  // ============================================================================
  // CONTENT CREATOR PROMPTS (10)
  // ============================================================================
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Publish Daily', body: 'Consistency beats perfection — ship something today.', priority: 1 },
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Engage First', body: 'Spend 15 minutes engaging before creating.', priority: 2 },
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Hooks Matter', body: 'The first line is 80% of the battle.', priority: 3 },
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Repurpose', body: 'One idea can become many formats — remix what worked.', priority: 4 },
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Value First', body: 'Help your audience before you ask for anything.', priority: 5 },
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Document Journey', body: 'Your story is your best content — share the process.', priority: 6 },
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Test Formats', body: 'Try something new today — growth comes from experimentation.', priority: 7 },
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Build Relationships', body: 'Reply to comments, answer DMs — connection beats reach.', priority: 8 },
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Double Down', body: 'When something works, do more of it.', priority: 9 },
  { track: 'content_creator', type: 'morning', slot: 'prompt', title: 'Imperfect Action', body: 'Done is better than perfect — hit publish.', priority: 10 },

  // ============================================================================
  // SAAS FOUNDER PROMPTS (10)
  // ============================================================================
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'Ship Daily', body: 'Shipping daily builds momentum — even tiny improvements matter.', priority: 1 },
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'Talk to Users', body: 'Talk to users before guessing.', priority: 2 },
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'Activation Focus', body: 'Activation is your real bottleneck, not features.', priority: 3 },
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'Keep It Simple', body: 'Keep it simple; most SaaS fails from over-building.', priority: 4 },
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'User Conversations', body: 'One user conversation can change your roadmap.', priority: 5 },
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'Clarity Over Scale', body: 'Your app doesn\'t need scale yet — it needs clarity.', priority: 6 },
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'Problem Obsession', body: 'Obsession with the problem beats obsession with features.', priority: 7 },
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'Compound Progress', body: 'Every iteration compounds.', priority: 8 },
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'Solve One Pain', body: 'Solve one pain extremely well.', priority: 9 },
  { track: 'saas', type: 'morning', slot: 'prompt', title: 'Progress Over Perfection', body: 'Progress > Perfection.', priority: 10 },

  // ============================================================================
  // COACH / CONSULTANT PROMPTS (10)
  // ============================================================================
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'Show Up Daily', body: 'Visibility is the new credibility — show up every day.', priority: 1 },
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'Serve First', body: 'Help one person today, even if they never pay you.', priority: 2 },
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'Your Story Sells', body: 'Your transformation is your best marketing asset.', priority: 3 },
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'DM One Person', body: 'Start one genuine conversation — sales start with conversations.', priority: 4 },
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'Share Results', body: 'Results beat theory — share what actually works.', priority: 5 },
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'Simple Offer', body: 'A confused prospect never buys — simplify your offer.', priority: 6 },
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'Niche Down', body: 'The riches are in the niches — go deeper, not wider.', priority: 7 },
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'Client Experience', body: 'Great delivery creates referrals — over-deliver today.', priority: 8 },
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'Ask for Feedback', body: 'Feedback is free market research — ask for it.', priority: 9 },
  { track: 'coach_consultant', type: 'morning', slot: 'prompt', title: 'Build Trust', body: 'Trust takes time — plant seeds today for future clients.', priority: 10 },

  // ============================================================================
  // E-COMMERCE OWNER PROMPTS (10)
  // ============================================================================
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Test Daily', body: 'Test one thing every day — small tests lead to big wins.', priority: 1 },
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Check Metrics', body: 'Data doesn\'t lie — check your numbers before deciding.', priority: 2 },
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Customer Focus', body: 'Happy customers create more customers — respond fast.', priority: 3 },
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Optimize Pages', body: 'Your product page is your best salesperson — improve it today.', priority: 4 },
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Scale Winners', body: 'When you find a winner, scale it fast.', priority: 5 },
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Kill Losers', body: 'Stop losing money on underperformers — cut fast.', priority: 6 },
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Increase AOV', body: 'Upsells and bundles increase profit — test one today.', priority: 7 },
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Email Captures', body: 'Build your list — email is owned traffic.', priority: 8 },
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Fresh Creatives', body: 'Creative fatigue is real — refresh your ads regularly.', priority: 9 },
  { track: 'ecom', type: 'morning', slot: 'prompt', title: 'Retain Customers', body: 'Retention is cheaper than acquisition — re-engage past buyers.', priority: 10 },

  // ============================================================================
  // AGENCY OWNER PROMPTS (10)
  // ============================================================================
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Outreach Daily', body: 'Pipeline solves all problems — do your outreach today.', priority: 1 },
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Proactive Clients', body: 'A proactive update beats a client asking for one.', priority: 2 },
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Systemize', body: 'If you do it twice, document it — systems create scale.', priority: 3 },
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Results Focus', body: 'Client results are your best marketing — deliver excellence.', priority: 4 },
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Follow Up', body: 'Most deals close on follow-up #5 — don\'t quit early.', priority: 5 },
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Case Studies', body: 'A great case study sells for months — create one today.', priority: 6 },
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Price Confidence', body: 'Charge what you\'re worth — confidence attracts clients.', priority: 7 },
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Client Retention', body: 'Keeping a client is cheaper than finding a new one.', priority: 8 },
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Improve Delivery', body: 'Better processes = better margins — optimize one today.', priority: 9 },
  { track: 'agency', type: 'morning', slot: 'prompt', title: 'Build Relationships', body: 'Referrals come from relationships — nurture your network.', priority: 10 },

  // ============================================================================
  // COMMUNITY BUILDER PROMPTS (10)
  // ============================================================================
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Start Conversations', body: 'Communities grow through conversations — start one today.', priority: 1 },
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Celebrate Members', body: 'Recognition drives engagement — spotlight a member today.', priority: 2 },
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Create Value', body: 'Value keeps members coming back — add something useful today.', priority: 3 },
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Personal Touch', body: 'DM a member — personal connection builds loyalty.', priority: 4 },
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Build Rituals', body: 'Rituals create rhythm — establish consistent community moments.', priority: 5 },
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Welcome New Members', body: 'First impressions matter — make new members feel seen.', priority: 6 },
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Re-engage Quiet Members', body: 'Reach out to someone who\'s been quiet — they might need it.', priority: 7 },
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Ask Questions', body: 'Good questions spark great discussions — ask one today.', priority: 8 },
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Co-create', body: 'Let members shape the community — ask for their input.', priority: 9 },
  { track: 'community_builder', type: 'morning', slot: 'prompt', title: 'Document Wins', body: 'Member success stories attract new members — share one today.', priority: 10 },

  // ============================================================================
  // GENERIC FALLBACK PROMPTS
  // ============================================================================
  { track: null, type: 'morning', slot: 'prompt', title: 'Start Strong', body: 'What\'s your top priority today?', priority: 100 },
  { track: null, type: 'evening', slot: 'prompt', title: 'Reflect', body: 'What did you accomplish? What could be better?', priority: 100 },
  { track: null, type: 'weekly', slot: 'prompt', title: 'Weekly Review', body: 'Look back at your week. Celebrate wins, learn from setbacks.', priority: 100 },
  
  // Goal slot prompts
  { track: null, type: 'morning', slot: 'goal', title: 'Goal Check', body: 'Are your tasks aligned with your goal?', priority: 100 },
  { track: null, type: 'evening', slot: 'goal', title: 'Progress Update', body: 'How much closer are you to your goal after today?', priority: 100 },
  
  // Quote slot prompts - ~100 motivational quotes for daily variety
  // Classic philosophers
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'We suffer more often in imagination than in reality. — Seneca', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The obstacle is the way. — Marcus Aurelius', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'A journey of a thousand miles begins with a single step. — Lao Tzu', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'What you seek is seeking you. — Rumi', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'No man is free who is not master of himself. — Epictetus', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Waste no more time arguing about what a good man should be. Be one. — Marcus Aurelius', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The happiness of your life depends upon the quality of your thoughts. — Marcus Aurelius', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'It is not that we have a short time to live, but that we waste a lot of it. — Seneca', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Knowing yourself is the beginning of all wisdom. — Aristotle', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The unexamined life is not worth living. — Socrates', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'He who has a why to live can bear almost any how. — Nietzsche', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Out of your vulnerabilities will come your strength. — Sigmund Freud', priority: 100 },
  
  // Modern thought leaders
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'You do not rise to the level of your goals. You fall to the level of your systems. — James Clear', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Discipline equals freedom. — Jocko Willink', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Play long-term games with long-term people. — Naval Ravikant', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The person who says he knows what he thinks but cannot express it usually does not know what he thinks. — Mortimer Adler', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Clarity about what matters provides clarity about what does not. — Cal Newport', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Deep work is the ability to focus without distraction on a cognitively demanding task. — Cal Newport', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'What we fear doing most is usually what we most need to do. — Tim Ferriss', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Focus on being productive instead of busy. — Tim Ferriss', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'If you want to be successful, find someone who has achieved the results you want and model them. — Tony Robbins', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The quality of your life is the quality of your relationships. — Tony Robbins', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Earn with your mind, not your time. — Naval Ravikant', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'A fit body, a calm mind, a house full of love. These things cannot be bought. — Naval Ravikant', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Desire is a contract you make with yourself to be unhappy until you get what you want. — Naval Ravikant', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Atomic habits are the compound interest of self-improvement. — James Clear', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Every action you take is a vote for the type of person you wish to become. — James Clear', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The most dangerous risk of all is spending your life not doing what you want on the bet you can buy yourself the freedom to do it later. — Randy Komisar', priority: 100 },
  
  // Historical figures & entrepreneurs
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The secret of getting ahead is getting started. — Mark Twain', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The way to get started is to quit talking and begin doing. — Walt Disney', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Be yourself; everyone else is already taken. — Oscar Wilde', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The only way to do great work is to love what you do. — Steve Jobs', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Stay hungry, stay foolish. — Steve Jobs', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Life is what happens when you are busy making other plans. — John Lennon', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'In the middle of difficulty lies opportunity. — Albert Einstein', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Imagination is more important than knowledge. — Albert Einstein', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The best time to plant a tree was 20 years ago. The second best time is now. — Chinese Proverb', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The only thing we have to fear is fear itself. — Franklin D. Roosevelt', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'In the end, it is not the years in your life that count. It is the life in your years. — Abraham Lincoln', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Whether you think you can or you think you cannot, you are right. — Henry Ford', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'If you want to lift yourself up, lift up someone else. — Booker T. Washington', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The future belongs to those who believe in the beauty of their dreams. — Eleanor Roosevelt', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'You miss 100% of the shots you do not take. — Wayne Gretzky', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'It always seems impossible until it is done. — Nelson Mandela', priority: 100 },
  
  // Authors & speakers
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'How we spend our days is, of course, how we spend our lives. — Annie Dillard', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Done is better than perfect. — Sheryl Sandberg', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Small daily improvements are the key to staggering long-term results. — Robin Sharma', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Success is the sum of small efforts, repeated day in and day out. — Robert Collier', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work. — Steve Jobs', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The only limit to our realization of tomorrow is our doubts of today. — Franklin D. Roosevelt', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Do what you can, with what you have, where you are. — Theodore Roosevelt', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Courage is not the absence of fear, but rather the judgment that something else is more important than fear. — Ambrose Redmoon', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'What lies behind us and what lies before us are tiny matters compared to what lies within us. — Ralph Waldo Emerson', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The mind is everything. What you think you become. — Buddha', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The only impossible journey is the one you never begin. — Tony Robbins', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Vulnerability is the birthplace of innovation, creativity and change. — Brene Brown', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Owning our story and loving ourselves through that process is the bravest thing we will ever do. — Brene Brown', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Ship often. Ship lousy stuff, but ship. Ship constantly. — Seth Godin', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The only thing worse than starting something and failing is not starting something. — Seth Godin', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'You cannot swim for new horizons until you have courage to lose sight of the shore. — William Faulkner', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Do not wait to strike till the iron is hot, but make it hot by striking. — William Butler Yeats', priority: 100 },
  
  // Productivity & growth mindset
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Action is the foundational key to all success. — Pablo Picasso', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Simplicity is the ultimate sophistication. — Leonardo da Vinci', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The way to get things done is to not mind who gets the credit for doing them. — Benjamin Jowett', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Excellence is not a skill. It is an attitude. — Ralph Marston', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'What gets measured gets managed. — Peter Drucker', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The best way to predict the future is to create it. — Peter Drucker', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'An investment in knowledge pays the best interest. — Benjamin Franklin', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Lost time is never found again. — Benjamin Franklin', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Tell me and I forget. Teach me and I remember. Involve me and I learn. — Benjamin Franklin', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Perfection is not attainable, but if we chase perfection we can catch excellence. — Vince Lombardi', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The difference between ordinary and extraordinary is that little extra. — Jimmy Johnson', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Success is not final, failure is not fatal: it is the courage to continue that counts. — Winston Churchill', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'If you are going through hell, keep going. — Winston Churchill', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit. — Will Durant', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Start where you are. Use what you have. Do what you can. — Arthur Ashe', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'It does not matter how slowly you go as long as you do not stop. — Confucius', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Our greatest glory is not in never falling, but in rising every time we fall. — Confucius', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The man who moves a mountain begins by carrying away small stones. — Confucius', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'I have not failed. I have just found 10,000 ways that will not work. — Thomas Edison', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Opportunity is missed by most people because it is dressed in overalls and looks like work. — Thomas Edison', priority: 100 },
  
  // Mindfulness & presence
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Yesterday is history, tomorrow is a mystery, but today is a gift. That is why it is called the present. — Bil Keane', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Be where you are, not where you think you should be. — Unknown', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The present moment is filled with joy and happiness. If you are attentive, you will see it. — Thich Nhat Hanh', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Realize deeply that the present moment is all you ever have. — Eckhart Tolle', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Life is available only in the present moment. — Thich Nhat Hanh', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment. — Buddha', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Almost everything will work again if you unplug it for a few minutes, including you. — Anne Lamott', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The quieter you become, the more you can hear. — Ram Dass', priority: 100 },
  
  // Resilience & perseverance
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Fall seven times, stand up eight. — Japanese Proverb', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The comeback is always stronger than the setback. — Unknown', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Tough times never last, but tough people do. — Robert H. Schuller', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Strength does not come from winning. Your struggles develop your strengths. — Arnold Schwarzenegger', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Rock bottom became the solid foundation on which I rebuilt my life. — J.K. Rowling', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Hardships often prepare ordinary people for an extraordinary destiny. — C.S. Lewis', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Persistence is very important. You should not give up unless you are forced to give up. — Elon Musk', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'You just have to keep showing up and doing the work. — Angela Duckworth', priority: 100 },
  
  // Creativity & innovation
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Creativity is intelligence having fun. — Albert Einstein', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The chief enemy of creativity is good sense. — Pablo Picasso', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'You can not use up creativity. The more you use, the more you have. — Maya Angelou', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Innovation distinguishes between a leader and a follower. — Steve Jobs', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'Have no fear of perfection - you will never reach it. — Salvador Dali', priority: 100 },
  { track: null, type: 'morning', slot: 'quote', title: '', body: 'The desire to create is one of the deepest yearnings of the human soul. — Dieter F. Uchtdorf', priority: 100 },
];

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

async function seedTracks() {
  console.log('\n📌 Seeding Tracks...\n');
  
  const trackIdMap: Record<string, string> = {};
  
  for (const track of TRACKS) {
    // Check if track exists
    const existingSnapshot = await db
      .collection('tracks')
      .where('slug', '==', track.slug)
      .limit(1)
      .get();
    
    const trackData = {
      slug: track.slug,
      name: track.name,
      description: track.description,
      habitLabel: track.habitLabel,
      programBadgeLabel: track.programBadgeLabel,
      defaultHabits: track.defaultHabits,
      weeklyFocusDefaults: track.weeklyFocusDefaults,
      isActive: true,
    };
    
    if (!existingSnapshot.empty) {
      const trackId = existingSnapshot.docs[0].id;
      trackIdMap[track.slug] = trackId;
      
      // Update existing track
      await db.collection('tracks').doc(trackId).update({
        ...trackData,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✓ Updated: ${track.name} (${trackId})`);
    } else {
      // Create new track
      const docRef = await db.collection('tracks').add({
        ...trackData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      trackIdMap[track.slug] = docRef.id;
      console.log(`   ✓ Created: ${track.name} (${docRef.id})`);
    }
  }
  
  return trackIdMap;
}

async function seedContentCreator30DayProgram(trackIdMap: Record<string, string>) {
  console.log('\n📚 Seeding Content Creator 30-Day Program...\n');
  
  const programSlug = 'creator-starter-30';
  const trackSlug = 'content_creator';
  
  // Check if program exists
  const existingSnapshot = await db
    .collection('starter_programs')
    .where('slug', '==', programSlug)
    .limit(1)
    .get();
  
  const programData = {
    track: trackSlug,
    slug: programSlug,
    name: 'Content Creator Starter Program',
    description: '30 days to build a consistent content routine and ship work that grows your audience.',
    lengthDays: 30,
    isDefaultForTrack: true,
    isActive: true,
    type: 'starter',
    defaultHabits: TRACKS.find(t => t.slug === trackSlug)?.defaultHabits.map(h => ({
      title: h.title,
      description: h.description,
      frequency: 'daily' as const,
    })) || [],
  };
  
  let programId: string;
  
  if (!existingSnapshot.empty) {
    programId = existingSnapshot.docs[0].id;
    await db.collection('starter_programs').doc(programId).update({
      ...programData,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`   ✓ Updated: ${programData.name} (${programId})`);
  } else {
    const docRef = await db.collection('starter_programs').add({
      ...programData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    programId = docRef.id;
    console.log(`   ✓ Created: ${programData.name} (${programId})`);
  }
  
  // Seed all 30 days
  console.log('   Seeding 30 days of content...');
  for (const day of CONTENT_CREATOR_30_DAY_PROGRAM) {
    await seedProgramDay(programId, day);
  }
  console.log(`   ✓ Seeded all 30 days for ${programData.name}`);
}

async function seedProgramDay(
  programId: string, 
  day: ProgramDayDefinition
) {
  const existingSnapshot = await db
    .collection('starter_program_days')
    .where('programId', '==', programId)
    .where('dayIndex', '==', day.dayIndex)
    .limit(1)
    .get();
  
  const dayData = {
    programId,
    dayIndex: day.dayIndex,
    title: day.title,
    summary: day.summary,
    dailyPrompt: day.dailyPrompt,
    tasks: day.tasks,
  };
  
  if (!existingSnapshot.empty) {
    await db.collection('starter_program_days').doc(existingSnapshot.docs[0].id).update({
      ...dayData,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await db.collection('starter_program_days').add({
      ...dayData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

async function seedOther30DayPrograms(trackIdMap: Record<string, string>) {
  console.log('\n📚 Seeding 30-Day Programs for All Tracks...\n');
  
  // SaaS Founder 30-Day Program
  await seed30DayProgram({
    track: 'saas',
    slug: 'saas-starter-30',
    name: 'SaaS Founder Starter Program',
    description: 'Build momentum toward a functioning, validated SaaS product in 30 days.',
    days: SAAS_FOUNDER_30_DAY_PROGRAM,
  });
  
  // Coach / Consultant 30-Day Program
  await seed30DayProgram({
    track: 'coach_consultant',
    slug: 'coach-starter-30',
    name: 'Coach / Consultant Starter Program',
    description: 'Build a validated offer and consistent lead flow in 30 days.',
    days: COACH_CONSULTANT_30_DAY_PROGRAM,
  });
  
  // E-commerce Owner 30-Day Program
  await seed30DayProgram({
    track: 'ecom',
    slug: 'ecom-starter-30',
    name: 'E-commerce Owner Starter Program',
    description: 'Improve conversion and predictable performance in 30 days.',
    days: ECOM_OWNER_30_DAY_PROGRAM,
  });
  
  // Agency Owner 30-Day Program
  await seed30DayProgram({
    track: 'agency',
    slug: 'agency-starter-30',
    name: 'Agency Owner Starter Program',
    description: 'Increase lead flow and strengthen fulfillment system in 30 days.',
    days: AGENCY_OWNER_30_DAY_PROGRAM,
  });
  
  // Community Builder 30-Day Program
  await seed30DayProgram({
    track: 'community_builder',
    slug: 'community-starter-30',
    name: 'Community Builder Starter Program',
    description: 'Build a thriving, engaged community with rituals in 30 days.',
    days: COMMUNITY_BUILDER_30_DAY_PROGRAM,
  });
}

async function seed30DayProgram(config: {
  track: string;
  slug: string;
  name: string;
  description: string;
  days: ProgramDayDefinition[];
}) {
  const { track, slug, name, description, days } = config;
  
  // Get default habits from track definition
  const trackDef = TRACKS.find(t => t.slug === track);
  const defaultHabits = trackDef?.defaultHabits.map(h => ({
    title: h.title,
    description: h.description,
    frequency: 'daily' as const,
  })) || [];
  
  // Check if program exists
  const existingSnapshot = await db
    .collection('starter_programs')
    .where('slug', '==', slug)
    .limit(1)
    .get();
  
  let programId: string;
  
  const programData = {
    track,
    slug,
    name,
    description,
    lengthDays: 30,
    isDefaultForTrack: true,
    isActive: true,
    type: 'starter',
    defaultHabits,
  };
  
  if (!existingSnapshot.empty) {
    programId = existingSnapshot.docs[0].id;
    await db.collection('starter_programs').doc(programId).update({
      ...programData,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`   ✓ Updated: ${name} (${programId})`);
  } else {
    const docRef = await db.collection('starter_programs').add({
      ...programData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    programId = docRef.id;
    console.log(`   ✓ Created: ${name} (${programId})`);
  }
  
  // Seed all 30 days
  console.log(`   Seeding 30 days for ${name}...`);
  for (const day of days) {
    await seedProgramDay(programId, day);
  }
  console.log(`   ✓ Seeded all 30 days for ${name}`);
}

async function seedDynamicPrompts(trackIdMap: Record<string, string>) {
  console.log('\n💬 Seeding Dynamic Prompts...\n');
  
  let created = 0;
  let updated = 0;
  
  for (const prompt of DYNAMIC_PROMPTS) {
    const trackId = prompt.track ? trackIdMap[prompt.track] : null;
    
    // Check if prompt exists (by trackId + type + slot + title)
    let query = db.collection('dynamic_prompts')
      .where('type', '==', prompt.type)
      .where('slot', '==', prompt.slot);
    
    if (trackId) {
      query = query.where('trackId', '==', trackId);
    } else {
      query = query.where('trackId', '==', null);
    }
    
    if (prompt.title) {
      query = query.where('title', '==', prompt.title);
    }
    
    const existingSnapshot = await query.limit(1).get();
    
    const promptData = {
      trackId,
      type: prompt.type,
      slot: prompt.slot,
      title: prompt.title,
      body: prompt.body,
      priority: prompt.priority,
      isActive: true,
    };
    
    if (!existingSnapshot.empty) {
      await db.collection('dynamic_prompts').doc(existingSnapshot.docs[0].id).update({
        ...promptData,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated++;
    } else {
      await db.collection('dynamic_prompts').add({
        ...promptData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      created++;
    }
  }
  
  console.log(`   ✓ Created ${created} prompts, updated ${updated} prompts`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n🌱 Seeding Tracks CMS Data...');
  console.log('================================\n');
  
  try {
    // 1. Seed tracks (6 tracks)
    const trackIdMap = await seedTracks();
    
    // 2. Seed Content Creator 30-day program (full 30 days)
    await seedContentCreator30DayProgram(trackIdMap);
    
    // 3. Seed other 30-day programs (SaaS, Coach, E-com, Agency, Community)
    await seedOther30DayPrograms(trackIdMap);
    
    // 4. Seed dynamic prompts (10 per track + generic fallbacks)
    await seedDynamicPrompts(trackIdMap);
    
    console.log('\n================================');
    console.log('✅ Seeding complete!');
    console.log(`   Tracks: ${TRACKS.length}`);
    console.log(`   30-Day Programs: ${TRACKS.length} (Content Creator + 5 others)`);
    console.log(`   Dynamic Prompts: ${DYNAMIC_PROMPTS.length} (10 per track + fallbacks)`);
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
