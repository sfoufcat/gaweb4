import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeCallConfig, CoachAvailability } from '@/types';

interface RouteParams {
  params: Promise<{ orgSlug: string; slug: string }>;
}

/**
 * GET /api/public/intake/[orgSlug]/[slug]
 * Get intake call config and coach info for public booking page
 *
 * This is a public endpoint - no authentication required
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { orgSlug, slug } = await params;

    // Find organization by subdomain/slug
    const orgsSnapshot = await adminDb
      .collection('organizations')
      .where('subdomain', '==', orgSlug)
      .limit(1)
      .get();

    if (orgsSnapshot.empty) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgDoc = orgsSnapshot.docs[0];
    const orgData = orgDoc.data();
    const organizationId = orgData.clerkOrganizationId || orgDoc.id;

    // Find intake config by slug
    const configsSnapshot = await adminDb
      .collection('intake_call_configs')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', slug)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (configsSnapshot.empty) {
      return NextResponse.json({ error: 'Intake call not found' }, { status: 404 });
    }

    const configDoc = configsSnapshot.docs[0];
    const config = { id: configDoc.id, ...configDoc.data() } as IntakeCallConfig;

    // Get organization branding for the booking page
    const brandingDoc = await adminDb
      .collection('organizations')
      .doc(orgDoc.id)
      .collection('settings')
      .doc('branding')
      .get();

    const branding = brandingDoc.exists ? brandingDoc.data() : null;

    // Get coach info (primary coach of the org)
    // For now, we'll use the organization owner
    let coachInfo = {
      name: orgData.name || orgSlug,
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
        name: orgData.name,
        logoUrl: branding?.logoUrl,
        primaryColor: branding?.primaryColor,
      },
      coach: coachInfo,
      timezone: availability?.timezone || 'America/New_York',
    });
  } catch (error) {
    console.error('[PUBLIC_INTAKE_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
