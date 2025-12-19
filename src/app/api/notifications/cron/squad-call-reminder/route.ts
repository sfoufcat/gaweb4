import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient, ensureSystemBotUser, SYSTEM_BOT_USER_ID } from '@/lib/stream-server';
import type { StandardSquadCall } from '@/types';

/**
 * GET/POST /api/notifications/cron/squad-call-reminder
 * 
 * Cron job to send 1-hour-before reminders for scheduled squad calls.
 * Supports both premium squads (using squad document fields) and standard squads
 * (using the standardSquadCalls collection with voting).
 * 
 * This job should run every 5-10 minutes (e.g., every 5 minutes in cron syntax).
 * It checks for any pending reminders where:
 * - sent === false
 * - reminderTime <= now
 * 
 * For each matching reminder, it:
 * 1. Sends a reminder message to the squad chat
 * 2. Marks the reminder as sent
 * 
 * Standard squad reminders have:
 * - isStandardSquad: true
 * - callId: reference to the standardSquadCalls document
 * 
 * Security: Protected by CRON_SECRET header.
 * 
 * Note: Vercel cron jobs send GET requests by default, so we support both methods.
 */
export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  try {
    // Validate cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();
    const stats = {
      processed: 0,
      remindersSent: 0,
      skippedNoChannel: 0,
      errors: 0,
    };

    // Query for pending reminders that should be sent
    const remindersSnapshot = await adminDb
      .collection('squadCallReminders')
      .where('sent', '==', false)
      .where('reminderTime', '<=', now)
      .limit(50) // Process in batches
      .get();

    if (remindersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No pending reminders',
        stats,
      });
    }

    // Initialize Stream client once
    let streamClient = null;
    
    for (const doc of remindersSnapshot.docs) {
      stats.processed++;
      const reminderData = doc.data();
      const squadId = doc.id;

      try {
        // Check if chat channel exists
        if (!reminderData.chatChannelId) {
          stats.skippedNoChannel++;
          // Mark as sent to avoid reprocessing
          await adminDb.collection('squadCallReminders').doc(doc.id).update({
            sent: true,
            sentAt: now,
            error: 'No chat channel',
          });
          continue;
        }

        // Verify the call hasn't been rescheduled
        const squadDoc = await adminDb.collection('squads').doc(squadId).get();
        if (!squadDoc.exists) {
          // Squad was deleted, clean up reminder
          await adminDb.collection('squadCallReminders').doc(doc.id).delete();
          continue;
        }

        const squadData = squadDoc.data();
        
        // Check if call time still matches based on squad type
        if (reminderData.isStandardSquad) {
          // Standard squad - verify against standardSquadCalls collection
          if (!reminderData.callId) {
            await adminDb.collection('squadCallReminders').doc(doc.id).delete();
            continue;
          }

          const callDoc = await adminDb.collection('standardSquadCalls').doc(reminderData.callId).get();
          if (!callDoc.exists) {
            // Call was deleted
            await adminDb.collection('squadCallReminders').doc(doc.id).delete();
            continue;
          }

          const callData = callDoc.data() as StandardSquadCall;
          
          // Check if call is still confirmed and time matches
          if (callData.status !== 'confirmed' || callData.startDateTimeUtc !== reminderData.callDateTime) {
            // Call was canceled or rescheduled
            await adminDb.collection('squadCallReminders').doc(doc.id).delete();
            continue;
          }
        } else {
          // Premium squad - verify against squad document
          if (squadData?.nextCallDateTime !== reminderData.callDateTime) {
            // Call was rescheduled, this reminder is stale
            await adminDb.collection('squadCallReminders').doc(doc.id).delete();
            continue;
          }
        }

        // Initialize Stream client if not done yet
        if (!streamClient) {
          streamClient = await getStreamServerClient();
          await ensureSystemBotUser(streamClient);
        }

        // Send reminder message to squad chat
        const channel = streamClient.channel('messaging', reminderData.chatChannelId);
        
        // Format the call time for the message
        const callDate = new Date(reminderData.callDateTime);
        const formattedTime = formatCallTime(callDate, reminderData.callTimezone);

        const messageText = `⏰ **Reminder:** Your squad call starts in 1 hour!\n\n**When:** ${formattedTime}\n**Location:** ${reminderData.callLocation}`;

        await channel.sendMessage({
          text: messageText,
          user_id: SYSTEM_BOT_USER_ID,
          call_reminder: true,
          call_squad_id: squadId,
          call_date_time: reminderData.callDateTime,
        } as Parameters<typeof channel.sendMessage>[0]);

        // Mark reminder as sent
        await adminDb.collection('squadCallReminders').doc(doc.id).update({
          sent: true,
          sentAt: now,
        });

        stats.remindersSent++;
        console.log(`[CRON_SQUAD_REMINDER] Sent reminder for squad ${squadId} (${reminderData.isStandardSquad ? 'standard' : 'premium'})`);

      } catch (error) {
        console.error(`[CRON_SQUAD_REMINDER] Error processing squad ${squadId}:`, error);
        stats.errors++;
        
        // Mark with error but don't retry indefinitely
        await adminDb.collection('squadCallReminders').doc(doc.id).update({
          error: error instanceof Error ? error.message : 'Unknown error',
          lastErrorAt: now,
        }).catch(() => {});
      }
    }

    console.log('[CRON_SQUAD_REMINDER] Completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Squad call reminders cron completed',
      stats,
    });
  } catch (error: any) {
    console.error('[CRON_SQUAD_REMINDER] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process squad call reminders' },
      { status: 500 }
    );
  }
}

/**
 * Format call time for display in reminder message
 */
function formatCallTime(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    return formatter.format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

