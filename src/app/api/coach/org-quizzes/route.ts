/**
 * Coach API: Organization-scoped Quizzes Management
 * 
 * GET /api/coach/org-quizzes - List quizzes in coach's organization
 * POST /api/coach/org-quizzes - Create new quiz in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { Quiz, QuizCreateRequest } from '@/types';

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_QUIZZES] Fetching quizzes for organization: ${organizationId}`);

    const quizzesSnapshot = await adminDb
      .collection('quizzes')
      .where('organizationId', '==', organizationId)
      .orderBy('updatedAt', 'desc')
      .get();

    const quizzes: Quiz[] = quizzesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        slug: data.slug,
        title: data.title,
        trackId: data.trackId || null,
        isActive: data.isActive ?? true,
        stepCount: data.stepCount || 0,
        organizationId: data.organizationId,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      };
    });

    return NextResponse.json({ quizzes });
  } catch (error) {
    console.error('[COACH_ORG_QUIZZES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch quizzes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body: QuizCreateRequest = await request.json();
    
    // Validate required fields
    if (!body.slug || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: slug and title are required' },
        { status: 400 }
      );
    }

    // Check if quiz with this slug already exists in this organization
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

    const quizData = {
      slug: body.slug,
      title: body.title,
      trackId: body.trackId || null,
      isActive: body.isActive ?? true,
      stepCount: 0,
      organizationId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('quizzes').add(quizData);

    console.log(`[COACH_ORG_QUIZZES_POST] Created quiz: ${body.slug} (${docRef.id}) in organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      quiz: { 
        id: docRef.id, 
        ...quizData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: 'Quiz created successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_QUIZZES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 });
  }
}
