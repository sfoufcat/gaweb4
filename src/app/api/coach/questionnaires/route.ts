/**
 * Coach API: Questionnaires Management
 *
 * GET /api/coach/questionnaires - List questionnaires in coach's organization
 * POST /api/coach/questionnaires - Create new questionnaire in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { requirePlanLimit, isEntitlementError, getEntitlementErrorStatus } from '@/lib/billing/server-enforcement';
import { FieldValue } from 'firebase-admin/firestore';
import { isDemoRequest, demoResponse, demoNotAvailable } from '@/lib/demo-api';
import { nanoid } from 'nanoid';
import type { Questionnaire, CreateQuestionnaireData } from '@/types/questionnaire';

// Demo data for questionnaires
function generateDemoQuestionnaires(): Questionnaire[] {
  return [
    {
      id: 'demo-questionnaire-1',
      organizationId: 'demo-org',
      slug: 'client-intake',
      title: 'New Client Intake Form',
      description: 'Help us understand your goals and background.',
      questions: [
        {
          id: 'q1',
          type: 'short_text',
          title: 'What is your primary goal for coaching?',
          required: true,
          order: 0,
          placeholder: 'e.g., Grow my business, improve productivity',
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
            { id: 'o4', label: 'Other', value: 'other', order: 3 },
          ],
        },
        {
          id: 'q3',
          type: 'scale',
          title: 'How motivated are you to make changes?',
          required: true,
          order: 2,
          minValue: 1,
          maxValue: 10,
          scaleLabels: { min: 'Not very', max: 'Extremely' },
        },
      ],
      isActive: true,
      allowMultipleResponses: false,
      requireAuth: true,
      responseCount: 12,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'demo-coach',
    },
    {
      id: 'demo-questionnaire-2',
      organizationId: 'demo-org',
      slug: 'weekly-checkin',
      title: 'Weekly Progress Check-in',
      description: 'Share your wins and challenges from this week.',
      questions: [
        {
          id: 'q1',
          type: 'multi_choice',
          title: 'What areas did you make progress in this week?',
          required: true,
          order: 0,
          options: [
            { id: 'o1', label: 'Business Growth', value: 'business', order: 0 },
            { id: 'o2', label: 'Health & Fitness', value: 'health', order: 1 },
            { id: 'o3', label: 'Relationships', value: 'relationships', order: 2 },
            { id: 'o4', label: 'Personal Development', value: 'personal', order: 3 },
          ],
        },
        {
          id: 'q2',
          type: 'long_text',
          title: 'Describe your biggest win this week',
          required: false,
          order: 1,
          placeholder: 'Tell us about something you accomplished...',
        },
      ],
      isActive: true,
      allowMultipleResponses: true,
      requireAuth: true,
      responseCount: 45,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'demo-coach',
    },
  ];
}

export async function GET() {
  try {
    // Demo mode: return demo questionnaires
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const questionnaires = generateDemoQuestionnaires().map(q => ({
        ...q,
        newResponseCount: Math.floor(q.responseCount * 0.3), // Demo: 30% are "new"
      }));
      return demoResponse({
        questionnaires,
        totalCount: questionnaires.length,
      });
    }

    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_QUESTIONNAIRES_GET] Fetching questionnaires for organization: ${organizationId}`);

    const snapshot = await adminDb
      .collection('questionnaires')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .get();

    console.log(`[COACH_QUESTIONNAIRES_GET] Found ${snapshot.docs.length} questionnaires for org ${organizationId}`);

    // Calculate newResponseCount for each questionnaire
    const questionnaires = await Promise.all(
      snapshot.docs.map(async doc => {
        const data = doc.data();
        const lastViewedAt = data.lastViewedAt?.toDate?.() || data.lastViewedAt;
        const responseCount = data.responseCount || 0;

        let newResponseCount = responseCount; // Default: all responses are new

        if (lastViewedAt) {
          try {
            // Count responses submitted after lastViewedAt
            // Note: Requires composite index on questionnaire_responses (questionnaireId, submittedAt)
            const newResponsesSnapshot = await adminDb
              .collection('questionnaire_responses')
              .where('questionnaireId', '==', doc.id)
              .where('submittedAt', '>', lastViewedAt)
              .count()
              .get();
            newResponseCount = newResponsesSnapshot.data().count;
          } catch (indexError) {
            // Index may not exist yet - fall back to showing all as new
            console.warn(`[COACH_QUESTIONNAIRES_GET] Index error for ${doc.id}, showing all responses as new:`, indexError);
            newResponseCount = responseCount;
          }
        }

        return {
          id: doc.id,
          ...data,
          newResponseCount,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
          lastViewedAt: lastViewedAt?.toISOString?.() || lastViewedAt || null,
        };
      })
    );

    return NextResponse.json({
      questionnaires,
      totalCount: questionnaires.length,
    });
  } catch (error) {
    console.error('[COACH_QUESTIONNAIRES_GET] Error:', error);
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

    return NextResponse.json({ error: 'Failed to fetch questionnaires' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Demo mode: block write operations
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoNotAvailable('Creating questionnaires');
    }

    const { organizationId, userId } = await requireCoachWithOrg();

    // Enforce content item limit based on plan
    try {
      await requirePlanLimit(organizationId, 'maxContentItems');
    } catch (limitError) {
      if (isEntitlementError(limitError)) {
        return NextResponse.json(
          {
            error: 'Content item limit reached for your current plan',
            code: limitError.code,
            ...('currentCount' in limitError ? { currentCount: limitError.currentCount } : {}),
            ...('maxLimit' in limitError ? { maxLimit: limitError.maxLimit } : {}),
          },
          { status: getEntitlementErrorStatus(limitError) }
        );
      }
      throw limitError;
    }

    const body = (await request.json()) as CreateQuestionnaireData;

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Generate slug if not provided
    const slug = body.slug?.trim() || nanoid(8);

    // Check slug uniqueness within organization
    const existingSlug = await adminDb
      .collection('questionnaires')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!existingSlug.empty) {
      return NextResponse.json(
        { error: 'A questionnaire with this slug already exists' },
        { status: 400 }
      );
    }

    const questionnaireData = {
      slug,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      questions: body.questions || [],
      isActive: body.isActive ?? true,
      allowMultipleResponses: body.allowMultipleResponses ?? false,
      requireAuth: true, // Always require auth per requirements
      coverImageUrl: body.coverImageUrl || null,
      accentColor: body.accentColor || null,
      responseCount: 0,
      organizationId,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('questionnaires').add(questionnaireData);

    console.log(`[COACH_QUESTIONNAIRES_POST] Created questionnaire ${docRef.id} in organization ${organizationId}`);

    return NextResponse.json(
      {
        id: docRef.id,
        ...questionnaireData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[COACH_QUESTIONNAIRES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to create questionnaire' }, { status: 500 });
  }
}
