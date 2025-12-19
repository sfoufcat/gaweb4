/**
 * Content Creator – 30 Day Jumpstart Program
 * 
 * A structured 30-day program to help content creators:
 * - Define their content strategy and audience
 * - Build consistent publishing habits
 * - Grow their audience and engagement
 * - Create systems for sustainable content creation
 */

import type { ProgramTaskTemplate } from '@/types';

export const CONTENT_CREATOR_PROGRAM = {
  track: 'content_creator' as const,
  slug: 'content-creator-30-day-start',
  name: 'Content Creator – 30 Day Jumpstart',
  description: '30 days of simple, focused actions to publish consistently and grow your audience.',
  lengthDays: 30,
  isDefaultForTrack: true,
};

export type ContentCreatorDayTasks = {
  dayIndex: number;
  tasks: ProgramTaskTemplate[];
};

/**
 * Full 30-day program content
 * 
 * Structure:
 * - Week 1 (Days 1-7): Foundation & Strategy
 * - Week 2 (Days 8-14): Content Creation Systems
 * - Week 3 (Days 15-21): Audience Growth
 * - Week 4 (Days 22-28): Engagement & Community
 * - Days 29-30: Review & Plan Ahead
 */
export const CONTENT_CREATOR_DAYS: ContentCreatorDayTasks[] = [
  // ============================================================================
  // WEEK 1: FOUNDATION & STRATEGY (Days 1-7)
  // ============================================================================
  {
    dayIndex: 1,
    tasks: [
      {
        label: 'Define your content creator goal for the next 90 days',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 20,
        notes: 'What does success look like? Be specific: followers, revenue, content pieces, etc.',
      },
      {
        label: 'Define your target audience (who are you creating for?)',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 25,
        notes: 'Demographics, pain points, aspirations. The more specific, the better.',
      },
      {
        label: 'Write down 10 content ideas based on your audience\'s needs',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Clean up your bio on one platform',
        isPrimary: false,
        tag: 'admin',
        estimatedMinutes: 15,
      },
    ],
  },
  {
    dayIndex: 2,
    tasks: [
      {
        label: 'Choose your primary platform (focus on one for now)',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 15,
        notes: 'Pick the platform where your audience spends the most time.',
      },
      {
        label: 'Audit your current content: what performed best?',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 30,
      },
      {
        label: 'Identify 3 content pillars (themes you\'ll consistently create about)',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Follow 5 creators in your niche for inspiration',
        isPrimary: false,
        tag: 'learning',
        estimatedMinutes: 15,
      },
    ],
  },
  {
    dayIndex: 3,
    tasks: [
      {
        label: 'Define your unique angle (what makes your content different?)',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 25,
      },
      {
        label: 'Write your creator mission statement in one sentence',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 15,
      },
      {
        label: 'Create or update your content creation schedule',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 20,
        notes: 'How many pieces per week? Which days? Be realistic.',
      },
      {
        label: 'Optional: Set up a simple content calendar (Notion, Google Sheets, etc.)',
        isPrimary: false,
        tag: 'systems',
        estimatedMinutes: 30,
      },
    ],
  },
  {
    dayIndex: 4,
    tasks: [
      {
        label: 'Research trending topics in your niche',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 30,
      },
      {
        label: 'Draft your first piece of content for the week',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 45,
      },
      {
        label: 'Identify 3 hashtags or keywords relevant to your content',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 15,
      },
      {
        label: 'Optional: Analyze a competitor\'s top-performing content',
        isPrimary: false,
        tag: 'learning',
        estimatedMinutes: 20,
      },
    ],
  },
  {
    dayIndex: 5,
    tasks: [
      {
        label: 'Finish and publish your first piece of content this week',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 30,
      },
      {
        label: 'Engage with 5 posts in your niche (genuine comments)',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Track your content\'s initial performance',
        isPrimary: true,
        tag: 'analytics',
        estimatedMinutes: 10,
      },
      {
        label: 'Optional: Repurpose your content for another platform',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 20,
      },
    ],
  },
  {
    dayIndex: 6,
    tasks: [
      {
        label: 'Batch-brainstorm 10 more content ideas',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 25,
      },
      {
        label: 'Create a simple hook/intro template for your content',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 20,
        notes: 'Strong hooks grab attention. Create 3-5 templates you can reuse.',
      },
      {
        label: 'Reply to all comments on your recent posts',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 15,
      },
      {
        label: 'Optional: Study one viral piece in your niche - why did it work?',
        isPrimary: false,
        tag: 'learning',
        estimatedMinutes: 20,
      },
    ],
  },
  {
    dayIndex: 7,
    tasks: [
      {
        label: 'Review your week: What worked? What didn\'t?',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 20,
      },
      {
        label: 'Plan next week\'s content topics',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 25,
      },
      {
        label: 'Set one specific goal for Week 2',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 10,
      },
      {
        label: 'Optional: Rest and consume content for inspiration',
        isPrimary: false,
        tag: 'mindset',
        estimatedMinutes: 30,
      },
    ],
  },
  
  // ============================================================================
  // WEEK 2: CONTENT CREATION SYSTEMS (Days 8-14)
  // ============================================================================
  {
    dayIndex: 8,
    tasks: [
      {
        label: 'Set up a dedicated workspace for content creation',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 30,
      },
      {
        label: 'Create a content idea capture system (notes app, voice memos)',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 15,
      },
      {
        label: 'Draft this week\'s first piece of content',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 40,
      },
      {
        label: 'Optional: Invest in one tool to improve content quality',
        isPrimary: false,
        tag: 'systems',
        estimatedMinutes: 20,
      },
    ],
  },
  {
    dayIndex: 9,
    tasks: [
      {
        label: 'Build a swipe file of content you admire',
        isPrimary: true,
        tag: 'learning',
        estimatedMinutes: 25,
        notes: 'Save 10-15 pieces that resonate. Note what makes them effective.',
      },
      {
        label: 'Create 3 content templates for your main formats',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 35,
      },
      {
        label: 'Publish today\'s content',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Test a new content format',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 30,
      },
    ],
  },
  {
    dayIndex: 10,
    tasks: [
      {
        label: 'Batch-create 3 pieces of content in one session',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 90,
        notes: 'Batching is more efficient. Try to create 3 drafts in one sitting.',
      },
      {
        label: 'Engage with 10 accounts in your niche',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Schedule your batched content for the week',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 15,
      },
      {
        label: 'Optional: Set up a scheduling tool if you haven\'t',
        isPrimary: false,
        tag: 'systems',
        estimatedMinutes: 20,
      },
    ],
  },
  {
    dayIndex: 11,
    tasks: [
      {
        label: 'Analyze your best-performing content from last week',
        isPrimary: true,
        tag: 'analytics',
        estimatedMinutes: 25,
      },
      {
        label: 'Double down: Create a variation of your top performer',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 30,
      },
      {
        label: 'Reply to all comments and DMs',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 15,
      },
      {
        label: 'Optional: Reach out to one creator for collaboration',
        isPrimary: false,
        tag: 'growth',
        estimatedMinutes: 15,
      },
    ],
  },
  {
    dayIndex: 12,
    tasks: [
      {
        label: 'Create a "content bank" of evergreen ideas',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 30,
      },
      {
        label: 'Write captions/copy for your next 3 posts',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 35,
      },
      {
        label: 'Optimize your profile for discoverability',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Create one piece of long-form content',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 60,
      },
    ],
  },
  {
    dayIndex: 13,
    tasks: [
      {
        label: 'Document your content creation process step-by-step',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 30,
        notes: 'This becomes your repeatable system. Write down each step.',
      },
      {
        label: 'Identify one bottleneck in your process and fix it',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 25,
      },
      {
        label: 'Publish and engage with your audience',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Create a behind-the-scenes content piece',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 25,
      },
    ],
  },
  {
    dayIndex: 14,
    tasks: [
      {
        label: 'Review Week 2: Did you publish consistently?',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 15,
      },
      {
        label: 'Celebrate your progress - share a win with your audience',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 20,
      },
      {
        label: 'Plan Week 3 content around audience growth',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 25,
      },
      {
        label: 'Optional: Take a content break - consume, don\'t create',
        isPrimary: false,
        tag: 'mindset',
        estimatedMinutes: 30,
      },
    ],
  },
  
  // ============================================================================
  // WEEK 3: AUDIENCE GROWTH (Days 15-21)
  // ============================================================================
  {
    dayIndex: 15,
    tasks: [
      {
        label: 'Define your ideal follower profile in detail',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 25,
      },
      {
        label: 'Find 10 accounts where your ideal followers hang out',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Create content that specifically addresses their pain points',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 40,
      },
      {
        label: 'Optional: Create a lead magnet idea (freebie, guide, etc.)',
        isPrimary: false,
        tag: 'growth',
        estimatedMinutes: 30,
      },
    ],
  },
  {
    dayIndex: 16,
    tasks: [
      {
        label: 'Engage meaningfully with 15 accounts today',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 30,
        notes: 'Quality over quantity. Leave thoughtful, valuable comments.',
      },
      {
        label: 'Create content with a strong call-to-action',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 35,
      },
      {
        label: 'Ask your audience a question to boost engagement',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 15,
      },
      {
        label: 'Optional: Go live or create Stories/Reels',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 30,
      },
    ],
  },
  {
    dayIndex: 17,
    tasks: [
      {
        label: 'Reach out to 3 creators for potential collaboration',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 30,
      },
      {
        label: 'Create shareable content (infographic, carousel, quote)',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 40,
      },
      {
        label: 'Analyze which content types get most saves/shares',
        isPrimary: true,
        tag: 'analytics',
        estimatedMinutes: 15,
      },
      {
        label: 'Optional: Guest post or appear on someone else\'s platform',
        isPrimary: false,
        tag: 'growth',
        estimatedMinutes: 60,
      },
    ],
  },
  {
    dayIndex: 18,
    tasks: [
      {
        label: 'Create a "This vs That" or comparison content piece',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 35,
      },
      {
        label: 'Respond to trending topics in your niche',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 30,
      },
      {
        label: 'DM 5 engaged followers - start conversations',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Create content addressing common objections',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 35,
      },
    ],
  },
  {
    dayIndex: 19,
    tasks: [
      {
        label: 'Repurpose your best content for a new platform',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 30,
      },
      {
        label: 'Create a "How I..." personal story content piece',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 40,
        notes: 'Personal stories build connection. Share your journey.',
      },
      {
        label: 'Engage with comments for 15 minutes',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 15,
      },
      {
        label: 'Optional: Host a Q&A session with your audience',
        isPrimary: false,
        tag: 'growth',
        estimatedMinutes: 45,
      },
    ],
  },
  {
    dayIndex: 20,
    tasks: [
      {
        label: 'Optimize your bio and link for conversions',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 25,
      },
      {
        label: 'Create content with a hook that stops the scroll',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 35,
      },
      {
        label: 'Follow up with collaboration opportunities',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 15,
      },
      {
        label: 'Optional: Create a tutorial or educational piece',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 45,
      },
    ],
  },
  {
    dayIndex: 21,
    tasks: [
      {
        label: 'Review Week 3: Track follower growth and engagement',
        isPrimary: true,
        tag: 'analytics',
        estimatedMinutes: 20,
      },
      {
        label: 'Identify your top growth strategies from this week',
        isPrimary: true,
        tag: 'strategy',
        estimatedMinutes: 15,
      },
      {
        label: 'Plan Week 4 focused on engagement and community',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 25,
      },
      {
        label: 'Optional: Write about your growth journey so far',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 30,
      },
    ],
  },
  
  // ============================================================================
  // WEEK 4: ENGAGEMENT & COMMUNITY (Days 22-28)
  // ============================================================================
  {
    dayIndex: 22,
    tasks: [
      {
        label: 'Create content asking for audience opinions',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 30,
      },
      {
        label: 'Set up a system to respond to DMs within 24 hours',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 20,
      },
      {
        label: 'Feature or shout out a community member',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Start planning a community space (Discord, etc.)',
        isPrimary: false,
        tag: 'growth',
        estimatedMinutes: 30,
      },
    ],
  },
  {
    dayIndex: 23,
    tasks: [
      {
        label: 'Create "myth-busting" content in your niche',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 35,
      },
      {
        label: 'Engage deeply with 10 comments on your posts',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Share user-generated content or testimonials',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Create a poll or interactive content',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 15,
      },
    ],
  },
  {
    dayIndex: 24,
    tasks: [
      {
        label: 'Create content showing your personality/behind-the-scenes',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 30,
      },
      {
        label: 'Start a conversation thread in your comments',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 15,
      },
      {
        label: 'Identify and thank your most engaged followers',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Create a "day in my life" content piece',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 40,
      },
    ],
  },
  {
    dayIndex: 25,
    tasks: [
      {
        label: 'Create content addressing a common struggle',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 35,
      },
      {
        label: 'Send personal thank-you messages to 5 supporters',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Ask your audience what content they want to see',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 15,
      },
      {
        label: 'Optional: Create exclusive content for engaged followers',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 40,
      },
    ],
  },
  {
    dayIndex: 26,
    tasks: [
      {
        label: 'Respond to every comment on your last 3 posts',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 30,
      },
      {
        label: 'Create content based on audience feedback',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 40,
      },
      {
        label: 'Share a genuine lesson learned from your journey',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 25,
      },
      {
        label: 'Optional: Host a mini-challenge for your community',
        isPrimary: false,
        tag: 'growth',
        estimatedMinutes: 30,
      },
    ],
  },
  {
    dayIndex: 27,
    tasks: [
      {
        label: 'Create a "resource list" content piece for your audience',
        isPrimary: true,
        tag: 'content',
        estimatedMinutes: 40,
      },
      {
        label: 'Connect with 3 new accounts in your niche',
        isPrimary: true,
        tag: 'growth',
        estimatedMinutes: 20,
      },
      {
        label: 'Plan your content calendar for the next month',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 30,
      },
      {
        label: 'Optional: Create a "start here" guide for new followers',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 45,
      },
    ],
  },
  {
    dayIndex: 28,
    tasks: [
      {
        label: 'Review Week 4: Measure engagement improvements',
        isPrimary: true,
        tag: 'analytics',
        estimatedMinutes: 20,
      },
      {
        label: 'Document your community-building wins',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 15,
      },
      {
        label: 'Prepare for your 30-day reflection',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Write a thread about your 30-day journey',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 40,
      },
    ],
  },
  
  // ============================================================================
  // DAYS 29-30: REVIEW & PLAN AHEAD
  // ============================================================================
  {
    dayIndex: 29,
    tasks: [
      {
        label: 'Review your 30-day analytics: followers, engagement, reach',
        isPrimary: true,
        tag: 'analytics',
        estimatedMinutes: 30,
      },
      {
        label: 'Identify your top 3 performing content pieces and why',
        isPrimary: true,
        tag: 'analytics',
        estimatedMinutes: 25,
      },
      {
        label: 'Write down 3 key lessons from this 30-day journey',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 20,
      },
      {
        label: 'Optional: Share your transformation with your audience',
        isPrimary: false,
        tag: 'content',
        estimatedMinutes: 35,
      },
    ],
  },
  {
    dayIndex: 30,
    tasks: [
      {
        label: 'Set your content goals for the next 90 days',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 30,
      },
      {
        label: 'Create a sustainable weekly content schedule',
        isPrimary: true,
        tag: 'systems',
        estimatedMinutes: 25,
      },
      {
        label: 'Celebrate! Reward yourself for completing the program 🎉',
        isPrimary: true,
        tag: 'mindset',
        estimatedMinutes: 15,
        notes: 'You did it! Take time to acknowledge your progress.',
      },
      {
        label: 'Optional: Plan next steps - course, monetization, scaling',
        isPrimary: false,
        tag: 'strategy',
        estimatedMinutes: 30,
      },
    ],
  },
];



