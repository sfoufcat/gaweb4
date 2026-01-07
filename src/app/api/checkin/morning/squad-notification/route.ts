import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient, ensureSystemBotUser, SYSTEM_BOT_USER_ID } from '@/lib/stream-server';
import { getEffectiveOrgId } from '@/lib/tenant/context';

interface SquadNotificationResult {
  squadId: string;
  squadName: string;
  sent: boolean;
  alreadySent?: boolean;
  noChannel?: boolean;
  error?: string;
}

/**
 * POST /api/checkin/morning/squad-notification
 * 
 * Sends a notification to ALL of the user's squad chats when they complete
 * their morning check-in. Sends once per day per squad per user.
 */
export async function POST(_request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current organization context - only send to squads in this org
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      console.log(`[SQUAD_NOTIFICATION] No organization context - skipping notifications`);
      return NextResponse.json({ success: true, noOrg: true, message: 'No organization context' });
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Get ALL of the user's squad memberships (no limit)
    const membershipSnapshot = await adminDb
      .collection('squadMembers')
      .where('userId', '==', userId)
      .get();

    console.log(`[SQUAD_NOTIFICATION] Found ${membershipSnapshot.size} squad memberships for user ${userId}`);

    if (membershipSnapshot.empty) {
      // User is not in any squad - this is fine, just return
      console.log(`[SQUAD_NOTIFICATION] User ${userId} has no squad memberships in squadMembers collection`);
      return NextResponse.json({ 
        success: true, 
        noSquad: true,
        message: 'User is not in any squad' 
      });
    }

    // Get user's display name from Clerk
    const clerk = await clerkClient();
    let userName = 'Someone';
    
    try {
      const clerkUser = await clerk.users.getUser(userId);
      userName = clerkUser.firstName || clerkUser.lastName || 'Someone';
      if (clerkUser.firstName && clerkUser.lastName) {
        userName = clerkUser.firstName;
      }
    } catch (err) {
      console.error('[SQUAD_NOTIFICATION] Failed to get Clerk user:', err);
      // Fallback to Firebase user data
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        userName = userData?.name || userData?.firstName || 'Someone';
      }
    }

    // Get today's focus tasks (once, reuse for all squads)
    const tasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', today)
      .get();

    const focusTasks = tasksSnapshot.docs
      .map(doc => doc.data())
      .filter(task => task.listType === 'focus' && !task.isPrivate) // Only focus tasks, exclude private
      .sort((a, b) => (a.order || 0) - (b.order || 0)) // Sort by order
      .slice(0, 3); // Limit to 3

    // Build the message (same for all squads)
    let messageText = `${userName} just completed their morning check-in`;
    
    if (focusTasks.length > 0) {
      messageText += ` and set today's focus.\n\nToday's focus:\n`;
      focusTasks.forEach(task => {
        messageText += `• ${task.title}\n`;
      });
    } else {
      messageText += '.';
    }

    // Ensure the system bot user exists (once)
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);

    // Process each squad membership
    const results: SquadNotificationResult[] = [];
    
    for (const memberDoc of membershipSnapshot.docs) {
      const squadId = memberDoc.data().squadId;
      const notificationDocId = `${userId}_${squadId}_${today}`;
      
      try {
        // Check if notification already sent to this squad today
        const existingNotification = await adminDb
          .collection('squadCheckinNotifications')
          .doc(notificationDocId)
          .get();

        // Get the squad document
        const squadDoc = await adminDb.collection('squads').doc(squadId).get();
        const squadData = squadDoc.data();
        const squadName = squadDoc.exists ? squadData?.name || 'Unknown Squad' : 'Unknown Squad';
        const isStandaloneSquad = !squadData?.programId;
        const hasChatChannel = !!squadData?.chatChannelId;
        
        console.log(`[SQUAD_NOTIFICATION] Processing squad ${squadId} (${squadName}): isStandalone=${isStandaloneSquad}, hasChatChannel=${hasChatChannel}, programId=${squadData?.programId || 'none'}, squadOrgId=${squadData?.organizationId || 'none'}`);

        // MULTI-TENANCY: Skip squads from other organizations
        if (squadData?.organizationId !== organizationId) {
          console.log(`[SQUAD_NOTIFICATION] Skipping squad ${squadId} (${squadName}): belongs to org ${squadData?.organizationId}, not ${organizationId}`);
          results.push({
            squadId,
            squadName,
            sent: false,
            error: 'Squad belongs to different organization',
          });
          continue;
        }

        if (existingNotification.exists) {
          results.push({
            squadId,
            squadName,
            sent: false,
            alreadySent: true,
          });
          continue;
        }

        if (!squadDoc.exists) {
          results.push({
            squadId,
            squadName,
            sent: false,
            error: 'Squad not found',
          });
          continue;
        }

        const chatChannelId = squadData?.chatChannelId;

        if (!chatChannelId) {
          console.log(`[SQUAD_NOTIFICATION] Skipping squad ${squadId} (${squadName}): NO CHAT CHANNEL - isStandalone=${isStandaloneSquad}`);
          results.push({
            squadId,
            squadName,
            sent: false,
            noChannel: true,
          });
          continue;
        }

        // Get the channel and send the message
        const channel = streamClient.channel('messaging', chatChannelId);
        
        await channel.sendMessage({
          text: messageText.trim(),
          user_id: SYSTEM_BOT_USER_ID,
          checkin_notification: true,
          checkin_date: today,
          checkin_user_id: userId,
          checkin_user_name: userName,
        } as Parameters<typeof channel.sendMessage>[0]);

        // Record that we've sent the notification to this squad for today
        await adminDb.collection('squadCheckinNotifications').doc(notificationDocId).set({
          userId,
          date: today,
          squadId,
          chatChannelId,
          userName,
          taskCount: focusTasks.length,
          createdAt: new Date().toISOString(),
        });

        results.push({
          squadId,
          squadName,
          sent: true,
        });

        console.log(`[SQUAD_NOTIFICATION] Sent to squad ${squadName} (${squadId}) for user ${userId}`);

      } catch (squadError) {
        console.error(`[SQUAD_NOTIFICATION] Error sending to squad ${squadId}:`, squadError);
        const squadDoc = await adminDb.collection('squads').doc(squadId).get();
        results.push({
          squadId,
          squadName: squadDoc.exists ? squadDoc.data()?.name || 'Unknown Squad' : 'Unknown Squad',
          sent: false,
          error: squadError instanceof Error ? squadError.message : 'Unknown error',
        });
      }
    }

    const sentCount = results.filter(r => r.sent).length;
    const alreadySentCount = results.filter(r => r.alreadySent).length;
    const noChannelCount = results.filter(r => r.noChannel).length;
    const errorCount = results.filter(r => r.error).length;

    console.log(`[SQUAD_NOTIFICATION] Summary for user ${userId}: total=${results.length}, sent=${sentCount}, alreadySent=${alreadySentCount}, noChannel=${noChannelCount}, errors=${errorCount}`);

    return NextResponse.json({ 
      success: true,
      message: `Notifications processed for ${results.length} squad(s): ${sentCount} sent, ${alreadySentCount} already sent, ${noChannelCount} no channel, ${errorCount} errors`,
      squadCount: results.length,
      sentCount,
      alreadySentCount,
      noChannelCount,
      errorCount,
      results,
    });

  } catch (error) {
    console.error('[SQUAD_NOTIFICATION_ERROR]', error);
    // Don't fail the check-in if notification fails - just log and return success
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: true, 
      error: errorMessage,
      message: 'Failed to send notification but check-in succeeded' 
    });
  }
}

