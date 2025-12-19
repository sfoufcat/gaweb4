'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import type { UserTrack } from '@/types';

interface UseTrackReturn {
  /** Current track (null if not set) */
  track: UserTrack | null;
  /** Whether track is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether user is a content creator */
  isContentCreator: boolean;
  /** Whether user is a SaaS founder */
  isSaas: boolean;
  /** Whether user is a coach/consultant */
  isCoachConsultant: boolean;
  /** Whether user is an e-commerce brand owner */
  isEcom: boolean;
  /** Whether user is an agency owner */
  isAgency: boolean;
  /** Whether user is a community builder */
  isCommunityBuilder: boolean;
  /** Whether user is a general entrepreneur */
  isGeneral: boolean;
  /** Whether user has selected a track */
  hasTrack: boolean;
  /** Set user's track */
  setTrack: (track: UserTrack) => Promise<boolean>;
  /** Refresh track from server */
  refreshTrack: () => Promise<void>;
}

/**
 * Hook for accessing and managing user track
 * 
 * Usage:
 * ```tsx
 * const { track, isContentCreator, setTrack } = useTrack();
 * 
 * if (isContentCreator) {
 *   // Show content creator specific features
 * }
 * ```
 */
export function useTrack(): UseTrackReturn {
  const { user, isLoaded } = useUser();
  const [track, setTrackState] = useState<UserTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch track from API
  const fetchTrack = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/user/track');
      
      if (!response.ok) {
        throw new Error('Failed to fetch track');
      }

      const data = await response.json();
      setTrackState(data.track || null);
    } catch (err) {
      console.error('Error fetching track:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch track');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initialize track from Clerk metadata first (fast), then validate with API
  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setTrackState(null);
      setIsLoading(false);
      return;
    }

    // Try to get track from Clerk public metadata (instant)
    const clerkTrack = user.publicMetadata?.track as UserTrack | undefined;
    if (clerkTrack) {
      setTrackState(clerkTrack);
      setIsLoading(false);
    } else {
      // Fetch from API if not in Clerk metadata
      fetchTrack();
    }
  }, [isLoaded, user, fetchTrack]);

  // Set track via API
  const setTrack = useCallback(async (newTrack: UserTrack): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch('/api/user/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: newTrack }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set track');
      }

      setTrackState(newTrack);
      return true;
    } catch (err) {
      console.error('Error setting track:', err);
      setError(err instanceof Error ? err.message : 'Failed to set track');
      return false;
    }
  }, []);

  // Refresh track from server
  const refreshTrack = useCallback(async () => {
    setIsLoading(true);
    await fetchTrack();
  }, [fetchTrack]);

  // Computed properties for easy checks
  const hasTrack = track !== null;
  const isContentCreator = track === 'content_creator';
  const isSaas = track === 'saas';
  const isCoachConsultant = track === 'coach_consultant';
  const isEcom = track === 'ecom';
  const isAgency = track === 'agency';
  const isCommunityBuilder = track === 'community_builder';
  const isGeneral = track === 'general';

  return {
    track,
    isLoading,
    error,
    isContentCreator,
    isSaas,
    isCoachConsultant,
    isEcom,
    isAgency,
    isCommunityBuilder,
    isGeneral,
    hasTrack,
    setTrack,
    refreshTrack,
  };
}

