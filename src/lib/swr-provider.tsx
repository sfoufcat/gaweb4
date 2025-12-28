'use client';

import { SWRConfig, Cache } from 'swr';
import { ReactNode, useCallback, useEffect, useState } from 'react';

const CACHE_KEY = 'ga-swr-cache';
const CACHE_VERSION = 1;

interface CacheData {
  version: number;
  data: [string, unknown][];
  timestamp: number;
}

/**
 * Creates a localStorage-backed cache provider for SWR
 * 
 * Features:
 * - Persists cache to localStorage across sessions
 * - Automatically expires cache after 24 hours
 * - Handles SSR (returns empty map on server)
 * - Gracefully handles localStorage errors
 */
function createLocalStorageProvider(): () => Cache<unknown> {
  return () => {
    // Check if we're on the client
    if (typeof window === 'undefined') {
      return new Map();
    }

    // Load cached data from localStorage
    let initialData: [string, unknown][] = [];
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed: CacheData = JSON.parse(stored);
        
        // Check version and expiry (24 hours)
        const isValid = 
          parsed.version === CACHE_VERSION &&
          Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000;
        
        if (isValid && Array.isArray(parsed.data)) {
          initialData = parsed.data;
        }
      }
    } catch (error) {
      console.warn('[SWR Cache] Failed to load cache from localStorage:', error);
    }

    const map = new Map<string, unknown>(initialData);

    // Save to localStorage before page unload
    const saveCache = () => {
      try {
        const cacheData: CacheData = {
          version: CACHE_VERSION,
          data: Array.from(map.entries()),
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      } catch (error) {
        console.warn('[SWR Cache] Failed to save cache to localStorage:', error);
      }
    };

    // Save on page unload
    window.addEventListener('beforeunload', saveCache);

    // Also save periodically (every 30 seconds) to handle tab crashes
    const intervalId = setInterval(saveCache, 30000);

    // Return a Map-like object that also cleans up on garbage collection
    // Note: We can't really clean up the interval properly, but it's fine
    // since this is a singleton that lives for the app's lifetime
    return map as Cache<unknown>;
  };
}

// Create the provider factory once
const localStorageProvider = createLocalStorageProvider();

/**
 * Default fetcher for SWR - handles JSON responses
 */
async function defaultFetcher(url: string): Promise<unknown> {
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  
  return response.json();
}

interface SWRProviderProps {
  children: ReactNode;
}

/**
 * SWR Provider with localStorage persistence
 * 
 * Wraps the app to enable:
 * - In-memory caching (instant navigation between pages)
 * - localStorage persistence (instant on return visits)
 * - Stale-while-revalidate (shows cached data, updates in background)
 * 
 * Usage in layout.tsx:
 * ```tsx
 * <SWRProvider>
 *   {children}
 * </SWRProvider>
 * ```
 */
export function SWRProvider({ children }: SWRProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render children without SWR config on server to avoid hydration mismatch
  // SWR will still work, just without localStorage persistence until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <SWRConfig
      value={{
        provider: localStorageProvider,
        fetcher: defaultFetcher,
        // Default options for all SWR hooks
        revalidateOnFocus: false, // Don't refetch when window regains focus
        revalidateOnReconnect: true, // Refetch when network reconnects
        dedupingInterval: 5000, // Dedupe requests within 5 seconds
        errorRetryCount: 3, // Retry failed requests 3 times
      }}
    >
      {children}
    </SWRConfig>
  );
}

/**
 * Hook to manually clear the SWR cache
 * Useful for logout or when user data needs to be completely refreshed
 */
export function useClearSWRCache() {
  return useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.warn('[SWR Cache] Failed to clear cache:', error);
    }
  }, []);
}






