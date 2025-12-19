import { NextRequest, NextResponse } from 'next/server';
import { processAbandonedEmails } from '@/lib/email';

/**
 * GET/POST /api/notifications/cron/abandoned
 * 
 * Cron job to send abandoned quiz/payment emails.
 * 
 * This job should run frequently (every 5-10 minutes) to catch users
 * who started the quiz but haven't paid within 15 minutes.
 * 
 * Example cron schedule: "every 5 minutes"
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

    console.log('[CRON_ABANDONED] Starting abandoned email processing...');

    // Process abandoned cart emails
    const stats = await processAbandonedEmails();

    console.log('[CRON_ABANDONED] Completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Abandoned email cron completed',
      stats,
    });
  } catch (error: any) {
    console.error('[CRON_ABANDONED] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process abandoned emails' },
      { status: 500 }
    );
  }
}



