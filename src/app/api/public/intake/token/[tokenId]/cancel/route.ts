import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeCallConfig, IntakeBookingToken, UnifiedEvent, Funnel, Program } from '@/types';
import { sendIntakeCancellationNotifications, createIntakeNotificationForCoach } from '@/lib/intake-notifications';

interface RouteParams {
  params: Promise<{ tokenId: string }>;
}

/**
 * POST /api/public/intake/token/[tokenId]/cancel
 * Cancel an intake call booking using token auth
 *
 * Body:
 * - reason?: string (optional cancellation reason)
 *
 * This is a public endpoint - no authentication required
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { tokenId } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

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
        message: 'This link has expired. Please contact your coach to cancel your booking.'
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
        message: 'This appointment has already taken place and cannot be cancelled.'
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

    // Check if cancellation is allowed
    if (config.allowCancellation === false) {
      return NextResponse.json({
        error: 'Cancellation not allowed',
        code: 'CANCELLATION_DISABLED',
        message: 'Self-service cancellation is not available for this booking. Please contact your coach directly to cancel.'
      }, { status: 403 });
    }

    // Check deadline
    const cancelDeadlineHours = config.cancelDeadlineHours ?? 24;
    const eventStart = new Date(event.startDateTime);
    const deadlineTime = new Date(eventStart.getTime() - cancelDeadlineHours * 60 * 60 * 1000);

    if (new Date() >= deadlineTime) {
      return NextResponse.json({
        error: 'Past deadline',
        code: 'PAST_DEADLINE',
        message: `Cancellations must be made at least ${cancelDeadlineHours} hours before the appointment. Please contact your coach directly.`
      }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Update event to cancelled
    await adminDb.collection('events').doc(event.id).update({
      status: 'completed',
      schedulingStatus: 'cancelled',
      cancelledAt: now,
      cancelledBy: 'prospect',
      cancellationReason: reason || null,
      updatedAt: now,
    });

    // Delete any scheduled reminder jobs
    const jobsSnapshot = await adminDb
      .collection('eventScheduledJobs')
      .where('eventId', '==', event.id)
      .get();

    const deletePromises = jobsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    // Get coach info for email
    let coachEmail: string | null = null;
    let coachName = event.hostName || 'Coach';

    if (event.hostUserId && event.hostUserId !== 'system' && event.hostUserId !== 'public_booking') {
      const coachDoc = await adminDb.collection('users').doc(event.hostUserId).get();
      if (coachDoc.exists) {
        const coachData = coachDoc.data();
        coachEmail = coachData?.email || coachData?.primaryEmail || null;
        coachName = coachData?.displayName || coachData?.firstName || coachName;
      }
    }

    // Fallback: get coach email from organization's admin/super_coach
    if (!coachEmail && event.organizationId) {
      const coachesSnapshot = await adminDb
        .collection('users')
        .where('clerkOrganizationId', '==', event.organizationId)
        .where('role', 'in', ['super_coach', 'admin'])
        .limit(1)
        .get();

      if (!coachesSnapshot.empty) {
        const coachData = coachesSnapshot.docs[0].data();
        coachEmail = coachData?.email || coachData?.primaryEmail || null;
        if (!coachName || coachName === 'Coach') {
          coachName = coachData?.displayName || coachData?.firstName || coachName;
        }
      }
    }

    // Get organization info for branding
    const orgsSnapshot = await adminDb
      .collection('organizations')
      .where('clerkOrganizationId', '==', event.organizationId)
      .limit(1)
      .get();

    let orgBranding = {
      name: coachName,
      logoUrl: undefined as string | undefined,
      horizontalLogoUrl: undefined as string | undefined,
      accentColor: undefined as string | undefined,
      plan: 'starter' as 'starter' | 'pro' | 'scale',
    };

    let orgSubdomain = '';

    if (!orgsSnapshot.empty) {
      const orgDoc = orgsSnapshot.docs[0];
      const orgData = orgDoc.data();
      orgSubdomain = orgData.subdomain || '';

      // Get branding from org_branding or subcollection
      const [orgBrandingDoc, settingsBrandingDoc] = await Promise.all([
        adminDb.collection('org_branding').doc(orgDoc.id).get(),
        adminDb.collection('organizations').doc(orgDoc.id).collection('settings').doc('branding').get(),
      ]);

      const branding = orgBrandingDoc.exists
        ? orgBrandingDoc.data()
        : settingsBrandingDoc.exists
          ? settingsBrandingDoc.data()
          : null;

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

      orgBranding = {
        name: branding?.appTitle || orgData.name || coachName,
        logoUrl: branding?.logoUrl,
        horizontalLogoUrl: branding?.horizontalLogoUrl,
        accentColor: branding?.colors?.accentLight || branding?.primaryColor,
        plan,
      };
    }

    // Check if intake config has a linked funnel to build booking URL
    let bookingUrl: string | undefined;

    if ((config as IntakeCallConfig & { funnelId?: string }).funnelId && orgSubdomain) {
      const funnelId = (config as IntakeCallConfig & { funnelId?: string }).funnelId;
      const funnelDoc = await adminDb.collection('funnels').doc(funnelId!).get();

      if (funnelDoc.exists) {
        const funnel = funnelDoc.data() as Funnel;
        // Get program to get its slug
        if (funnel.programId) {
          const programDoc = await adminDb.collection('programs').doc(funnel.programId).get();
          if (programDoc.exists) {
            const program = programDoc.data() as Program;
            bookingUrl = `https://${orgSubdomain}.coachful.co/join/${program.slug}/${funnel.slug}`;
          }
        }
      }
    }

    // Send cancellation notifications
    sendIntakeCancellationNotifications({
      event,
      config,
      prospectName: event.prospectName || 'Guest',
      prospectEmail: event.prospectEmail || token.prospectEmail,
      coachName,
      coachEmail: coachEmail || undefined,
      organizationId: event.organizationId || '',
      reason: reason || undefined,
      cancelledBy: 'prospect',
      orgBranding,
      bookingUrl,
    }).catch((err: unknown) => {
      console.error('[INTAKE_CANCEL] Failed to send notifications:', err);
    });

    // Create in-app notification for coach
    createIntakeNotificationForCoach({
      coachUserId: event.hostUserId || '',
      type: 'intake_call_cancelled',
      prospectName: event.prospectName || 'Guest',
      configName: config.name,
      startDateTime: event.startDateTime,
      organizationId: event.organizationId || '',
      eventId: event.id,
    }).catch((err: unknown) => {
      console.error('[INTAKE_CANCEL] Failed to create in-app notification:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Your appointment has been cancelled.',
    });
  } catch (error) {
    console.error('[PUBLIC_INTAKE_CANCEL_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
