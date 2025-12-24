import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient, ensureSystemBotUser, SYSTEM_BOT_USER_ID } from '@/lib/stream-server';
import { scheduleSquadCallJobs, cancelSquadCallJobs } from '@/lib/squad-call-notifications';
import type { Squad, StandardSquadCall, SquadCallVote } from '@/types';

/**
 * Standard Squad Call API
 * 
 * Handles call management for peer-led (non-coached) squads.
 * Any squad member can suggest, vote, and propose edits/deletions.
 * Calls are confirmed when >50% of members vote yes.
 */

// ============================================================================
// GET - Get current active call for a standard squad
// ============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { squadId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a member of this squad
    const membershipSnapshot = await adminDb
      .collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      return NextResponse.json({ error: 'Not a member of this squad' }, { status: 403 });
    }

    // Fetch the squad to verify it's not premium
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squadData = squadDoc.data() as Squad;
    const hasCoach = squadData.hasCoach ?? squadData.isPremium ?? false;
    if (hasCoach) {
      return NextResponse.json(
        { error: 'This endpoint is for peer-led squads only. Coached squads use the coach scheduling endpoint.' },
        { status: 400 }
      );
    }

    // Get active call (pending or confirmed, not canceled)
    // Query by squadId only, then filter/sort in code to avoid composite index requirement
    const callsSnapshot = await adminDb
      .collection('standardSquadCalls')
      .where('squadId', '==', squadId)
      .get();

    // Filter for active calls and sort by createdAt desc
    // Exclude confirmed delete proposals - they represent "no active call"
    const activeCalls = callsSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        if (data.status === 'confirmed' && data.proposalType === 'delete') {
          return false;
        }
        return data.status === 'pending' || data.status === 'confirmed';
      })
      .sort((a, b) => {
        const aTime = new Date(a.data().createdAt).getTime();
        const bTime = new Date(b.data().createdAt).getTime();
        return bTime - aTime; // desc
      });

    if (activeCalls.length === 0) {
      return NextResponse.json({ call: null, userVote: null });
    }

    const callDoc = activeCalls[0];
    const call = { id: callDoc.id, ...callDoc.data() } as StandardSquadCall;

    // Get user's vote for this call
    const voteDoc = await adminDb
      .collection('squadCallVotes')
      .doc(`${call.id}_${userId}`)
      .get();

    const userVote = voteDoc.exists ? (voteDoc.data() as SquadCallVote).vote : null;

    return NextResponse.json({ call, userVote });
  } catch (error) {
    console.error('[STANDARD_CALL_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Suggest a new call (or propose edit/delete)
// ============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { squadId } = await params;
    const { userId } = await auth();

    console.log('[STANDARD_CALL_POST] Starting - squadId:', squadId, 'userId:', userId);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[STANDARD_CALL_POST] Request body:', body);
    const { 
      dateTime, 
      timezone, 
      location, 
      title,
      proposalType = 'new',
      originalCallId,
    } = body;

    // Validate required fields for new/edit proposals
    if (proposalType !== 'delete') {
      if (!dateTime || !timezone || !location) {
        return NextResponse.json(
          { error: 'Missing required fields: dateTime, timezone, location' },
          { status: 400 }
        );
      }

      // Validate dateTime is in the future
      const callDate = new Date(dateTime);
      if (isNaN(callDate.getTime())) {
        return NextResponse.json({ error: 'Invalid dateTime format' }, { status: 400 });
      }

      if (callDate.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Call must be scheduled in the future' }, { status: 400 });
      }
    }

    // Verify squad exists and is not premium
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squadData = squadDoc.data() as Squad;
    const squadHasCoach = squadData.hasCoach ?? squadData.isPremium ?? false;
    if (squadHasCoach) {
      return NextResponse.json(
        { error: 'This endpoint is for peer-led squads only. Coached squads use the coach scheduling endpoint.' },
        { status: 400 }
      );
    }

    // Verify user is a member of this squad
    const membershipSnapshot = await adminDb
      .collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      return NextResponse.json({ error: 'Not a member of this squad' }, { status: 403 });
    }

    // Count total squad members
    const allMembersSnapshot = await adminDb
      .collection('squadMembers')
      .where('squadId', '==', squadId)
      .get();
    
    const totalMembers = allMembersSnapshot.size;
    const requiredVotes = Math.floor(totalMembers / 2) + 1;

    // Check for existing active call
    // Query by squadId only, then filter in code to avoid composite index requirement
    const existingCallsSnapshot = await adminDb
      .collection('standardSquadCalls')
      .where('squadId', '==', squadId)
      .get();

    // Filter for active calls (pending or confirmed)
    const existingActiveCalls = existingCallsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.status === 'pending' || data.status === 'confirmed';
    });

    // For new proposals, cancel any existing pending calls
    if (proposalType === 'new' && existingActiveCalls.length > 0) {
      // Cancel the existing call
      const existingCall = existingActiveCalls[0];
      await adminDb.collection('standardSquadCalls').doc(existingCall.id).update({
        status: 'canceled',
        updatedAt: new Date().toISOString(),
      });
    }

    // For edit/delete proposals, verify original call exists
    if ((proposalType === 'edit' || proposalType === 'delete') && originalCallId) {
      const originalCallDoc = await adminDb
        .collection('standardSquadCalls')
        .doc(originalCallId)
        .get();
      
      if (!originalCallDoc.exists) {
        return NextResponse.json({ error: 'Original call not found' }, { status: 404 });
      }

      const originalCall = originalCallDoc.data() as StandardSquadCall;
      if (originalCall.squadId !== squadId) {
        return NextResponse.json({ error: 'Call does not belong to this squad' }, { status: 403 });
      }

      // Mark original as having a pending edit/delete proposal
      await adminDb.collection('standardSquadCalls').doc(originalCallId).update({
        status: 'canceled', // Cancel the old one, new proposal becomes active
        updatedAt: new Date().toISOString(),
      });
    }

    const now = new Date().toISOString();

    // Create the call/proposal
    const callData: Omit<StandardSquadCall, 'id'> = {
      squadId,
      createdByUserId: userId,
      status: 'pending',
      proposalType,
      startDateTimeUtc: proposalType === 'delete' ? '' : dateTime,
      timezone: proposalType === 'delete' ? '' : timezone,
      location: proposalType === 'delete' ? '' : location,
      title: title?.trim() || 'Squad accountability call',
      // Use null instead of undefined for optional fields (Firestore compatibility)
      ...(originalCallId ? { originalCallId } : {}),
      yesCount: 1, // Creator automatically votes yes
      noCount: 0,
      requiredVotes,
      totalMembers,
      createdAt: now,
      updatedAt: now,
    };

    const callRef = await adminDb.collection('standardSquadCalls').add(callData);
    const callId = callRef.id;

    // Create creator's automatic YES vote
    const voteData: SquadCallVote = {
      id: `${callId}_${userId}`,
      callId,
      squadId,
      userId,
      vote: 'yes',
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('squadCallVotes').doc(voteData.id).set(voteData);

    // Check if call is immediately confirmed (e.g., squad of 1-2 members)
    let isConfirmed = false;
    if (callData.yesCount >= requiredVotes) {
      isConfirmed = true;
      await confirmCall(callId, squadId, squadData);
    }

    // Send chat notification
    await sendCallSuggestedNotification(
      squadData,
      userId,
      proposalType,
      proposalType === 'delete' ? '' : dateTime,
      proposalType === 'delete' ? '' : timezone,
      proposalType === 'delete' ? '' : location
    );

    return NextResponse.json({
      success: true,
      call: { id: callId, ...callData },
      isConfirmed,
    });
  } catch (error) {
    console.error('[STANDARD_CALL_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PUT - Vote on a call
// ============================================================================

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { squadId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { callId, vote } = body;

    if (!callId || !vote || !['yes', 'no'].includes(vote)) {
      return NextResponse.json(
        { error: 'Invalid request: callId and vote (yes/no) required' },
        { status: 400 }
      );
    }

    // Verify squad exists and is not premium
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squadData = squadDoc.data() as Squad;
    const squadHasCoachVote = squadData.hasCoach ?? squadData.isPremium ?? false;
    if (squadHasCoachVote) {
      return NextResponse.json(
        { error: 'This endpoint is for peer-led squads only. Coached squads use the coach scheduling endpoint.' },
        { status: 400 }
      );
    }

    // Verify user is a member of this squad
    const membershipSnapshot = await adminDb
      .collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      return NextResponse.json({ error: 'Not a member of this squad' }, { status: 403 });
    }

    // Fetch the call
    const callDoc = await adminDb.collection('standardSquadCalls').doc(callId).get();
    if (!callDoc.exists) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    const callData = callDoc.data() as Omit<StandardSquadCall, 'id'>;

    // Only allow voting on pending calls
    if (callData.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot vote on this call - it is not pending' },
        { status: 400 }
      );
    }

    // Verify call belongs to this squad
    if (callData.squadId !== squadId) {
      return NextResponse.json({ error: 'Call does not belong to this squad' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const voteId = `${callId}_${userId}`;

    // Check for existing vote
    const existingVoteDoc = await adminDb.collection('squadCallVotes').doc(voteId).get();
    const existingVote = existingVoteDoc.exists ? (existingVoteDoc.data() as SquadCallVote).vote : null;

    // Calculate vote changes
    let yesChange = 0;
    let noChange = 0;

    if (existingVote) {
      if (existingVote === vote) {
        // No change needed
        return NextResponse.json({
          success: true,
          message: 'Vote unchanged',
          call: { id: callId, ...callData },
        });
      }
      // Changing vote
      if (existingVote === 'yes' && vote === 'no') {
        yesChange = -1;
        noChange = 1;
      } else {
        yesChange = 1;
        noChange = -1;
      }
    } else {
      // New vote
      if (vote === 'yes') {
        yesChange = 1;
      } else {
        noChange = 1;
      }
    }

    // Update vote document
    const voteData: SquadCallVote = {
      id: voteId,
      callId,
      squadId,
      userId,
      vote,
      createdAt: existingVoteDoc.exists 
        ? (existingVoteDoc.data() as SquadCallVote).createdAt 
        : now,
      updatedAt: now,
    };

    await adminDb.collection('squadCallVotes').doc(voteId).set(voteData);

    // Update call vote counts
    const newYesCount = callData.yesCount + yesChange;
    const newNoCount = callData.noCount + noChange;

    await adminDb.collection('standardSquadCalls').doc(callId).update({
      yesCount: newYesCount,
      noCount: newNoCount,
      updatedAt: now,
    });

    // Check if call is now confirmed
    let isConfirmed = false;
    if (newYesCount >= callData.requiredVotes && callData.status === 'pending') {
      isConfirmed = true;
      await confirmCall(callId, squadId, squadData);
    }

    // Fetch updated call
    const updatedCallDoc = await adminDb.collection('standardSquadCalls').doc(callId).get();
    const updatedCall = { id: callId, ...updatedCallDoc.data() } as StandardSquadCall;

    return NextResponse.json({
      success: true,
      call: updatedCall,
      userVote: vote,
      isConfirmed,
    });
  } catch (error) {
    console.error('[STANDARD_CALL_VOTE_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function confirmCall(callId: string, squadId: string, squadData: Squad) {
  const now = new Date().toISOString();

  // Get the call data
  const callDoc = await adminDb.collection('standardSquadCalls').doc(callId).get();
  const callData = callDoc.data() as StandardSquadCall;

  // Update call status to confirmed
  await adminDb.collection('standardSquadCalls').doc(callId).update({
    status: 'confirmed',
    confirmedAt: now,
    updatedAt: now,
  });

  // Handle different proposal types
  if (callData.proposalType === 'delete') {
    // Delete proposal confirmed - send cancellation notification
    await sendCallCanceledNotification(squadData);
    // Remove any scheduled reminders
    await adminDb.collection('squadCallReminders').doc(`standard_${squadId}`).delete().catch(() => {});
    // Cancel any scheduled notification/email jobs
    await cancelSquadCallJobs({
      squadId,
      hasCoach: false,
      callId,
    });
    return;
  }

  // For edit proposals, cancel previous jobs first
  if (callData.proposalType === 'edit' && callData.originalCallId) {
    await cancelSquadCallJobs({
      squadId,
      hasCoach: false,
      callId: callData.originalCallId,
    });
  }

  // For new/edit proposals, schedule the reminder
  const callDate = new Date(callData.startDateTimeUtc);
  const reminderTime = new Date(callDate.getTime() - 60 * 60 * 1000); // 1 hour before

  if (reminderTime.getTime() > Date.now()) {
    await adminDb.collection('squadCallReminders').doc(`standard_${squadId}`).set({
      squadId,
      squadName: squadData.name,
      callDateTime: callData.startDateTimeUtc,
      callTimezone: callData.timezone,
      callLocation: callData.location,
      callTitle: callData.title,
      reminderTime: reminderTime.toISOString(),
      chatChannelId: squadData.chatChannelId,
      sent: false,
      isStandardSquad: true, // Flag to identify standard squad reminders
      callId,
      createdAt: now,
      updatedAt: now,
    }, { merge: false });
  }

  // Schedule notification and email jobs (24h before, 1h before, at start)
  try {
    await scheduleSquadCallJobs({
      squadId,
      squadName: squadData.name,
      hasCoach: false,
      callDateTime: callData.startDateTimeUtc,
      callTimezone: callData.timezone,
      callLocation: callData.location,
      callTitle: callData.title,
      chatChannelId: squadData.chatChannelId || undefined,
      callId,
    });
  } catch (jobError) {
    console.error('[STANDARD_CALL_CONFIRM] Failed to schedule notification/email jobs:', jobError);
    // Don't fail the request if job scheduling fails
  }

  // Send confirmed notification
  if (callData.proposalType === 'edit') {
    await sendCallUpdatedNotification(squadData, callData.startDateTimeUtc, callData.timezone, callData.location);
  } else {
    await sendCallConfirmedNotification(squadData, callData.startDateTimeUtc, callData.timezone, callData.location);
  }
}

async function sendCallSuggestedNotification(
  squad: Squad,
  userId: string,
  proposalType: string,
  dateTime: string,
  timezone: string,
  location: string
) {
  if (!squad.chatChannelId) return;

  try {
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);

    const channel = streamClient.channel('messaging', squad.chatChannelId);

    // Get user name for the message
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userName = userData?.firstName || 'Someone';

    let messageText = '';

    if (proposalType === 'delete') {
      messageText = `🗑️ **${userName}** proposed to cancel the upcoming squad call.\n\nVote to approve or reject this proposal.`;
    } else if (proposalType === 'edit') {
      const formattedDate = formatCallTime(new Date(dateTime), timezone);
      messageText = `✏️ **${userName}** proposed a new time for the squad call:\n\n**When:** ${formattedDate}\n**Location:** ${location}\n\nVote to approve this change.`;
    } else {
      const formattedDate = formatCallTime(new Date(dateTime), timezone);
      messageText = `📅 **${userName}** suggested a new squad call!\n\n**When:** ${formattedDate}\n**Location:** ${location}\n\nVote to confirm this call.`;
    }

    await channel.sendMessage({
      text: messageText,
      user_id: SYSTEM_BOT_USER_ID,
      standard_call_notification: true,
      notification_type: 'suggested',
    } as Parameters<typeof channel.sendMessage>[0]);
  } catch (error) {
    console.error('[STANDARD_CALL_CHAT_ERROR] Failed to send suggested notification:', error);
  }
}

async function sendCallConfirmedNotification(
  squad: Squad,
  dateTime: string,
  timezone: string,
  location: string
) {
  if (!squad.chatChannelId) return;

  try {
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);

    const channel = streamClient.channel('messaging', squad.chatChannelId);

    const formattedDate = formatCallTime(new Date(dateTime), timezone);
    const messageText = `✅ **The squad call is confirmed!**\n\n**When:** ${formattedDate}\n**Location:** ${location}`;

    await channel.sendMessage({
      text: messageText,
      user_id: SYSTEM_BOT_USER_ID,
      standard_call_notification: true,
      notification_type: 'confirmed',
    } as Parameters<typeof channel.sendMessage>[0]);
  } catch (error) {
    console.error('[STANDARD_CALL_CHAT_ERROR] Failed to send confirmed notification:', error);
  }
}

async function sendCallUpdatedNotification(
  squad: Squad,
  dateTime: string,
  timezone: string,
  location: string
) {
  if (!squad.chatChannelId) return;

  try {
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);

    const channel = streamClient.channel('messaging', squad.chatChannelId);

    const formattedDate = formatCallTime(new Date(dateTime), timezone);
    const messageText = `✏️ **The squad call time has been updated!**\n\n**When:** ${formattedDate}\n**Location:** ${location}`;

    await channel.sendMessage({
      text: messageText,
      user_id: SYSTEM_BOT_USER_ID,
      standard_call_notification: true,
      notification_type: 'updated',
    } as Parameters<typeof channel.sendMessage>[0]);
  } catch (error) {
    console.error('[STANDARD_CALL_CHAT_ERROR] Failed to send updated notification:', error);
  }
}

async function sendCallCanceledNotification(squad: Squad) {
  if (!squad.chatChannelId) return;

  try {
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);

    const channel = streamClient.channel('messaging', squad.chatChannelId);

    const messageText = `❌ **The upcoming squad call has been canceled.**`;

    await channel.sendMessage({
      text: messageText,
      user_id: SYSTEM_BOT_USER_ID,
      standard_call_notification: true,
      notification_type: 'canceled',
    } as Parameters<typeof channel.sendMessage>[0]);
  } catch (error) {
    console.error('[STANDARD_CALL_CHAT_ERROR] Failed to send canceled notification:', error);
  }
}

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

