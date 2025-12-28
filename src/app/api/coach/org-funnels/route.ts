import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type { Funnel, FunnelTargetType, FunnelTrackingConfig } from '@/types';

/**
 * GET /api/coach/org-funnels
 * Get all funnels for the coach's organization
 * 
 * Query params:
 * - programId?: string (filter by program)
 * - squadId?: string (filter by squad)
 * - targetType?: 'program' | 'squad' (filter by target type)
 */
export async function GET(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('programId');
    const squadId = searchParams.get('squadId');
    const targetType = searchParams.get('targetType') as FunnelTargetType | null;

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
 * - targetType: 'program' | 'squad' (default: 'program')
 * - programId?: string (required if targetType is 'program')
 * - squadId?: string (required if targetType is 'squad')
 * - description?: string
 * - accessType?: 'public' | 'invite_only'
 * - isDefault?: boolean
 */
export async function POST(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { 
      name, 
      slug, 
      targetType = 'program' as FunnelTargetType,
      programId, 
      squadId,
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
    if (!['program', 'squad'].includes(targetType)) {
      return NextResponse.json({ error: 'Invalid target type' }, { status: 400 });
    }

    // Validate target ID based on type
    if (targetType === 'program' && !programId) {
      return NextResponse.json({ error: 'Program ID is required' }, { status: 400 });
    }
    if (targetType === 'squad' && !squadId) {
      return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug can only contain lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Get target ID for uniqueness check
    const targetId = targetType === 'program' ? programId : squadId;
    const targetField = targetType === 'program' ? 'programId' : 'squadId';

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
    if (targetType === 'program') {
      const programDoc = await adminDb.collection('programs').doc(programId).get();
      if (!programDoc.exists) {
        return NextResponse.json({ error: 'Program not found' }, { status: 404 });
      }
      const programData = programDoc.data();
      if (programData?.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Program not in your organization' }, { status: 403 });
      }
    } else {
      const squadDoc = await adminDb.collection('squads').doc(squadId).get();
      if (!squadDoc.exists) {
        return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
      }
      const squadData = squadDoc.data();
      if (squadData?.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Squad not in your organization' }, { status: 403 });
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

    console.log(`[COACH_ORG_FUNNELS] Created ${targetType} funnel ${funnelRef.id} for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      funnel: { id: funnelRef.id, ...funnelData },
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
