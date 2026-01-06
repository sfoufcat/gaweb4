import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { withDemoMode, demoNotAvailable, isDemoRequest } from '@/lib/demo-api';
import type { OrgBranding, OrgEnrollmentRules } from '@/types';
import { DEFAULT_ENROLLMENT_RULES } from '@/types';

/**
 * GET /api/coach/branding/enrollment-rules
 * Get enrollment rules for the coach's organization
 */
export async function GET() {
  try {
    // Demo mode: return default rules
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return NextResponse.json({ rules: DEFAULT_ENROLLMENT_RULES });
    }
    
    const { organizationId } = await requireCoachWithOrg();

    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    
    if (!brandingDoc.exists) {
      return NextResponse.json({ rules: DEFAULT_ENROLLMENT_RULES });
    }

    const branding = brandingDoc.data() as OrgBranding;
    
    return NextResponse.json({
      rules: branding.enrollmentRules || DEFAULT_ENROLLMENT_RULES,
    });
  } catch (error) {
    console.error('[ENROLLMENT_RULES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch enrollment rules';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/coach/branding/enrollment-rules
 * Update enrollment rules for the coach's organization
 */
export async function PUT(request: NextRequest) {
  try {
    // Demo mode: block write operations
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoNotAvailable('Updating enrollment rules');
    }
    
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { rules } = body as { rules: OrgEnrollmentRules };

    // Validate the rules object
    if (!rules || typeof rules !== 'object') {
      return NextResponse.json(
        { error: 'rules must be an object' },
        { status: 400 }
      );
    }

    // Validate each rule is a boolean
    const ruleKeys: (keyof OrgEnrollmentRules)[] = [
      'allowCohortWithCohort',
      'allowCohortWithEvergreen',
      'allowEvergreenWithEvergreen',
      'allowIndividualWithCohort',
      'allowIndividualWithEvergreen',
      'allowIndividualWithIndividual',
    ];

    for (const key of ruleKeys) {
      if (typeof rules[key] !== 'boolean') {
        return NextResponse.json(
          { error: `${key} must be a boolean` },
          { status: 400 }
        );
      }
    }

    // Update org branding with new enrollment rules
    const brandingRef = adminDb.collection('org_branding').doc(organizationId);
    const now = new Date().toISOString();
    
    await brandingRef.set(
      { 
        enrollmentRules: rules,
        updatedAt: now,
      },
      { merge: true }
    );

    console.log(`[ENROLLMENT_RULES_PUT] Updated enrollment rules for org ${organizationId}:`, rules);

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error) {
    console.error('[ENROLLMENT_RULES_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update enrollment rules';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
