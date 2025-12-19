/**
 * Admin API: Quizzes Management
 * 
 * GET /api/admin/quizzes - List all quizzes
 * POST /api/admin/quizzes - Create new quiz
 * 
 * Admin and Editor roles can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { Quiz, QuizCreateRequest } from '@/types';

export async function GET() {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const quizzesSnapshot = await adminDb
      .collection('quizzes')
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
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      };
    });

    return NextResponse.json({ quizzes });
  } catch (error) {
    console.error('[ADMIN_QUIZZES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quizzes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body: QuizCreateRequest = await request.json();
    
    // Validate required fields
    if (!body.slug || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: slug and title are required' },
        { status: 400 }
      );
    }

    // Check if quiz with this slug already exists
    const existingQuiz = await adminDb
      .collection('quizzes')
      .where('slug', '==', body.slug)
      .limit(1)
      .get();

    if (!existingQuiz.empty) {
      return NextResponse.json(
        { error: `Quiz with slug "${body.slug}" already exists` },
        { status: 400 }
      );
    }

    const quizData = {
      slug: body.slug,
      title: body.title,
      trackId: body.trackId || null,
      isActive: body.isActive ?? true,
      stepCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('quizzes').add(quizData);

    console.log(`[ADMIN_QUIZZES_POST] Created quiz: ${body.slug} (${docRef.id})`);

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
    console.error('[ADMIN_QUIZZES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create quiz' },
      { status: 500 }
    );
  }
}

