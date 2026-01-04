/**
 * Seed Discover Data Script
 * 
 * Run with: npx ts-node scripts/seed-discover.ts
 * Or: npx tsx scripts/seed-discover.ts
 * 
 * Seeds the Firestore database with sample events, articles, and courses
 * for the Discover feature.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

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
        title: 'Understanding Your Why',
        description: 'Discover your core motivations and values.',
        lessons: [
          { id: 'lesson-1-1-1', title: 'Introduction to Purpose', durationMinutes: 12 },
          { id: 'lesson-1-1-2', title: 'Values Assessment Exercise', durationMinutes: 20 },
          { id: 'lesson-1-1-3', title: 'Creating Your Vision Statement', durationMinutes: 15 },
        ],
      },
      {
        id: 'module-1-2',
        title: 'Building Your Foundation',
        description: 'Set up systems for sustainable growth.',
        lessons: [
          { id: 'lesson-1-2-1', title: 'The Habit Loop', durationMinutes: 18 },
          { id: 'lesson-1-2-2', title: 'Environment Design', durationMinutes: 14 },
          { id: 'lesson-1-2-3', title: 'Tracking Progress', durationMinutes: 10, isLocked: true },
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
        title: 'Strategic Planning',
        description: 'Learn to plan like a high performer.',
        lessons: [
          { id: 'lesson-2-1-1', title: 'Quarterly Goal Framework', durationMinutes: 22 },
          { id: 'lesson-2-1-2', title: 'Priority Matrix', durationMinutes: 16 },
        ],
      },
      {
        id: 'module-2-2',
        title: 'Execution Excellence',
        description: 'Turn plans into results.',
        lessons: [
          { id: 'lesson-2-2-1', title: 'Daily Review System', durationMinutes: 12 },
          { id: 'lesson-2-2-2', title: 'Overcoming Obstacles', durationMinutes: 18, isLocked: true },
          { id: 'lesson-2-2-3', title: 'Celebration & Reflection', durationMinutes: 10, isLocked: true },
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

  const now = Timestamp.now();
  const results = {
    events: 0,
    eventUpdates: 0,
    articles: 0,
    courses: 0,
    categories: 0,
  };

  // Seed Events
  console.log('📅 Seeding events...');
  for (const event of EVENTS) {
    await db.collection('events').doc(event.id).set({
      ...event,
      createdAt: now,
      updatedAt: now,
    });
    results.events++;
    console.log(`  ✓ ${event.title}`);
  }

  // Seed Event Updates (as subcollection)
  console.log('\n📝 Seeding event updates...');
  for (const update of EVENT_UPDATES) {
    const createdAt = Timestamp.fromDate(new Date(Date.now() - Math.random() * 86400000 * 2));
    await db
      .collection('events')
      .doc(update.eventId)
      .collection('updates')
      .doc(update.id)
      .set({
        ...update,
        createdAt,
      });
    results.eventUpdates++;
    console.log(`  ✓ ${update.title}`);
  }

  // Seed Articles
  console.log('\n📰 Seeding articles...');
  for (const article of ARTICLES) {
    const publishedAt = Timestamp.fromDate(new Date(Date.now() - Math.random() * 86400000 * 30));
    await db.collection('articles').doc(article.id).set({
      ...article,
      publishedAt,
      createdAt: now,
      updatedAt: now,
    });
    results.articles++;
    console.log(`  ✓ ${article.title}`);
  }

  // Seed Courses
  console.log('\n📚 Seeding courses...');
  for (const course of COURSES) {
    await db.collection('courses').doc(course.id).set({
      ...course,
      createdAt: now,
      updatedAt: now,
    });
    results.courses++;
    console.log(`  ✓ ${course.title}`);
  }

  // Seed Categories
  console.log('\n🏷️ Seeding categories...');
  for (const category of CATEGORIES) {
    await db.collection('discoverCategories').doc(category.id).set(category);
    results.categories++;
    console.log(`  ✓ ${category.name}`);
  }

  console.log('\n✅ Seeding complete!');
  console.log(`   Events: ${results.events}`);
  console.log(`   Event Updates: ${results.eventUpdates}`);
  console.log(`   Articles: ${results.articles}`);
  console.log(`   Courses: ${results.courses}`);
  console.log(`   Categories: ${results.categories}`);
}

// Run the seeding
seedData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });











