/**
 * Email Queue API
 * 
 * Queue emails for automated sending.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { queueEmailsForTrigger } from '@/lib/email-automation';
import type { EmailFlowTrigger } from '@/types';

/**
 * POST /api/email/queue
 * Queue emails for a specific trigger
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    
    // Allow internal calls without auth (for system triggers)
    // In production, add proper internal API key validation
    const internalKey = request.headers.get('x-internal-key');
    const isInternalCall = internalKey === process.env.INTERNAL_API_KEY;
    
    if (!userId && !isInternalCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      trigger, 
      recipientEmail, 
      recipientUserId, 
      recipientOrgId,
      variables 
    } = body;

    // Validate required fields
    if (!trigger || !recipientEmail || !recipientUserId) {
      return NextResponse.json(
        { error: 'Missing required fields: trigger, recipientEmail, recipientUserId' },
        { status: 400 }
      );
    }

    // Validate trigger type
    const validTriggers: EmailFlowTrigger[] = [
      'signup_no_plan',
      'trial_started',
      'day_14',
      'trial_ending',
      'subscription_canceled',
    ];
    
    if (!validTriggers.includes(trigger)) {
      return NextResponse.json(
        { error: `Invalid trigger. Must be one of: ${validTriggers.join(', ')}` },
        { status: 400 }
      );
    }

    // Queue the emails
    const result = await queueEmailsForTrigger(
      trigger as EmailFlowTrigger,
      recipientEmail,
      recipientUserId,
      recipientOrgId,
      variables
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to queue emails' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      queuedCount: result.queuedCount,
    });

  } catch (error) {
    console.error('[EMAIL_QUEUE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to queue emails' },
      { status: 500 }
    );
  }
}

