'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTrack } from './useTrack';

export interface Quote {
  text: string;
  author: string;
}

interface UseQuoteReturn {
  /** The quote for today (null while loading or if not found) */
  quote: Quote | null;
  /** Whether the quote is still loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

/**
 * Get a quote index that cycles daily
 * Returns a consistent index for the entire day
 */
function getQuoteCycleIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear;
}

/**
 * Hook for getting quotes from the CMS for the quote card
 * 
 * Fetches quotes from the CMS via /api/quote
 * - Cycles to a new quote each day
 * - Falls back to generic quotes if no track-specific quotes exist
 * 
 * Usage:
 * ```tsx
 * const { quote, isLoading } = useQuote();
 * 
 * if (isLoading) return <Skeleton />;
 * if (!quote) return null;
 * 
 * // Render: "{quote.text}" — {quote.author}
 * ```
 */
export function useQuote(): UseQuoteReturn {
  const { track, isLoading: trackLoading } = useTrack();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get cycle index for quote rotation (changes daily)
  const cycleIndex = useMemo(() => getQuoteCycleIndex(), []);

  // Fetch quote from CMS API
  const fetchQuote = useCallback(async (trackSlug: string | null, index: number) => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Build URL with query params
      const url = new URL('/api/quote', window.location.origin);
      if (trackSlug) {
        url.searchParams.set('track', trackSlug);
      }
      url.searchParams.set('index', index.toString());
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }
      
      const data = await response.json();
      setQuote(data.quote || null);
    } catch (err) {
      console.error('[useQuote] Error fetching quote:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quote');
      setQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch quote when track changes or loads
  useEffect(() => {
    // Wait for track to finish loading
    if (trackLoading) {
      return;
    }
    
    fetchQuote(track, cycleIndex);
  }, [track, trackLoading, cycleIndex, fetchQuote]);

  return {
    quote,
    isLoading: trackLoading || isLoading,
    error,
  };
}


