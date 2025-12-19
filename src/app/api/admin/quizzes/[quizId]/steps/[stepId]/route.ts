/**
 * Admin API: Single Quiz Step Management
 * 
 * GET /api/admin/quizzes/:quizId/steps/:stepId - Get step with options
 * PUT /api/admin/quizzes/:quizId/steps/:stepId - Update step (including options)
 * DELETE /api/admin/quizzes/:quizId/steps/:stepId - Delete step
 * 
 * Admin and Editor roles can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection, isAdmin } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { QuizStep, QuizOption, QuizStepWithOptions, QuizOptionCreateRequest, ClerkPublicMetadata } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; stepId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { quizId, stepId } = await params;

    const stepDoc = await adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('steps')
      .doc(stepId)
      .get();

    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const stepData = stepDoc.data()!;
    
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

    // Fetch options
    const optionsSnapshot = await adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('steps')
      .doc(stepId)
      .collection('options')
      .orderBy('order', 'asc')
      .get();

    const options: QuizOption[] = optionsSnapshot.docs.map(optionDoc => {
      const optionData = optionDoc.data();
      return {
        id: optionDoc.id,
        quizStepId: stepId,
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

    const stepWithOptions: QuizStepWithOptions = { ...step, options };

    return NextResponse.json(stepWithOptions);
  } catch (error) {
    console.error('[ADMIN_QUIZ_STEP_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch step' },
      { status: 500 }
    );
  }
}

interface UpdateStepRequest {
  order?: number;
  type?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  statement?: string;
  statementImageUrl?: string;
  dataKey?: string;
  isRequired?: boolean;
  isSkippable?: boolean;
  ctaLabel?: string;
  illustrationKey?: string;
  chartLabel1?: string;
  chartLabel2?: string;
  chartEmoji1?: string;
  chartEmoji2?: string;
  isGoalQuestion?: boolean;
  isStartingPointQuestion?: boolean;
  showConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationSubtitle?: string;
  options?: QuizOptionCreateRequest[];
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; stepId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { quizId, stepId } = await params;
    const body: UpdateStepRequest = await request.json();

    const stepRef = adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('steps')
      .doc(stepId);

    const stepDoc = await stepRef.get();

    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    // Build update data - only include provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.order !== undefined) updateData.order = body.order;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.statement !== undefined) updateData.statement = body.statement;
    if (body.statementImageUrl !== undefined) updateData.statementImageUrl = body.statementImageUrl;
    if (body.dataKey !== undefined) updateData.dataKey = body.dataKey;
    if (body.isRequired !== undefined) updateData.isRequired = body.isRequired;
    if (body.isSkippable !== undefined) updateData.isSkippable = body.isSkippable;
    if (body.ctaLabel !== undefined) updateData.ctaLabel = body.ctaLabel;
    if (body.illustrationKey !== undefined) updateData.illustrationKey = body.illustrationKey;
    if (body.chartLabel1 !== undefined) updateData.chartLabel1 = body.chartLabel1;
    if (body.chartLabel2 !== undefined) updateData.chartLabel2 = body.chartLabel2;
    if (body.chartEmoji1 !== undefined) updateData.chartEmoji1 = body.chartEmoji1;
    if (body.chartEmoji2 !== undefined) updateData.chartEmoji2 = body.chartEmoji2;
    if (body.isGoalQuestion !== undefined) updateData.isGoalQuestion = body.isGoalQuestion;
    if (body.isStartingPointQuestion !== undefined) updateData.isStartingPointQuestion = body.isStartingPointQuestion;
    if (body.showConfirmation !== undefined) updateData.showConfirmation = body.showConfirmation;
    if (body.confirmationTitle !== undefined) updateData.confirmationTitle = body.confirmationTitle;
    if (body.confirmationSubtitle !== undefined) updateData.confirmationSubtitle = body.confirmationSubtitle;

    await stepRef.update(updateData);

    // If options are provided, replace all options
    if (body.options !== undefined) {
      // Delete existing options
      const existingOptions = await stepRef.collection('options').get();
      const batch = adminDb.batch();
      existingOptions.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // Add new options
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
          confirmationTitle: option.confirmationTitle || '',
          confirmationSubtitle: option.confirmationSubtitle || '',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        await stepRef.collection('options').add(optionData);
      }
    }

    // Update quiz updatedAt
    await adminDb.collection('quizzes').doc(quizId).update({
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[ADMIN_QUIZ_STEP_PUT] Updated step ${stepId} for quiz ${quizId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Step updated successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_QUIZ_STEP_PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update step' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; stepId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    // Only admin can delete steps
    if (!isAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { quizId, stepId } = await params;

    const stepRef = adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('steps')
      .doc(stepId);

    const stepDoc = await stepRef.get();

    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    // Delete all options first
    const optionsSnapshot = await stepRef.collection('options').get();
    const batch = adminDb.batch();
    optionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(stepRef);
    await batch.commit();

    // Update quiz step count
    const quizRef = adminDb.collection('quizzes').doc(quizId);
    const quizDoc = await quizRef.get();
    const currentStepCount = quizDoc.data()?.stepCount || 1;
    await quizRef.update({
      stepCount: Math.max(0, currentStepCount - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[ADMIN_QUIZ_STEP_DELETE] Deleted step ${stepId} from quiz ${quizId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Step deleted successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_QUIZ_STEP_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete step' },
      { status: 500 }
    );
  }
}

