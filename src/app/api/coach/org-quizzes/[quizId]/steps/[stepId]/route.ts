/**
 * Coach API: Single Quiz Step Management (Organization-scoped)
 * 
 * GET /api/coach/org-quizzes/:quizId/steps/:stepId - Get single step with options
 * PUT /api/coach/org-quizzes/:quizId/steps/:stepId - Update step
 * DELETE /api/coach/org-quizzes/:quizId/steps/:stepId - Delete step
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; stepId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { quizId, stepId } = await params;

    // Verify quiz belongs to organization
    const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
    if (!quizDoc.exists || quizDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Quiz not found in your organization' }, { status: 404 });
    }

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

    // Fetch options
    const optionsSnapshot = await stepDoc.ref.collection('options').orderBy('order', 'asc').get();
    const options = optionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({
      id: stepDoc.id,
      quizId,
      ...stepData,
      options,
      createdAt: stepData.createdAt?.toDate?.()?.toISOString?.() || stepData.createdAt,
      updatedAt: stepData.updatedAt?.toDate?.()?.toISOString?.() || stepData.updatedAt,
    });
  } catch (error) {
    console.error('[COACH_ORG_QUIZ_STEP_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch step' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; stepId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { quizId, stepId } = await params;
    const body = await request.json();

    // Verify quiz belongs to organization
    const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
    if (!quizDoc.exists || quizDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Quiz not found in your organization' }, { status: 404 });
    }

    const stepRef = adminDb.collection('quizzes').doc(quizId).collection('steps').doc(stepId);
    const stepDoc = await stepRef.get();

    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Update provided fields
    const allowedFields = [
      'order', 'type', 'title', 'subtitle', 'description', 'imageUrl',
      'statement', 'statementImageUrl', 'dataKey', 'isRequired', 'isSkippable',
      'ctaLabel', 'illustrationKey', 'chartLabel1', 'chartLabel2', 'chartEmoji1', 'chartEmoji2',
      'isGoalQuestion', 'isStartingPointQuestion', 'showConfirmation',
      'confirmationTitle', 'confirmationSubtitle'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    await stepRef.update(updateData);

    // Update options if provided
    if (body.options && Array.isArray(body.options)) {
      // Delete existing options
      const existingOptions = await stepRef.collection('options').get();
      const batch = adminDb.batch();
      existingOptions.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // Create new options
      for (let i = 0; i < body.options.length; i++) {
        const option = body.options[i];
        await stepRef.collection('options').add({
          order: option.order ?? (i + 1),
          label: option.label,
          emoji: option.emoji,
          value: option.value,
          helperText: option.helperText,
          imageUrl: option.imageUrl,
          isDefault: option.isDefault ?? false,
          confirmationTitle: option.confirmationTitle,
          confirmationSubtitle: option.confirmationSubtitle,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    console.log(`[COACH_ORG_QUIZ_STEP_PUT] Updated step: ${stepId}`);

    return NextResponse.json({ success: true, message: 'Step updated successfully' });
  } catch (error) {
    console.error('[COACH_ORG_QUIZ_STEP_PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; stepId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { quizId, stepId } = await params;

    // Verify quiz belongs to organization
    const quizRef = adminDb.collection('quizzes').doc(quizId);
    const quizDoc = await quizRef.get();
    if (!quizDoc.exists || quizDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Quiz not found in your organization' }, { status: 404 });
    }

    const stepRef = quizRef.collection('steps').doc(stepId);
    const stepDoc = await stepRef.get();

    if (!stepDoc.exists) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    // Delete all options for this step
    const optionsSnapshot = await stepRef.collection('options').get();
    const batch = adminDb.batch();
    optionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(stepRef);
    await batch.commit();

    // Update quiz step count
    const currentStepCount = quizDoc.data()?.stepCount || 0;
    await quizRef.update({
      stepCount: Math.max(0, currentStepCount - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COACH_ORG_QUIZ_STEP_DELETE] Deleted step: ${stepId}`);

    return NextResponse.json({ success: true, message: 'Step deleted successfully' });
  } catch (error) {
    console.error('[COACH_ORG_QUIZ_STEP_DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete step' }, { status: 500 });
  }
}
