import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { requirePlanLimit, isEntitlementError, getEntitlementErrorStatus } from '@/lib/billing/server-enforcement';
import { withDemoMode, demoNotAvailable } from '@/lib/demo-api';
import type { Funnel, FunnelTargetType, FunnelContentType, FunnelTrackingConfig } from '@/types';

/**
 * GET /api/coach/org-funnels
 * Get all funnels for the coach's organization
 *
 * Query params:
 * - programId?: string (filter by program)
 * - squadId?: string (filter by squad) @deprecated Squad funnels disabled
 * - targetType?: 'program' | 'squad' | 'content' (filter by target type)
 *   @deprecated 'squad' - Squad funnels disabled. Squads now managed via Program > Community
 * - contentType?: string (filter by content type when targetType is 'content')
 * - contentId?: string (filter by content ID)
 */
export async function GET(req: Request) {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('org-funnels');
    if (demoData) return demoData;
    
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('programId');
    const squadId = searchParams.get('squadId');
    const targetType = searchParams.get('targetType') as FunnelTargetType | null;
    const contentType = searchParams.get('contentType') as FunnelContentType | null;
    const contentId = searchParams.get('contentId');

    // Build query
    let query = adminDb
      .collection('funnels')
      .where('organizationId', '==', organizationId);

    if (programId) {
      query = query.where('programId', '==', programId);
    }
    if (squadId) {
      query = query.where('squadId', '==', squadId);
    }
    if (targetType) {
      query = query.where('targetType', '==', targetType);
    }
    if (contentType) {
      query = query.where('contentType', '==', contentType);
    }
    if (contentId) {
      query = query.where('contentId', '==', contentId);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    const funnels = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Funnel[];

    return NextResponse.json({ funnels });
  } catch (error) {
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_FUNNELS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-funnels
 * Create a new funnel
 *
 * Body:
 * - name: string
 * - slug: string
 * - targetType: 'program' | 'squad' | 'content' (default: 'program')
 *   @deprecated 'squad' - Squad funnels disabled. Squads now managed via Program > Community
 * - programId?: string (required if targetType is 'program')
 * - squadId?: string (required if targetType is 'squad') @deprecated
 * - contentType?: string (required if targetType is 'content')
 * - contentId?: string (required if targetType is 'content')
 * - description?: string
 * - accessType?: 'public' | 'invite_only'
 * - isDefault?: boolean
 */
export async function POST(req: Request) {
  try {
    // Demo mode: block write operations
    const demoData = await withDemoMode('org-funnels');
    if (demoData) return demoNotAvailable('Creating funnels');
    
    const { organizationId } = await requireCoachWithOrg();
    
    // Enforce funnel limit based on plan
    try {
      await requirePlanLimit(organizationId, 'maxFunnelsPerTarget');
    } catch (limitError) {
      if (isEntitlementError(limitError)) {
        return NextResponse.json(
          { 
            error: 'Funnel limit reached for your current plan',
            code: limitError.code,
            ...('currentCount' in limitError ? { currentCount: limitError.currentCount } : {}),
            ...('maxLimit' in limitError ? { maxLimit: limitError.maxLimit } : {}),
          },
          { status: getEntitlementErrorStatus(limitError) }
        );
      }
      throw limitError;
    }

    const body = await req.json();
    const { 
      name, 
      slug, 
      targetType = 'program' as FunnelTargetType,
      programId, 
      squadId,
      contentType,
      contentId,
      description, 
      accessType = 'public', 
      isDefault = false,
      tracking,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!slug?.trim()) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    // Validate target type
    if (!['program', 'squad', 'content', 'intake'].includes(targetType)) {
      return NextResponse.json({ error: 'Invalid target type' }, { status: 400 });
    }

    // Validate target ID based on type
    if (targetType === 'program' && !programId) {
      return NextResponse.json({ error: 'Program ID is required' }, { status: 400 });
    }
    if (targetType === 'squad' && !squadId) {
      return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }
    if (targetType === 'intake' && !body.intakeConfigId) {
      return NextResponse.json({ error: 'Intake config ID is required' }, { status: 400 });
    }
    if (targetType === 'content') {
      if (!contentType) {
        return NextResponse.json({ error: 'Content type is required' }, { status: 400 });
      }
      if (!['article', 'course', 'event', 'download', 'link'].includes(contentType)) {
        return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
      }
      if (!contentId) {
        return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
      }
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug can only contain lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Get target ID and field for uniqueness check based on target type
    let targetId: string;
    let targetField: string;

    if (targetType === 'program') {
      targetId = programId;
      targetField = 'programId';
    } else if (targetType === 'squad') {
      targetId = squadId;
      targetField = 'squadId';
    } else if (targetType === 'intake') {
      targetId = body.intakeConfigId;
      targetField = 'intakeConfigId';
    } else {
      // For content, use contentId as the target
      targetId = contentId;
      targetField = 'contentId';
    }

    // Check slug uniqueness within target
    const existingSlug = await adminDb
      .collection('funnels')
      .where(targetField, '==', targetId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!existingSlug.empty) {
      return NextResponse.json(
        { error: `A funnel with this slug already exists for this ${targetType}` },
        { status: 400 }
      );
    }

    // Verify target belongs to this organization
    // Store program data for step creation logic
    let programData: FirebaseFirestore.DocumentData | undefined;

    if (targetType === 'program') {
      const programDoc = await adminDb.collection('programs').doc(programId).get();
      if (!programDoc.exists) {
        return NextResponse.json({ error: 'Program not found' }, { status: 404 });
      }
      programData = programDoc.data();
      if (programData?.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Program not in your organization' }, { status: 403 });
      }
    } else if (targetType === 'squad') {
      const squadDoc = await adminDb.collection('squads').doc(squadId).get();
      if (!squadDoc.exists) {
        return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
      }
      const squadData = squadDoc.data();
      if (squadData?.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Squad not in your organization' }, { status: 403 });
      }
    } else if (targetType === 'intake') {
      // Verify intake config belongs to this organization
      const intakeConfigDoc = await adminDb.collection('intake_call_configs').doc(body.intakeConfigId).get();
      if (!intakeConfigDoc.exists) {
        return NextResponse.json({ error: 'Intake config not found' }, { status: 404 });
      }
      const intakeConfigData = intakeConfigDoc.data();
      if (intakeConfigData?.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Intake config not in your organization' }, { status: 403 });
      }
    } else if (targetType === 'content') {
      // Verify content belongs to this organization
      // Map contentType to collection name
      const collectionMap: Record<string, string> = {
        article: 'articles',
        course: 'courses',
        event: 'events',
        download: 'downloads',
        link: 'links',
      };
      const collection = collectionMap[contentType];

      const contentDoc = await adminDb.collection(collection).doc(contentId).get();
      if (!contentDoc.exists) {
        return NextResponse.json({ error: `${contentType} not found` }, { status: 404 });
      }
      const contentData = contentDoc.data();
      if (contentData?.organizationId !== organizationId) {
        return NextResponse.json({ error: `${contentType} not in your organization` }, { status: 403 });
      }
    }

    // If this is being set as default, unset any existing default for the target
    if (isDefault) {
      const existingDefaults = await adminDb
        .collection('funnels')
        .where(targetField, '==', targetId)
        .where('isDefault', '==', true)
        .get();

      const batch = adminDb.batch();
      existingDefaults.docs.forEach(doc => {
        batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();
    }

    const now = new Date().toISOString();
    
    // Clean tracking config - only include if has values
    const cleanTracking: FunnelTrackingConfig | undefined = tracking && (
      tracking.metaPixelId || 
      tracking.googleAnalyticsId || 
      tracking.googleAdsId || 
      tracking.customHeadHtml || 
      tracking.customBodyHtml
    ) ? tracking : undefined;
    
    const funnelData: Omit<Funnel, 'id'> = {
      organizationId,
      targetType,
      programId: targetType === 'program' ? programId : null,
      squadId: targetType === 'squad' ? squadId : null,
      intakeConfigId: targetType === 'intake' ? body.intakeConfigId : undefined,
      contentType: targetType === 'content' ? contentType : undefined,
      contentId: targetType === 'content' ? contentId : undefined,
      slug: slug.toLowerCase(),
      name: name.trim(),
      description: description?.trim() || undefined,
      isDefault,
      isActive: true,
      accessType,
      defaultPaymentStatus: 'required',
      stepCount: 0,
      tracking: cleanTracking,
      createdAt: now,
      updatedAt: now,
    };

    const funnelRef = await adminDb.collection('funnels').add(funnelData);

    // Create required steps based on target type
    interface StepToCreate {
      type: string;
      config: Record<string, unknown>;
      order: number;
    }
    const requiredSteps: StepToCreate[] = [];

    if (targetType === 'intake') {
      // Intake funnels need: scheduling + success
      requiredSteps.push(
        { type: 'scheduling', config: { intakeConfigId: body.intakeConfigId }, order: 0 },
        { type: 'success', config: { showConfetti: true, redirectDelay: 3000 }, order: 1 }
      );
    } else {
      // Program/squad/content funnels need: payment (if paid) + signup + success
      let order = 0;
      if (programData?.priceInCents && programData.priceInCents > 0) {
        requiredSteps.push({ type: 'payment', config: { useProgramPricing: true }, order: order++ });
      }
      requiredSteps.push(
        { type: 'signup', config: { showSocialLogin: true }, order: order++ },
        { type: 'success', config: { showConfetti: true, redirectDelay: 3000 }, order: order++ }
      );
    }

    // Create steps in subcollection using batch
    const stepBatch = adminDb.batch();
    for (const step of requiredSteps) {
      const stepRef = adminDb.collection('funnels').doc(funnelRef.id).collection('steps').doc();
      stepBatch.set(stepRef, {
        funnelId: funnelRef.id,
        type: step.type,
        config: step.config,
        order: step.order,
        createdAt: now,
        updatedAt: now,
      });
    }
    // Update stepCount on funnel
    stepBatch.update(funnelRef, { stepCount: requiredSteps.length });
    await stepBatch.commit();

    console.log(`[COACH_ORG_FUNNELS] Created ${targetType} funnel ${funnelRef.id} with ${requiredSteps.length} steps for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      funnel: { id: funnelRef.id, ...funnelData, stepCount: requiredSteps.length },
    });
  } catch (error) {
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_ORG_FUNNELS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
