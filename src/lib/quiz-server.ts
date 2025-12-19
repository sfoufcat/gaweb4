/**
 * Server-side Quiz Data Fetching
 * 
 * Used by Server Components to fetch quiz data directly from Firestore
 * without going through the API route. This enables SSR for quiz pages.
 * 
 * Uses the same optimized parallel fetching logic as the API route.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Quiz, QuizStep, QuizOption, QuizWithSteps, QuizStepWithOptions } from '@/types';
import { cache } from 'react';

/**
 * Fetch a quiz by slug with all steps and options
 * 
 * This function is cached using React's cache() for deduplication
 * within a single request. Multiple components can call this and
 * only one Firestore query will be made.
 */
export const getQuizBySlug = cache(async (slug: string): Promise<QuizWithSteps | null> => {
  try {
    console.log(`[QUIZ_SERVER] Fetching quiz with slug: "${slug}"`);
    
    if (!slug) {
      console.log('[QUIZ_SERVER] No slug provided');
      return null;
    }

    // Fetch quiz by slug directly
    const quizzesSnapshot = await adminDb
      .collection('quizzes')
      .where('slug', '==', slug)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (quizzesSnapshot.empty) {
      console.log(`[QUIZ_SERVER] No active quiz found with slug "${slug}"`);
      return null;
    }

    const quizDoc = quizzesSnapshot.docs[0];
    const quizData = quizDoc.data();
    console.log(`[QUIZ_SERVER] Found quiz: "${quizData.title}"`);
    
    const quiz: Quiz = {
      id: quizDoc.id,
      slug: quizData.slug,
      title: quizData.title,
      trackId: quizData.trackId || null,
      isActive: quizData.isActive,
      stepCount: quizData.stepCount,
      createdAt: quizData.createdAt?.toDate?.()?.toISOString?.() || quizData.createdAt,
      updatedAt: quizData.updatedAt?.toDate?.()?.toISOString?.() || quizData.updatedAt,
    };

    // Fetch all steps for this quiz, ordered by order field
    const stepsSnapshot = await adminDb
      .collection('quizzes')
      .doc(quizDoc.id)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    // PARALLEL: Fetch options for ALL steps at once
    const stepsWithOptionsPromises = stepsSnapshot.docs.map(async (stepDoc) => {
      const stepData = stepDoc.data();
      
      const step: QuizStep = {
        id: stepDoc.id,
        quizId: quizDoc.id,
        order: stepData.order,
        type: stepData.type,
        title: stepData.title,
        subtitle: stepData.subtitle,
        description: stepData.description,
        imageUrl: stepData.imageUrl,
        statement: stepData.statement,
        statementImageUrl: stepData.statementImageUrl,
        dataKey: stepData.dataKey,
        isRequired: stepData.isRequired,
        isSkippable: stepData.isSkippable,
        ctaLabel: stepData.ctaLabel,
        illustrationKey: stepData.illustrationKey,
        chartLabel1: stepData.chartLabel1,
        chartLabel2: stepData.chartLabel2,
        chartEmoji1: stepData.chartEmoji1,
        chartEmoji2: stepData.chartEmoji2,
        isGoalQuestion: stepData.isGoalQuestion,
        isStartingPointQuestion: stepData.isStartingPointQuestion,
        showConfirmation: stepData.showConfirmation,
        confirmationTitle: stepData.confirmationTitle,
        confirmationSubtitle: stepData.confirmationSubtitle,
        createdAt: stepData.createdAt?.toDate?.()?.toISOString?.() || stepData.createdAt,
        updatedAt: stepData.updatedAt?.toDate?.()?.toISOString?.() || stepData.updatedAt,
      };

      // Fetch options for this step
      const optionsSnapshot = await adminDb
        .collection('quizzes')
        .doc(quizDoc.id)
        .collection('steps')
        .doc(stepDoc.id)
        .collection('options')
        .orderBy('order', 'asc')
        .get();

      const options: QuizOption[] = optionsSnapshot.docs.map(optionDoc => {
        const optionData = optionDoc.data();
        return {
          id: optionDoc.id,
          quizStepId: stepDoc.id,
          order: optionData.order,
          label: optionData.label,
          emoji: optionData.emoji,
          value: optionData.value,
          helperText: optionData.helperText,
          imageUrl: optionData.imageUrl,
          isDefault: optionData.isDefault,
          confirmationTitle: optionData.confirmationTitle,
          confirmationSubtitle: optionData.confirmationSubtitle,
          createdAt: optionData.createdAt?.toDate?.()?.toISOString?.() || optionData.createdAt,
          updatedAt: optionData.updatedAt?.toDate?.()?.toISOString?.() || optionData.updatedAt,
        };
      });

      return { ...step, options };
    });

    // Wait for all options to be fetched in parallel
    const stepsWithOptions = await Promise.all(stepsWithOptionsPromises);
    
    // Sort by order to ensure correct sequence
    stepsWithOptions.sort((a, b) => a.order - b.order);

    const quizWithSteps: QuizWithSteps = {
      ...quiz,
      steps: stepsWithOptions,
    };

    console.log(`[QUIZ_SERVER] Loaded quiz with ${stepsWithOptions.length} steps`);
    return quizWithSteps;
  } catch (error) {
    console.error('[QUIZ_SERVER] Error fetching quiz:', error);
    return null;
  }
});

