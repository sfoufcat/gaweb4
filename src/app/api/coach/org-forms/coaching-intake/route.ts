/**
 * Coach API: Organization-scoped Coaching Intake Forms
 * 
 * GET /api/coach/org-forms/coaching-intake - List coaching intake forms from users in coach's organization
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { CoachingIntakeForm } from '@/types';

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_COACHING_FORMS] Fetching coaching intake forms for organization: ${organizationId}`);

    // Fetch forms that belong to this organization
    const formsSnapshot = await adminDb
      .collection('coachingIntakeForms')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .get();

    const forms: CoachingIntakeForm[] = formsSnapshot.docs.map(doc => ({
      ...doc.data() as CoachingIntakeForm,
      id: doc.id,
    }));

    return NextResponse.json({
      success: true,
      forms,
      total: forms.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_COACHING_FORMS] Error:', error);
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
    
    return NextResponse.json({ error: 'Failed to fetch coaching intake forms' }, { status: 500 });
  }
}


