/**
 * Public API: Submit Questionnaire Response
 *
 * POST /api/questionnaires/submit - Submit a response to a questionnaire (requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth, currentUser } from '@clerk/nextjs/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { SubmitResponseData, Questionnaire, QuestionnaireQuestion } from '@/types/questionnaire';

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json()) as SubmitResponseData;

    // Validate required fields
    if (!body.questionnaireId) {
      return NextResponse.json({ error: 'questionnaireId is required' }, { status: 400 });
    }

    if (!body.answers || !Array.isArray(body.answers)) {
      return NextResponse.json({ error: 'answers array is required' }, { status: 400 });
    }

    // Fetch the questionnaire
    const questionnaireDoc = await adminDb
      .collection('questionnaires')
      .doc(body.questionnaireId)
      .get();

    if (!questionnaireDoc.exists) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    const questionnaire = questionnaireDoc.data() as Questionnaire;

    // Check if questionnaire is active
    if (!questionnaire.isActive) {
      return NextResponse.json(
        { error: 'This questionnaire is no longer accepting responses' },
        { status: 403 }
      );
    }

    // Check if user has already submitted (if multiple responses not allowed)
    if (!questionnaire.allowMultipleResponses) {
      const existingResponse = await adminDb
        .collection('questionnaire_responses')
        .where('questionnaireId', '==', body.questionnaireId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!existingResponse.empty) {
        return NextResponse.json(
          { error: 'You have already submitted a response to this questionnaire' },
          { status: 403 }
        );
      }
    }

    // Validate required questions are answered
    const questionMap = new Map<string, QuestionnaireQuestion>(
      questionnaire.questions.map(q => [q.id, q])
    );

    const answeredQuestionIds = new Set(body.answers.map(a => a.questionId));

    for (const question of questionnaire.questions) {
      if (question.required && !answeredQuestionIds.has(question.id)) {
        // Check if this question might have been skipped via skip logic
        // For now, we'll be lenient and only validate non-skipped required questions
        // Skip logic validation would need to trace through the flow
        const answer = body.answers.find(a => a.questionId === question.id);
        if (!answer || answer.value === null || answer.value === '' ||
            (Array.isArray(answer.value) && answer.value.length === 0)) {
          return NextResponse.json(
            { error: `Required question not answered: ${question.title}`, questionId: question.id },
            { status: 400 }
          );
        }
      }
    }

    // Validate answer types match question types
    for (const answer of body.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        // Skip answers for questions that don't exist (might be from an older version)
        continue;
      }

      // Type validation
      switch (question.type) {
        case 'single_choice':
          if (answer.value !== null && typeof answer.value !== 'string') {
            return NextResponse.json(
              { error: `Invalid answer type for single choice question: ${question.title}` },
              { status: 400 }
            );
          }
          break;
        case 'multi_choice':
          if (answer.value !== null && !Array.isArray(answer.value)) {
            return NextResponse.json(
              { error: `Invalid answer type for multi choice question: ${question.title}` },
              { status: 400 }
            );
          }
          break;
        case 'number':
        case 'scale':
          if (answer.value !== null && typeof answer.value !== 'number') {
            return NextResponse.json(
              { error: `Invalid answer type for number/scale question: ${question.title}` },
              { status: 400 }
            );
          }
          // Validate scale range
          if (question.type === 'scale' && typeof answer.value === 'number') {
            const min = question.minValue ?? 1;
            const max = question.maxValue ?? 5;
            if (answer.value < min || answer.value > max) {
              return NextResponse.json(
                { error: `Scale value must be between ${min} and ${max}` },
                { status: 400 }
              );
            }
          }
          break;
        case 'short_text':
        case 'long_text':
          if (answer.value !== null && typeof answer.value !== 'string') {
            return NextResponse.json(
              { error: `Invalid answer type for text question: ${question.title}` },
              { status: 400 }
            );
          }
          // Validate length
          if (typeof answer.value === 'string') {
            if (question.maxLength && answer.value.length > question.maxLength) {
              return NextResponse.json(
                { error: `Answer exceeds maximum length of ${question.maxLength} characters` },
                { status: 400 }
              );
            }
          }
          break;
        case 'file_upload':
        case 'media_upload':
          // File uploads should have fileUrls array
          if (answer.fileUrls && !Array.isArray(answer.fileUrls)) {
            return NextResponse.json(
              { error: `Invalid file URLs for upload question: ${question.title}` },
              { status: 400 }
            );
          }
          break;
      }
    }

    // Get user info for denormalization
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;
    const userName =
      user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.firstName || user?.username || userEmail?.split('@')[0];
    const userAvatarUrl = user?.imageUrl;

    // Create the response document
    const responseData = {
      questionnaireId: body.questionnaireId,
      organizationId: questionnaire.organizationId,
      userId,
      userEmail: userEmail || null,
      userName: userName || null,
      userAvatarUrl: userAvatarUrl || null,
      answers: body.answers,
      submittedAt: FieldValue.serverTimestamp(),
      completionTimeMs: body.completionTimeMs || null,
    };

    const responseRef = await adminDb.collection('questionnaire_responses').add(responseData);

    // Increment response count on questionnaire
    await questionnaireDoc.ref.update({
      responseCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(
      `[QUESTIONNAIRE_SUBMIT] Response ${responseRef.id} submitted by ${userId} for questionnaire ${body.questionnaireId}`
    );

    return NextResponse.json(
      {
        id: responseRef.id,
        message: 'Response submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[QUESTIONNAIRE_SUBMIT] Error:', error);
    return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 });
  }
}
