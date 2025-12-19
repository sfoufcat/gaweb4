/**
 * Public API: Get Quiz by Slug
 * 
 * GET /api/quizzes/:slug - Get quiz with all steps and options
 * 
 * This endpoint is public (no auth required) to support guest users
 * taking quizzes during the onboarding flow.
 * 
 * Performance optimizations:
 * - Parallel fetching of options for all steps (instead of sequential)
 * - Response caching for 5 minutes (quiz content rarely changes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Quiz, QuizStep, QuizOption, QuizWithSteps } from '@/types';

// Cache duration: 5 minutes for CDN, 1 minute stale-while-revalidate
const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    console.log(`[QUIZ_API] Fetching quiz with slug: "${slug}"`);
    
    if (!slug) {
      console.log('[QUIZ_API] No slug provided');
      return NextResponse.json({ error: 'Quiz slug is required' }, { status: 400 });
    }

    // Fetch quiz by slug directly (more efficient than fetching all)
    const quizzesSnapshot = await adminDb
      .collection('quizzes')
      .where('slug', '==', slug)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (quizzesSnapshot.empty) {
      console.log(`[QUIZ_API] No active quiz found with slug "${slug}"`);
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const quizDoc = quizzesSnapshot.docs[0];
    const quizData = quizDoc.data();
    console.log(`[QUIZ_API] Found quiz: "${quizData.title}"`);
    
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

    // PARALLEL: Fetch options for ALL steps at once (instead of sequential loop)
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
        // Goal question and confirmation fields
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

    // Return with cache headers for faster subsequent loads
    return NextResponse.json(quizWithSteps, {
      headers: {
        'Cache-Control': CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error('[QUIZ_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz' },
      { status: 500 }
    );
  }
}

