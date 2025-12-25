import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { scheduleCoachingCallJobs, cancelCoachingCallJobs } from '@/lib/coaching-call-notifications';
import type { ClientCoachingData, UserRole, FirebaseUser, Coach } from '@/types';
import { StreamChat } from 'stream-chat';

const streamApiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const streamApiSecret = process.env.STREAM_API_SECRET!;

/**
 * @deprecated This route is deprecated and will be removed in a future version.
 * Use the unified events API instead:
 * - POST /api/events (create event with eventType: 'coaching_1on1')
 * - PATCH /api/events/[eventId] (update event)
 * - DELETE /api/events/[eventId] (cancel event)
 * 
 * This route is kept temporarily for backward compatibility during migration.
 * See: scripts/migrate-events.ts
 * 
 * ============================================================================
 * 
 * PUT /api/coaching/clients/[clientId]/call
 * Schedule or update a coaching call (coach only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (sessionClaims?.publicMetadata as { role?: UserRole })?.role;

    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    // Fetch existing coaching data
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(clientId).get();

    if (!coachingDoc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const coachingData = coachingDoc.data() as ClientCoachingData;

    // Verify coach has access to this client
    if (role === 'coach' && coachingData.coachId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { dateTime, timezone, location, title } = body;

    if (!dateTime || !timezone) {
      return NextResponse.json({ error: 'dateTime and timezone are required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Cancel any existing scheduled jobs for this client
    await cancelCoachingCallJobs({ userId: clientId });

    // Update coaching data with new call info
    const nextCall = {
      datetime: dateTime,
      timezone,
      location: location || 'Chat',
      title: title || 'Coaching Call',
    };

    await adminDb.collection('clientCoachingData').doc(clientId).update({
      nextCall,
      updatedAt: now,
    });

    // Get client and coach info for notifications
    const [userDoc, coachDoc] = await Promise.all([
      adminDb.collection('users').doc(clientId).get(),
      adminDb.collection('coaches').doc(coachingData.coachId).get(),
    ]);

    const user = userDoc.exists ? userDoc.data() as FirebaseUser : null;
    const coach = coachDoc.exists ? coachDoc.data() as Coach : null;

    // Schedule notification/email jobs
    await scheduleCoachingCallJobs({
      userId: clientId,
      coachId: coachingData.coachId,
      clientName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Client',
      coachName: coach ? coach.name : 'Your Coach',
      callDateTime: dateTime,
      callTimezone: timezone,
      callLocation: location || 'Chat',
      callTitle: title,
      chatChannelId: coachingData.chatChannelId,
    });

    // Send chat message to client about the scheduled call if chat channel exists
    if (coachingData.chatChannelId && streamApiKey && streamApiSecret) {
      try {
        const serverClient = StreamChat.getInstance(streamApiKey, streamApiSecret);
        const channel = serverClient.channel('messaging', coachingData.chatChannelId);
        
        // Format call time for message
        const callDate = new Date(dateTime);
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        });
        const formattedTime = formatter.format(callDate);

        await channel.sendMessage({
          text: `📅 Your next coaching call is scheduled for **${formattedTime}**.\n\nLocation: ${location || 'Chat'}`,
          user_id: coachingData.coachId,
        });
      } catch (chatError) {
        console.error('[COACHING_CALL_CHAT_MESSAGE_ERROR]', chatError);
        // Don't fail the request if chat message fails
      }
    }

    return NextResponse.json({ success: true, nextCall });
  } catch (error) {
    console.error('[COACHING_CALL_PUT_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coaching/clients/[clientId]/call
 * Remove a scheduled coaching call (coach only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (sessionClaims?.publicMetadata as { role?: UserRole })?.role;

    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    // Fetch existing coaching data
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(clientId).get();

    if (!coachingDoc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const coachingData = coachingDoc.data() as ClientCoachingData;

    // Verify coach has access to this client
    if (role === 'coach' && coachingData.coachId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Cancel any existing scheduled jobs
    await cancelCoachingCallJobs({ userId: clientId });

    // Clear the next call data
    await adminDb.collection('clientCoachingData').doc(clientId).update({
      nextCall: {
        datetime: null,
        timezone: coachingData.nextCall?.timezone || 'America/New_York',
        location: 'Chat',
      },
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACHING_CALL_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}