/**
 * Convert CMS quiz steps to the internal format used by the quiz UI
 */
export type QuestionLayout = 
  | 'standard' 
  | 'image-options' 
  | 'statement-cards' 
  | 'stat-with-text' 
  | 'grid-image' 
  | 'list-image';

export interface QuizOptionInternal {
  id: string;
  label: string;
  helperText?: string;
  icon?: string;
  imageUrl?: string;
  confirmationTitle?: string;
  confirmationSubtitle?: string;
}

export interface QuestionStep {
  id: string;
  kind: 'question';
  questionType: 'single' | 'multi';
  title: string;
  subtitle?: string;
  layout?: QuestionLayout;
  options: QuizOptionInternal[];
  dataKey: string;
  statement?: string;
  statementImageUrl?: string;
  isGoalQuestion?: boolean;
  isStartingPointQuestion?: boolean;
  showConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationSubtitle?: string;
}

export interface InfoStep {
  id: string;
  kind: 'info';
  title: string;
  subtitle?: string;
  body: string;
  badge?: string;
  illustrationKey?: string;
  imageUrl?: string;
  ctaLabel?: string;
  chartLabel1?: string;
  chartLabel2?: string;
  chartEmoji1?: string;
  chartEmoji2?: string;
}

export interface SwipeCard {
  id: string;
  label: string;
  icon: string;
  imageUrl?: string;
}

export interface SwipeCardStep {
  id: string;
  kind: 'swipe-cards';
  title: string;
  dataKey: string;
  cards: SwipeCard[];
}

export type QuizStepInternal = QuestionStep | InfoStep | SwipeCardStep;

function getQuestionType(cmsType: string): 'single' | 'multi' {
  if (cmsType.startsWith('multi_select')) return 'multi';
  return 'single';
}

function getLayout(cmsType: string): QuestionLayout | undefined {
  switch (cmsType) {
    case 'single_choice_grid':
    case 'multi_select_grid':
      return 'grid-image';
    case 'single_choice_list_image':
    case 'multi_select_list_image':
      return 'list-image';
    case 'single_choice_cards':
      return 'image-options';
    case 'statement_cards':
      return 'statement-cards';
    default:
      return undefined;
  }
}

/**
 * Convert a CMS quiz step to the internal format
 */
export function convertCMSStepToInternal(step: QuizStepWithOptions): QuizStepInternal {
  // Info prompt steps
  if (step.type === 'info_prompt') {
    return {
      id: step.id,
      kind: 'info',
      title: step.title,
      subtitle: step.subtitle,
      body: step.description || '',
      ctaLabel: step.ctaLabel,
      illustrationKey: step.illustrationKey,
      imageUrl: step.imageUrl,
      chartLabel1: step.chartLabel1,
      chartLabel2: step.chartLabel2,
      chartEmoji1: step.chartEmoji1,
      chartEmoji2: step.chartEmoji2,
    };
  }

  // Swipe cards / Like-dislike-neutral
  if (step.type === 'swipe_cards' || step.type === 'like_dislike_neutral') {
    return {
      id: step.id,
      kind: 'swipe-cards',
      title: step.title,
      dataKey: step.dataKey || step.id,
      cards: step.options.map(opt => ({
        id: opt.value,
        label: opt.label,
        icon: opt.emoji || '📌',
        imageUrl: opt.imageUrl,
      })),
    };
  }

  // Question steps
  return {
    id: step.id,
    kind: 'question',
    questionType: getQuestionType(step.type),
    title: step.title,
    subtitle: step.subtitle,
    layout: getLayout(step.type),
    dataKey: step.dataKey || step.id,
    statement: step.statement,
    statementImageUrl: step.statementImageUrl,
    isGoalQuestion: step.isGoalQuestion,
    isStartingPointQuestion: step.isStartingPointQuestion,
    showConfirmation: step.showConfirmation,
    confirmationTitle: step.confirmationTitle,
    confirmationSubtitle: step.confirmationSubtitle,
    options: step.options.map(opt => ({
      id: opt.value,
      label: opt.label,
      helperText: opt.helperText,
      icon: opt.emoji,
      imageUrl: opt.imageUrl,
      confirmationTitle: opt.confirmationTitle,
      confirmationSubtitle: opt.confirmationSubtitle,
    })),
  };
}

/**
 * Get quiz steps in internal format, ready for the UI
 */
export async function getQuizStepsForUI(slug: string): Promise<QuizStepInternal[] | null> {
  const quiz = await getQuizBySlug(slug);
  if (!quiz) return null;
  
  return quiz.steps.map(convertCMSStepToInternal);
}

