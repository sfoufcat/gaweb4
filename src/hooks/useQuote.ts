'use client';

import useSWR from 'swr';
import { useMemo } from 'react';

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
 * Uses SWR for:
 * - Instant loading from cache on return visits
 * - Background revalidation for fresh data
 * 
 * Fetches quotes from the CMS via /api/quote
 * - Cycles to a new quote each day
 */
export function useQuote(): UseQuoteReturn {
  // Get cycle index for quote rotation (changes daily)
  const cycleIndex = useMemo(() => getQuoteCycleIndex(), []);
  
  // Build cache key - uses index for daily cycling
  const cacheKey = `/api/quote?index=${cycleIndex}`;
  
  const { data, error, isLoading } = useSWR<{ quote: Quote | null }>(
    cacheKey,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }
      return response.json();
    },
    {
      // Quotes don't change during the day, cache for 1 hour
      dedupingInterval: 60 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  return {
    quote: data?.quote ?? null,
    isLoading: isLoading && !data,
    error: error?.message ?? null,
  };
}
