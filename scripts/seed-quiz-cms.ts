/**
 * Seed Quiz CMS - Migrate Content Creator Quiz to Firestore
 * 
 * This script creates the Content Creator quiz in the CMS
 * by extracting the existing hardcoded quiz data.
 * 
 * Usage:
 *   npx ts-node -r dotenv/config scripts/seed-quiz-cms.ts
 * 
 * Or with Doppler:
 *   doppler run -- npx ts-node scripts/seed-quiz-cms.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const db = getFirestore();

// =============================================================================
// QUIZ DATA - Extracted from /start/content-creator/page.tsx
// =============================================================================

type QuizStepType = 
  | 'single_choice_list'
  | 'single_choice_grid'
  | 'multi_select_list'
  | 'multi_select_grid'
  | 'statement_cards'
  | 'swipe_cards'
  | 'info_prompt';

interface QuizStepData {
  order: number;
  type: QuizStepType;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  statement?: string;
  statementImageUrl?: string;
  dataKey?: string;
  isRequired?: boolean;
  ctaLabel?: string;
  illustrationKey?: string;
  options?: {
    label: string;
    emoji?: string;
    value: string;
    imageUrl?: string;
  }[];
}

const CONTENT_CREATOR_QUIZ_STEPS: QuizStepData[] = [
  // Step 1 - Hero/Intro
  {
    order: 1,
    type: 'info_prompt',
    title: "Ready to grow and monetize your audience?",
    subtitle: "Let's design your content creator growth plan.",
    description: `• See where you are right now 📍
• Get a realistic 90-day growth roadmap 🗺️
• Know exactly what to focus on each day 🎯`,
    ctaLabel: 'Start quiz ➜',
    illustrationKey: 'rocket',
  },
  
  // Q1 - What kind of page are you building right now?
  {
    order: 2,
    type: 'single_choice_grid',
    title: 'What kind of page are you building right now?',
    dataKey: 'creatorType',
    options: [
      { value: 'personal-brand', label: 'Personal brand with my face front and center', emoji: '😄', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fpersonalbrand.png?alt=media' },
      { value: 'faceless', label: 'Faceless or theme page (no-face channel)', emoji: '🕶️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ffaceless.png?alt=media' },
      { value: 'business', label: 'Content to grow my existing business or product', emoji: '🧩', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fproductpage.png?alt=media' },
      { value: 'experimenting', label: "I'm experimenting and still figuring it out", emoji: '🤔', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ffiguringout.png?alt=media' },
    ],
  },
  
  // Q2 - What's your #1 goal for the next 90 days?
  {
    order: 3,
    type: 'single_choice_grid',
    title: "What's your #1 goal for the next 90 days as a creator?",
    dataKey: 'primary90DayGoal',
    options: [
      { value: 'grow-followers', label: 'Grow my followers and reach more people', emoji: '📈', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ffollowers.png?alt=media' },
      { value: 'increase-engagement', label: 'Increase engagement and build a real community', emoji: '💬', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fengagement.png?alt=media' },
      { value: 'make-money', label: 'Start making consistent money from my content', emoji: '💰', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fmoney.png?alt=media' },
      { value: 'all-above', label: 'All of the above – I want real momentum', emoji: '⚡️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fmomentum.png?alt=media' },
    ],
  },
  
  // Q3 - Which platforms are you focused on right now? (MULTI-SELECT)
  {
    order: 4,
    type: 'multi_select_list',
    title: 'Which platforms are you focused on right now?',
    subtitle: 'Choose all that apply.',
    dataKey: 'focusedPlatforms',
    options: [
      { value: 'tiktok', label: 'TikTok 🎵' },
      { value: 'instagram', label: 'Instagram (Reels / Feed) 📸' },
      { value: 'youtube', label: 'YouTube / YouTube Shorts ▶️' },
      { value: 'linkedin', label: 'LinkedIn 💼' },
      { value: 'twitter', label: 'X / Twitter 🐦' },
      { value: 'newsletter', label: 'Newsletter / Email list 📧' },
      { value: 'other', label: "Other or I'm not sure yet 🌍" },
    ],
  },
  
  // Q4 - Where are you in your creator journey right now?
  {
    order: 5,
    type: 'single_choice_grid',
    title: 'Where are you in your creator journey right now?',
    dataKey: 'creatorStage',
    options: [
      { value: 'not-started', label: "I haven't really started yet, I'm just curious", emoji: '👀', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fnotposting.png?alt=media' },
      { value: 'occasional', label: 'I post occasionally but my audience is still small', emoji: '🌱', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fpostinglittle.png?alt=media' },
      { value: 'consistent-slow', label: "I'm posting consistently but growth feels slow", emoji: '🐢', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fpostingslow.png?alt=media' },
      { value: 'scaling', label: 'I already have a solid audience and want to scale', emoji: '🚀', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fgrowingfast.png?alt=media' },
    ],
  },
  
  // Q5 - What do you struggle with the most right now? (MULTI-SELECT)
  {
    order: 6,
    type: 'multi_select_grid',
    title: 'What do you struggle with the most right now?',
    subtitle: 'Choose all that apply.',
    dataKey: 'biggestStruggle',
    options: [
      { value: 'consistency', label: 'Posting consistently and sticking to a schedule', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fschedule.png?alt=media' },
      { value: 'ideas', label: 'Coming up with good content ideas regularly', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fideas.png?alt=media' },
      { value: 'production', label: 'Filming / editing / production takes too long', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fediting.png?alt=media' },
      { value: 'reach', label: "My content doesn't get reach or views", imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fviews.png?alt=media' },
      { value: 'monetization', label: 'Turning my audience into actual income', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fmonetizing.png?alt=media' },
    ],
  },
  
  // Info: Consistency beats random viral hits (follows Q5)
  {
    order: 7,
    type: 'info_prompt',
    title: 'Consistency beats random viral hits 🎯',
    subtitle: "Most creators overestimate what one viral video will do and underestimate what 90 days of consistent posting can do.",
    description: "Growth Addicts will help you build a simple, realistic system so you can show up even when life gets busy.",
    ctaLabel: 'Sounds good ➜',
    illustrationKey: 'chart',
  },
  
  // Q6 - When did you last see meaningful growth?
  {
    order: 8,
    type: 'single_choice_list',
    title: 'When did you last see meaningful growth?',
    dataKey: 'lastMeaningfulGrowth',
    options: [
      { value: '1-3-months', label: 'Within the last 3 months 📈' },
      { value: '6-plus-months', label: '6+ months ago 😔' },
      { value: 'over-year', label: 'Over a year ago 🤷' },
      { value: 'never', label: 'Never 😅' },
    ],
  },
  
  // Q7 - How often do you typically gain new followers?
  {
    order: 9,
    type: 'single_choice_list',
    title: 'How often do you typically gain new followers?',
    dataKey: 'followerGrowthFrequency',
    options: [
      { value: 'every-day', label: 'Every day 📈' },
      { value: 'few-times-week', label: 'A few times a week 📆' },
      { value: 'few-times-month', label: 'A few times a month 📉' },
      { value: 'almost-never', label: 'Almost never 😶‍🌫️' },
    ],
  },
  
  // Q8 - Which of these do you already do regularly? (MULTI-SELECT)
  {
    order: 10,
    type: 'multi_select_list',
    title: 'Which of these do you already do regularly?',
    subtitle: 'You can select multiple',
    dataKey: 'currentHabits',
    options: [
      { value: 'post-regularly', label: 'Post regularly 📅' },
      { value: 'run-ads', label: 'Run ads 📣' },
      { value: 'experiment-formats', label: 'Experiment with new formats 🎬' },
      { value: 'engage-others', label: 'Engage with others 🤝' },
      { value: 'script-content', label: 'Script my content 📝' },
      { value: 'none', label: 'None of the above 😬' },
    ],
  },
  
  // Info: Results Timeline - Only 2 weeks for first results
  {
    order: 11,
    type: 'info_prompt',
    title: 'Only 2 weeks for the first results',
    subtitle: 'We predict you will start seeing better reach and follower growth by the end of week 2 if you follow your plan.',
    description: '*Illustrative graphic based on data from thousands of creator routines. Individual results may vary.',
    ctaLabel: 'Got it →',
    illustrationKey: 'results-chart',
  },
  
  // Q13 - How do you usually build content?
  {
    order: 12,
    type: 'single_choice_grid',
    title: 'How do you usually build content?',
    dataKey: 'contentCreationMethod',
    options: [
      { value: 'create-edit-myself', label: 'I create and edit myself', emoji: '✍️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Frecord.png?alt=media' },
      { value: 'create-have-editor', label: 'I create but have an editor', emoji: '🎬', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fedit.png?alt=media' },
      { value: 'fully-outsource', label: 'I fully outsource everything', emoji: '🤝', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Foutsource.png?alt=media' },
    ],
  },
  
  // Q14 - How much content do you already publish every week?
  {
    order: 13,
    type: 'single_choice_list',
    title: 'How much content do you already publish every week?',
    dataKey: 'weeklyPublishingVolume',
    options: [
      { value: 'none-yet', label: 'None yet 🌱' },
      { value: 'once-a-week', label: 'Once a week 📝' },
      { value: '2-4-times', label: '2–4 times 📅' },
      { value: '4-plus', label: '4+ times 🔥' },
    ],
  },
  
  // Q15 - What type of content do you create? (MULTI-SELECT)
  {
    order: 14,
    type: 'multi_select_grid',
    title: 'What type of content do you create?',
    subtitle: 'Select all that apply',
    dataKey: 'contentTypes',
    options: [
      { value: 'photos-carousels', label: 'Simple photos or carousels 📸✨', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fimg.png?alt=media' },
      { value: 'tiktok-shorts', label: 'TikTok-style short videos 🎥⚡️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ftiktok.png?alt=media' },
      { value: 'high-quality-video', label: 'High-quality produced videos 🎬✨', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fhighquality.png?alt=media' },
      { value: 'talking-head', label: 'Talking-head educational content 🎤📚', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ftalkinghead.png?alt=media' },
      { value: 'writing-based', label: 'Writing-based content ✍️ (threads, captions, newsletters)', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fwriting.png?alt=media' },
    ],
  },
  
  // Info: Putting too much effort is not required!
  {
    order: 15,
    type: 'info_prompt',
    title: 'Putting too much effort into content creation is not required!',
    description: "Too much effort can increase your burnout risk and hurt quality. GrowthAddicts tailors your plan to help you grow without overdoing it.",
    ctaLabel: 'Got it →',
    illustrationKey: 'content-volume-chart',
  },
  
  // Current audience size
  {
    order: 16,
    type: 'single_choice_list',
    title: 'Roughly how many followers/subscribers do you currently have on your main platform?',
    dataKey: 'currentAudienceSize',
    options: [
      { value: '0-500', label: '0–500 followers 👶' },
      { value: '500-2k', label: '500–2k followers 🌱' },
      { value: '2k-10k', label: '2k–10k followers 🌿' },
      { value: '10k-50k', label: '10k–50k followers 🌳' },
      { value: '50k-plus', label: '50k+ followers 🌋' },
    ],
  },
  
  // 90-day audience goal
  {
    order: 17,
    type: 'single_choice_list',
    title: 'What would feel like a meaningful follower/subscriber win in the next 90 days?',
    dataKey: 'audienceGoal90Days',
    options: [
      { value: 'first-1k', label: 'Get my first 1k true followers 🎯' },
      { value: 'grow-2-5k', label: 'Grow by +2–5k followers 🚀' },
      { value: 'grow-10k', label: 'Grow by +10k or more 🌋' },
      { value: 'engagement', label: 'I care more about engagement / leads than follower count 🧠' },
    ],
  },
  
  // Offer / monetization
  {
    order: 18,
    type: 'single_choice_list',
    title: 'Do you already have something to sell (or plan to)?',
    dataKey: 'hasOffer',
    options: [
      { value: 'not-yet', label: 'Not yet, I just want to grow first 🌱' },
      { value: 'have-never-mention', label: 'I have a product/service but never talk about it 🎁' },
      { value: 'mention-sometimes', label: 'I mention my offer sometimes but without a clear strategy 🧩' },
      { value: 'actively-sell', label: 'I actively sell and want more leads & buyers 🧲' },
    ],
  },
  
  // Info: Creators who sell
  {
    order: 19,
    type: 'info_prompt',
    title: 'Creators who sell early grow more sustainably 💡',
    description: "GrowthAddicts helps you balance value content with simple offers, instead of posting endlessly for free. Your content should work for you, not just your audience.",
    ctaLabel: 'Got it ➜',
    illustrationKey: 'money',
  },
  
  // Content style preference - SWIPE CARDS
  {
    order: 20,
    type: 'swipe_cards',
    title: 'Like it or dislike it',
    dataKey: 'contentStyleRatings',
    options: [
      { value: 'tips', label: 'Short tips & insights', emoji: '⚡️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard1.png?alt=media' },
      { value: 'storytelling', label: 'Storytelling', emoji: '📖', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard2.png?alt=media' },
      { value: 'educational', label: 'Educational breakdowns', emoji: '🧠', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard3.png?alt=media' },
      { value: 'entertaining', label: 'Entertaining / humorous', emoji: '😄', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard4.png?alt=media' },
      { value: 'thought-sharing', label: 'Thought sharing', emoji: '💭', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard5.png?alt=media' },
    ],
  },
  
  // Psychology: Consistency pattern
  {
    order: 21,
    type: 'single_choice_grid',
    title: 'Which feels most like you?',
    dataKey: 'consistencyPattern',
    options: [
      { value: 'start-disappear', label: 'I start strong, then disappear for weeks', emoji: '😅', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fdisappear.png?alt=media' },
      { value: 'on-off', label: "I'm on and off, depending on my motivation", emoji: '🎢', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Frollercoaster.png?alt=media' },
      { value: 'consistent-better', label: "I'm pretty consistent, just want better results", emoji: '🧱', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fconsistent.png?alt=media' },
      { value: 'ultra-consistent', label: "I'm ultra consistent, I just want to scale", emoji: '📡', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fscale.png?alt=media' },
    ],
  },
  
  // Psychology: Energy & burnout risk
  {
    order: 22,
    type: 'single_choice_grid',
    title: 'How do you usually feel about content after a few weeks of trying?',
    dataKey: 'energyBurnout',
    options: [
      { value: 'burnout', label: 'I burn out quickly and give up', emoji: '😮‍💨', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fgiveup.png?alt=media' },
      { value: 'bored', label: 'I get bored and drift away', emoji: '🌀', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fdrift.png?alt=media' },
      { value: 'frustrated', label: "I stay okay, just frustrated with results", emoji: '😑', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fresults.png?alt=media' },
      { value: 'enjoy', label: 'I actually enjoy it and just want clearer direction', emoji: '😄', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fdirection.png?alt=media' },
    ],
  },
  
  // Time available
  {
    order: 23,
    type: 'single_choice_list',
    title: 'How much focused time can you realistically give content per week?',
    dataKey: 'timeAvailable',
    options: [
      { value: 'less-2h', label: 'Less than 2 hours ⏰' },
      { value: '2-4h', label: '2–4 hours per week 🧩' },
      { value: '5-8h', label: '5–8 hours per week 💪' },
      { value: '10-plus', label: '10+ hours per week 🚀' },
    ],
  },
  
  // Info: No hustle-porn
  {
    order: 24,
    type: 'info_prompt',
    title: "You don't need to post 5 times a day 🧘",
    description: "Your plan will prioritize a realistic posting rhythm, based on your time and energy, with high-leverage formats instead of burnout. Quality + consistency > quantity.",
    ctaLabel: 'Love that ➜',
    illustrationKey: 'zen',
  },
  
  // Step 21 - Collaboration & network
  {
    order: 25,
    type: 'single_choice_grid',
    title: 'How connected do you feel to other creators or founders?',
    dataKey: 'networkConnection',
    options: [
      { value: 'alone', label: "I'm creating completely alone", emoji: '🏝️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Falone.png?alt=media' },
      { value: 'few-creators', label: 'I know a few creators but we rarely talk', emoji: '🤝', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fsomepeople.png?alt=media' },
      { value: 'community', label: "I'm in at least one active creator community", emoji: '🌐', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fpeople.png?alt=media' },
      { value: 'collaborate', label: 'I regularly collaborate or co-create with others', emoji: '🤜🤛', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcollab.png?alt=media' },
    ],
  },
  
  // Step 22 - Systems & organization
  {
    order: 26,
    type: 'single_choice_grid',
    title: 'How organized is your current content process?',
    dataKey: 'organizationLevel',
    options: [
      { value: 'no-system', label: 'I have no system, I post when I remember', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fchaos.png?alt=media' },
      { value: 'rough-notes', label: 'I keep rough notes but nothing structured', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fnotes.png?alt=media' },
      { value: 'calendar', label: 'I have some form of calendar or Notion board', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fnotion.png?alt=media' },
      { value: 'proper-system', label: 'I run a proper content system with deadlines & assets', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fstructure.png?alt=media' },
    ],
  },
  
  // Step 23 - Statement 1: Overthink
  {
    order: 27,
    type: 'statement_cards',
    title: 'How much do you relate to this?',
    statement: 'I have good ideas, but I overthink and post much less than I could.',
    statementImageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fgoodideas.png?alt=media',
    dataKey: 'overthinkStatement',
    options: [
      { value: 'disagree', label: 'Disagree 👎' },
      { value: 'neutral', label: 'Neutral 😐' },
      { value: 'agree', label: 'Agree 👍' },
    ],
  },
  
  // Step 24 - Statement 2: Comparison
  {
    order: 28,
    type: 'statement_cards',
    title: 'How much do you relate to this?',
    statement: "I worry that my content isn't good enough compared to others.",
    statementImageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcompare.png?alt=media',
    dataKey: 'comparisonStatement',
    options: [
      { value: 'disagree', label: 'Disagree 👎' },
      { value: 'neutral', label: 'Neutral 😐' },
      { value: 'agree', label: 'Agree 👍' },
    ],
  },
  
  // Step 25 - Statement 3: Client work
  {
    order: 29,
    type: 'statement_cards',
    title: 'How much do you relate to this?',
    statement: 'I know content is important, but client work / my job always comes first.',
    statementImageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fwork.png?alt=media',
    dataKey: 'clientWorkStatement',
    options: [
      { value: 'disagree', label: 'Disagree 👎' },
      { value: 'neutral', label: 'Neutral 😐' },
      { value: 'agree', label: 'Agree 👍' },
    ],
  },
  
  // Step 26 - Info: Authority/proof
  {
    order: 30,
    type: 'info_prompt',
    title: 'Thousands of creators struggle with the same patterns 🤝',
    description: "GrowthAddicts has worked with creators who started from 0–2k followers, were juggling full-time work, and used structure + accountability to finally become consistent.\n\nYou're in good company.",
    ctaLabel: "Let's build your plan ➜",
    illustrationKey: 'community',
  },
  
  // Step 27 - Time of day preference
  {
    order: 31,
    type: 'single_choice_list',
    title: 'When do you usually have the easiest time to create?',
    dataKey: 'bestTimeToCreate',
    options: [
      { value: 'early-morning', label: 'Early morning 🌅' },
      { value: 'mid-day', label: 'Mid-day / work breaks 🌤️' },
      { value: 'evening', label: 'Evening after work 🌙' },
      { value: 'weekends', label: 'Weekends only 📆' },
      { value: 'random', label: 'Totally random, no pattern 🎲' },
    ],
  },
  
  // Step 28 - Willingness level
  {
    order: 32,
    type: 'single_choice_list',
    title: 'How committed are you to making content a real habit in the next 90 days?',
    dataKey: 'commitmentLevel',
    options: [
      { value: 'exploring', label: "I'm just exploring, low pressure 🧊" },
      { value: 'interested', label: "I'm interested but still nervous 😬" },
      { value: 'ready', label: "I'm ready to commit if the plan is realistic 💪" },
      { value: 'all-in', label: "I'm all-in and want to be pushed (gently) 🔥" },
    ],
  },
  
  // Step 29 - Final commitment
  {
    order: 33,
    type: 'single_choice_list',
    title: 'Are you ready to see your personalized creator plan? 🚀',
    dataKey: 'finalCommitment',
    options: [
      { value: 'yes-show', label: 'Yes, show me my 90-day growth plan 👌' },
      { value: 'yes-follow', label: "Yes, and I'm ready to actually follow it 😎" },
      { value: 'curious', label: "I'm curious but still a bit skeptical 🤔" },
    ],
  },
];

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function seedContentCreatorQuiz() {
  console.log('🚀 Starting Quiz CMS seed...\n');

  // Check if quiz already exists
  const existingQuiz = await db
    .collection('quizzes')
    .where('slug', '==', 'content-creator')
    .limit(1)
    .get();

  if (!existingQuiz.empty) {
    console.log('⚠️  Quiz "content-creator" already exists. Skipping seed.');
    console.log('   To re-seed, delete the existing quiz from Admin → Quizzes first.\n');
    return;
  }

  // Create the quiz
  console.log('📝 Creating Content Creator quiz...');
  const quizRef = await db.collection('quizzes').add({
    slug: 'content-creator',
    title: 'Content Creator Growth Quiz',
    trackId: 'content_creator',
    isActive: true,
    stepCount: CONTENT_CREATOR_QUIZ_STEPS.length,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`   ✅ Quiz created: ${quizRef.id}`);

  // Create steps with their options
  console.log('\n📝 Creating quiz steps...');
  
  for (const stepData of CONTENT_CREATOR_QUIZ_STEPS) {
    const { options, ...stepFields } = stepData;
    
    // Create step
    const stepRef = await db
      .collection('quizzes')
      .doc(quizRef.id)
      .collection('steps')
      .add({
        ...stepFields,
        isRequired: stepFields.isRequired ?? true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    console.log(`   ✅ Step ${stepData.order}: ${stepData.title.substring(0, 50)}...`);

    // Create options for this step
    if (options && options.length > 0) {
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        await stepRef.collection('options').add({
          order: i + 1,
          label: option.label,
          emoji: option.emoji || null,
          value: option.value,
          imageUrl: option.imageUrl || null,
          isDefault: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      console.log(`      └─ ${options.length} options created`);
    }
  }

  console.log('\n✅ Quiz CMS seed complete!');
  console.log(`   Quiz ID: ${quizRef.id}`);
  console.log(`   Total steps: ${CONTENT_CREATOR_QUIZ_STEPS.length}`);
  console.log('\nYou can now view and edit this quiz in Admin → Quizzes');
}

// Run the seed
seedContentCreatorQuiz()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });

