'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useGuestSession } from '@/hooks/useGuestSession';
import type { QuizStepInternal } from '@/lib/quiz-server';

// =============================================================================
// QUIZ STEP TYPES
// =============================================================================

type QuestionLayout = 'standard' | 'image-options' | 'statement-cards' | 'stat-with-text' | 'grid-image' | 'list-image';

interface QuizOption {
  id: string;
  label: string;
  helperText?: string;
  icon?: string; // emoji or icon key
  imageUrl?: string; // Firebase URL for image - empty string shows placeholder
  // Per-option confirmation text for goal questions
  confirmationTitle?: string;
  confirmationSubtitle?: string;
}

interface QuestionStep {
  id: string;
  kind: 'question';
  questionType: 'single' | 'multi';
  title: string;
  subtitle?: string;
  layout?: QuestionLayout;
  options: QuizOption[];
  dataKey: string; // key to store in guest session
  statement?: string; // for statement-cards layout
  statementImageUrl?: string; // image for statement-cards layout
  // Goal question and confirmation fields
  isGoalQuestion?: boolean;
  isStartingPointQuestion?: boolean;
  showConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationSubtitle?: string;
}

interface InfoStep {
  id: string;
  kind: 'info';
  title: string;
  subtitle?: string;
  body: string;
  badge?: string;
  illustrationKey?: string;
  imageUrl?: string;
  ctaLabel?: string;
  // Chart legend labels (for chart illustrations)
  chartLabel1?: string;
  chartLabel2?: string;
  chartEmoji1?: string;
  chartEmoji2?: string;
}

interface SwipeCard {
  id: string;
  label: string;
  icon: string;
  imageUrl?: string;
}

interface SwipeCardStep {
  id: string;
  kind: 'swipe-cards';
  title: string;
  dataKey: string;
  cards: SwipeCard[];
}

type SwipeRating = 'dislike' | 'neutral' | 'like';
type SwipeCardRatings = Record<string, SwipeRating>;

type QuizStep = QuestionStep | InfoStep | SwipeCardStep;

// =============================================================================
// DYNAMIC CONTENT MAPPINGS
// =============================================================================

// Maps creatorType option IDs to display labels
const CREATOR_TYPE_LABELS: Record<string, string> = {
  'personal-brand': 'Personal brand',
  'faceless': 'Faceless channel',
  'business': 'Brand / product page',
  'experimenting': 'Experimenting creator',
};

// Maps primary90DayGoal option IDs to path labels (for title)
const PRIMARY_GOAL_PATH_LABELS: Record<string, string> = {
  'grow-followers': 'follower growth',
  'increase-engagement': 'engagement',
  'make-money': 'monetization',
  'all-above': 'all-around momentum',
};

// Maps primary90DayGoal option IDs to focus labels (for body)
const PRIMARY_GOAL_FOCUS_LABELS: Record<string, string> = {
  'grow-followers': 'growing your reach and discoverability',
  'increase-engagement': 'building community and meaningful interactions',
  'make-money': 'converting your audience into income',
  'all-above': 'building momentum across all fronts',
};

// Goal-specific bullet points for the dynamic info step
const GOAL_SPECIFIC_BULLETS: Record<string, string> = {
  'grow-followers': `– Turn your strengths into repeatable content themes
– Optimize for the algorithm and discoverability
– Use simple systems so you do not burn out`,
  'increase-engagement': `– Turn your strengths into content that sparks conversation
– Build a loyal community that actually engages
– Use simple systems so you do not burn out`,
  'make-money': `– Turn your strengths into content that sells
– Focus on offers and CTAs that convert
– Use simple systems so you do not burn out`,
  'all-above': `– Turn your strengths into repeatable content themes
– Focus on the platforms that give you the highest upside
– Use simple systems so you do not burn out`,
};

/**
 * Generates dynamic title for the info-method step
 */
function getDynamicInfoTitle(creatorType: string | undefined, primaryGoal: string | undefined): string {
  const creatorLabel = CREATOR_TYPE_LABELS[creatorType || ''] || 'Creator';
  const goalLabel = PRIMARY_GOAL_PATH_LABELS[primaryGoal || ''] || 'growth';
  return `${creatorLabel} creators grow fastest with a clear ${goalLabel} path 🎯`;
}

/**
 * Generates dynamic body for the info-method step based on user's answers
 */
function getDynamicInfoBody(creatorType: string | undefined, primaryGoal: string | undefined): string {
  const creatorLabel = CREATOR_TYPE_LABELS[creatorType || '']?.toLowerCase() || 'creator';
  const focusLabel = PRIMARY_GOAL_FOCUS_LABELS[primaryGoal || ''] || 'growth';
  const bullets = GOAL_SPECIFIC_BULLETS[primaryGoal || ''] || GOAL_SPECIFIC_BULLETS['all-above'];
  
  return `As a ${creatorLabel}, your content strategy should focus on ${focusLabel} first, then layer everything else on top.

In your plan, we will show you how to:
${bullets}`;
}

/**
 * Gets the illustration key based on creator type
 */
function getIllustrationForCreatorType(_creatorType: string | undefined): string {
  // Always use prompt1 image for the dynamic info step
  return 'prompt1';
}

// =============================================================================
// Q14 COMPARISON CARD DATA
// =============================================================================

interface ComparisonCardData {
  title: string;
  subtitle: string;
  footnote?: string;
}

const PUBLISHING_VOLUME_COMPARISON: Record<string, ComparisonCardData> = {
  'none-yet': {
    title: 'No worries!',
    subtitle: 'GrowthAddicts will help you build the habit to publish often.',
  },
  'once-a-week': {
    title: "You've published more than 62% of users*",
    subtitle: 'It will be easier for you to maintain a content plan.',
    footnote: '*users of GrowthAddicts who took the quiz',
  },
  '2-4-times': {
    title: "You've published more than 82% of users*",
    subtitle: 'It will be easier for you to maintain a content plan.',
    footnote: '*users of GrowthAddicts who took the quiz',
  },
  '4-plus': {
    title: "You've published more than 94% of users*",
    subtitle: 'It will be easier for you to maintain a content plan.',
    footnote: '*users of GrowthAddicts who took the quiz',
  },
};

// =============================================================================
// QUIZ CONTENT - 29 STEPS
// =============================================================================

const QUIZ_STEPS: QuizStep[] = [
  // Step 1 - Hero/Intro
  {
    id: 'intro',
    kind: 'info',
    title: "Ready to grow and monetize your audience?",
    subtitle: "Let's design your content creator growth plan.",
    body: `• See where you are right now 📍
• Get a realistic 90-day growth roadmap 🗺️
• Know exactly what to focus on each day 🎯`,
    ctaLabel: 'Start quiz ➜',
    illustrationKey: 'rocket',
  },
  
  // Q1 - What kind of page are you building right now?
  {
    id: 'creator-type',
    kind: 'question',
    questionType: 'single',
    layout: 'grid-image',
    title: 'What kind of page are you building right now?',
    dataKey: 'creatorType',
    options: [
      { id: 'personal-brand', label: 'Personal brand with my face front and center', icon: '😄', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fpersonalbrand.png?alt=media' },
      { id: 'faceless', label: 'Faceless or theme page (no-face channel)', icon: '🕶️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ffaceless.png?alt=media' },
      { id: 'business', label: 'Content to grow my existing business or product', icon: '🧩', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fproductpage.png?alt=media' },
      { id: 'experimenting', label: "I'm experimenting and still figuring it out", icon: '🤔', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ffiguringout.png?alt=media' },
    ],
  },
  
  // Q2 - What's your #1 goal for the next 90 days?
  {
    id: 'primary-goal',
    kind: 'question',
    questionType: 'single',
    layout: 'grid-image',
    title: "What's your #1 goal for the next 90 days as a creator?",
    dataKey: 'primary90DayGoal',
    options: [
      { id: 'grow-followers', label: 'Grow my followers and reach more people', icon: '📈', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ffollowers.png?alt=media' },
      { id: 'increase-engagement', label: 'Increase engagement and build a real community', icon: '💬', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fengagement.png?alt=media' },
      { id: 'make-money', label: 'Start making consistent money from my content', icon: '💰', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fmoney.png?alt=media' },
      { id: 'all-above', label: 'All of the above – I want real momentum', icon: '⚡️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fmomentum.png?alt=media' },
    ],
  },
  
  // Q3 - Which platforms are you focused on right now? (MULTI-SELECT)
  {
    id: 'platforms',
    kind: 'question',
    questionType: 'multi',
    title: 'Which platforms are you focused on right now?',
    subtitle: 'Choose all that apply.',
    dataKey: 'focusedPlatforms',
    options: [
      { id: 'tiktok', label: 'TikTok 🎵' },
      { id: 'instagram', label: 'Instagram (Reels / Feed) 📸' },
      { id: 'youtube', label: 'YouTube / YouTube Shorts ▶️' },
      { id: 'linkedin', label: 'LinkedIn 💼' },
      { id: 'twitter', label: 'X / Twitter 🐦' },
      { id: 'newsletter', label: 'Newsletter / Email list 📧' },
      { id: 'other', label: "Other or I'm not sure yet 🌍" },
    ],
  },
  
  // Q4 - Where are you in your creator journey right now?
  {
    id: 'creator-stage',
    kind: 'question',
    questionType: 'single',
    layout: 'grid-image',
    title: 'Where are you in your creator journey right now?',
    dataKey: 'creatorStage',
    options: [
      { id: 'not-started', label: "I haven't really started yet, I'm just curious", icon: '👀', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fnotposting.png?alt=media' },
      { id: 'occasional', label: 'I post occasionally but my audience is still small', icon: '🌱', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fpostinglittle.png?alt=media' },
      { id: 'consistent-slow', label: "I'm posting consistently but growth feels slow", icon: '🐢', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fpostingslow.png?alt=media' },
      { id: 'scaling', label: 'I already have a solid audience and want to scale', icon: '🚀', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fgrowingfast.png?alt=media' },
    ],
  },
  
  // Q5 - What do you struggle with the most right now? (MULTI-SELECT)
  {
    id: 'biggest-struggle',
    kind: 'question',
    questionType: 'multi',
    layout: 'list-image',
    title: 'What do you struggle with the most right now?',
    subtitle: 'Choose all that apply.',
    dataKey: 'biggestStruggle',
    options: [
      { id: 'consistency', label: 'Posting consistently and sticking to a schedule', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fschedule.png?alt=media' },
      { id: 'ideas', label: 'Coming up with good content ideas regularly', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fideas.png?alt=media' },
      { id: 'production', label: 'Filming / editing / production takes too long', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fediting.png?alt=media' },
      { id: 'reach', label: "My content doesn't get reach or views", imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fviews.png?alt=media' },
      { id: 'monetization', label: 'Turning my audience into actual income', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fmonetizing.png?alt=media' },
    ],
  },
  
  // Info: Consistency beats random viral hits (follows Q5)
  {
    id: 'info-method',
    kind: 'info',
    title: 'Consistency beats random viral hits 🎯',
    subtitle: "Most creators overestimate what one viral video will do and underestimate what 90 days of consistent posting can do.",
    body: "Growth Addicts will help you build a simple, realistic system so you can show up even when life gets busy.",
    ctaLabel: 'Sounds good ➜',
    illustrationKey: 'chart',
  },
  
  // Q6 - When did you last see meaningful growth?
  {
    id: 'last-meaningful-growth',
    kind: 'question',
    questionType: 'single',
    title: 'When did you last see meaningful growth?',
    dataKey: 'lastMeaningfulGrowth',
    options: [
      { id: '1-3-months', label: 'Within the last 3 months 📈' },
      { id: '6-plus-months', label: '6+ months ago 😔' },
      { id: 'over-year', label: 'Over a year ago 🤷' },
      { id: 'never', label: 'Never 😅' },
    ],
  },
  
  // Q7 - How often do you typically gain new followers?
  {
    id: 'follower-growth-frequency',
    kind: 'question',
    questionType: 'single',
    title: 'How often do you typically gain new followers?',
    dataKey: 'followerGrowthFrequency',
    options: [
      { id: 'every-day', label: 'Every day 📈' },
      { id: 'few-times-week', label: 'A few times a week 📆' },
      { id: 'few-times-month', label: 'A few times a month 📉' },
      { id: 'almost-never', label: 'Almost never 😶‍🌫️' },
    ],
  },
  
  // Q8 - Which of these do you already do regularly? (MULTI-SELECT)
  {
    id: 'current-habits',
    kind: 'question',
    questionType: 'multi',
    title: 'Which of these do you already do regularly?',
    subtitle: 'You can select multiple',
    dataKey: 'currentHabits',
    options: [
      { id: 'post-regularly', label: 'Post regularly 📅' },
      { id: 'run-ads', label: 'Run ads 📣' },
      { id: 'experiment-formats', label: 'Experiment with new formats 🎬' },
      { id: 'engage-others', label: 'Engage with others 🤝' },
      { id: 'script-content', label: 'Script my content 📝' },
      { id: 'none', label: 'None of the above 😬' },
    ],
  },
  
  // Info: Results Timeline - Only 2 weeks for first results
  {
    id: 'info-results-timeline',
    kind: 'info',
    title: 'Only 2 weeks for the first results',
    subtitle: 'We predict you will start seeing better reach and follower growth by the end of week 2 if you follow your plan.',
    body: '*Illustrative graphic based on data from thousands of creator routines. Individual results may vary.',
    ctaLabel: 'Got it →',
    illustrationKey: 'results-chart',
  },
  
  // Q13 - How do you usually build content?
  {
    id: 'content-creation-method',
    kind: 'question',
    questionType: 'single',
    layout: 'grid-image',
    title: 'How do you usually build content?',
    dataKey: 'contentCreationMethod',
    options: [
      { id: 'create-edit-myself', label: 'I create and edit myself', icon: '✍️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Frecord.png?alt=media' },
      { id: 'create-have-editor', label: 'I create but have an editor', icon: '🎬', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fedit.png?alt=media' },
      { id: 'fully-outsource', label: 'I fully outsource everything', icon: '🤝', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Foutsource.png?alt=media' },
    ],
  },
  
  // Q14 - How much content do you already publish every week? (with comparison card)
  {
    id: 'weekly-publishing-volume',
    kind: 'question',
    questionType: 'single',
    title: 'How much content do you already publish every week?',
    dataKey: 'weeklyPublishingVolume',
    options: [
      { id: 'none-yet', label: 'None yet 🌱' },
      { id: 'once-a-week', label: 'Once a week 📝' },
      { id: '2-4-times', label: '2–4 times 📅' },
      { id: '4-plus', label: '4+ times 🔥' },
    ],
  },
  
  // Q15 - What type of content do you create? (MULTI-SELECT)
  {
    id: 'content-type',
    kind: 'question',
    questionType: 'multi',
    layout: 'list-image',
    title: 'What type of content do you create?',
    subtitle: 'Select all that apply',
    dataKey: 'contentTypes',
    options: [
      { id: 'photos-carousels', label: 'Simple photos or carousels 📸✨', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fimg.png?alt=media' },
      { id: 'tiktok-shorts', label: 'TikTok-style short videos 🎥⚡️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ftiktok.png?alt=media' },
      { id: 'high-quality-video', label: 'High-quality produced videos 🎬✨', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fhighquality.png?alt=media' },
      { id: 'talking-head', label: 'Talking-head educational content 🎤📚', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Ftalkinghead.png?alt=media' },
      { id: 'writing-based', label: 'Writing-based content ✍️ (threads, captions, newsletters)', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fwriting.png?alt=media' },
    ],
  },
  
  // Info: Putting too much effort is not required!
  {
    id: 'info-content-volume',
    kind: 'info',
    title: 'Putting too much effort into content creation is not required!',
    body: "Too much effort can increase your burnout risk and hurt quality. GrowthAddicts tailors your plan to help you grow without overdoing it.",
    ctaLabel: 'Got it →',
    illustrationKey: 'content-volume-chart',
  },
  
  // Current audience size
  {
    id: 'audience-size',
    kind: 'question',
    questionType: 'single',
    title: 'Roughly how many followers/subscribers do you currently have on your main platform?',
    dataKey: 'currentAudienceSize',
    options: [
      { id: '0-500', label: '0–500 followers 👶' },
      { id: '500-2k', label: '500–2k followers 🌱' },
      { id: '2k-10k', label: '2k–10k followers 🌿' },
      { id: '10k-50k', label: '10k–50k followers 🌳' },
      { id: '50k-plus', label: '50k+ followers 🌋' },
    ],
  },
  
  // 90-day audience goal
  {
    id: 'audience-goal',
    kind: 'question',
    questionType: 'single',
    title: 'What would feel like a meaningful follower/subscriber win in the next 90 days?',
    dataKey: 'audienceGoal90Days',
    options: [
      { id: 'first-1k', label: 'Get my first 1k true followers 🎯' },
      { id: 'grow-2-5k', label: 'Grow by +2–5k followers 🚀' },
      { id: 'grow-10k', label: 'Grow by +10k or more 🌋' },
      { id: 'engagement', label: 'I care more about engagement / leads than follower count 🧠' },
    ],
  },
  
  // Offer / monetization
  {
    id: 'offer',
    kind: 'question',
    questionType: 'single',
    title: 'Do you already have something to sell (or plan to)?',
    dataKey: 'hasOffer',
    options: [
      { id: 'not-yet', label: 'Not yet, I just want to grow first 🌱' },
      { id: 'have-never-mention', label: 'I have a product/service but never talk about it 🎁' },
      { id: 'mention-sometimes', label: 'I mention my offer sometimes but without a clear strategy 🧩' },
      { id: 'actively-sell', label: 'I actively sell and want more leads & buyers 🧲' },
    ],
  },
  
  // Info: Creators who sell
  {
    id: 'info-sell',
    kind: 'info',
    title: 'Creators who sell early grow more sustainably 💡',
    body: "GrowthAddicts helps you balance value content with simple offers, instead of posting endlessly for free. Your content should work for you, not just your audience.",
    ctaLabel: 'Got it ➜',
    illustrationKey: 'money',
  },
  
  // Content style preference - SWIPE CARDS (placeholder, will be converted)
  {
    id: 'content-style',
    kind: 'swipe-cards',
    title: 'Like it or dislike it',
    dataKey: 'contentStyleRatings',
    cards: [
      { id: 'tips', label: 'Short tips & insights', icon: '⚡️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard1.png?alt=media' },
      { id: 'storytelling', label: 'Storytelling', icon: '📖', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard2.png?alt=media' },
      { id: 'educational', label: 'Educational breakdowns', icon: '🧠', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard3.png?alt=media' },
      { id: 'entertaining', label: 'Entertaining / humorous', icon: '😄', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard4.png?alt=media' },
      { id: 'thought-sharing', label: 'Thought sharing', icon: '💭', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcard5.png?alt=media' },
    ],
  },
  
  // Psychology: Consistency pattern
  {
    id: 'consistency-pattern',
    kind: 'question',
    questionType: 'single',
    layout: 'grid-image',
    title: 'Which feels most like you?',
    dataKey: 'consistencyPattern',
    options: [
      { id: 'start-disappear', label: 'I start strong, then disappear for weeks', icon: '😅', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fdisappear.png?alt=media' },
      { id: 'on-off', label: "I'm on and off, depending on my motivation", icon: '🎢', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Frollercoaster.png?alt=media' },
      { id: 'consistent-better', label: "I'm pretty consistent, just want better results", icon: '🧱', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fconsistent.png?alt=media' },
      { id: 'ultra-consistent', label: "I'm ultra consistent, I just want to scale", icon: '📡', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fscale.png?alt=media' },
    ],
  },
  
  // Psychology: Energy & burnout risk
  {
    id: 'energy-burnout',
    kind: 'question',
    questionType: 'single',
    layout: 'grid-image',
    title: 'How do you usually feel about content after a few weeks of trying?',
    dataKey: 'energyBurnout',
    options: [
      { id: 'burnout', label: 'I burn out quickly and give up', icon: '😮‍💨', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fgiveup.png?alt=media' },
      { id: 'bored', label: 'I get bored and drift away', icon: '🌀', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fdrift.png?alt=media' },
      { id: 'frustrated', label: "I stay okay, just frustrated with results", icon: '😑', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fresults.png?alt=media' },
      { id: 'enjoy', label: 'I actually enjoy it and just want clearer direction', icon: '😄', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fdirection.png?alt=media' },
    ],
  },
  
  // Time available
  {
    id: 'time-available',
    kind: 'question',
    questionType: 'single',
    title: 'How much focused time can you realistically give content per week?',
    dataKey: 'timeAvailable',
    options: [
      { id: 'less-2h', label: 'Less than 2 hours ⏰' },
      { id: '2-4h', label: '2–4 hours per week 🧩' },
      { id: '5-8h', label: '5–8 hours per week 💪' },
      { id: '10-plus', label: '10+ hours per week 🚀' },
    ],
  },
  
  // Info: No hustle-porn
  {
    id: 'info-no-hustle',
    kind: 'info',
    title: "You don't need to post 5 times a day 🧘",
    body: "Your plan will prioritize a realistic posting rhythm, based on your time and energy, with high-leverage formats instead of burnout. Quality + consistency > quantity.",
    ctaLabel: 'Love that ➜',
    illustrationKey: 'zen',
  },
  
  // Step 21 - Collaboration & network
  {
    id: 'network',
    kind: 'question',
    questionType: 'single',
    layout: 'grid-image',
    title: 'How connected do you feel to other creators or founders?',
    dataKey: 'networkConnection',
    options: [
      { id: 'alone', label: "I'm creating completely alone", icon: '🏝️', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Falone.png?alt=media' },
      { id: 'few-creators', label: 'I know a few creators but we rarely talk', icon: '🤝', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fsomepeople.png?alt=media' },
      { id: 'community', label: "I'm in at least one active creator community", icon: '🌐', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fpeople.png?alt=media' },
      { id: 'collaborate', label: 'I regularly collaborate or co-create with others', icon: '🤜🤛', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcollab.png?alt=media' },
    ],
  },
  
  // Step 22 - Systems & organization
  {
    id: 'organization',
    kind: 'question',
    questionType: 'single',
    layout: 'list-image',
    title: 'How organized is your current content process?',
    dataKey: 'organizationLevel',
    options: [
      { id: 'no-system', label: 'I have no system, I post when I remember', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fchaos.png?alt=media' },
      { id: 'rough-notes', label: 'I keep rough notes but nothing structured', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fnotes.png?alt=media' },
      { id: 'calendar', label: 'I have some form of calendar or Notion board', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fnotion.png?alt=media' },
      { id: 'proper-system', label: 'I run a proper content system with deadlines & assets', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fstructure.png?alt=media' },
    ],
  },
  
  // Step 23 - Statement 1: Overthink
  {
    id: 'statement-overthink',
    kind: 'question',
    questionType: 'single',
    layout: 'statement-cards',
    title: 'How much do you relate to this?',
    statement: 'I have good ideas, but I overthink and post much less than I could.',
    statementImageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fgoodideas.png?alt=media',
    dataKey: 'overthinkStatement',
    options: [
      { id: 'disagree', label: 'Disagree 👎' },
      { id: 'neutral', label: 'Neutral 😐' },
      { id: 'agree', label: 'Agree 👍' },
    ],
  },
  
  // Step 24 - Statement 2: Comparison
  {
    id: 'statement-comparison',
    kind: 'question',
    questionType: 'single',
    layout: 'statement-cards',
    title: 'How much do you relate to this?',
    statement: "I worry that my content isn't good enough compared to others.",
    statementImageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcompare.png?alt=media',
    dataKey: 'comparisonStatement',
    options: [
      { id: 'disagree', label: 'Disagree 👎' },
      { id: 'neutral', label: 'Neutral 😐' },
      { id: 'agree', label: 'Agree 👍' },
    ],
  },
  
  // Step 25 - Statement 3: Client work
  {
    id: 'statement-client-work',
    kind: 'question',
    questionType: 'single',
    layout: 'statement-cards',
    title: 'How much do you relate to this?',
    statement: 'I know content is important, but client work / my job always comes first.',
    statementImageUrl: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fwork.png?alt=media',
    dataKey: 'clientWorkStatement',
    options: [
      { id: 'disagree', label: 'Disagree 👎' },
      { id: 'neutral', label: 'Neutral 😐' },
      { id: 'agree', label: 'Agree 👍' },
    ],
  },
  
  // Step 26 - Info: Authority/proof
  {
    id: 'info-authority',
    kind: 'info',
    title: 'Thousands of creators struggle with the same patterns 🤝',
    body: "GrowthAddicts has worked with creators who started from 0–2k followers, were juggling full-time work, and used structure + accountability to finally become consistent.\n\nYou're in good company.",
    ctaLabel: "Let's build your plan ➜",
    illustrationKey: 'community',
  },
  
  // Step 27 - Time of day preference
  {
    id: 'time-of-day',
    kind: 'question',
    questionType: 'single',
    title: 'When do you usually have the easiest time to create?',
    dataKey: 'bestTimeToCreate',
    options: [
      { id: 'early-morning', label: 'Early morning 🌅' },
      { id: 'mid-day', label: 'Mid-day / work breaks 🌤️' },
      { id: 'evening', label: 'Evening after work 🌙' },
      { id: 'weekends', label: 'Weekends only 📆' },
      { id: 'random', label: 'Totally random, no pattern 🎲' },
    ],
  },
  
  // Step 28 - Willingness level
  {
    id: 'commitment-level',
    kind: 'question',
    questionType: 'single',
    title: 'How committed are you to making content a real habit in the next 90 days?',
    dataKey: 'commitmentLevel',
    options: [
      { id: 'exploring', label: "I'm just exploring, low pressure 🧊" },
      { id: 'interested', label: "I'm interested but still nervous 😬" },
      { id: 'ready', label: "I'm ready to commit if the plan is realistic 💪" },
      { id: 'all-in', label: "I'm all-in and want to be pushed (gently) 🔥" },
    ],
  },
  
  // Step 29 - Final commitment
  {
    id: 'final-commitment',
    kind: 'question',
    questionType: 'single',
    title: 'Are you ready to see your personalized creator plan? 🚀',
    dataKey: 'finalCommitment',
    options: [
      { id: 'yes-show', label: 'Yes, show me my 90-day growth plan 👌' },
      { id: 'yes-follow', label: "Yes, and I'm ready to actually follow it 😎" },
      { id: 'curious', label: "I'm curious but still a bit skeptical 🤔" },
    ],
  },
];

// =============================================================================
// ILLUSTRATION COMPONENTS
// =============================================================================

interface QuizIllustrationProps {
  illustrationKey?: string;
  chartLabel1?: string;
  chartLabel2?: string;
  chartEmoji1?: string;
  chartEmoji2?: string;
}

function QuizIllustration({ 
  illustrationKey, 
  chartLabel1, 
  chartLabel2, 
  chartEmoji1, 
  chartEmoji2 
}: QuizIllustrationProps) {
  const illustrations: Record<string, React.ReactNode> = {
    rocket: (
      <div className="w-20 h-20 bg-gradient-to-br from-[#a07855] to-[#c9a07a] rounded-2xl flex items-center justify-center shadow-lg">
        <span className="text-4xl">🚀</span>
      </div>
    ),
    chart: (
      <div className="w-20 h-20 bg-gradient-to-br from-[#22c55e] to-[#4ade80] rounded-2xl flex items-center justify-center shadow-lg">
        <span className="text-4xl">📈</span>
      </div>
    ),
    sunrise: (
      <div className="w-20 h-20 bg-gradient-to-br from-[#f7c948] to-[#fbbf24] rounded-2xl flex items-center justify-center shadow-lg">
        <span className="text-4xl">🌅</span>
      </div>
    ),
    money: (
      <div className="w-20 h-20 bg-gradient-to-br from-[#22c55e] to-[#16a34a] rounded-2xl flex items-center justify-center shadow-lg">
        <span className="text-4xl">💰</span>
      </div>
    ),
    zen: (
      <div className="w-20 h-20 bg-gradient-to-br from-[#8b5cf6] to-[#a78bfa] rounded-2xl flex items-center justify-center shadow-lg">
        <span className="text-4xl">🧘</span>
      </div>
    ),
    community: (
      <div className="w-20 h-20 bg-gradient-to-br from-[#3b82f6] to-[#60a5fa] rounded-2xl flex items-center justify-center shadow-lg">
        <span className="text-4xl">🤝</span>
      </div>
    ),
    // Creator type specific illustrations
    personal: (
      <div className="w-20 h-20 bg-gradient-to-br from-[#ec4899] to-[#f472b6] rounded-2xl flex items-center justify-center shadow-lg">
        <span className="text-4xl">😄</span>
      </div>
    ),
    // Prompt1 image for dynamic info step - full width matching body card
    prompt1: (
      <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden shadow-lg">
        <Image
          src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fprompt1.png?alt=media"
          alt="Prompt illustration"
          fill
          sizes="(max-width: 768px) 100vw, 448px"
          className="object-cover"
        />
      </div>
    ),
    faceless: (
      <div className="w-20 h-20 bg-gradient-to-br from-[#6366f1] to-[#818cf8] rounded-2xl flex items-center justify-center shadow-lg">
        <span className="text-4xl">🕶️</span>
      </div>
    ),
    business: (
      <div className="w-20 h-20 bg-gradient-to-br from-[#0ea5e9] to-[#38bdf8] rounded-2xl flex items-center justify-center shadow-lg">
        <span className="text-4xl">🧩</span>
      </div>
    ),
    // Results timeline chart illustration - Animated
    'results-chart': (
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] rounded-2xl p-5 shadow-lg border border-[#e2e8f0]">
          {/* Chart SVG */}
          <svg viewBox="0 0 320 160" className="w-full h-auto">
            {/* Grid lines - horizontal */}
            {[0, 1, 2].map((i) => (
              <line 
                key={`h-${i}`}
                x1="40" 
                y1={30 + i * 40} 
                x2="300" 
                y2={30 + i * 40} 
                stroke="#e2e8f0" 
                strokeWidth="1"
              />
            ))}
            
            {/* Grid lines - vertical */}
            {[0, 1, 2, 3].map((i) => (
              <line 
                key={`v-${i}`}
                x1={50 + i * 80} 
                y1="30" 
                x2={50 + i * 80} 
                y2="110" 
                stroke="#e2e8f0" 
                strokeWidth="1"
                strokeDasharray={i > 0 ? "4,4" : "0"}
              />
            ))}
            
            {/* X-axis labels */}
            <text x="50" y="130" fill="#64748b" fontSize="10" textAnchor="middle">Now</text>
            <text x="130" y="130" fill="#64748b" fontSize="10" textAnchor="middle">2 weeks</text>
            <text x="210" y="130" fill="#64748b" fontSize="10" textAnchor="middle">1 month</text>
            <text x="290" y="130" fill="#64748b" fontSize="10" textAnchor="middle">3 months</text>
            
            {/* Orange area fill under decreasing line */}
            <motion.path 
              d="M 50 35 Q 90 42, 130 55 T 210 80 T 290 95 L 290 110 L 50 110 Z" 
              fill="url(#orangeFillResults)"
              fillOpacity="0.2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.2 }}
            />
            
            {/* Orange line - % of posts that underperform (decreasing) */}
            <motion.path 
              d="M 50 35 Q 90 42, 130 55 T 210 80 T 290 95" 
              fill="none" 
              stroke="#f97316" 
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            />
            
            {/* Green/teal line - Average views per post (increasing) */}
            <motion.path 
              d="M 50 95 Q 90 75, 130 50 T 210 35 T 290 25" 
              fill="none" 
              stroke="#22c55e" 
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
            />
            
            {/* Gradient definition */}
            <defs>
              <linearGradient id="orangeFillResults" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Highlight point at 2 weeks with animated glow */}
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 1.5 }}
            >
              <circle cx="130" cy="50" r="10" fill="#f7c948" fillOpacity="0.3" />
              <circle cx="130" cy="50" r="6" fill="#f7c948" />
              {/* 2nd week label with fire emoji */}
              <rect x="105" y="18" width="65" height="22" rx="6" fill="#f7c948" />
              <text x="137" y="33" fill="#1a1a1a" fontSize="10" textAnchor="middle" fontWeight="bold">2nd week 🔥</text>
            </motion.g>
            
            {/* End points */}
            <motion.circle 
              cx="290" cy="95" r="4" fill="#f97316"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            />
            <motion.circle 
              cx="290" cy="25" r="4" fill="#22c55e"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.7 }}
            />
          </svg>
          
          {/* Legend */}
          <div className="flex justify-center gap-5 mt-3">
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
            >
              <div className="w-4 h-1 rounded-full bg-[#22c55e]" />
              <span className="text-[11px] text-[#64748b] font-medium">{chartLabel1 || 'Avg views/post'}</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
            >
              <div className="w-4 h-1 rounded-full bg-[#f97316]" />
              <span className="text-[11px] text-[#64748b] font-medium">{chartLabel2 || 'Underperforming %'}</span>
            </motion.div>
          </div>
        </div>
      </div>
    ),
    // Content volume chart - Animated light design
    'content-volume-chart': (
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] rounded-2xl p-5 shadow-lg border border-[#e2e8f0]">
          {/* Chart SVG */}
          <svg viewBox="0 0 360 220" className="w-full h-auto">
            {/* Grid lines - horizontal */}
            {[0, 1, 2, 3].map((i) => (
              <line 
                key={`h-${i}`}
                x1="70" 
                y1={40 + i * 45} 
                x2="340" 
                y2={40 + i * 45} 
                stroke="#e2e8f0" 
                strokeWidth="1"
              />
            ))}
            
            {/* Grid lines - vertical */}
            {[0, 1, 2, 3].map((i) => (
              <line 
                key={`v-${i}`}
                x1={70 + i * 90} 
                y1="40" 
                x2={70 + i * 90} 
                y2="175" 
                stroke="#e2e8f0" 
                strokeWidth="1"
                strokeDasharray={i > 0 ? "4,4" : "0"}
              />
            ))}
            
            {/* Y-axis labels - Burnout Risk */}
            <text x="15" y="35" fill="#64748b" fontSize="10" fontWeight="600">Burnout</text>
            <text x="15" y="47" fill="#64748b" fontSize="10" fontWeight="600">Risk</text>
            <text x="60" y="55" fill="#94a3b8" fontSize="9" textAnchor="end">High</text>
            <text x="60" y="170" fill="#94a3b8" fontSize="9" textAnchor="end">Low</text>
            
            {/* X-axis labels */}
            <text x="70" y="195" fill="#64748b" fontSize="10" textAnchor="middle">Now</text>
            <text x="160" y="195" fill="#64748b" fontSize="10" textAnchor="middle">1 Month</text>
            <text x="250" y="195" fill="#64748b" fontSize="10" textAnchor="middle">2 Months</text>
            <text x="340" y="195" fill="#64748b" fontSize="10" textAnchor="middle">3 Months</text>
            
            {/* Time label */}
            <text x="205" y="212" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="500">Time</text>
            
            {/* Blue curve - Burnout Risk (starts high, decreases) */}
            <motion.path 
              d="M 70 55 C 120 58, 160 75, 205 105 S 280 145, 340 160" 
              fill="none" 
              stroke="#60a5fa" 
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
            />
            
            {/* Orange fill area under quality curve */}
            <motion.path 
              d="M 70 160 C 120 155, 160 130, 205 100 S 280 60, 340 45 L 340 175 L 70 175 Z" 
              fill="url(#orangeGradient)"
              fillOpacity="0.15"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
            />
            
            {/* Orange curve - Content Quality (starts low, increases) */}
            <motion.path 
              d="M 70 160 C 120 155, 160 130, 205 100 S 280 60, 340 45" 
              fill="none" 
              stroke="#f97316" 
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
            />
            
            {/* Gradient definition */}
            <defs>
              <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Animated icon box at end of orange line */}
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 2 }}
            >
              <rect x="320" y="20" width="32" height="32" rx="6" fill="#f97316" />
              <text x="336" y="42" fill="white" fontSize="16" textAnchor="middle">💪</text>
            </motion.g>
            
            {/* End points */}
            <motion.circle 
              cx="340" cy="160" r="5" fill="#60a5fa"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
            />
            <motion.circle 
              cx="340" cy="45" r="5" fill="#f97316"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
            />
          </svg>
          
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-3">
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2 }}
            >
              <div className="w-5 h-5 rounded bg-[#f97316] flex items-center justify-center">
                <span className="text-[10px]">{chartEmoji1 || '💪'}</span>
              </div>
              <span className="text-[12px] text-[#64748b] font-medium">{chartLabel1 || 'Content Quality'}</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.4 }}
            >
              <div className="w-5 h-5 rounded bg-[#60a5fa] flex items-center justify-center">
                <span className="text-[10px]">{chartEmoji2 || '📉'}</span>
              </div>
              <span className="text-[12px] text-[#64748b] font-medium">{chartLabel2 || 'Burnout Risk'}</span>
            </motion.div>
          </div>
        </div>
        
        {/* Chart Title - Below the graph */}
        <motion.h3 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.5 }}
          className="text-center font-albert text-[18px] lg:text-[20px] text-text-primary font-semibold mt-4"
        >
          Content Quality vs. Burnout Risk Over Time
        </motion.h3>
      </div>
    ),
  };
  
  return illustrations[illustrationKey || 'rocket'] || illustrations.rocket;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface QuizClientProps {
  /** Quiz steps from server-side fetch */
  initialSteps: QuizStepInternal[];
}

export default function QuizClient({ initialSteps }: QuizClientProps) {
  const router = useRouter();
  const { saveData, isLoading: sessionLoading, data: sessionData } = useGuestSession();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]); // For multi-select questions
  const [isNavigating, setIsNavigating] = useState(false);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for back
  const [showGoalConfirmation, setShowGoalConfirmation] = useState(false); // For goal question confirmation
  const initialLoadCompleteRef = useRef(false);

  // Use steps from props (SSR) or fallback to hardcoded
  const quizSteps = initialSteps.length > 0 ? initialSteps : QUIZ_STEPS;

  const baseStep = quizSteps[currentStepIndex];
  const totalSteps = quizSteps.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  // Generate dynamic content for the info-method step based on user's answers
  const currentStep = (() => {
    if (baseStep.id === 'info-method' && baseStep.kind === 'info') {
      const creatorType = sessionData.creatorType;
      const primaryGoal = sessionData.primary90DayGoal;
      
      return {
        ...baseStep,
        title: getDynamicInfoTitle(creatorType, primaryGoal),
        body: getDynamicInfoBody(creatorType, primaryGoal),
        illustrationKey: getIllustrationForCreatorType(creatorType),
      };
    }
    return baseStep;
  })();

  // Restore quiz progress from session - only on initial load
  useEffect(() => {
    if (!sessionLoading && sessionData.contentCreatorQuizStep && !initialLoadCompleteRef.current) {
      const savedStep = sessionData.contentCreatorQuizStep;
      if (savedStep > 0 && savedStep < totalSteps) {
        setCurrentStepIndex(savedStep);
      }
      initialLoadCompleteRef.current = true;
    } else if (!sessionLoading && !initialLoadCompleteRef.current) {
      // Mark as complete even if no saved step
      initialLoadCompleteRef.current = true;
    }
  }, [sessionLoading, sessionData.contentCreatorQuizStep, totalSteps]);

  // Save current step to session
  const saveProgress = useCallback(async (stepIndex: number, additionalData?: Record<string, string | string[]>) => {
    await saveData({
      contentCreatorQuizStep: stepIndex,
      currentStep: 'content-creator',
      ...additionalData,
    });
  }, [saveData]);

  // Handle option selection for question steps
  const handleOptionSelect = async (optionId: string) => {
    if (isNavigating) return;
    
    // Check if this is a multi-select question
    if (currentStep.kind === 'question' && currentStep.questionType === 'multi') {
      // Toggle selection for multi-select
      setSelectedOptions(prev => {
        if (prev.includes(optionId)) {
          return prev.filter(id => id !== optionId);
        } else {
          return [...prev, optionId];
        }
      });
      // Don't auto-advance for multi-select - user needs to click Continue
      return;
    }
    
    // Single-select behavior
    setSelectedOption(optionId);
    
    // Don't auto-advance for weekly-publishing-volume - show comparison card first
    if (currentStep.kind === 'question' && currentStep.id === 'weekly-publishing-volume') {
      return; // User will click Continue after seeing the comparison card
    }
    
    // Don't auto-advance for goal questions with confirmation enabled - show confirmation card first
    if (currentStep.kind === 'question' && currentStep.isGoalQuestion && currentStep.showConfirmation) {
      setShowGoalConfirmation(true);
      return; // User will click Continue or "Set my own goal" after seeing the confirmation
    }
    
    // Auto-advance after short delay
    setTimeout(async () => {
      if (currentStep.kind === 'question') {
        // Save the answer
        const dataToSave = { [currentStep.dataKey]: optionId };
        await saveProgress(currentStepIndex + 1, dataToSave);
      }
      goToNextStep();
    }, 300);
  };

  // Handle Continue for multi-select questions
  const handleMultiSelectContinue = async () => {
    if (isNavigating || selectedOptions.length === 0) return;
    
    if (currentStep.kind === 'question') {
      // Save the array of selected options
      const dataToSave = { [currentStep.dataKey]: selectedOptions };
      await saveProgress(currentStepIndex + 1, dataToSave);
    }
    goToNextStep();
  };

  // Handle Continue for Q14 (weekly-publishing-volume) after showing comparison card
  const handleComparisonCardContinue = async () => {
    if (isNavigating || !selectedOption) return;
    
    if (currentStep.kind === 'question') {
      const dataToSave = { [currentStep.dataKey]: selectedOption };
      await saveProgress(currentStepIndex + 1, dataToSave);
    }
    goToNextStep();
  };

  // Handle Continue for goal question after showing confirmation card
  const handleGoalConfirmationContinue = async () => {
    if (isNavigating || !selectedOption) return;
    setShowGoalConfirmation(false);
    
    if (currentStep.kind === 'question') {
      const dataToSave = { [currentStep.dataKey]: selectedOption };
      await saveProgress(currentStepIndex + 1, dataToSave);
    }
    goToNextStep();
  };

  // Handle "Set my own goal" button - redirect to goal setting page
  const handleSetOwnGoal = async () => {
    if (isNavigating || !selectedOption) return;
    
    // Save the current selection first
    if (currentStep.kind === 'question') {
      const dataToSave = { 
        [currentStep.dataKey]: selectedOption,
        // Save the next step index so we can return after goal setting (as string)
        goalReturnStepIndex: String(currentStepIndex + 1),
      };
      await saveProgress(currentStepIndex, dataToSave);
    }
    
    // Navigate to goal setting page
    router.push('/start/goal');
  };

  // Handle swipe card completion
  const handleSwipeCardComplete = async (ratings: SwipeCardRatings) => {
    if (isNavigating) return;
    
    if (currentStep.kind === 'swipe-cards') {
      // Save ratings as JSON string since saveProgress expects string values
      const dataToSave = { [currentStep.dataKey]: JSON.stringify(ratings) };
      await saveProgress(currentStepIndex + 1, dataToSave);
    }
    goToNextStep();
  };

  // Handle CTA click for info steps
  const handleInfoContinue = async () => {
    if (isNavigating) return;
    await saveProgress(currentStepIndex + 1);
    goToNextStep();
  };

  // Go to next step
  const goToNextStep = () => {
    setDirection(1);
    setSelectedOption(null);
    setSelectedOptions([]); // Reset multi-select
    setShowGoalConfirmation(false); // Reset goal confirmation
    
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Quiz complete - navigate to analyzing
      handleQuizComplete();
    }
  };

  // Go to previous step
  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setDirection(-1);
      setSelectedOption(null);
      setSelectedOptions([]); // Reset multi-select
      setShowGoalConfirmation(false); // Reset goal confirmation
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Handle quiz completion
  const handleQuizComplete = async () => {
    setIsNavigating(true);
    
    // Calculate a target date 90 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 90);
    const targetDateISO = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Find the question marked as goal question (isGoalQuestion: true)
    // Fall back to audienceGoal90Days if no question is marked
    const goalStep = quizSteps.find(
      (s): s is QuestionStep => s.kind === 'question' && s.isGoalQuestion === true
    ) || quizSteps.find(
      (s): s is QuestionStep => s.kind === 'question' && s.dataKey === 'audienceGoal90Days'
    );
    
    // Find the question marked as starting point question (isStartingPointQuestion: true)
    // Fall back to creatorStage if no question is marked
    const startingPointStep = quizSteps.find(
      (s): s is QuestionStep => s.kind === 'question' && s.isStartingPointQuestion === true
    ) || quizSteps.find(
      (s): s is QuestionStep => s.kind === 'question' && s.dataKey === 'creatorStage'
    );
    
    // Get the selected option for goal
    const goalDataKey = goalStep?.dataKey || 'audienceGoal90Days';
    const goalSelectedId = sessionData[goalDataKey as keyof typeof sessionData] as string;
    const goalSelectedOption = goalStep?.options.find(opt => opt.id === goalSelectedId);
    
    // Get the selected option for starting point
    const startingPointDataKey = startingPointStep?.dataKey || 'creatorStage';
    const startingPointSelectedId = sessionData[startingPointDataKey as keyof typeof sessionData] as string;
    const startingPointSelectedOption = startingPointStep?.options.find(opt => opt.id === startingPointSelectedId);
    
    // Static fallback mappings for goal summaries based on option ID
    const GOAL_SUMMARY_MAP: Record<string, string> = {
      'first-1k': '1k Followers',
      'grow-2-5k': '5k Followers',
      'grow-10k': '10k+ Followers',
      'engagement': 'Engagement',
      // Add more mappings as needed
    };

    // Check if user set a custom goal - if so, use it instead of generating from quiz
    let goalText = 'Grow my audience'; // Default fallback
    let goalSummary = 'Audience Growth'; // Default fallback for graph label
    
    if (sessionData.customGoal && sessionData.goal) {
      // User set a custom goal - use the already saved values
      goalText = sessionData.goal;
      goalSummary = sessionData.goalSummary || 'Custom Goal';
      console.log('[Quiz Complete] Using custom goal:', goalText);
    } else if (goalSelectedOption?.label) {
      // First, set a static fallback based on the option ID (reliable)
      if (goalSelectedId && GOAL_SUMMARY_MAP[goalSelectedId]) {
        goalSummary = GOAL_SUMMARY_MAP[goalSelectedId];
        console.log('[Quiz Complete] Using static goal summary:', goalSummary);
      }
      
      // Generate goal text using AI from the selected quiz option
      try {
        // Step 1: Generate the full goal text
        const goalResponse = await fetch('/api/goal/generate-from-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionLabel: goalSelectedOption.label }),
        });
        const goalData = await goalResponse.json();
        if (goalData.goal) {
          goalText = goalData.goal;
          console.log('[Quiz Complete] AI generated goal text:', goalText);
        }
        
        // Step 2: Generate a separate 1-2 word summary for the graph label
        // Only override static fallback if AI returns a valid summary
        const summaryResponse = await fetch('/api/goal/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: goalText }),
        });
        const summaryData = await summaryResponse.json();
        if (summaryData.goalSummary && summaryData.goalSummary !== 'Your Goal') {
          goalSummary = summaryData.goalSummary;
          console.log('[Quiz Complete] AI generated goal summary:', goalSummary);
        }
      } catch (error) {
        console.error('[Quiz Complete] Failed to generate goal from AI:', error);
        // Fallback: use the option label cleaned up
        const cleanLabel = goalSelectedOption.label.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
        goalText = cleanLabel;
        // Keep the static fallback goalSummary if we have one, otherwise extract from label
        if (!GOAL_SUMMARY_MAP[goalSelectedId]) {
          goalSummary = cleanLabel.split(/\s+/).slice(0, 3).join(' ');
        }
      }
    }
    
    console.log('[Quiz Complete] Final goal values:', { goalText, goalSummary, goalSelectedId });
    
    // Static fallback mappings for starting point summaries based on option ID
    const STARTING_POINT_MAP: Record<string, string> = {
      'not-started': 'Just Starting',
      'occasional': 'Early Stage',
      'consistent-slow': 'Slow Growth',
      'scaling': 'Ready to Scale',
    };

    // Generate starting point summary
    let startingPointSummary = 'Starting Point'; // Default fallback
    let startingPointRaw = startingPointSelectedId || ''; // Store raw answer
    
    // First, set a static fallback based on the option ID (reliable)
    if (startingPointSelectedId && STARTING_POINT_MAP[startingPointSelectedId]) {
      startingPointSummary = STARTING_POINT_MAP[startingPointSelectedId];
      console.log('[Quiz Complete] Using static starting point summary:', startingPointSummary);
    }
    
    if (startingPointSelectedOption?.label) {
      startingPointRaw = startingPointSelectedOption.label;
      try {
        const response = await fetch('/api/goal/generate-starting-point', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionLabel: startingPointSelectedOption.label }),
        });
        const data = await response.json();
        // Only override static fallback if AI returns a valid summary
        if (data.summary && data.summary !== 'Starting Point') {
          startingPointSummary = data.summary;
          console.log('[Quiz Complete] AI generated starting point summary:', startingPointSummary);
        }
      } catch (error) {
        console.error('[Quiz Complete] Failed to generate starting point from AI:', error);
        // Keep the static fallback - already set above
      }
    }
    
    console.log('[Quiz Complete] Final starting point values:', { startingPointSummary, startingPointSelectedId, startingPointRaw });
    
    // Save the goal to the user's profile via the goal API
    try {
      await fetch('/api/goal/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalText,
          targetDate: targetDateISO,
          isAISuggested: true, // Now AI-generated
        }),
      });
    } catch (error) {
      console.error('Failed to save goal:', error);
      // Continue anyway - the goal is also saved to session
    }
    
    // Log all data being saved for debugging
    const dataToSave = {
      contentCreatorQuizCompleted: true,
      currentStep: 'analyzing',
      // Set goal data for transformation page
      goal: goalText,
      goalTargetDate: targetDate.toISOString(),
      goalSummary: goalSummary,
      // Set starting point data for transformation page
      startingPoint: startingPointRaw,
      startingPointSummary: startingPointSummary,
      // Keep business stage for backward compatibility
      businessStage: sessionData.creatorStage === 'not-started' ? 'just_starting'
        : sessionData.creatorStage === 'occasional' ? 'building_momentum'
        : sessionData.creatorStage === 'consistent-slow' ? 'growing_steadily'
        : 'leveling_up',
    };
    
    console.log('[Quiz Complete] Saving data to session:', dataToSave);
    
    await saveData(dataToSave);
    
    // Navigate to existing analyzing page
    router.push('/start/analyzing');
  };

  // Animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  // Handle case where no steps are available
  if (!baseStep) {
    return (
      <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center">
        <p className="text-[#5f5a55] font-sans">Unable to load quiz. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app-bg overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header with logo and progress */}
        <motion.div 
          className="pt-6 pb-2 px-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between max-w-xl lg:max-w-2xl mx-auto">
            {/* Back button */}
            <button
              onClick={goToPrevStep}
              disabled={currentStepIndex === 0 || isNavigating}
              className={`p-2 rounded-full transition-all ${
                currentStepIndex === 0 
                  ? 'opacity-0 cursor-default' 
                  : 'opacity-100 hover:bg-[#e1ddd8]/50 active:scale-95'
              }`}
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            
            {/* Logo */}
            <Image 
              src="/logo.jpg" 
              alt="GrowthAddicts" 
              width={40} 
              height={40} 
              className="rounded-lg"
            />
            
            {/* Step counter */}
            <span className="font-sans text-[12px] text-text-secondary">
              {currentStepIndex + 1}/{totalSteps}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="max-w-xl lg:max-w-2xl mx-auto mt-4">
            <div className="h-1.5 bg-[#e1ddd8] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#a07855] to-[#c9a07a]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStepIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col px-4 py-6 lg:py-8"
            >
              <div className="w-full max-w-xl lg:max-w-4xl mx-auto flex-1 flex flex-col">
                {currentStep.kind === 'info' ? (
                  // Info step layout
                  <InfoStepContent 
                    step={currentStep} 
                    onContinue={handleInfoContinue}
                    isNavigating={isNavigating}
                  />
                ) : currentStep.kind === 'swipe-cards' ? (
                  // Swipe cards step layout
                  <SwipeCardStepContent
                    step={currentStep}
                    onComplete={handleSwipeCardComplete}
                    isNavigating={isNavigating}
                  />
                ) : (
                  // Question step layout
                  <QuestionStepContent 
                    step={currentStep}
                    selectedOption={selectedOption}
                    selectedOptions={selectedOptions}
                    onSelect={handleOptionSelect}
                    onMultiSelectContinue={handleMultiSelectContinue}
                    onComparisonCardContinue={handleComparisonCardContinue}
                    onGoalConfirmationContinue={handleGoalConfirmationContinue}
                    onSetOwnGoal={handleSetOwnGoal}
                    showGoalConfirmation={showGoalConfirmation}
                    isNavigating={isNavigating}
                  />
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

// =============================================================================
// INFO STEP COMPONENT
// =============================================================================

function InfoStepContent({ 
  step, 
  onContinue,
  isNavigating,
}: { 
  step: InfoStep; 
  onContinue: () => void;
  isNavigating: boolean;
}) {
  // Only content-volume-chart has a built-in title, growth-chart does not
  // So we only hide the title for content-volume-chart specifically
  const isContentVolumeChart = step.illustrationKey === 'content-volume-chart';
  const titleAboveIllustration = isContentVolumeChart; // Show title above for chart steps
  
  return (
    <div className="flex-1 flex flex-col">
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {/* Title - Above illustration for content-volume step */}
        {titleAboveIllustration && (
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-albert text-[28px] lg:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4 px-4"
          >
            {step.title}
          </motion.h1>
        )}
        
        {/* Illustration - Custom image or fallback to illustrationKey */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-6 w-full flex justify-center"
        >
          {step.imageUrl ? (
            <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden shadow-lg">
              <Image
                src={step.imageUrl}
                alt={step.title}
                fill
                sizes="(max-width: 768px) 100vw, 448px"
                className="object-cover"
              />
            </div>
          ) : (
          <QuizIllustration 
            illustrationKey={step.illustrationKey}
            chartLabel1={step.chartLabel1}
            chartLabel2={step.chartLabel2}
            chartEmoji1={step.chartEmoji1}
            chartEmoji2={step.chartEmoji2}
          />
          )}
        </motion.div>
        
        {/* Badge */}
        {step.badge && (
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-block px-3 py-1 bg-[#a07855]/10 text-[#a07855] text-[12px] font-medium rounded-full mb-4"
          >
            {step.badge}
          </motion.span>
        )}
        
        {/* Title - Below illustration (only hidden for content-volume-chart which has built-in title) */}
        {!titleAboveIllustration && !isContentVolumeChart && (
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="font-albert text-[28px] lg:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-3"
        >
          {step.title}
        </motion.h1>
        )}
        
        {/* Subtitle */}
        {step.subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-sans text-[16px] text-text-secondary leading-[1.5] mb-4 max-w-md"
          >
            {step.subtitle}
          </motion.p>
        )}
        
        {/* Body */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/70 backdrop-blur-sm border border-[#e1ddd8] rounded-2xl p-5 text-left shadow-sm max-w-md"
        >
          <p className="font-sans text-[15px] text-text-primary leading-[1.7] whitespace-pre-line">
            {step.body}
          </p>
        </motion.div>
      </div>
      
      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="pt-4 pb-6"
      >
        <button
          onClick={onContinue}
          disabled={isNavigating}
          className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step.ctaLabel || 'Continue ➜'}
        </button>
      </motion.div>
    </div>
  );
}

// =============================================================================
// SWIPE CARD STEP COMPONENT
// =============================================================================

function SwipeCardStepContent({
  step,
  onComplete,
  isNavigating,
}: {
  step: SwipeCardStep;
  onComplete: (ratings: SwipeCardRatings) => void;
  isNavigating: boolean;
}) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [ratings, setRatings] = useState<SwipeCardRatings>({});
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const currentCard = step.cards[currentCardIndex];
  const isLastCard = currentCardIndex === step.cards.length - 1;
  
  const handleRate = (rating: SwipeRating) => {
    if (isAnimating || isNavigating) return;
    
    // Set exit direction based on rating
    const direction = rating === 'dislike' ? 'left' : rating === 'like' ? 'right' : 'up';
    setExitDirection(direction);
    setIsAnimating(true);
    
    // Update ratings
    const newRatings = { ...ratings, [currentCard.id]: rating };
    setRatings(newRatings);
    
    // After animation, move to next card or complete
    setTimeout(() => {
      if (isLastCard) {
        onComplete(newRatings);
      } else {
        setCurrentCardIndex(prev => prev + 1);
        setExitDirection(null);
        setIsAnimating(false);
      }
    }, 300);
  };
  
  // Animation variants for card exit
  const cardVariants = {
    initial: { scale: 1, x: 0, y: 0, opacity: 1, rotate: 0 },
    exit: {
      x: exitDirection === 'left' ? -300 : exitDirection === 'right' ? 300 : 0,
      y: exitDirection === 'up' ? -200 : 0,
      opacity: 0,
      rotate: exitDirection === 'left' ? -15 : exitDirection === 'right' ? 15 : 0,
      scale: 0.8,
      transition: { duration: 0.3, ease: 'easeOut' as const }
    }
  };
  
  return (
    <div className="flex-1 flex flex-col">
      {/* Title - Centered */}
      <div className="mb-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-albert text-[26px] lg:text-[32px] text-text-primary tracking-[-1.5px] leading-[1.2]"
        >
          {step.title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-sans text-[14px] text-text-secondary mt-2"
        >
          {currentCardIndex + 1} of {step.cards.length}
        </motion.p>
      </div>
      
      {/* Card Stack */}
      <div className="flex items-center justify-center">
        <div className="relative w-full max-w-[280px] lg:max-w-[320px]">
          {/* Background cards (stack effect) */}
          {step.cards.slice(currentCardIndex + 1, currentCardIndex + 3).map((card, index) => (
            <div
              key={card.id}
              className="absolute inset-0 bg-white rounded-2xl border border-[#e1ddd8]"
              style={{
                transform: `translateY(${(index + 1) * 8}px) scale(${1 - (index + 1) * 0.03})`,
                zIndex: 10 - index,
                opacity: 0.6 - index * 0.2,
              }}
            />
          ))}
          
          {/* Current card */}
          <AnimatePresence mode="wait">
            {currentCard && (
              <motion.div
                key={currentCard.id}
                variants={cardVariants}
                initial="initial"
                animate={exitDirection ? "exit" : "initial"}
                className="relative bg-white rounded-2xl border-2 border-[#e1ddd8] shadow-xl overflow-hidden z-20"
              >
                {/* Card content */}
                <div className="flex flex-col">
                  {/* Square Image area */}
                  <div className="relative w-full aspect-square bg-gradient-to-br from-[#f5f0eb] to-[#e8e3de] overflow-hidden">
                    {currentCard.imageUrl ? (
                      <Image
                        src={currentCard.imageUrl}
                        alt={currentCard.label}
                        fill
                        sizes="320px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-7xl">{currentCard.icon}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Label */}
                  <div className="p-4 bg-white text-center">
                    <h3 className="font-sans font-bold text-[18px] text-text-primary">
                      {currentCard.label}
                    </h3>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Rating buttons - Right below cards */}
      <div className="pt-4 pb-4">
        <div className="flex justify-center gap-4">
          {/* Dislike */}
          <button
            onClick={() => handleRate('dislike')}
            disabled={isAnimating || isNavigating}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-[#e1ddd8] bg-white hover:border-[#f97316] hover:bg-[#fff7ed] transition-all disabled:opacity-50 min-w-[100px]"
          >
            <svg className="w-8 h-8 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-6h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
            <span className="font-sans font-medium text-[14px] text-text-primary">Dislike</span>
          </button>
          
          {/* Neutral */}
          <button
            onClick={() => handleRate('neutral')}
            disabled={isAnimating || isNavigating}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-[#e1ddd8] bg-white hover:border-[#f97316] hover:bg-[#fff7ed] transition-all disabled:opacity-50 min-w-[100px]"
          >
            <svg className="w-8 h-8 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
            <span className="font-sans font-medium text-[14px] text-text-primary">Neutral</span>
          </button>
          
          {/* Like */}
          <button
            onClick={() => handleRate('like')}
            disabled={isAnimating || isNavigating}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-[#e1ddd8] bg-white hover:border-[#f97316] hover:bg-[#fff7ed] transition-all disabled:opacity-50 min-w-[100px]"
          >
            <svg className="w-8 h-8 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            <span className="font-sans font-medium text-[14px] text-text-primary">Like</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// QUESTION STEP COMPONENT
// =============================================================================

function QuestionStepContent({ 
  step, 
  selectedOption,
  selectedOptions,
  onSelect,
  onMultiSelectContinue,
  onComparisonCardContinue,
  onGoalConfirmationContinue,
  onSetOwnGoal,
  showGoalConfirmation,
  isNavigating,
}: { 
  step: QuestionStep;
  selectedOption: string | null;
  selectedOptions: string[];
  onSelect: (optionId: string) => void;
  onMultiSelectContinue: () => void;
  onComparisonCardContinue: () => void;
  onGoalConfirmationContinue: () => void;
  onSetOwnGoal: () => void;
  showGoalConfirmation: boolean;
  isNavigating: boolean;
}) {
  const isStatementLayout = step.layout === 'statement-cards';
  const isImageLayout = step.layout === 'image-options';
  const isGridImageLayout = step.layout === 'grid-image';
  const isListImageLayout = step.layout === 'list-image';
  const isMultiSelect = step.questionType === 'multi';
  
  // Determine grid columns based on number of options
  const getGridClasses = () => {
    const count = step.options.length;
    if (count === 3) return 'grid-cols-2 sm:grid-cols-3'; // 2x1 on mobile (last centered), 3 on desktop
    if (count === 4) return 'grid-cols-2 lg:grid-cols-4'; // 4 in a row on desktop, 2x2 on mobile
    if (count === 5) return 'grid-cols-2 lg:grid-cols-3'; // 3x2 on desktop, 2 cols on mobile
    if (count === 6) return 'grid-cols-2 lg:grid-cols-3'; // 3x2 on desktop, 2x3 on mobile
    return 'grid-cols-2'; // Default 2 columns
  };
  
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="mb-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-albert text-[26px] lg:text-[32px] text-text-primary tracking-[-1.5px] leading-[1.2] mb-2"
        >
          {step.title}
        </motion.h1>
        
        {step.subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-sans text-[15px] text-text-secondary"
          >
            {step.subtitle}
          </motion.p>
        )}
      </div>
      
      {/* Statement card for statement-cards layout */}
      {isStatementLayout && step.statement && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#faf8f6] to-[#f5f0eb] border border-[#e1ddd8] rounded-2xl overflow-hidden mb-4"
        >
          {/* Image area */}
          <div className="relative w-full h-48 lg:h-56 bg-gradient-to-br from-[#e8e3de] to-[#ddd5cc] overflow-hidden">
            {step.statementImageUrl ? (
              <Image
                src={step.statementImageUrl}
                alt={step.statement}
                fill
                sizes="(max-width: 768px) 100vw, 600px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl lg:text-6xl opacity-60">💭</span>
              </div>
            )}
          </div>
          {/* Statement text */}
          <div className="p-5 text-center">
            <p className="font-albert text-[18px] lg:text-[22px] text-text-primary tracking-[-0.5px] leading-[1.4] italic">
              &ldquo;{step.statement}&rdquo;
            </p>
          </div>
        </motion.div>
      )}
      
      {/* Options */}
      <div className={`flex-1 overflow-y-auto ${isStatementLayout ? '' : ''}`}>
        {isGridImageLayout ? (
          // Grid image layout - boxes with images
          <div className={`grid ${getGridClasses()} gap-3 lg:gap-5 pb-2 ${step.options.length === 3 ? '[&>*:last-child]:col-span-2 [&>*:last-child]:w-[calc(50%-6px)] [&>*:last-child]:mx-auto sm:[&>*:last-child]:col-span-1 sm:[&>*:last-child]:w-full sm:[&>*:last-child]:mx-0' : ''}`}>
            {step.options.map((option) => {
              const isSelected = isMultiSelect 
                ? selectedOptions.includes(option.id)
                : selectedOption === option.id;
              
              return (
                <motion.button
                  key={option.id}
                  onClick={() => onSelect(option.id)}
                  disabled={isNavigating}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`
                    relative flex flex-col overflow-hidden rounded-[16px] border-2 transition-all
                    hover:scale-[1.02] active:scale-[0.98]
                    ${isSelected 
                      ? 'border-[#a07855] shadow-lg ring-2 ring-[#a07855]/20' 
                      : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-md'
                    }
                    disabled:opacity-50 disabled:hover:scale-100
                  `}
                >
                  {/* Image area - square aspect ratio for square images */}
                  <div className={`relative w-full aspect-square overflow-hidden ${
                    isSelected ? 'bg-[#a07855]/10' : 'bg-gradient-to-br from-[#f5f0eb] to-[#e8e3de]'
                  }`}>
                    {option.imageUrl ? (
                      <Image
                        src={option.imageUrl}
                        alt={option.label}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      // Placeholder with icon
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl lg:text-6xl opacity-80">{option.icon || '📷'}</span>
                      </div>
                    )}
                    
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-[#a07855] flex items-center justify-center shadow-md">
                        <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Label area */}
                  <div className={`px-3 py-3 lg:px-5 lg:py-5 text-left lg:text-center ${isSelected ? 'bg-[#faf8f6]' : 'bg-white'}`}>
                    <p className="font-sans text-[14px] lg:text-[16px] text-text-primary leading-[1.3] font-medium">
                      {option.label}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : isListImageLayout ? (
          // List layout with images on the right
          <div className="w-full space-y-3 pb-2">
            {step.options.map((option) => {
              const isSelected = isMultiSelect 
                ? selectedOptions.includes(option.id)
                : selectedOption === option.id;
              
              return (
                <motion.button
                  key={option.id}
                  onClick={() => onSelect(option.id)}
                  disabled={isNavigating}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`
                    w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[14px] border-2 transition-all
                    hover:scale-[1.01] active:scale-[0.99]
                    ${isSelected 
                      ? 'border-[#a07855] bg-[#faf8f6] shadow-md ring-2 ring-[#a07855]/20' 
                      : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-sm'
                    }
                    disabled:opacity-50 disabled:hover:scale-100
                  `}
                >
                  {/* Left side - checkbox/radio and label */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Checkbox/Radio indicator */}
                    <div className={`
                      w-5 h-5 ${isMultiSelect ? 'rounded-md' : 'rounded-full'} border-2 flex-shrink-0 flex items-center justify-center transition-all
                      ${isSelected 
                        ? 'border-[#a07855] bg-[#a07855]' 
                        : 'border-[#d4d0cb] bg-white'
                      }
                    `}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <span className={`font-sans text-[15px] leading-[1.3] ${isSelected ? 'text-text-primary font-medium' : 'text-text-primary'}`}>
                      {option.label}
                    </span>
                  </div>
                  
                  {/* Right side - image */}
                  {option.imageUrl && (
                    <div className="relative w-16 h-16 lg:w-20 lg:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-[#f5f0eb] to-[#e8e3de]">
                      <Image
                        src={option.imageUrl}
                        alt={option.label}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        ) : (
          // Standard list layouts
          <div className={`w-full pb-2 ${isStatementLayout ? 'grid grid-cols-3 gap-3' : 'space-y-3'}`}>
            {step.options.map((option) => {
              const isSelected = isMultiSelect 
                ? selectedOptions.includes(option.id)
                : selectedOption === option.id;
              
              return (
                <motion.button
                  key={option.id}
                  onClick={() => onSelect(option.id)}
                  disabled={isNavigating}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`
                    ${isStatementLayout ? 'w-full h-full min-h-[100px] px-2 py-4 lg:p-5' : 'w-full p-4 lg:p-5'} 
                    rounded-[20px] border-2 text-left transition-all 
                    hover:scale-[1.01] active:scale-[0.99]
                    ${isSelected 
                      ? 'border-[#a07855] bg-[#faf8f6] shadow-md' 
                      : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-sm'
                    }
                    disabled:opacity-50 disabled:hover:scale-100
                    ${isStatementLayout ? 'text-center flex items-center justify-center' : ''}
                  `}
                >
                  {isImageLayout ? (
                    // Image options layout
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected 
                          ? 'bg-[#a07855]/20' 
                          : 'bg-[#faf5ef]'
                      }`}>
                        <span className="text-2xl">{option.icon || '📌'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-[15px] lg:text-[16px] text-text-primary leading-[1.4]">
                          {option.label}
                        </p>
                        {option.helperText && (
                          <p className="font-sans text-[13px] text-text-secondary mt-0.5">
                            {option.helperText}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[#a07855] flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ) : isStatementLayout ? (
                    // Statement cards layout (agree/disagree)
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl">{option.label.split(' ').pop()}</span>
                      <span className="font-sans text-[14px] text-text-primary font-medium">
                        {option.label.split(' ').slice(0, -1).join(' ')}
                      </span>
                    </div>
                  ) : (
                    // Standard layout
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 ${isMultiSelect ? 'rounded-md' : 'rounded-full'} border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected 
                          ? 'border-[#a07855] bg-[#a07855]' 
                          : 'border-[#d4d0cb]'
                      }`}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-[15px] lg:text-[16px] text-text-primary leading-[1.4]">
                          {option.label}
                        </p>
                        {option.helperText && (
                          <p className="font-sans text-[13px] text-text-secondary mt-0.5">
                            {option.helperText}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Comparison Card for Q14 (weekly-publishing-volume) */}
      {step.id === 'weekly-publishing-volume' && selectedOption && PUBLISHING_VOLUME_COMPARISON[selectedOption] && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="mt-4 bg-[#2563eb] rounded-2xl p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-sans font-bold text-[15px] text-white leading-[1.3]">
                  {PUBLISHING_VOLUME_COMPARISON[selectedOption].title}
                </p>
                <p className="font-sans text-[13px] text-white/80 mt-1 leading-[1.4]">
                  {PUBLISHING_VOLUME_COMPARISON[selectedOption].subtitle}
                </p>
              </div>
            </div>
            {PUBLISHING_VOLUME_COMPARISON[selectedOption].footnote && (
              <p className="font-sans text-[11px] text-white/60 mt-3">
                {PUBLISHING_VOLUME_COMPARISON[selectedOption].footnote}
              </p>
            )}
          </motion.div>
          
          {/* Continue button for Q14 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-4"
          >
            <button
              onClick={onComparisonCardContinue}
              disabled={isNavigating}
              className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue ➜
            </button>
          </motion.div>
        </>
      )}
      
      {/* Goal Confirmation Card */}
      {step.isGoalQuestion && step.showConfirmation && showGoalConfirmation && selectedOption && (() => {
        // Find the selected option to get its confirmation text
        const selectedOpt = step.options.find(opt => opt.id === selectedOption);
        const confirmTitle = selectedOpt?.confirmationTitle || step.confirmationTitle || 'Great choice!';
        const confirmSubtitle = selectedOpt?.confirmationSubtitle || step.confirmationSubtitle;
        
        return (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="mt-4 bg-[#2563eb] rounded-2xl p-5 shadow-lg"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-sans font-bold text-[16px] lg:text-[18px] text-white leading-[1.3]">
                  {confirmTitle}
                </p>
                {confirmSubtitle && (
                  <p className="font-sans text-[14px] text-white/80 mt-1 leading-[1.4]">
                    {confirmSubtitle}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
          
          {/* Goal Confirmation Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-4 flex flex-col-reverse sm:flex-row gap-3"
          >
            {/* Set my own goal button - white, positioned left on desktop, above on mobile */}
            <button
              onClick={onSetOwnGoal}
              disabled={isNavigating}
              className="flex-1 sm:flex-none sm:min-w-[160px] bg-white text-[#2c2520] font-sans font-semibold text-[15px] tracking-[-0.3px] leading-[1.4] py-3.5 px-5 rounded-[24px] border-2 border-[#e1ddd8] hover:border-[#d4d0cb] hover:bg-[#faf8f6] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set my own goal
            </button>
            
            {/* Continue button - yellow, positioned right on desktop, below on mobile */}
            <button
              onClick={onGoalConfirmationContinue}
              disabled={isNavigating}
              className="flex-1 bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue ➜
            </button>
          </motion.div>
        </>
        );
      })()}
      
      {/* Continue button for multi-select questions */}
      {isMultiSelect && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="pt-4"
        >
          <button
            onClick={onMultiSelectContinue}
            disabled={isNavigating || selectedOptions.length === 0}
            className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Continue ➜
          </button>
        </motion.div>
      )}
      
      {/* Spacer for bottom padding */}
      <div className="h-6" />
    </div>
  );
}

