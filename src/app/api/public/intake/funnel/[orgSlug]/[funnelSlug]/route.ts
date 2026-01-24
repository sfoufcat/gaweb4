import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { getTenantFromHeaders } from '@/lib/tenant';
import type { IntakeCallConfig, CoachAvailability, Funnel } from '@/types';

interface RouteParams {
  params: Promise<{ orgSlug: string; funnelSlug: string }>;
}

/**
 * GET /api/public/intake/funnel/[orgSlug]/[funnelSlug]
 * Get intake funnel, config, and coach info for public booking page
 *
 * This looks up the funnel by slug (not the config), then loads the config via intakeConfigId.
 * This enables funnel-first URL structure for intake calls.
 *
 * This is a public endpoint - no authentication required
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { funnelSlug } = await params;

    // Get tenant from middleware headers (handles dev-tenant cookie/param)
    const headersList = await headers();
    const tenant = getTenantFromHeaders(new Headers(headersList));
    if (!tenant) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const organizationId = tenant.organizationId;

    // Find funnel by slug and targetType
    const funnelsSnapshot = await adminDb
      .collection('funnels')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', funnelSlug)
      .where('targetType', '==', 'intake')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (funnelsSnapshot.empty) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    const funnelDoc = funnelsSnapshot.docs[0];
    const funnel = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

    // Ensure funnel has intakeConfigId
    if (!funnel.intakeConfigId) {
      return NextResponse.json({ error: 'Funnel missing intake config reference' }, { status: 500 });
    }

    // Find intake config by ID
    const configDoc = await adminDb
      .collection('intake_call_configs')
      .doc(funnel.intakeConfigId)
      .get();

    if (!configDoc.exists) {
      return NextResponse.json({ error: 'Intake config not found' }, { status: 404 });
    }

    const configData = configDoc.data();
    if (!configData?.isActive) {
      return NextResponse.json({ error: 'Intake call not available' }, { status: 404 });
    }

    const config = { id: configDoc.id, ...configData } as IntakeCallConfig;

    // Get organization data for branding
    const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
    const orgData = orgDoc.exists ? orgDoc.data() : null;

    // Get organization branding for the booking page
    const brandingDoc = await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('settings')
      .doc('branding')
      .get();

    const branding = brandingDoc.exists ? brandingDoc.data() : null;

    // Get coach info (primary coach of the org)
    let coachInfo = {
      name: orgData?.name || tenant.subdomain,
      avatarUrl: branding?.logoUrl || null,
    };

    // Try to get the super_coach user for this org
    const coachesSnapshot = await adminDb
      .collection('users')
      .where('clerkOrganizationId', '==', organizationId)
      .where('role', 'in', ['super_coach', 'admin'])
      .limit(1)
      .get();

    if (!coachesSnapshot.empty) {
      const coachData = coachesSnapshot.docs[0].data();
      coachInfo = {
        name: coachData.displayName || coachData.firstName || coachInfo.name,
        avatarUrl: coachData.avatarUrl || coachInfo.avatarUrl,
      };
    }

    // Get availability settings
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();

    const availability = availabilityDoc.exists
      ? (availabilityDoc.data() as CoachAvailability)
      : null;

    // Return public data only (no sensitive info)
    return NextResponse.json({
      funnel: {
        id: funnel.id,
        slug: funnel.slug,
        name: funnel.name,
        tracking: funnel.tracking, // Include tracking pixels
      },
      config: {
        id: config.id,
        name: config.name,
        slug: config.slug,
        description: config.description,
        duration: config.duration,
        coverImageUrl: config.coverImageUrl,
        requireEmail: config.requireEmail,
        requireName: config.requireName,
        requirePhone: config.requirePhone,
        customFields: config.customFields,
        confirmationMessage: config.confirmationMessage,
        allowCancellation: config.allowCancellation,
        allowReschedule: config.allowReschedule,
      },
      organization: {
        name: orgData?.name || tenant.subdomain,
        logoUrl: branding?.logoUrl,
        primaryColor: branding?.primaryColor,
      },
      coach: coachInfo,
      timezone: availability?.timezone || 'America/New_York',
    });
  } catch (error) {
    console.error('[PUBLIC_INTAKE_FUNNEL_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
