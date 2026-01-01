/**
 * Process Email Queue Cron Job
 * 
 * This endpoint is called by Vercel Cron to process pending emails.
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-email-queue",
 *     "schedule": "*/15 * * * *"
 *   }]
 * }
 */

import { NextResponse } from 'next/server';
import { processEmailQueue, initializeEmailFlows } from '@/lib/email-automation';

// Vercel cron job secret (set in environment)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/process-email-queue
 * Process the email queue (called by Vercel Cron)
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret if configured
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        console.warn('[CRON] Invalid cron secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    console.log('[CRON] Starting email queue processing...');
    
    // Initialize flows if needed (on first run)
    await initializeEmailFlows();
    
    // Process the queue
    const result = await processEmailQueue();
    
    console.log(`[CRON] Completed: ${result.processed} processed, ${result.sent} sent, ${result.failed} failed`);
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[CRON] Error processing email queue:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process email queue',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/process-email-queue
 * Manual trigger for testing
 */
export async function POST(request: Request) {
  // Use same logic as GET
  return GET(request);
}

