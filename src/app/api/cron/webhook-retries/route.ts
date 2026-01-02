/**
 * Webhook Retries Cron Job
 * 
 * POST /api/cron/webhook-retries
 * 
 * Processes pending webhook retries.
 * Should be called by Vercel Cron every 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processWebhookRetries, cleanupOldWebhookLogs } from '@/lib/integrations/webhook-dispatcher';

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow in development without secret
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  if (!cronSecret) {
    console.warn('[WEBHOOK_RETRIES_CRON] CRON_SECRET not configured');
    return false;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyCronSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[WEBHOOK_RETRIES_CRON] Starting webhook retry processing...');
    
    // Process pending retries
    await processWebhookRetries();
    
    // Cleanup old logs (runs as part of the same job)
    await cleanupOldWebhookLogs();

    console.log('[WEBHOOK_RETRIES_CRON] Completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Webhook retries processed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WEBHOOK_RETRIES_CRON] Error:', error);
    return NextResponse.json(
      { error: 'Internal Error' },
      { status: 500 }
    );
  }
}

// Also allow GET for Vercel Cron compatibility
export async function GET(req: NextRequest) {
  return POST(req);
}

