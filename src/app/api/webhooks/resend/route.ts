/**
 * Resend Webhook Handler
 * 
 * Handles webhook events from Resend for email tracking:
 * - email.delivered
 * - email.opened
 * - email.clicked
 * - email.bounced
 * - email.complained
 */

import { NextResponse } from 'next/server';
import { updateEmailStatus } from '@/lib/email-automation';
import type { EmailSendStatus } from '@/types';

// Resend webhook signing secret (set in Resend dashboard)
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.opened' | 'email.clicked' | 'email.bounced' | 'email.complained';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For clicked events
    click?: {
      link: string;
      timestamp: string;
    };
  };
}

/**
 * POST /api/webhooks/resend
 * Handle Resend webhook events
 */
export async function POST(request: Request) {
  try {
    // Verify webhook signature (if secret is configured)
    if (WEBHOOK_SECRET) {
      const signature = request.headers.get('svix-signature');
      const timestamp = request.headers.get('svix-timestamp');
      const svixId = request.headers.get('svix-id');
      
      if (!signature || !timestamp || !svixId) {
        console.warn('[RESEND_WEBHOOK] Missing signature headers');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }
      
      // TODO: Implement proper svix signature verification
      // For now, we'll accept requests but log a warning
      console.warn('[RESEND_WEBHOOK] Signature verification not fully implemented');
    }

    const event = await request.json() as ResendWebhookEvent;
    
    console.log(`[RESEND_WEBHOOK] Received event: ${event.type} for ${event.data.email_id}`);
    
    // Map Resend event types to our status
    let status: EmailSendStatus | null = null;
    
    switch (event.type) {
      case 'email.delivered':
        status = 'delivered';
        break;
      case 'email.opened':
        status = 'opened';
        break;
      case 'email.clicked':
        status = 'clicked';
        break;
      case 'email.bounced':
        status = 'bounced';
        break;
      case 'email.complained':
        status = 'bounced'; // Treat complaints as bounces
        break;
      case 'email.sent':
        // We already track sent status when we send
        return NextResponse.json({ received: true });
      default:
        console.log(`[RESEND_WEBHOOK] Unknown event type: ${event.type}`);
        return NextResponse.json({ received: true });
    }
    
    if (status) {
      // Update the email status in our database
      const success = await updateEmailStatus(
        event.data.email_id,
        status,
        event.created_at
      );
      
      if (!success) {
        console.warn(`[RESEND_WEBHOOK] Failed to update status for ${event.data.email_id}`);
      }
    }
    
    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('[RESEND_WEBHOOK] Error processing webhook:', error);
    // Return 200 to prevent Resend from retrying
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}

/**
 * GET /api/webhooks/resend
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Resend webhook endpoint is active',
  });
}

