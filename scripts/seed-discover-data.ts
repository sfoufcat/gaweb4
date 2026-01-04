/**
 * Seed Discover Data to Firestore
 * 
 * This script populates Firestore with sample events, articles, and courses
 * for the Discover feature.
 * 
 * Usage:
 * doppler run -- npx tsx scripts/seed-discover-data.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const initAdmin = () => {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      console.error('❌ Firebase credentials not found in environment');
      console.log('💡 Make sure to run with Doppler:');
      console.log('   doppler run -- npx tsx scripts/seed-discover-data.ts\n');
      process.exit(1);
    }
  }
};

initAdmin();
const db = getFirestore();

// Cover images (using Unsplash)
const COVER_IMAGES = {
  event1: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
  event2: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80',
  event3: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&q=80',
  article1: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80',
  article2: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80',
  course1: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
  course2: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
  recommended1: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80',
  avatar1: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
  avatar2: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
  avatar3: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80',
  avatar4: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80',
  avatar5: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80',
};

// Sample Events
const EVENTS = [
  {
    id: 'event-1',
    title: 'Unlock Your Best Self: Building Sustainable Habits for Growth',
    coverImageUrl: COVER_IMAGES.event1,
    date: '2025-10-20',
    startTime: '18:00',
    endTime: '20:00',
    timezone: 'CET',
    locationType: 'online',
    locationLabel: 'Online via Zoom',
    shortDescription: 'Join this interactive online workshop designed to help you identify, design, and sustain daily habits.',
    longDescription: `Join this interactive online workshop designed to help you identify, design, and sustain daily habits that align with your long-term goals. You'll learn practical tools from behavioral psychology, mindfulness, and habit tracking to create real, lasting change.`,
    bulletPoints: [
      'Understand how habits shape your identity and success',
      'Build a personal framework for self-growth',
      'Learn techniques to overcome procrastination and burnout',
      'Leave with a 7-day micro-challenge plan to apply immediately',
    ],
    additionalInfo: {
      type: 'Live workshop + Q&A',
      language: 'English',
      difficulty: 'Beginner–Intermediate',
    },
    zoomLink: 'https://zoom.us/j/123456789',
    hostName: 'Sarah Nguyen',
    hostAvatarUrl: COVER_IMAGES.avatar1,
    attendeeIds: [],
    maxAttendees: 50,
  },
  {
    id: 'event-2',
    title: 'Mastering Focus: Deep Work Strategies for Entrepreneurs',
    coverImageUrl: COVER_IMAGES.event2,
    date: '2025-10-25',
    startTime: '16:00',
    endTime: '17:30',
    timezone: 'CET',
    locationType: 'online',
    locationLabel: 'Online via Zoom',
    shortDescription: 'Learn how to eliminate distractions and achieve laser-like focus in your daily work.',
    longDescription: `Discover the science behind deep work and learn practical strategies to eliminate distractions. This workshop will help you create an environment and mindset conducive to your best work.`,
    bulletPoints: [
      'Understand the neuroscience of focus',
      'Create your optimal work environment',
      'Build a deep work routine that sticks',
      'Handle interruptions without losing momentum',
    ],
    additionalInfo: {
      type: 'Interactive Workshop',
      language: 'English',
      difficulty: 'All levels',
    },
    zoomLink: 'https://zoom.us/j/987654321',
    hostName: 'Marcus Chen',
    hostAvatarUrl: COVER_IMAGES.avatar2,
    attendeeIds: [],
    maxAttendees: 30,
  },
  {
    id: 'event-3',
    title: 'Goal Setting Masterclass: From Vision to Reality',
    coverImageUrl: COVER_IMAGES.event3,
    date: '2025-11-01',
    startTime: '19:00',
    endTime: '21:00',
    timezone: 'CET',
    locationType: 'online',
    locationLabel: 'Online via Zoom',
    shortDescription: 'Transform your dreams into achievable goals with proven frameworks.',
    longDescription: `This masterclass will guide you through the process of turning your biggest dreams into actionable, achievable goals. Learn the frameworks used by top performers.`,
    bulletPoints: [
      'Define your long-term vision',
      'Break down goals into actionable steps',
      'Create accountability systems',
      'Track and celebrate progress',
    ],
    additionalInfo: {
      type: 'Masterclass',
      language: 'English',
      difficulty: 'Intermediate',
    },
    zoomLink: 'https://zoom.us/j/456789123',
    hostName: 'Elena Rodriguez',
    hostAvatarUrl: COVER_IMAGES.avatar3,
    attendeeIds: [],
    maxAttendees: 40,
  },
];

// Sample Event Updates
const EVENT_UPDATES = [
  {
    id: 'update-1',
    eventId: 'event-1',
    title: 'Pre-event reminder',
    content: 'Please check your inbox for the Zoom link and prep materials. We recommend having a notebook ready and joining from a quiet space.',
    authorName: 'Coachful',
  },
  {
    id: 'update-2',
    eventId: 'event-1',
    title: 'Worksheet available',
    content: "We've uploaded the habit tracking worksheet to your dashboard. Feel free to print it before the session!",
    authorName: 'Coachful',
  },
];

// Sample Articles
const ARTICLES = [
  {
    id: 'article-1',
    title: 'The Power of Small Wins: How Tiny Actions Create Big Change',
    coverImageUrl: COVER_IMAGES.article1,
    content: `In a world that celebrates overnight success, we often overlook the quiet power of consistency. Yet real growth rarely happens in a single moment — it's built through hundreds of small, intentional choices that compound over time.

Think of progress as planting a seed. You don't see results right away, but every day you water it, give it sunlight, and protect it from the wind. Eventually, it grows roots — and then, one day, you notice the first leaf.

This is how habits shape who we become.

When you go for a 10-minute walk instead of skipping it, you're training your brain to trust your own discipline. When you write one paragraph a day, you're proving that creativity can grow in tiny doses.

The key is to lower the bar of perfection and raise the bar of consistency.

You don't need to do everything — just do something, every day.

Over weeks, these small wins add up. Over months, they shift your mindset. And over time, they redefine your identity — from someone who tries to someone who becomes.

So, next time you doubt your progress, remember this: Big change is just a collection of small wins done consistently.`,
    authorName: 'Vincent Hu',
    authorTitle: 'Founder, Imminence',
    authorAvatarUrl: COVER_IMAGES.avatar4,
    authorBio: 'Helped Vincent scale from $0 to $1m in ARR for his consulting business in just over a year.',
    readingTimeMinutes: 5,
    category: 'Mindset',
  },
  {
    id: 'article-2',
    title: 'Why Your Morning Routine is Your Secret Weapon',
    coverImageUrl: COVER_IMAGES.article2,
    content: `The first hour of your day sets the tone for everything that follows. How you spend those precious morning minutes can be the difference between a productive day and a chaotic one.

The most successful people in the world share one thing in common: they have intentional morning routines. Not because they're morning people by nature, but because they've learned to leverage this time for maximum impact.

Here's why mornings matter:
- Your willpower is at its peak
- Fewer distractions compete for your attention
- You set the emotional tone for the day

Start small. Wake up 30 minutes earlier. Use that time for one thing that matters to you — exercise, meditation, learning, or planning.

The compound effect of consistent mornings is extraordinary. Over a year, those 30 minutes become 182 hours of focused self-improvement.

Your morning routine isn't just a habit. It's an investment in your future self.`,
    authorName: 'Sarah Nguyen',
    authorTitle: 'Life Coach & Founder',
    authorAvatarUrl: COVER_IMAGES.avatar1,
    authorBio: 'Certified life coach and founder of MindShift Collective, with over 10 years of experience in personal development coaching.',
    readingTimeMinutes: 4,
    category: 'Productivity',
  },
];

// Sample video URLs (using publicly available test videos)
const SAMPLE_VIDEOS = {
  // Big Buck Bunny - open source test video in various resolutions
  intro: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  short1: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  short2: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  short3: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  short4: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  short5: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
};

// Video thumbnail images
const VIDEO_THUMBNAILS = {
  thumb1: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80',
  thumb2: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80',
  thumb3: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
  thumb4: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=800&q=80',
  thumb5: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80',
  thumb6: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
};

// Sample Courses
const COURSES = [
  {
    id: 'course-1',
    title: 'Foundations of Personal Growth',
    coverImageUrl: COVER_IMAGES.course1,
    shortDescription: 'Master the fundamentals of self-improvement and build lasting habits.',
    category: 'Direction',
    level: 'Beginner',
    modules: [
      {
        id: 'module-1-1',
        order: 1,
        title: 'Understanding Your Why',
        subtitle: 'Foundation Module',
        description: 'Discover your core motivations and values.',
        lessons: [
          { 
            id: 'lesson-1-1-1', 
            order: 1,
            title: 'Introduction to Purpose', 
            durationMinutes: 12,
            videoUrl: SAMPLE_VIDEOS.intro,
            videoThumbnailUrl: VIDEO_THUMBNAILS.thumb1,
            notes: `Welcome to your personal growth journey! In this foundational lesson, we'll explore what purpose means and why it matters.

Purpose is not just about goals—it's about understanding the deeper "why" behind everything you do. When you connect with your purpose, you unlock a powerful source of motivation that sustains you through challenges.

Key takeaways:
• Purpose provides direction and meaning
• It differs from goals (which are outcomes) by being a continuous pursuit
• Finding your purpose starts with self-reflection

Take a moment to journal: What activities make you lose track of time? What would you do even if you weren't paid for it?`,
          },
          { 
            id: 'lesson-1-1-2', 
            order: 2,
            title: 'Values Assessment Exercise', 
            durationMinutes: 20,
            videoUrl: SAMPLE_VIDEOS.short1,
            videoThumbnailUrl: VIDEO_THUMBNAILS.thumb2,
            notes: `Your values are the compass that guides your decisions. In this exercise, you'll identify and prioritize your core values.

Instructions:
1. Review the list of 50 common values
2. Select your top 15 that resonate most
3. Narrow down to your top 5
4. Rank them in order of importance

Remember: There are no wrong answers. Your values are unique to you and may change over time.

Common values to consider: Achievement, Adventure, Authenticity, Balance, Compassion, Creativity, Family, Freedom, Growth, Health, Independence, Integrity, Knowledge, Leadership, Love, Recognition, Security, Service, Spirituality, Wisdom.`,
          },
          { 
            id: 'lesson-1-1-3', 
            order: 3,
            title: 'Creating Your Vision Statement', 
            durationMinutes: 15,
            videoUrl: SAMPLE_VIDEOS.short2,
            videoThumbnailUrl: VIDEO_THUMBNAILS.thumb3,
            notes: `A vision statement is a vivid description of your ideal future. It paints a picture of who you want to become and what you want to achieve.

Elements of a powerful vision statement:
• Written in present tense (as if already achieved)
• Emotionally compelling
• Specific enough to be meaningful
• Aligned with your values

Template to get started:
"I am [describe who you've become]. I spend my days [describe your activities]. I feel [describe your emotional state]. I contribute to [describe your impact]."

Your vision statement should inspire you every time you read it!`,
          },
        ],
      },
      {
        id: 'module-1-2',
        order: 2,
        title: 'Building Your Foundation',
        subtitle: 'Systems & Habits',
        description: 'Set up systems for sustainable growth.',
        lessons: [
          { 
            id: 'lesson-1-2-1', 
            order: 1,
            title: 'The Habit Loop', 
            durationMinutes: 18,
            videoUrl: SAMPLE_VIDEOS.short3,
            videoThumbnailUrl: VIDEO_THUMBNAILS.thumb4,
            notes: `Every habit follows a predictable pattern called the Habit Loop. Understanding this loop is the key to building good habits and breaking bad ones.

The Habit Loop consists of:
1. CUE - The trigger that initiates the behavior
2. ROUTINE - The behavior itself
3. REWARD - The benefit you get from the behavior

To build a new habit:
• Make the cue obvious
• Make the routine attractive and easy
• Make the reward satisfying

To break a bad habit:
• Make the cue invisible
• Make the routine unattractive and difficult
• Make the reward unsatisfying

This week's challenge: Identify one habit you want to build and map out its habit loop.`,
          },
          { 
            id: 'lesson-1-2-2', 
            order: 2,
            title: 'Environment Design', 
            durationMinutes: 14,
            videoUrl: SAMPLE_VIDEOS.short4,
            videoThumbnailUrl: VIDEO_THUMBNAILS.thumb5,
            notes: `Your environment shapes your behavior more than willpower ever will. By designing your environment strategically, you make good habits easy and bad habits hard.

Environment design principles:
• Reduce friction for desired behaviors
• Increase friction for undesired behaviors
• Use visual cues as reminders
• Create dedicated spaces for specific activities

Examples:
• Keep healthy snacks visible, hide junk food
• Put your workout clothes next to your bed
• Create a distraction-free workspace
• Use app blockers on your phone during focus time

Remember: You don't need more motivation—you need a better environment!`,
          },
          { 
            id: 'lesson-1-2-3', 
            order: 3,
            title: 'Tracking Progress', 
            durationMinutes: 10, 
            isLocked: true,
            notes: `Learn how to track your habits effectively and use data to improve your consistency. This premium lesson covers advanced tracking methods and tools.`,
          },
        ],
      },
    ],
  },
  {
    id: 'course-2',
    title: 'Advanced Goal Achievement',
    coverImageUrl: COVER_IMAGES.course2,
    shortDescription: 'Take your goal-setting to the next level with advanced strategies.',
    category: 'Direction',
    level: 'Intermediate',
    modules: [
      {
        id: 'module-2-1',
        order: 1,
        title: 'Strategic Planning',
        subtitle: 'Think Like a High Performer',
        description: 'Learn to plan like a high performer.',
        lessons: [
          { 
            id: 'lesson-2-1-1', 
            order: 1,
            title: 'Quarterly Goal Framework', 
            durationMinutes: 22,
            videoUrl: SAMPLE_VIDEOS.short5,
            videoThumbnailUrl: VIDEO_THUMBNAILS.thumb6,
            notes: `The 12-Week Year is a powerful framework that compresses a year's worth of goal achievement into 12 weeks. This creates urgency and focus that annual planning lacks.

Why 12 weeks works:
• Creates healthy urgency
• Reduces procrastination
• Allows for faster pivots
• Maintains high execution intensity

Your 12-Week Plan structure:
1. Vision (where you want to be)
2. Goals (3 max, measurable)
3. Tactics (weekly actions for each goal)
4. Weekly accountability review

Start by defining 1-3 goals you want to achieve in the next 12 weeks. Make them specific and measurable!`,
          },
          { 
            id: 'lesson-2-1-2', 
            order: 2,
            title: 'Priority Matrix', 
            durationMinutes: 16,
            videoUrl: SAMPLE_VIDEOS.intro,
            videoThumbnailUrl: VIDEO_THUMBNAILS.thumb1,
            notes: `The Eisenhower Matrix helps you decide what deserves your time and attention by categorizing tasks into four quadrants.

The Four Quadrants:
• Q1: Urgent & Important → DO IT NOW
• Q2: Not Urgent & Important → SCHEDULE IT
• Q3: Urgent & Not Important → DELEGATE IT
• Q4: Not Urgent & Not Important → ELIMINATE IT

High performers spend most of their time in Q2—important but not urgent tasks like planning, relationship building, and skill development.

Weekly practice:
1. List all your tasks
2. Categorize each into a quadrant
3. Protect time for Q2 activities
4. Minimize or delegate Q3 tasks`,
          },
        ],
      },
      {
        id: 'module-2-2',
        order: 2,
        title: 'Execution Excellence',
        subtitle: 'From Plans to Results',
        description: 'Turn plans into results.',
        lessons: [
          { 
            id: 'lesson-2-2-1', 
            order: 1,
            title: 'Daily Review System', 
            durationMinutes: 12,
            videoUrl: SAMPLE_VIDEOS.short1,
            videoThumbnailUrl: VIDEO_THUMBNAILS.thumb2,
            notes: `A daily review system is your secret weapon for staying on track. It takes just 10-15 minutes but transforms your productivity.

Morning Review (5 min):
• Review your top 3 priorities
• Check your calendar
• Set your intention for the day
• Visualize success

Evening Review (5-10 min):
• Celebrate wins (even small ones)
• Note lessons learned
• Prepare tomorrow's priorities
• Clear your mind before rest

Consistency is key. Do this every day for 30 days and watch your execution improve dramatically!`,
          },
          { 
            id: 'lesson-2-2-2', 
            order: 2,
            title: 'Overcoming Obstacles', 
            durationMinutes: 18, 
            isLocked: true,
            notes: `Learn advanced strategies for pushing through resistance, handling setbacks, and maintaining momentum when things get tough. Premium content.`,
          },
          { 
            id: 'lesson-2-2-3', 
            order: 3,
            title: 'Celebration & Reflection', 
            durationMinutes: 10, 
            isLocked: true,
            notes: `Discover why celebration is crucial for sustainable achievement and how to build a practice of meaningful reflection. Premium content.`,
          },
        ],
      },
    ],
  },
];

// Sample Categories
const CATEGORIES = [
  { id: 'cat-1', name: 'Mindset' },
  { id: 'cat-2', name: 'Productivity' },
  { id: 'cat-3', name: 'Habits' },
  { id: 'cat-4', name: 'Goals' },
  { id: 'cat-5', name: 'Leadership' },
  { id: 'cat-6', name: 'Wellness' },
];

async function seedData() {
  console.log('🌱 Starting Discover data seeding...\n');

  try {
    const now = Timestamp.now();

    // Seed Events
    console.log('📅 Seeding events...');
    for (const event of EVENTS) {
      await db.collection('events').doc(event.id).set({
        ...event,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`   ✓ ${event.title}`);
    }

    // Seed Event Updates (as subcollection)
    console.log('\n📝 Seeding event updates...');
    for (const update of EVENT_UPDATES) {
      const createdAt = Timestamp.fromDate(new Date(Date.now() - Math.random() * 86400000 * 2)); // Random time in last 2 days
      await db
        .collection('events')
        .doc(update.eventId)
        .collection('updates')
        .doc(update.id)
        .set({
          ...update,
          createdAt,
        });
      console.log(`   ✓ ${update.title} (for ${update.eventId})`);
    }

    // Seed Articles
    console.log('\n📰 Seeding articles...');
    for (const article of ARTICLES) {
      const publishedAt = Timestamp.fromDate(new Date(Date.now() - Math.random() * 86400000 * 30)); // Random time in last 30 days
      await db.collection('articles').doc(article.id).set({
        ...article,
        publishedAt,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`   ✓ ${article.title}`);
    }

    // Seed Courses
    console.log('\n📚 Seeding courses...');
    for (const course of COURSES) {
      await db.collection('courses').doc(course.id).set({
        ...course,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`   ✓ ${course.title}`);
    }

    // Seed Categories
    console.log('\n🏷️  Seeding categories...');
    for (const category of CATEGORIES) {
      await db.collection('discoverCategories').doc(category.id).set(category);
      console.log(`   ✓ ${category.name}`);
    }

    console.log('\n✅ Discover data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - ${EVENTS.length} events`);
    console.log(`   - ${EVENT_UPDATES.length} event updates`);
    console.log(`   - ${ARTICLES.length} articles`);
    console.log(`   - ${COURSES.length} courses`);
    console.log(`   - ${CATEGORIES.length} categories`);

  } catch (error) {
    console.error('\n❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run the script
seedData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

