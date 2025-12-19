import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient, ensureSystemBotUser, SYSTEM_BOT_USER_ID } from '@/lib/stream-server';

/**
 * POST /api/checkin/morning/squad-notification
 * 
 * Sends a notification to the user's squad chat when they complete
 * their morning check-in. Only sends once per day per user.
 */
export async function POST(_request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    const notificationDocId = `${userId}_${today}`;

    // Check if notification already sent today
    const existingNotification = await adminDb
      .collection('squadCheckinNotifications')
      .doc(notificationDocId)
      .get();

    if (existingNotification.exists) {
      // Already sent today - this is fine, just return success
      return NextResponse.json({ 
        success: true, 
        alreadySent: true,
        message: 'Notification already sent for today' 
      });
    }

    // Get user's squad membership
    const membershipSnapshot = await adminDb
      .collection('squadMembers')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      // User is not in a squad - this is fine, just return
      return NextResponse.json({ 
        success: true, 
        noSquad: true,
        message: 'User is not in a squad' 
      });
    }

    const squadId = membershipSnapshot.docs[0].data().squadId;

    // Get the squad document to check for chatChannelId
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    
    if (!squadDoc.exists) {
      return NextResponse.json({ 
        success: true, 
        noSquad: true,
        message: 'Squad not found' 
      });
    }

    const squadData = squadDoc.data();
    const chatChannelId = squadData?.chatChannelId;

    if (!chatChannelId) {
      // Squad has no chat channel - this is fine, just return
      return NextResponse.json({ 
        success: true, 
        noChannel: true,
        message: 'Squad has no chat channel' 
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

    // Get today's focus tasks
    // Use a simpler query and filter/sort in memory to avoid compound index requirement
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

    // Build the message
    let messageText = `${userName} just completed their morning check-in`;
    
    if (focusTasks.length > 0) {
      messageText += ` and set today's focus.\n\nToday's focus:\n`;
      focusTasks.forEach(task => {
        messageText += `• ${task.title}\n`;
      });
    } else {
      messageText += '.';
    }

    // Ensure the system bot user exists
    const streamClient = await getStreamServerClient();
    await ensureSystemBotUser(streamClient);

    // Get the channel and send the message
    const channel = streamClient.channel('messaging', chatChannelId);
    
    // Use type assertion for custom message fields
    await channel.sendMessage({
      text: messageText.trim(),
      user_id: SYSTEM_BOT_USER_ID,
      // Custom fields for styling and identification
      checkin_notification: true,
      checkin_date: today,
      checkin_user_id: userId,
      checkin_user_name: userName,
    } as Parameters<typeof channel.sendMessage>[0]);

    // Record that we've sent the notification for today
    await adminDb.collection('squadCheckinNotifications').doc(notificationDocId).set({
      userId,
      date: today,
      squadId,
      chatChannelId,
      userName,
      taskCount: focusTasks.length,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      sent: true,
      message: 'Squad notification sent successfully' 
    });

  } catch (error: any) {
    console.error('[SQUAD_NOTIFICATION_ERROR]', error);
    // Don't fail the check-in if notification fails - just log and return success
    return NextResponse.json({ 
      success: true, 
      error: error.message,
      message: 'Failed to send notification but check-in succeeded' 
    });
  }
}

