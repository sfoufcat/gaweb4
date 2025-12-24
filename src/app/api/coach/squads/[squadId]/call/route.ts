import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getStreamServerClient, ensureSystemBotUser, SYSTEM_BOT_USER_ID } from '@/lib/stream-server';
import { scheduleSquadCallJobs, cancelSquadCallJobs } from '@/lib/squad-call-notifications';
import type { Squad, ClerkPublicMetadata } from '@/types';

/**
 * PUT /api/coach/squads/[squadId]/call
 * 
 * Updates the next squad call details for a coached squad.
 * Only accessible by coaches (for their own squads) or admins.
 * 
 * When call is created/updated:
 * 1. Updates the squad document with call details
 * 2. Sends a notification message to the squad chat
 * 3. Schedules/updates the 1-hour reminder (stored in Firebase for cron processing)
 * 
 * Request body:
 * {
 *   dateTime: string; // ISO 8601 timestamp
 *   timezone: string; // IANA timezone
 *   location: string;
 *   title?: string; // Optional, defaults to "Squad coaching call"
 * }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { squadId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get role from session claims
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;

    // Check if user can access coach dashboard
    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json(
        { error: 'Forbidden - Coach, Admin, or Super Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { dateTime, timezone, location, title } = body;

    // Validate required fields
    if (!dateTime || !timezone || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: dateTime, timezone, location' },
        { status: 400 }
      );
    }

    // Validate dateTime is a valid ISO string
    const callDate = new Date(dateTime);
    if (isNaN(callDate.getTime())) {
      return NextResponse.json({ error: 'Invalid dateTime format' }, { status: 400 });
    }

    // Validate the call is in the future
    if (callDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Call must be scheduled in the future' }, { status: 400 });
    }

    // Fetch the squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squadData = squadDoc.data() as Squad;
    const coachId = squadData?.coachId || null;

    // Check if squad has a coach (use hasCoach, fall back to isPremium for migration)
    const squadHasCoach = squadData.hasCoach ?? squadData.isPremium ?? false;
    if (!squadHasCoach) {
      return NextResponse.json(
        { error: 'Squad call scheduling is only available for coached squads' },
        { status: 400 }
      );
    }

    // Authorization check for coaches
    if (role === 'coach' && coachId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You are not the coach of this squad' },
        { status: 403 }
      );
    }

    // Check if this is a new call or an update
    const isNewCall = !squadData.nextCallDateTime;
    const previousCallTime = squadData.nextCallDateTime
      ? new Date(squadData.nextCallDateTime)
      : null;

    // Cancel any previously scheduled notification/email jobs
    if (previousCallTime) {
      await cancelSquadCallJobs({
        squadId,
        hasCoach: true,
      });
    }

    // Update the squad document with call details
    const updateData = {
      nextCallDateTime: dateTime,
      nextCallTimezone: timezone,
      nextCallLocation: location,
      nextCallTitle: title || 'Squad coaching call',
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('squads').doc(squadId).update(updateData);

    // Schedule the 1-hour reminder (store in Firebase for cron processing)
    const reminderTime = new Date(callDate.getTime() - 60 * 60 * 1000); // 1 hour before
    
    // Only schedule if reminder time is still in the future
    if (reminderTime.getTime() > Date.now()) {
      await adminDb.collection('squadCallReminders').doc(squadId).set({
        squadId,
        squadName: squadData.name,
        callDateTime: dateTime,
        callTimezone: timezone,
        callLocation: location,
        callTitle: title || 'Squad coaching call',
        reminderTime: reminderTime.toISOString(),
        chatChannelId: squadData.chatChannelId,
        sent: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: false }); // Replace any existing reminder for this squad
    } else {
      // If reminder time has passed, remove any existing reminder
      await adminDb.collection('squadCallReminders').doc(squadId).delete().catch(() => {});
    }

    // Schedule notification and email jobs (24h before, 1h before, at start)
    try {
      await scheduleSquadCallJobs({
        squadId,
        squadName: squadData.name,
        hasCoach: true,
        callDateTime: dateTime,
        callTimezone: timezone,
        callLocation: location,
        callTitle: title || 'Squad coaching call',
        chatChannelId: squadData.chatChannelId || undefined,
      });
    } catch (jobError) {
      console.error('[SQUAD_CALL_UPDATE] Failed to schedule notification/email jobs:', jobError);
      // Don't fail the request if job scheduling fails
    }

    // Send notification to squad chat
    if (squadData.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        await ensureSystemBotUser(streamClient);

        const channel = streamClient.channel('messaging', squadData.chatChannelId);

        // Format the call time for the message
        const formattedDate = formatCallTime(callDate, timezone);
        
        const messageText = isNewCall
          ? `📅 A new squad call has been scheduled!\n\n**When:** ${formattedDate}\n**Location:** ${location}`
          : `📅 The next squad call has been updated!\n\n**When:** ${formattedDate}\n**Location:** ${location}`;

        await channel.sendMessage({
          text: messageText,
          user_id: SYSTEM_BOT_USER_ID,
          call_notification: true,
          call_squad_id: squadId,
          call_date_time: dateTime,
        } as Parameters<typeof channel.sendMessage>[0]);

      } catch (chatError) {
        console.error('[SQUAD_CALL_UPDATE] Failed to send chat notification:', chatError);
        // Don't fail the request if chat notification fails
      }
    }

    return NextResponse.json({
      success: true,
      message: isNewCall ? 'Squad call scheduled successfully' : 'Squad call updated successfully',
      call: {
        dateTime,
        timezone,
        location,
        title: title || 'Squad coaching call',
      },
    });
  } catch (error) {
    console.error('[SQUAD_CALL_UPDATE_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/squads/[squadId]/call
 * 
 * Removes the scheduled call from a coached squad.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { squadId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;

    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json(
        { error: 'Forbidden - Coach, Admin, or Super Admin access required' },
        { status: 403 }
      );
    }

    // Fetch the squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squadData = squadDoc.data() as Squad;

    // Authorization check for coaches
    if (role === 'coach' && squadData.coachId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You are not the coach of this squad' },
        { status: 403 }
      );
    }

    // Clear call fields
    await adminDb.collection('squads').doc(squadId).update({
      nextCallDateTime: null,
      nextCallTimezone: null,
      nextCallLocation: null,
      nextCallTitle: null,
      updatedAt: new Date().toISOString(),
    });

    // Remove any scheduled reminder
    await adminDb.collection('squadCallReminders').doc(squadId).delete().catch(() => {});

    // Cancel any scheduled notification/email jobs
    await cancelSquadCallJobs({
      squadId,
      hasCoach: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Squad call removed successfully',
    });
  } catch (error) {
    console.error('[SQUAD_CALL_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Format call time for display in chat message
 */
function formatCallTime(date: Date, timezone: string): string {
  try {
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
    return formatter.format(date);
  } catch {
    return date.toLocaleString();
  }
}

