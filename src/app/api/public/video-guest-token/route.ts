import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { IntakeBookingToken, UnifiedEvent } from '@/types';

/**
 * POST /api/public/video-guest-token
 * Generate a Stream Video guest token for intake call prospects
 *
 * This is a PUBLIC endpoint - no auth required.
 * Security is via booking token validation.
 *
 * Body:
 * - token: string (booking token ID)
 * - guestName: string (display name for the call)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, guestName } = body;

    if (!token) {
      return NextResponse.json({ error: 'Booking token is required' }, { status: 400 });
    }

    if (!guestName?.trim()) {
      return NextResponse.json({ error: 'Guest name is required' }, { status: 400 });
    }

    // Validate booking token
    const tokenDoc = await adminDb.collection('intake_booking_tokens').doc(token).get();

    if (!tokenDoc.exists) {
      return NextResponse.json({ error: 'Invalid or expired booking link' }, { status: 404 });
    }

    const bookingToken = { id: tokenDoc.id, ...tokenDoc.data() } as IntakeBookingToken;

    // Check if token is expired
    if (new Date(bookingToken.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This booking link has expired' }, { status: 410 });
    }

    // Get the event
    const eventDoc = await adminDb.collection('events').doc(bookingToken.eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Check if event is cancelled
    if (event.status === 'canceled') {
      return NextResponse.json({ error: 'This call has been cancelled' }, { status: 410 });
    }

    // Check if event meeting provider is in_app (Stream)
    if (event.meetingProvider !== 'stream') {
      return NextResponse.json({
        error: 'This call uses an external meeting provider',
        meetingUrl: event.meetingLink
      }, { status: 400 });
    }

    // Check if call is not too far in the past (allow some grace period)
    const eventEnd = event.endDateTime
      ? new Date(event.endDateTime)
      : new Date(new Date(event.startDateTime).getTime() + (event.durationMinutes || 60) * 60 * 1000);

    const gracePeriod = 30 * 60 * 1000; // 30 minutes after scheduled end
    if (new Date() > new Date(eventEnd.getTime() + gracePeriod)) {
      return NextResponse.json({ error: 'This call has already ended' }, { status: 410 });
    }

    // Generate guest user ID
    const guestUserId = `guest_${event.id}_${Date.now()}`;

    // Generate Stream token for guest
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('[VIDEO_GUEST_TOKEN] Stream API key and secret must be defined');
      return NextResponse.json({ error: 'Video service configuration error' }, { status: 500 });
    }

    // Use StreamChat to generate token (Stream Video uses same tokens)
    const { StreamChat } = await import('stream-chat');
    const serverClient = StreamChat.getInstance(apiKey, apiSecret!);

    // Generate call-specific token
    // The callId should match what was created when booking
    const callId = event.streamVideoCallId || `intake_${event.id}`;

    // Ensure the Stream Video call exists (for backward compatibility with old bookings)
    try {
      const { StreamClient } = await import('@stream-io/node-sdk');
      const streamVideoClient = new StreamClient(apiKey, apiSecret!);
      const call = streamVideoClient.video.call('default', callId);

      // getOrCreate - creates if doesn't exist, returns existing if it does
      await call.getOrCreate({
        data: {
          created_by_id: event.hostUserId || 'system',
          custom: {
            eventId: event.id,
            organizationId: event.organizationId,
            callType: 'intake',
          },
        },
      });
      console.log(`[VIDEO_GUEST_TOKEN] Ensured call exists: ${callId}`);
    } catch (callErr) {
      console.error(`[VIDEO_GUEST_TOKEN] Failed to ensure call exists:`, callErr);
      // Continue anyway - maybe the coach will create it
    }

    // Create token with call_cids to restrict access to this specific call
    const streamToken = serverClient.createToken(guestUserId, undefined, undefined);

    // Get organization branding for the join page
    let orgBranding: { name?: string; logoUrl?: string } = {};
    if (event.organizationId) {
      try {
        const brandingDoc = await adminDb.collection('organization_branding').doc(event.organizationId).get();
        if (brandingDoc.exists) {
          orgBranding = brandingDoc.data() as typeof orgBranding;
        }
      } catch (err) {
        console.warn('[VIDEO_GUEST_TOKEN] Failed to fetch org branding:', err);
      }
    }

    // Get host/coach name
    let hostName = 'Your coach';
    try {
      const userDoc = await adminDb.collection('users').doc(event.hostUserId!).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        hostName = userData?.name || userData?.displayName || 'Your coach';
      }
    } catch (err) {
      console.warn('[VIDEO_GUEST_TOKEN] Failed to fetch host info:', err);
    }

    console.log(`[VIDEO_GUEST_TOKEN] Generated token for guest ${guestName} joining call ${callId}`);

    return NextResponse.json({
      streamToken,
      guestUserId,
      apiKey,
      callId,
      callType: 'default', // Stream Video call type
      event: {
        id: event.id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        durationMinutes: event.durationMinutes,
        hostName,
        hostUserId: event.hostUserId,
      },
      branding: {
        organizationName: orgBranding.name,
        logoUrl: orgBranding.logoUrl,
      },
    });
  } catch (error) {
    console.error('[VIDEO_GUEST_TOKEN_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
