/**
 * Coach API: Single Quiz Management (Organization-scoped)
 * 
 * GET /api/coach/org-quizzes/:quizId - Get quiz with all steps and options
 * PUT /api/coach/org-quizzes/:quizId - Update quiz
 * DELETE /api/coach/org-quizzes/:quizId - Delete quiz
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { Quiz, QuizStep, QuizOption, QuizWithSteps, QuizStepWithOptions } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { quizId } = await params;

    const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();

    if (!quizDoc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const quizData = quizDoc.data()!;
    
    // Verify quiz belongs to coach's organization
    if (quizData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Quiz not found in your organization' }, { status: 404 });
    }
    
    const quiz: Quiz = {
      id: quizDoc.id,
      slug: quizData.slug,
      title: quizData.title,
      trackId: quizData.trackId || null,
      isActive: quizData.isActive ?? true,
      stepCount: quizData.stepCount || 0,
      createdAt: quizData.createdAt?.toDate?.()?.toISOString?.() || quizData.createdAt,
      updatedAt: quizData.updatedAt?.toDate?.()?.toISOString?.() || quizData.updatedAt,
    };

    // Fetch all steps for this quiz
    const stepsSnapshot = await adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    const stepsWithOptions: QuizStepWithOptions[] = [];

    for (const stepDoc of stepsSnapshot.docs) {
      const stepData = stepDoc.data();
      
      const step: QuizStep = {
        id: stepDoc.id,
        quizId: quizId,
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
        .doc(quizId)
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

      stepsWithOptions.push({ ...step, options });
    }

    const quizWithSteps: QuizWithSteps = {
      ...quiz,
      steps: stepsWithOptions,
    };

    return NextResponse.json(quizWithSteps);
  } catch (error) {
    console.error('[COACH_ORG_QUIZ_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { quizId } = await params;
    const body = await request.json();

    const quizRef = adminDb.collection('quizzes').doc(quizId);
    const quizDoc = await quizRef.get();

    if (!quizDoc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Verify quiz belongs to coach's organization
    if (quizDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Quiz not found in your organization' }, { status: 404 });
    }

    // If changing slug, check it doesn't conflict within organization
    if (body.slug && body.slug !== quizDoc.data()?.slug) {
      const existingQuiz = await adminDb
        .collection('quizzes')
        .where('organizationId', '==', organizationId)
        .where('slug', '==', body.slug)
        .limit(1)
        .get();

      if (!existingQuiz.empty && existingQuiz.docs[0].id !== quizId) {
        return NextResponse.json(
          { error: `Quiz with slug "${body.slug}" already exists in your organization` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.trackId !== undefined) updateData.trackId = body.trackId;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    await quizRef.update(updateData);

    console.log(`[COACH_ORG_QUIZ_PUT] Updated quiz: ${quizId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Quiz updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_QUIZ_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to update quiz' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { quizId } = await params;

    const quizRef = adminDb.collection('quizzes').doc(quizId);
    const quizDoc = await quizRef.get();

    if (!quizDoc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Verify quiz belongs to coach's organization
    if (quizDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Quiz not found in your organization' }, { status: 404 });
    }

    // Delete all steps and their options first
    const stepsSnapshot = await quizRef.collection('steps').get();
    
    const batch = adminDb.batch();
    
    for (const stepDoc of stepsSnapshot.docs) {
      const optionsSnapshot = await stepDoc.ref.collection('options').get();
      for (const optionDoc of optionsSnapshot.docs) {
        batch.delete(optionDoc.ref);
      }
      batch.delete(stepDoc.ref);
    }
    
    batch.delete(quizRef);
    await batch.commit();

    console.log(`[COACH_ORG_QUIZ_DELETE] Deleted quiz: ${quizId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Quiz deleted successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_QUIZ_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 });
  }
}
