/**
 * Admin API: Single Quiz Management
 * 
 * GET /api/admin/quizzes/:quizId - Get quiz with all steps and options
 * PUT /api/admin/quizzes/:quizId - Update quiz
 * DELETE /api/admin/quizzes/:quizId - Delete quiz
 * 
 * Admin and Editor roles can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection, isAdmin } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { Quiz, QuizStep, QuizOption, QuizWithSteps, QuizStepWithOptions, ClerkPublicMetadata } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { quizId } = await params;

    const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();

    if (!quizDoc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const quizData = quizDoc.data()!;
    
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
        // Chart labels
        chartLabel1: stepData.chartLabel1,
        chartLabel2: stepData.chartLabel2,
        chartEmoji1: stepData.chartEmoji1,
        chartEmoji2: stepData.chartEmoji2,
        // Goal question fields
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
          // Per-option confirmation text for goal questions
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
    console.error('[ADMIN_QUIZ_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { quizId } = await params;
    const body = await request.json();

    const quizRef = adminDb.collection('quizzes').doc(quizId);
    const quizDoc = await quizRef.get();

    if (!quizDoc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // If changing slug, check it doesn't conflict
    if (body.slug && body.slug !== quizDoc.data()?.slug) {
      const existingQuiz = await adminDb
        .collection('quizzes')
        .where('slug', '==', body.slug)
        .limit(1)
        .get();

      if (!existingQuiz.empty && existingQuiz.docs[0].id !== quizId) {
        return NextResponse.json(
          { error: `Quiz with slug "${body.slug}" already exists` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only update provided fields
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.trackId !== undefined) updateData.trackId = body.trackId;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    await quizRef.update(updateData);

    console.log(`[ADMIN_QUIZ_PUT] Updated quiz: ${quizId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Quiz updated successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_QUIZ_PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update quiz' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    // Only admin can delete quizzes
    if (!isAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { quizId } = await params;

    const quizRef = adminDb.collection('quizzes').doc(quizId);
    const quizDoc = await quizRef.get();

    if (!quizDoc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Delete all steps and their options first
    const stepsSnapshot = await quizRef.collection('steps').get();
    
    const batch = adminDb.batch();
    
    for (const stepDoc of stepsSnapshot.docs) {
      // Delete all options for this step
      const optionsSnapshot = await stepDoc.ref.collection('options').get();
      for (const optionDoc of optionsSnapshot.docs) {
        batch.delete(optionDoc.ref);
      }
      batch.delete(stepDoc.ref);
    }
    
    // Delete the quiz itself
    batch.delete(quizRef);
    
    await batch.commit();

    console.log(`[ADMIN_QUIZ_DELETE] Deleted quiz: ${quizId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Quiz deleted successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_QUIZ_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete quiz' },
      { status: 500 }
    );
  }
}

