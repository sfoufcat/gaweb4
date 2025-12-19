'use client';

import { useState, useEffect, useCallback } from 'react';
import type { QuizWithSteps, QuizStepWithOptions, QuizStepType } from '@/types';

// =============================================================================
// TYPES - Internal quiz step types for rendering
// =============================================================================

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
  // Goal question and confirmation fields
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
  // Chart legend labels (for chart illustrations)
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

export type QuizStep = QuestionStep | InfoStep | SwipeCardStep;

// =============================================================================
// CMS TYPE TO INTERNAL TYPE MAPPING
// =============================================================================

/**
 * Maps CMS step type to internal questionType
 */
function getQuestionType(cmsType: QuizStepType): 'single' | 'multi' {
  if (cmsType.startsWith('multi_select')) return 'multi';
  return 'single';
}

/**
 * Maps CMS step type to internal layout
 */
function getLayout(cmsType: QuizStepType): QuestionLayout | undefined {
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
      return undefined; // standard layout
  }
}

/**
 * Converts CMS step to internal quiz step format
 */
function convertCMSStepToInternal(step: QuizStepWithOptions): QuizStep {
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
      id: opt.value, // Use value as the ID for storage
      label: opt.label,
      helperText: opt.helperText,
      icon: opt.emoji,
      imageUrl: opt.imageUrl,
      confirmationTitle: opt.confirmationTitle,
      confirmationSubtitle: opt.confirmationSubtitle,
    })),
  };
}

// =============================================================================
// IMAGE PRELOADING
// =============================================================================

/**
 * Preload an image and return a promise that resolves when loaded
 * Includes a timeout to prevent hanging on slow connections
 */
function preloadImage(url: string, timeoutMs: number = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }

    const img = new Image();
    const timeout = setTimeout(() => {
      console.log(`[useQuizCMS] ⏱️ Image preload timeout for: ${url.substring(0, 50)}...`);
      resolve(); // Resolve anyway after timeout
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timeout);
      console.log(`[useQuizCMS] 🖼️ Image preloaded: ${url.substring(0, 50)}...`);
      resolve();
    };

    img.onerror = () => {
      clearTimeout(timeout);
      console.warn(`[useQuizCMS] ❌ Failed to preload image: ${url.substring(0, 50)}...`);
      resolve(); // Resolve anyway on error
    };

    img.src = url;
  });
}

/**
 * Get the imageUrl from the first step if it exists
 */
function getFirstStepImageUrl(steps: QuizStep[]): string | undefined {
  if (steps.length === 0) return undefined;
  const firstStep = steps[0];
  if (firstStep.kind === 'info' && firstStep.imageUrl) {
    return firstStep.imageUrl;
  }
  return undefined;
}

// =============================================================================
// HOOK
// =============================================================================

interface UseQuizCMSOptions {
  slug: string;
  fallbackSteps?: QuizStep[]; // Optional fallback to hardcoded steps
}

interface UseQuizCMSReturn {
  quiz: QuizWithSteps | null;
  steps: QuizStep[];
  isLoading: boolean;
  error: string | null;
  isUsingFallback: boolean;
}

/**
 * Hook to load quiz data from CMS
 * 
 * Waits for CMS data AND first step image to load before rendering.
 * Falls back to hardcoded steps only if CMS fails.
 * 
 * Usage:
 * ```tsx
 * const { steps, isLoading, isUsingFallback } = useQuizCMS({ 
 *   slug: 'content-creator',
 *   fallbackSteps: HARDCODED_QUIZ_STEPS 
 * });
 * ```
 */
export function useQuizCMS({ slug, fallbackSteps }: UseQuizCMSOptions): UseQuizCMSReturn {
  const hasFallback = !!(fallbackSteps && fallbackSteps.length > 0);
  const [quiz, setQuiz] = useState<QuizWithSteps | null>(null);
  const [steps, setSteps] = useState<QuizStep[]>([]);
  // Always start loading - wait for CMS + image before showing content
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const fetchQuiz = useCallback(async () => {
    console.log(`[useQuizCMS] 🚀 Starting fetch for slug: "${slug}"`);
    try {
      setError(null);

      const response = await fetch(`/api/quizzes/${slug}`);
      console.log(`[useQuizCMS] 📡 Response status: ${response.status}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Quiz not found');
        }
        throw new Error('Failed to fetch quiz');
      }

      const quizData: QuizWithSteps = await response.json();
      console.log(`[useQuizCMS] ✅ Loaded quiz: "${quizData.title}" with ${quizData.steps.length} steps`);
      
      // Log a sample step to verify data
      const sampleInfoStep = quizData.steps.find(s => s.type === 'info_prompt');
      if (sampleInfoStep) {
        console.log(`[useQuizCMS] 📋 Sample info step:`, {
          title: sampleInfoStep.title?.substring(0, 40),
          imageUrl: sampleInfoStep.imageUrl,
          subtitle: sampleInfoStep.subtitle?.substring(0, 40),
        });
      }
      
      // Convert CMS steps to internal format
      const convertedSteps = quizData.steps.map(convertCMSStepToInternal);
      console.log(`[useQuizCMS] 🔄 Converted ${convertedSteps.length} steps to internal format`);
      
      // Log converted info step
      const convertedInfoStep = convertedSteps.find(s => s.kind === 'info') as InfoStep | undefined;
      if (convertedInfoStep) {
        console.log(`[useQuizCMS] 📋 Converted info step:`, {
          title: convertedInfoStep.title?.substring(0, 40),
          imageUrl: convertedInfoStep.imageUrl,
          subtitle: convertedInfoStep.subtitle?.substring(0, 40),
        });
      }
      
      // Preload the first step's image BEFORE showing content
      // This ensures the image appears instantly when content renders
      const firstStepImageUrl = getFirstStepImageUrl(convertedSteps);
      if (firstStepImageUrl) {
        console.log(`[useQuizCMS] 🖼️ Preloading first step image...`);
        await preloadImage(firstStepImageUrl);
      }
      
      setQuiz(quizData);
      setSteps(convertedSteps);
      setIsUsingFallback(false);
      console.log(`[useQuizCMS] ✅ CMS data + image loaded successfully`);
    } catch (err) {
      console.warn(`[useQuizCMS] ❌ Failed to load quiz "${slug}":`, err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
      
      // Fall back to hardcoded steps if CMS fails
      if (hasFallback && fallbackSteps) {
        console.log(`[useQuizCMS] ⚠️ Using FALLBACK steps for "${slug}" (${fallbackSteps.length} steps)`);
        setSteps(fallbackSteps);
        setIsUsingFallback(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [slug, fallbackSteps, hasFallback]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  return {
    quiz,
    steps,
    isLoading,
    error,
    isUsingFallback,
  };
}

export default useQuizCMS;

