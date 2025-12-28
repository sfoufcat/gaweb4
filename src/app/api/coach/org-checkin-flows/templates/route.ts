import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { CheckInFlowTemplate } from '@/types';

/**
 * GET /api/coach/org-checkin-flows/templates
 * Get all available check-in flow templates
 */
export async function GET() {
  try {
    await requireCoachWithOrg();

    const templatesSnapshot = await adminDb
      .collection('checkInFlowTemplates')
      .orderBy('key', 'asc')
      .get();

    const templates = templatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CheckInFlowTemplate[];

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[COACH_CHECKIN_TEMPLATES_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}





