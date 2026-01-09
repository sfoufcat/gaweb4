/**
 * Coach API: Individual Questionnaire Management
 *
 * GET /api/coach/questionnaires/[questionnaireId] - Get a specific questionnaire
 * PATCH /api/coach/questionnaires/[questionnaireId] - Update a questionnaire
 * DELETE /api/coach/questionnaires/[questionnaireId] - Delete a questionnaire
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { isDemoRequest, demoResponse, demoNotAvailable } from '@/lib/demo-api';
import type { UpdateQuestionnaireData } from '@/types/questionnaire';

interface RouteParams {
  params: Promise<{ questionnaireId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { questionnaireId } = await params;

    // Demo mode
    const isDemo = await isDemoRequest();
    if (isDemo) {
      // Return a demo questionnaire
      return demoResponse({
        id: questionnaireId,
        organizationId: 'demo-org',
        slug: 'demo-form',
        title: 'Demo Questionnaire',
        description: 'This is a demo questionnaire.',
        questions: [],
        isActive: true,
        allowMultipleResponses: false,
        requireAuth: true,
        responseCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'demo-coach',
      });
    }

    const { organizationId } = await requireCoachWithOrg();

    const docRef = adminDb.collection('questionnaires').doc(questionnaireId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    const data = doc.data()!;

    // Verify organization ownership
    if (data.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
    });
  } catch (error) {
    console.error('[COACH_QUESTIONNAIRE_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch questionnaire' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { questionnaireId } = await params;

    // Demo mode: block write operations
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoNotAvailable('Updating questionnaires');
    }

    const { organizationId } = await requireCoachWithOrg();

    const docRef = adminDb.collection('questionnaires').doc(questionnaireId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    const existingData = doc.data()!;

    // Verify organization ownership
    if (existingData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    const body = (await request.json()) as UpdateQuestionnaireData;

    // If slug is being changed, check uniqueness
    if (body.slug && body.slug !== existingData.slug) {
      const existingSlug = await adminDb
        .collection('questionnaires')
        .where('organizationId', '==', organizationId)
        .where('slug', '==', body.slug)
        .limit(1)
        .get();

      if (!existingSlug.empty && existingSlug.docs[0].id !== questionnaireId) {
        return NextResponse.json(
          { error: 'A questionnaire with this slug already exists' },
          { status: 400 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Allowed fields to update
    const allowedFields: (keyof UpdateQuestionnaireData)[] = [
      'slug',
      'title',
      'description',
      'questions',
      'isActive',
      'allowMultipleResponses',
      'coverImageUrl',
      'accentColor',
      'responseCount',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    await docRef.update(updateData);

    console.log(`[COACH_QUESTIONNAIRE] Updated questionnaire ${questionnaireId}`);

    // Fetch updated document
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data()!;

    return NextResponse.json({
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate?.()?.toISOString?.() || updatedData.createdAt,
      updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString?.() || updatedData.updatedAt,
    });
  } catch (error) {
    console.error('[COACH_QUESTIONNAIRE_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update questionnaire' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { questionnaireId } = await params;

    // Demo mode: block write operations
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoNotAvailable('Deleting questionnaires');
    }

    const { organizationId } = await requireCoachWithOrg();

    const docRef = adminDb.collection('questionnaires').doc(questionnaireId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    const data = doc.data()!;

    // Verify organization ownership
    if (data.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    // Delete the questionnaire
    await docRef.delete();

    // Also delete all associated responses
    const responsesSnapshot = await adminDb
      .collection('questionnaire_responses')
      .where('questionnaireId', '==', questionnaireId)
      .get();

    const batch = adminDb.batch();
    responsesSnapshot.docs.forEach(responseDoc => {
      batch.delete(responseDoc.ref);
    });
    await batch.commit();

    console.log(
      `[COACH_QUESTIONNAIRE] Deleted questionnaire ${questionnaireId} and ${responsesSnapshot.size} responses`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_QUESTIONNAIRE_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to delete questionnaire' }, { status: 500 });
  }
}
