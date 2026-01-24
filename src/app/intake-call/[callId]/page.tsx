import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JoinCallClient } from './JoinCallClient';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeBookingToken, UnifiedEvent, OrgBranding, OrgSettings } from '@/types';

interface PageProps {
  params: Promise<{ callId: string }>;
  searchParams: Promise<{ token?: string }>;
}

async function getCallInfo(token: string) {
  try {
    // Validate booking token
    const tokenDoc = await adminDb.collection('intake_booking_tokens').doc(token).get();

    if (!tokenDoc.exists) {
      return { error: 'invalid_token' };
    }

    const bookingToken = { id: tokenDoc.id, ...tokenDoc.data() } as IntakeBookingToken;

    // Check if token is expired
    if (new Date(bookingToken.expiresAt) < new Date()) {
      return { error: 'expired_token' };
    }

    // Get the event
    const eventDoc = await adminDb.collection('events').doc(bookingToken.eventId).get();

    if (!eventDoc.exists) {
      return { error: 'event_not_found' };
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Check if event is cancelled
    if (event.status === 'canceled') {
      return { error: 'canceled' };
    }

    // Get organization branding and settings
    let branding: { name?: string; logoUrl?: string; hidePoweredBy?: boolean } = {};
    if (event.organizationId) {
      try {
        const [brandingDoc, settingsDoc] = await Promise.all([
          adminDb.collection('org_branding').doc(event.organizationId).get(),
          adminDb.collection('org_settings').doc(event.organizationId).get(),
        ]);

        const brandingData = brandingDoc.exists ? (brandingDoc.data() as OrgBranding) : null;
        const settingsData = settingsDoc.exists ? (settingsDoc.data() as OrgSettings) : null;

        branding = {
          name: brandingData?.appTitle,
          logoUrl: brandingData?.horizontalLogoUrl || brandingData?.logoUrl || undefined,
          hidePoweredBy: settingsData?.hidePoweredByCoachful || false,
        };
      } catch (err) {
        console.warn('[JOIN_PAGE] Failed to fetch org branding:', err);
      }
    }

    // Get host info
    let hostName = 'Your coach';
    let hostAvatarUrl: string | undefined;
    try {
      if (event.hostUserId) {
        const userDoc = await adminDb.collection('users').doc(event.hostUserId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          hostName = userData?.name || userData?.displayName || 'Your coach';
          hostAvatarUrl = userData?.imageUrl || userData?.avatarUrl;
        }
      }
    } catch (err) {
      console.warn('[JOIN_PAGE] Failed to fetch host info:', err);
    }

    return {
      event: {
        id: event.id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        durationMinutes: event.durationMinutes,
        meetingProvider: event.meetingProvider,
        meetingLink: event.meetingLink,
        callId: event.streamVideoCallId,
        prospectName: event.prospectName,
        prospectEmail: event.prospectEmail,
      },
      host: {
        name: hostName,
        avatarUrl: hostAvatarUrl,
      },
      branding,
      bookingToken: token,
    };
  } catch (error) {
    console.error('[JOIN_PAGE] Error fetching call info:', error);
    return { error: 'internal_error' };
  }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { token } = await searchParams;

  if (!token) {
    return { title: 'Join Call' };
  }

  const data = await getCallInfo(token);

  if ('error' in data) {
    return { title: 'Join Call' };
  }

  return {
    title: `Join ${data.event.title}`,
    description: `Video call with ${data.host.name}`,
    robots: 'noindex', // Don't index call join pages
  };
}

export default async function JoinCallPage({ params, searchParams }: PageProps) {
  const { callId } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
            Invalid Link
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2]">
            This join link is missing required information. Please use the link from your confirmation email.
          </p>
        </div>
      </div>
    );
  }

  const data = await getCallInfo(token);

  if ('error' in data) {
    const errorMessages: Record<string, { title: string; message: string }> = {
      invalid_token: {
        title: 'Invalid Link',
        message: 'This join link is invalid. Please use the link from your confirmation email.',
      },
      expired_token: {
        title: 'Link Expired',
        message: 'This join link has expired. Please contact your coach to get a new link.',
      },
      event_not_found: {
        title: 'Call Not Found',
        message: 'We couldn\'t find this call. It may have been cancelled or rescheduled.',
      },
      canceled: {
        title: 'Call Canceled',
        message: 'This call has been canceled. Please contact your coach for more information.',
      },
      internal_error: {
        title: 'Something Went Wrong',
        message: 'We encountered an error. Please try again or contact support.',
      },
    };

    const error = errorMessages[data.error as string] || errorMessages.internal_error;

    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
            {error.title}
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2]">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  // Check if this is an external meeting (Zoom/Meet)
  if (data.event.meetingProvider !== 'stream') {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
            External Meeting
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
            This call uses {data.event.meetingProvider === 'zoom' ? 'Zoom' : 'Google Meet'}.
          </p>
          {data.event.meetingLink && (
            <a
              href={data.event.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 bg-brand-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Join Meeting
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <JoinCallClient
      event={data.event}
      host={data.host}
      branding={data.branding}
      bookingToken={token}
      callId={callId}
    />
  );
}
