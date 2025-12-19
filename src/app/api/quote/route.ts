/**
 * Quote API
 * 
 * GET /api/quote?track=content_creator&index=0
 * 
 * Returns a quote from the CMS for the quote card.
 * Falls back to generic CMS quotes (trackId = null) if no track-specific quote exists.
 * 
 * Query params:
 * - track: User's track (optional)
 * - index: Cycle index for rotating through quotes (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getQuoteFromDB } from '@/lib/track-cms';
import type { UserTrack } from '@/types';

const VALID_TRACKS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'community_builder',
  'general',
];

export async function GET(request: NextRequest) {
  try {
    // Authentication is optional - public endpoint
    const { userId } = await auth();
    
    // Get params from query
    const { searchParams } = new URL(request.url);
    const track = searchParams.get('track') as UserTrack | null;
    const indexStr = searchParams.get('index');
    const index = indexStr ? parseInt(indexStr, 10) : 0;

    // Validate track if provided
    if (track && !VALID_TRACKS.includes(track)) {
      return NextResponse.json(
        { error: 'Invalid track' },
        { status: 400 }
      );
    }

    // Get quote from CMS with cycling support
    const quote = await getQuoteFromDB(track, index);

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('[QUOTE_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}


