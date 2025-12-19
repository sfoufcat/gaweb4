/**
 * Admin API: Clone Quiz
 * 
 * POST /api/admin/quizzes/:quizId/clone - Clone an existing quiz
 * 
 * Creates a new quiz with all steps and options copied from the source.
 * Useful for creating track-specific quizzes based on the Content Creator template.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserTrack } from '@/types';

interface CloneRequest {
  slug: string;
  title: string;
  trackId?: UserTrack | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { quizId } = await params;
    const body: CloneRequest = await request.json();
    
    // Validate required fields
    if (!body.slug || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: slug and title are required' },
        { status: 400 }
      );
    }

    // Check if source quiz exists
    const sourceQuizDoc = await adminDb.collection('quizzes').doc(quizId).get();

    if (!sourceQuizDoc.exists) {
      return NextResponse.json({ error: 'Source quiz not found' }, { status: 404 });
    }

    // Check if target slug already exists
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

    const sourceQuizData = sourceQuizDoc.data()!;

    // Create the new quiz
    const newQuizData = {
      slug: body.slug,
      title: body.title,
      trackId: body.trackId ?? sourceQuizData.trackId ?? null,
      isActive: false, // Start as inactive so it can be edited before going live
      stepCount: sourceQuizData.stepCount || 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const newQuizRef = await adminDb.collection('quizzes').add(newQuizData);
    const newQuizId = newQuizRef.id;

    // Fetch all steps from source quiz
    const stepsSnapshot = await adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    // Clone each step and its options
    for (const stepDoc of stepsSnapshot.docs) {
      const stepData = stepDoc.data();
      
      // Create new step (without id, timestamps)
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const newStepRef = await adminDb
        .collection('quizzes')
        .doc(newQuizId)
        .collection('steps')
        .add(newStepData);

      // Fetch and clone options for this step
      const optionsSnapshot = await adminDb
        .collection('quizzes')
        .doc(quizId)
        .collection('steps')
        .doc(stepDoc.id)
        .collection('options')
        .orderBy('order', 'asc')
        .get();

      for (const optionDoc of optionsSnapshot.docs) {
        const optionData = optionDoc.data();
        
        const newOptionData = {
          order: optionData.order,
          label: optionData.label,
          emoji: optionData.emoji,
          value: optionData.value,
          helperText: optionData.helperText,
          imageUrl: optionData.imageUrl,
          isDefault: optionData.isDefault,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        await newStepRef.collection('options').add(newOptionData);
      }
    }

    console.log(`[ADMIN_QUIZ_CLONE] Cloned quiz ${quizId} to ${newQuizId} (slug: ${body.slug})`);

    return NextResponse.json({ 
      success: true, 
      id: newQuizId,
      message: `Quiz cloned successfully. New quiz slug: ${body.slug}` 
    });
  } catch (error) {
    console.error('[ADMIN_QUIZ_CLONE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clone quiz' },
      { status: 500 }
    );
  }
}

