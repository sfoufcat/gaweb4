import { NextRequest, NextResponse } from 'next/server';
import { processSquadCallScheduledJobs } from '@/lib/squad-call-notifications';
import { processCoachingCallScheduledJobs } from '@/lib/coaching-call-notifications';

/**
 * GET/POST /api/notifications/cron/squad-call-jobs
 * 
 * Cron job to process scheduled squad call AND coaching call notification/email jobs.
 * 
 * This job should run every 5 minutes to process:
 * - 24-hour-before notifications and emails
 * - 1-hour-before notifications and emails
 * - At-start (live) notifications
 * 
 * For each due job, it:
 * 1. Validates the call still exists and hasn't been rescheduled
 * 2. Sends notifications/emails to squad members or coaching client
 * 3. Marks the job as executed
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

    // Process all pending scheduled jobs (squads and coaching)
    const [squadStats, coachingStats] = await Promise.all([
      processSquadCallScheduledJobs(),
      processCoachingCallScheduledJobs(),
    ]);

    console.log('[CRON_CALL_JOBS] Completed - Squads:', squadStats, 'Coaching:', coachingStats);

    return NextResponse.json({
      success: true,
      message: 'Call scheduled jobs cron completed',
      squadStats,
      coachingStats,
    });
  } catch (error: unknown) {
    console.error('[CRON_CALL_JOBS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process call jobs';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

