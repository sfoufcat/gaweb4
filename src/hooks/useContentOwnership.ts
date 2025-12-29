'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import type { PurchasableContentType } from '@/types/discover';

// Fetcher for SWR
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return response.json();
}

interface MyContentItem {
  contentType: string;
  contentId: string;
}

interface MyContentResponse {
  items: MyContentItem[];
  totalCount: number;
}

/**
 * Hook to check if the user owns specific content.
 * Uses the my-content API which is already cached with SWR.
 */
export function useContentOwnership() {
  const { data, isLoading } = useSWR<MyContentResponse>(
    '/api/my-content',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2 * 60 * 1000, // 2 minutes
    }
  );

  // Build a Set of owned content keys for O(1) lookup
  const ownedContentKeys = useMemo(() => {
    if (!data?.items) return new Set<string>();
    return new Set(
      data.items.map((item) => `${item.contentType}:${item.contentId}`)
    );
  }, [data?.items]);

  /**
   * Check if the user owns specific content
   */
  const isOwned = (contentType: PurchasableContentType | 'program' | 'squad', contentId: string): boolean => {
    return ownedContentKeys.has(`${contentType}:${contentId}`);
  };

  return {
    isOwned,
    isLoading,
    ownedCount: data?.totalCount ?? 0,
  };
}

/**
 * Hook for checking a single content item's ownership status.
 * More efficient when you only need to check one item.
 */
export function useIsContentOwned(
  contentType: PurchasableContentType | 'program' | 'squad',
  contentId: string
) {
  const { isOwned, isLoading } = useContentOwnership();
  
  return {
    isOwned: isOwned(contentType, contentId),
    isLoading,
  };
}





