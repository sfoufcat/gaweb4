/**
 * Cancel Queued Emails API
 * 
 * Cancel all queued emails for a specific user.
 * Used when a user converts (e.g., selects a plan after signing up).
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cancelQueuedEmails } from '@/lib/email-automation';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/**
 * DELETE /api/email/queue/[userId]
 * Cancel all queued emails for a user
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { userId: authUserId } = await auth();
    const { userId: targetUserId } = await params;
    
    // Allow internal calls without auth
    const internalKey = request.headers.get('x-internal-key');
    const isInternalCall = internalKey === process.env.INTERNAL_API_KEY;
    
    // Users can only cancel their own emails (unless internal call)
    if (!isInternalCall && authUserId !== targetUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get reason from query params
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason') || 'User converted';

    // Cancel queued emails
    const result = await cancelQueuedEmails(targetUserId, reason);

    return NextResponse.json({
      success: result.success,
      cancelledCount: result.cancelledCount,
    });

  } catch (error) {
    console.error('[EMAIL_QUEUE_CANCEL] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel queued emails' },
      { status: 500 }
    );
  }
}

