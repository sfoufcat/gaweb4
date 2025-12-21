/**
 * @deprecated This API is deprecated. Tracks have been replaced by Programs.
 * Track-specific config will be migrated to program-based content.
 * This API is kept for backward compatibility.
 * 
 * Track Configuration API
 * 
 * GET /api/track-config?track=content_creator
 * 
 * Returns track-specific labels and configuration from the CMS (with fallback to defaults)
 * Used by client components to get track-based UI labels
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTrackConfigForClient } from '@/lib/track-cms';
import type { UserTrack } from '@/types';

const VALID_TRACKS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'general',
];

export async function GET(request: NextRequest) {
  try {
    // Authentication is optional - public endpoint with user-specific track
    await auth();
    
    // Get track from query params
    const { searchParams } = new URL(request.url);
    const track = searchParams.get('track') as UserTrack | null;

    // Validate track if provided
    if (track && !VALID_TRACKS.includes(track)) {
      return NextResponse.json(
        { error: 'Invalid track' },
        { status: 400 }
      );
    }

    // Get track configuration
    const config = await getTrackConfigForClient(track);

    return NextResponse.json(config);
  } catch (error) {
    console.error('[TRACK_CONFIG_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch track configuration' },
      { status: 500 }
    );
  }
}



