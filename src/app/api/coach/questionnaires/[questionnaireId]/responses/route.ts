/**
 * Coach API: Questionnaire Responses
 *
 * GET /api/coach/questionnaires/[questionnaireId]/responses - List responses for a questionnaire
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { FieldValue } from 'firebase-admin/firestore';
import type { QuestionnaireResponse, Questionnaire } from '@/types/questionnaire';

interface RouteParams {
  params: Promise<{ questionnaireId: string }>;
}

// Demo responses data
function generateDemoResponses(questionnaireId: string): QuestionnaireResponse[] {
  return [
    {
      id: 'demo-response-1',
      questionnaireId,
      organizationId: 'demo-org',
      userId: 'demo-user-1',
      userEmail: 'alice@example.com',
      userName: 'Alice Johnson',
      userAvatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      answers: [
        { questionId: 'q1', questionType: 'short_text', value: 'Grow my consulting business' },
        { questionId: 'q2', questionType: 'single_choice', value: 'referral' },
        { questionId: 'q3', questionType: 'scale', value: 9 },
      ],
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      completionTimeMs: 180000,
    },
    {
      id: 'demo-response-2',
      questionnaireId,
      organizationId: 'demo-org',
      userId: 'demo-user-2',
      userEmail: 'bob@example.com',
      userName: 'Bob Smith',
      userAvatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
      answers: [
        { questionId: 'q1', questionType: 'short_text', value: 'Improve work-life balance' },
        { questionId: 'q2', questionType: 'single_choice', value: 'social_media' },
        { questionId: 'q3', questionType: 'scale', value: 7 },
      ],
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      completionTimeMs: 240000,
    },
    {
      id: 'demo-response-3',
      questionnaireId,
      organizationId: 'demo-org',
      userId: 'demo-user-3',
      userEmail: 'carol@example.com',
      userName: 'Carol Davis',
      userAvatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol',
      answers: [
        { questionId: 'q1', questionType: 'short_text', value: 'Launch my first product' },
        { questionId: 'q2', questionType: 'single_choice', value: 'search' },
        { questionId: 'q3', questionType: 'scale', value: 10 },
      ],
      submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      completionTimeMs: 120000,
    },
  ];
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { questionnaireId } = await params;

    // Parse query params
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Demo mode
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const responses = generateDemoResponses(questionnaireId);
      return demoResponse({
        responses: responses.slice(offset, offset + limit),
        totalCount: responses.length,
        questionnaire: {
          id: questionnaireId,
          title: 'Demo Questionnaire',
          questions: [
            {
              id: 'q1',
              type: 'short_text',
              title: 'What is your primary goal?',
              required: true,
              order: 0,
            },
            {
              id: 'q2',
              type: 'single_choice',
              title: 'How did you hear about us?',
              required: true,
              order: 1,
              options: [
                { id: 'o1', label: 'Social Media', value: 'social_media', order: 0 },
                { id: 'o2', label: 'Referral', value: 'referral', order: 1 },
                { id: 'o3', label: 'Search', value: 'search', order: 2 },
              ],
            },
            {
              id: 'q3',
              type: 'scale',
              title: 'How motivated are you?',
              required: true,
              order: 2,
              minValue: 1,
              maxValue: 10,
            },
          ],
        },
      });
    }

    const { organizationId } = await requireCoachWithOrg();

    // First, verify the questionnaire exists and belongs to this organization
    const questionnaireDoc = await adminDb.collection('questionnaires').doc(questionnaireId).get();

    if (!questionnaireDoc.exists) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    const questionnaireData = questionnaireDoc.data() as Questionnaire;

    if (questionnaireData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    // Fetch responses
    const responsesSnapshot = await adminDb
      .collection('questionnaire_responses')
      .where('questionnaireId', '==', questionnaireId)
      .orderBy('submittedAt', 'desc')
      .limit(limit)
      .offset(offset)
      .get();

    // Get total count
    const countSnapshot = await adminDb
      .collection('questionnaire_responses')
      .where('questionnaireId', '==', questionnaireId)
      .count()
      .get();

    const totalCount = countSnapshot.data().count;

    const responses = responsesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() || data.submittedAt,
      };
    });

    // Update lastViewedAt to mark all responses as viewed (reset badge)
    await adminDb.collection('questionnaires').doc(questionnaireId).update({
      lastViewedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      responses,
      totalCount,
      questionnaire: {
        id: questionnaireDoc.id,
        title: questionnaireData.title,
        questions: questionnaireData.questions,
      },
    });
  } catch (error) {
    console.error('[COACH_QUESTIONNAIRE_RESPONSES] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
  }
}
