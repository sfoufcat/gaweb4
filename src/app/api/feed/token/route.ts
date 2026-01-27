import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateFeedToken } from '@/lib/stream-feeds';

/**
 * GET /api/feed/token
 * Generate a Stream Feeds token for the authenticated user
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      // Return null token instead of 401 to prevent error spam during auth transitions
      return NextResponse.json({ token: null, userId: null, appId: null });
    }

    // Generate user token for Stream Feeds
    const token = generateFeedToken(userId);

    return NextResponse.json({
      token,
      userId,
      appId: process.env.STREAM_APP_ID || null,
    });
  } catch (error) {
    console.error('[FEED_TOKEN] Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}

