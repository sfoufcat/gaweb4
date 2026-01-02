import { NextRequest, NextResponse } from 'next/server';
import { processRecurringEvents } from '@/lib/event-recurrence';

/**
 * GET/POST /api/notifications/cron/event-recurrence
 * 
 * Daily cron job to generate recurring event instances.
 * 
 * This job should run once per day (e.g., at midnight) to:
 * 1. Find all recurring parent events
 * 2. Generate instances for the next 2 weeks
 * 3. Schedule notification jobs for new instances
 * 
 * For each recurring event, it generates instance documents that:
 * - Have their own startDateTime for the specific occurrence
 * - Reference the parent event via parentEventId
 * - Get their own notification jobs scheduled
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

    // Process recurring events - generate instances for next 14 days
    const stats = await processRecurringEvents(14);

    console.log('[CRON_RECURRENCE] Completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Event recurrence cron completed',
      stats,
    });
  } catch (error: unknown) {
    console.error('[CRON_RECURRENCE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process recurring events';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}










