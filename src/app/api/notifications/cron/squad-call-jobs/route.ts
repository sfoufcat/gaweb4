import { NextRequest, NextResponse } from 'next/server';
import { processSquadCallScheduledJobs } from '@/lib/squad-call-notifications';
import { processCoachingCallScheduledJobs } from '@/lib/coaching-call-notifications';
import { processEventScheduledJobs } from '@/lib/event-notifications';

/**
 * GET/POST /api/notifications/cron/squad-call-jobs
 * 
 * Cron job to process scheduled event notification/email jobs.
 * 
 * This job should run every 5 minutes to process:
 * - 24-hour-before notifications and emails
 * - 1-hour-before notifications and emails
 * - At-start (live) notifications
 * - Chat reminders
 * 
 * For each due job, it:
 * 1. Validates the event still exists and hasn't been rescheduled
 * 2. Sends notifications/emails to participants
 * 3. Marks the job as executed
 * 
 * Processes both:
 * - Unified events (eventScheduledJobs collection) - NEW
 * - Legacy squad/coaching jobs (for backward compatibility during migration)
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

    // Process all pending scheduled jobs (unified + legacy)
    const [unifiedStats, squadStats, coachingStats] = await Promise.all([
      // New unified event system
      processEventScheduledJobs(),
      // Legacy systems (keep for backward compatibility during migration)
      processSquadCallScheduledJobs(),
      processCoachingCallScheduledJobs(),
    ]);

    console.log('[CRON_EVENT_JOBS] Completed:', {
      unified: unifiedStats,
      legacySquads: squadStats,
      legacyCoaching: coachingStats,
    });

    return NextResponse.json({
      success: true,
      message: 'Event scheduled jobs cron completed',
      unifiedStats,
      squadStats,
      coachingStats,
    });
  } catch (error: unknown) {
    console.error('[CRON_EVENT_JOBS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process event jobs';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

