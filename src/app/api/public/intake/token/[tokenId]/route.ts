import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeCallConfig, IntakeBookingToken, UnifiedEvent, CoachAvailability } from '@/types';

interface RouteParams {
  params: Promise<{ tokenId: string }>;
}

/**
 * GET /api/public/intake/token/[tokenId]
 * Validate booking token and return event + config data
 *
 * This is a public endpoint - no authentication required
 * Used for cancel/reschedule pages
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { tokenId } = await params;

    if (!tokenId) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Get token
    const tokenDoc = await adminDb.collection('intake_booking_tokens').doc(tokenId).get();

    if (!tokenDoc.exists) {
      return NextResponse.json({
        error: 'Invalid link',
        code: 'TOKEN_INVALID',
        message: 'This link is not valid. Please check your email for the correct link.'
      }, { status: 404 });
    }

    const token = { id: tokenDoc.id, ...tokenDoc.data() } as IntakeBookingToken;

    // Check if token is expired
    if (new Date(token.expiresAt) < new Date()) {
      return NextResponse.json({
        error: 'Link expired',
        code: 'TOKEN_EXPIRED',
        message: 'This link has expired. Please contact your coach to make changes to your booking.'
      }, { status: 410 });
    }

    // Get event
    const eventDoc = await adminDb.collection('events').doc(token.eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({
        error: 'Booking not found',
        code: 'EVENT_NOT_FOUND',
        message: 'This booking could not be found.'
      }, { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Check if event is already cancelled
    if (event.schedulingStatus === 'cancelled' || event.status === 'canceled') {
      return NextResponse.json({
        error: 'Already cancelled',
        code: 'EVENT_CANCELLED',
        message: 'This appointment has already been cancelled.'
      }, { status: 410 });
    }

    // Check if event is in the past
    if (new Date(event.startDateTime) < new Date()) {
      return NextResponse.json({
        error: 'Event passed',
        code: 'EVENT_PAST',
        message: 'This appointment has already taken place.'
      }, { status: 410 });
    }

    // Get intake config
    const configDoc = await adminDb.collection('intake_call_configs').doc(token.intakeCallConfigId).get();

    if (!configDoc.exists) {
      return NextResponse.json({
        error: 'Configuration not found',
        code: 'CONFIG_NOT_FOUND',
        message: 'The booking configuration could not be found.'
      }, { status: 404 });
    }

    const config = { id: configDoc.id, ...configDoc.data() } as IntakeCallConfig;

    // Get organization for branding
    // First try by clerkOrganizationId, then try direct document ID lookup
    let orgsSnapshot = await adminDb
      .collection('organizations')
      .where('clerkOrganizationId', '==', event.organizationId)
      .limit(1)
      .get();

    // If not found by clerkOrganizationId, try direct doc ID lookup
    if (orgsSnapshot.empty && event.organizationId) {
      const directOrgDoc = await adminDb.collection('organizations').doc(event.organizationId).get();
      if (directOrgDoc.exists) {
        // Create a fake snapshot-like structure
        orgsSnapshot = {
          empty: false,
          docs: [directOrgDoc],
        } as typeof orgsSnapshot;
      }
    }

    let organization = {
      name: null as string | null,
      logoUrl: null as string | null,
      primaryColor: null as string | null,
      subdomain: '',
      hidePoweredBy: false,
      plan: 'starter' as 'starter' | 'pro' | 'scale',
    };

    if (!orgsSnapshot.empty) {
      const orgDoc = orgsSnapshot.docs[0];
      const orgData = orgDoc.data();

      // Try to get branding from org_branding collection first (newer pattern)
      // Then fall back to organizations/{id}/settings/branding subcollection
      const [orgBrandingDoc, settingsBrandingDoc] = await Promise.all([
        adminDb.collection('org_branding').doc(orgDoc.id).get(),
        adminDb.collection('organizations').doc(orgDoc.id).collection('settings').doc('branding').get(),
      ]);

      const branding = orgBrandingDoc.exists
        ? orgBrandingDoc.data()
        : settingsBrandingDoc.exists
          ? settingsBrandingDoc.data()
          : null;

      // Use organization name or branding title as fallback
      const orgName = branding?.appTitle || orgData?.name || null;

      // Get settings for hidePoweredBy
      const settingsDoc = await adminDb.collection('org_settings').doc(orgDoc.id).get();
      const settings = settingsDoc.exists ? settingsDoc.data() : null;

      // Get subscription plan tier
      const subscriptionSnapshot = await adminDb
        .collection('coach_subscriptions')
        .where('organizationId', '==', orgDoc.id)
        .where('status', 'in', ['active', 'trialing'])
        .limit(1)
        .get();

      const plan = subscriptionSnapshot.empty
        ? 'starter'
        : (subscriptionSnapshot.docs[0].data().tier as 'starter' | 'pro' | 'scale') || 'starter';

      organization = {
        name: orgName,
        logoUrl: branding?.horizontalLogoUrl || branding?.logoUrl || null,
        primaryColor: branding?.colors?.accentLight || branding?.primaryColor || null,
        subdomain: orgData?.subdomain || '',
        hidePoweredBy: settings?.hidePoweredByCoachful || false,
        plan,
      };
    }

    // Get coach info
    let coach = {
      name: event.hostName || 'Coach',
      email: null as string | null,
    };

    if (event.hostUserId && event.hostUserId !== 'system' && event.hostUserId !== 'public_booking') {
      const coachDoc = await adminDb.collection('users').doc(event.hostUserId).get();
      if (coachDoc.exists) {
        const coachData = coachDoc.data();
        coach = {
          name: coachData?.displayName || coachData?.firstName || coach.name,
          email: coachData?.email || coachData?.primaryEmail || null,
        };
      }
    }

    // Get availability for timezone
    let availability: CoachAvailability | null = null;
    if (event.organizationId) {
      const availabilityDoc = await adminDb
        .collection('coach_availability')
        .doc(event.organizationId)
        .get();

      availability = availabilityDoc.exists
        ? (availabilityDoc.data() as CoachAvailability)
        : null;
    }

    // Calculate deadline info
    const cancelDeadlineHours = config.cancelDeadlineHours ?? 24;
    const eventStart = new Date(event.startDateTime);
    const deadlineTime = new Date(eventStart.getTime() - cancelDeadlineHours * 60 * 60 * 1000);
    const canMakeChanges = new Date() < deadlineTime;

    return NextResponse.json({
      token: {
        id: token.id,
        expiresAt: token.expiresAt,
      },
      event: {
        id: event.id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        timezone: event.timezone,
        durationMinutes: event.durationMinutes,
        meetingLink: event.meetingLink,
        meetingProvider: event.meetingProvider,
        locationLabel: event.locationLabel,
        prospectName: event.prospectName,
        prospectEmail: event.prospectEmail,
      },
      config: {
        id: config.id,
        name: config.name,
        slug: config.slug,
        description: config.description,
        duration: config.duration,
        allowCancellation: config.allowCancellation ?? true,
        allowReschedule: config.allowReschedule ?? true,
        cancelDeadlineHours,
        meetingProvider: config.meetingProvider,
      },
      organization,
      coach,
      coachTimezone: availability?.timezone || event.timezone || 'America/New_York',
      deadline: {
        canMakeChanges,
        deadlineTime: deadlineTime.toISOString(),
        hoursUntilDeadline: Math.max(0, Math.floor((deadlineTime.getTime() - Date.now()) / (1000 * 60 * 60))),
        hoursRequired: cancelDeadlineHours,
      },
    });
  } catch (error) {
    console.error('[PUBLIC_INTAKE_TOKEN_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
