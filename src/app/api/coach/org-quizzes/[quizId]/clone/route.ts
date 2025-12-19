/**
 * Coach API: Clone Quiz (Organization-scoped)
 * 
 * POST /api/coach/org-quizzes/:quizId/clone - Clone quiz with all steps and options
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { quizId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.slug || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: slug and title are required' },
        { status: 400 }
      );
    }

    // Get source quiz
    const sourceQuizDoc = await adminDb.collection('quizzes').doc(quizId).get();
    if (!sourceQuizDoc.exists) {
      return NextResponse.json({ error: 'Source quiz not found' }, { status: 404 });
    }

    // Verify source quiz belongs to organization
    if (sourceQuizDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Source quiz not found in your organization' }, { status: 404 });
    }

    // Check if slug already exists in organization
    const existingQuiz = await adminDb
      .collection('quizzes')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', body.slug)
      .limit(1)
      .get();

    if (!existingQuiz.empty) {
      return NextResponse.json(
        { error: `Quiz with slug "${body.slug}" already exists in your organization` },
        { status: 400 }
      );
    }

    const sourceData = sourceQuizDoc.data()!;

    // Create new quiz
    const newQuizData = {
      slug: body.slug,
      title: body.title,
      trackId: body.trackId ?? sourceData.trackId,
      isActive: false, // New clones start inactive
      stepCount: sourceData.stepCount || 0,
      organizationId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const newQuizRef = await adminDb.collection('quizzes').add(newQuizData);

    // Clone all steps and options
    const stepsSnapshot = await adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    for (const stepDoc of stepsSnapshot.docs) {
      const stepData = stepDoc.data();
      
      // Create new step (without id and timestamps)
      const newStepData = {
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const newStepRef = await newQuizRef.collection('steps').add(newStepData);

      // Clone options for this step
      const optionsSnapshot = await stepDoc.ref.collection('options').orderBy('order', 'asc').get();
      
      for (const optionDoc of optionsSnapshot.docs) {
        const optionData = optionDoc.data();
        await newStepRef.collection('options').add({
          order: optionData.order,
          label: optionData.label,
          emoji: optionData.emoji,
          value: optionData.value,
          helperText: optionData.helperText,
          imageUrl: optionData.imageUrl,
          isDefault: optionData.isDefault,
          confirmationTitle: optionData.confirmationTitle,
          confirmationSubtitle: optionData.confirmationSubtitle,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    console.log(`[COACH_ORG_QUIZ_CLONE] Cloned quiz ${quizId} to ${newQuizRef.id}`);

    return NextResponse.json({
      success: true,
      id: newQuizRef.id,
      message: 'Quiz cloned successfully',
    });
  } catch (error) {
    console.error('[COACH_ORG_QUIZ_CLONE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to clone quiz' }, { status: 500 });
  }
}
