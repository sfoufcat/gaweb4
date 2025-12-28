/**
 * API Route: Event Vote
 * 
 * POST /api/events/[eventId]/vote - Cast a vote for event approval
 * 
 * Body: { vote: 'yes' | 'no' }
 * 
 * Used for squad calls that require member approval (voting).
 * When enough yes votes are received, the event is automatically confirmed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { scheduleEventJobs } from '@/lib/event-notifications';
import { getStreamServerClient, ensureSystemBotUser, SYSTEM_BOT_USER_ID } from '@/lib/stream-server';
import type { UnifiedEvent, EventVote } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const { vote } = await request.json();

    if (!vote || !['yes', 'no'].includes(vote)) {
      return NextResponse.json(
        { error: 'Invalid vote. Use "yes" or "no"' },
        { status: 400 }
      );
    }

    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() } as UnifiedEvent;

    // Check if event requires voting
    if (event.approvalType !== 'voting') {
      return NextResponse.json(
        { error: 'This event does not require voting' },
        { status: 400 }
      );
    }

    // Check if event is still pending approval
    if (event.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Voting is closed for this event' },
        { status: 400 }
      );
    }

    // Verify user is allowed to vote (squad member check)
    if (event.squadId) {
      const membershipSnapshot = await adminDb
        .collection('squadMembers')
        .where('squadId', '==', event.squadId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (membershipSnapshot.empty) {
        return NextResponse.json(
          { error: 'You must be a squad member to vote' },
          { status: 403 }
        );
      }
    }

    const now = new Date().toISOString();
    const voteId = `${eventId}_${userId}`;
    const voteRef = adminDb.collection('eventVotes').doc(voteId);

    // Check for existing vote
    const existingVoteDoc = await voteRef.get();
    const existingVote = existingVoteDoc.exists 
      ? (existingVoteDoc.data() as EventVote).vote 
      : null;

    // Update or create vote
    const voteData: EventVote = {
      id: voteId,
      eventId,
      userId,
      vote,
      createdAt: existingVoteDoc.exists 
        ? (existingVoteDoc.data() as EventVote).createdAt 
        : now,
      updatedAt: now,
    };

    await voteRef.set(voteData);

    // Update vote counts on event
    const votingConfig = event.votingConfig || {
      yesCount: 0,
      noCount: 0,
      requiredVotes: 1,
      totalEligibleVoters: 1,
    };

    // Adjust counts based on vote change
    if (existingVote === 'yes' && vote === 'no') {
      votingConfig.yesCount = Math.max(0, votingConfig.yesCount - 1);
      votingConfig.noCount += 1;
    } else if (existingVote === 'no' && vote === 'yes') {
      votingConfig.noCount = Math.max(0, votingConfig.noCount - 1);
      votingConfig.yesCount += 1;
    } else if (!existingVote) {
      if (vote === 'yes') {
        votingConfig.yesCount += 1;
      } else {
        votingConfig.noCount += 1;
      }
    }

    // Check if event should be confirmed
    const shouldConfirm = votingConfig.yesCount >= votingConfig.requiredVotes;
    
    const updateData: Record<string, unknown> = {
      votingConfig,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (shouldConfirm && event.status === 'pending_approval') {
      updateData.status = 'confirmed';
      updateData.confirmedAt = now;
    }

    await eventRef.update(updateData);

    // If just confirmed, schedule notifications and send chat message
    if (shouldConfirm && event.status === 'pending_approval') {
      // Schedule notification jobs
      const confirmedEvent = { ...event, ...updateData, status: 'confirmed' } as UnifiedEvent;
      await scheduleEventJobs(confirmedEvent);

      // Send confirmation message to chat
      if (event.chatChannelId) {
        try {
          const streamClient = await getStreamServerClient();
          await ensureSystemBotUser(streamClient);

          const channel = streamClient.channel('messaging', event.chatChannelId);
          
          const formattedTime = formatEventTime(event.startDateTime, event.timezone);
          
          await channel.sendMessage({
            text: `✅ **Call Confirmed!**\n\n"${event.title}" has been approved by the squad.\n\n**When:** ${formattedTime}\n**Location:** ${event.locationLabel}`,
            user_id: SYSTEM_BOT_USER_ID,
            call_confirmed: true,
            event_id: eventId,
          } as Parameters<typeof channel.sendMessage>[0]);
        } catch (chatError) {
          console.error('[EVENT_VOTE] Failed to send chat confirmation:', chatError);
        }
      }

      console.log(`[EVENT_VOTE] Event ${eventId} confirmed with ${votingConfig.yesCount} votes`);
    }

    // Fetch updated event
    const updatedEventDoc = await eventRef.get();
    const updatedEvent = { id: updatedEventDoc.id, ...updatedEventDoc.data() } as UnifiedEvent;

    return NextResponse.json({
      success: true,
      vote,
      event: updatedEvent,
      userVote: vote,
      wasConfirmed: shouldConfirm && event.status === 'pending_approval',
    });
  } catch (error) {
    console.error('[EVENT_VOTE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cast vote' },
      { status: 500 }
    );
  }
}

/**
 * Format event time for display
 */
function formatEventTime(dateTime: string, timezone: string): string {
  try {
    const date = new Date(dateTime);
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
    return new Date(dateTime).toLocaleString();
  }
}





