/**
 * Track Prompt API
 * 
 * GET /api/track-prompt?track=content_creator&type=morning&index=0
 * 
 * Returns track-specific prompt from the CMS for the Dynamic Section.
 * Falls back to generic CMS prompts (trackId = null) if no track-specific prompt exists.
 * 
 * Query params:
 * - track: User's track (optional)
 * - type: 'morning' | 'evening' | 'weekly' (default: 'morning')
 * - index: Cycle index for rotating through prompts (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTrackPromptFromDB } from '@/lib/track-cms';
import type { UserTrack, DynamicPromptType } from '@/types';

const VALID_TRACKS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'community_builder',
  'general',
];

const VALID_TYPES: DynamicPromptType[] = ['morning', 'evening', 'weekly'];

export async function GET(request: NextRequest) {
  try {
    // Authentication is optional - public endpoint
    await auth();
    
    // Get params from query
    const { searchParams } = new URL(request.url);
    const track = searchParams.get('track') as UserTrack | null;
    const type = (searchParams.get('type') as DynamicPromptType) || 'morning';
    const indexStr = searchParams.get('index');
    const index = indexStr ? parseInt(indexStr, 10) : 0;

    // Validate track if provided
    if (track && !VALID_TRACKS.includes(track)) {
      return NextResponse.json(
        { error: 'Invalid track' },
        { status: 400 }
      );
    }

    // Validate type
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type' },
        { status: 400 }
      );
    }

    // Get prompt from CMS with cycling support
    const prompt = await getTrackPromptFromDB(track, type, index);

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('[TRACK_PROMPT_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch track prompt' },
      { status: 500 }
    );
  }
}

