import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// Get Stream Video server-side client
async function getStreamVideoServerClient() {
  const { StreamClient } = await import('@stream-io/node-sdk');

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Stream API credentials not configured');
  }

  return new StreamClient(apiKey, apiSecret);
}

/**
 * POST /api/calls/[callId]/leave
 *
 * Server-side endpoint to force-leave a call session.
 * Used by sendBeacon when the browser tab closes to ensure
 * the session is properly ended even if client-side cleanup fails.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { callId } = await params;
    if (!callId) {
      return NextResponse.json({ error: 'Missing callId' }, { status: 400 });
    }

    console.log(`[API] Force leaving call ${callId} for user ${userId}`);

    // Initialize Stream server client
    const client = await getStreamVideoServerClient();

    // Get the call and remove the user from it
    const call = client.video.call('default', callId);

    try {
      // Try to end the user's session by removing them from the call
      // This forces the session to end server-side
      await call.updateCallMembers({
        remove_members: [userId],
      });
      console.log(`[API] Removed user ${userId} from call ${callId}`);
    } catch (e) {
      // If remove fails, the user may have already left
      console.log(`[API] Could not remove member (may have already left):`, e);
    }

    return NextResponse.json({ success: true, callId, userId });
  } catch (error) {
    console.error('[API] Error in call leave endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to leave call' },
      { status: 500 }
    );
  }
}
