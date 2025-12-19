/**
 * Coach API: Quiz Steps Management (Organization-scoped)
 * 
 * GET /api/coach/org-quizzes/:quizId/steps - List all steps for a quiz
 * POST /api/coach/org-quizzes/:quizId/steps - Create new step
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { QuizStep, QuizStepCreateRequest, QuizStepWithOptions, QuizOption } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { quizId } = await params;

    // Verify quiz exists and belongs to organization
    const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
    if (!quizDoc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }
    if (quizDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Quiz not found in your organization' }, { status: 404 });
    }

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
        createdAt: stepData.createdAt?.toDate?.()?.toISOString?.() || stepData.createdAt,
        updatedAt: stepData.updatedAt?.toDate?.()?.toISOString?.() || stepData.updatedAt,
      };

      // Fetch options
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
          createdAt: optionData.createdAt?.toDate?.()?.toISOString?.() || optionData.createdAt,
          updatedAt: optionData.updatedAt?.toDate?.()?.toISOString?.() || optionData.updatedAt,
        };
      });

      stepsWithOptions.push({ ...step, options });
    }

    return NextResponse.json({ steps: stepsWithOptions });
  } catch (error) {
    console.error('[COACH_ORG_QUIZ_STEPS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { quizId } = await params;
    const body: QuizStepCreateRequest = await request.json();

    // Verify quiz exists and belongs to organization
    const quizRef = adminDb.collection('quizzes').doc(quizId);
    const quizDoc = await quizRef.get();
    if (!quizDoc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }
    if (quizDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Quiz not found in your organization' }, { status: 404 });
    }

    // Validate required fields
    if (!body.type || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: type and title are required' },
        { status: 400 }
      );
    }

    // Determine order - if not specified, add to end
    let order = body.order;
    if (order === undefined) {
      const lastStep = await adminDb
        .collection('quizzes')
        .doc(quizId)
        .collection('steps')
        .orderBy('order', 'desc')
        .limit(1)
        .get();
      
      order = lastStep.empty ? 1 : (lastStep.docs[0].data().order || 0) + 1;
    }

    const stepData = {
      order,
      type: body.type,
      title: body.title,
      subtitle: body.subtitle,
      description: body.description,
      imageUrl: body.imageUrl,
      statement: body.statement,
      statementImageUrl: body.statementImageUrl,
      dataKey: body.dataKey,
      isRequired: body.isRequired ?? true,
      isSkippable: body.isSkippable ?? false,
      ctaLabel: body.ctaLabel,
      illustrationKey: body.illustrationKey,
      chartLabel1: body.chartLabel1,
      chartLabel2: body.chartLabel2,
      chartEmoji1: body.chartEmoji1,
      chartEmoji2: body.chartEmoji2,
      isGoalQuestion: body.isGoalQuestion ?? false,
      isStartingPointQuestion: body.isStartingPointQuestion ?? false,
      showConfirmation: body.showConfirmation ?? false,
      confirmationTitle: body.confirmationTitle,
      confirmationSubtitle: body.confirmationSubtitle,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const stepRef = await quizRef.collection('steps').add(stepData);

    // Create options if provided
    if (body.options && body.options.length > 0) {
      for (let i = 0; i < body.options.length; i++) {
        const option = body.options[i];
        const optionData = {
          order: option.order ?? (i + 1),
          label: option.label,
          emoji: option.emoji,
          value: option.value,
          helperText: option.helperText,
          imageUrl: option.imageUrl,
          isDefault: option.isDefault ?? false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        await stepRef.collection('options').add(optionData);
      }
    }

    // Update quiz step count
    const currentStepCount = quizDoc.data()?.stepCount || 0;
    await quizRef.update({
      stepCount: currentStepCount + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COACH_ORG_QUIZ_STEPS_POST] Created step for quiz ${quizId}: ${stepRef.id}`);

    return NextResponse.json({ 
      success: true, 
      id: stepRef.id,
      message: 'Step created successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_QUIZ_STEPS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to create step' }, { status: 500 });
  }
}
