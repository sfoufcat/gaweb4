'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTrack } from './useTrack';
import { getTrackDisplayName } from '@/lib/track-prompts';
import type { DynamicPromptType } from '@/types';

export interface TrackPrompt {
  title: string;
  description: string;
}

interface UseTrackPromptOptions {
  /** Override the automatic type detection (morning/evening based on time) */
  typeOverride?: DynamicPromptType;
}

interface UseTrackPromptReturn {
  /** The track-specific prompt for today (null while loading or if not found) */
  prompt: TrackPrompt | null;
  /** User's track display name (e.g., "Creator", "SaaS") */
  trackName: string;
  /** Whether the prompt is still loading */
  isLoading: boolean;
  /** Whether user has a track set */
  hasTrack: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Current prompt type being displayed */
  promptType: DynamicPromptType;
}

/**
 * Get the appropriate prompt type based on time of day
 * - Morning (before 5pm): 'morning'
 * - Evening (5pm onwards): 'evening'
 */
function getPromptTypeForTime(): DynamicPromptType {
  const hour = new Date().getHours();
  // 5pm (17:00) is the cutoff for evening
  return hour >= 17 ? 'evening' : 'morning';
}

/**
 * Get a prompt index that cycles twice per day
 * - Morning cycle: based on day of year
 * - Afternoon cycle: changes at 1pm (adds 1 to index)
 * This allows showing different prompts throughout the day
 */
function getPromptCycleIndex(): number {
  const now = new Date();
  const hour = now.getHours();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  // Base index is day of year * 2 (to have room for 2 prompts per day)
  // After 1pm, add 1 to get a different prompt
  const cycleOffset = hour >= 13 ? 1 : 0;
  
  return (dayOfYear * 2) + cycleOffset;
}

/**
 * Hook for getting track-specific prompts for the Dynamic Section
 * 
 * Fetches prompts from the CMS via /api/track-prompt
 * - Shows 'morning' prompts before 5pm (unless overridden)
 * - Shows 'evening' prompts after 5pm (unless overridden)
 * - Shows 'weekly' prompts when typeOverride is 'weekly'
 * - Cycles to a new prompt at 1pm each day
 * 
 * Usage:
 * ```tsx
 * // Auto-detect type based on time
 * const { prompt, trackName, isLoading, promptType } = useTrackPrompt();
 * 
 * // Force weekly prompts
 * const { prompt } = useTrackPrompt({ typeOverride: 'weekly' });
 * 
 * if (isLoading) return <Skeleton />;
 * if (!prompt) return null;
 * 
 * // Render: "Creator Tip" with prompt.title and prompt.description
 * ```
 */
export function useTrackPrompt(options?: UseTrackPromptOptions): UseTrackPromptReturn {
  const { typeOverride } = options || {};
  const { track, isLoading: trackLoading, hasTrack } = useTrack();
  const [prompt, setPrompt] = useState<TrackPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Determine prompt type - use override if provided, otherwise detect from time
  const promptType = useMemo(() => typeOverride || getPromptTypeForTime(), [typeOverride]);
  
  // Get cycle index for prompt rotation
  const cycleIndex = useMemo(() => getPromptCycleIndex(), []);

  // Fetch prompt from CMS API
  const fetchPrompt = useCallback(async (trackSlug: string | null, type: DynamicPromptType, index: number) => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Build URL with query params
      const url = new URL('/api/track-prompt', window.location.origin);
      if (trackSlug) {
        url.searchParams.set('track', trackSlug);
      }
      url.searchParams.set('type', type);
      url.searchParams.set('index', index.toString());
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error('Failed to fetch prompt');
      }
      
      const data = await response.json();
      setPrompt(data.prompt || null);
    } catch (err) {
      console.error('[useTrackPrompt] Error fetching prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prompt');
      setPrompt(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch prompt when track changes or loads
  useEffect(() => {
    // Wait for track to finish loading
    if (trackLoading) {
      return;
    }
    
    fetchPrompt(track, promptType, cycleIndex);
  }, [track, trackLoading, promptType, cycleIndex, fetchPrompt]);

  // Get track display name
  const trackName = getTrackDisplayName(track);

  return {
    prompt,
    trackName,
    isLoading: trackLoading || isLoading,
    hasTrack,
    error,
    promptType,
  };
}
