/**
 * Public API: Get Questionnaire by Slug
 *
 * GET /api/questionnaires/[slug] - Get a questionnaire for client form (requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';
import type { Questionnaire } from '@/types/questionnaire';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Require authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get organizationId from request headers (set by middleware based on domain)
    const organizationId = request.headers.get('x-organization-id');
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Find questionnaire by slug and organization
    const snapshot = await adminDb
      .collection('questionnaires')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    const data = doc.data() as Questionnaire;

    // Check if questionnaire is active
    if (!data.isActive) {
      return NextResponse.json(
        { error: 'This questionnaire is no longer accepting responses' },
        { status: 403 }
      );
    }

    // Check if user has already submitted (if multiple responses not allowed)
    if (!data.allowMultipleResponses) {
      const existingResponse = await adminDb
        .collection('questionnaire_responses')
        .where('questionnaireId', '==', doc.id)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!existingResponse.empty) {
        return NextResponse.json(
          {
            error: 'You have already submitted a response to this questionnaire',
            alreadySubmitted: true,
          },
          { status: 403 }
        );
      }
    }

    // Return questionnaire data (without sensitive fields)
    return NextResponse.json({
      id: doc.id,
      slug: data.slug,
      title: data.title,
      description: data.description,
      questions: data.questions,
      coverImageUrl: data.coverImageUrl,
      accentColor: data.accentColor,
      allowMultipleResponses: data.allowMultipleResponses,
    });
  } catch (error) {
    console.error('[QUESTIONNAIRE_GET_BY_SLUG] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch questionnaire' }, { status: 500 });
  }
}
