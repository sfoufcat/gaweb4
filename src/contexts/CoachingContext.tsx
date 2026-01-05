'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useDemoMode } from '@/contexts/DemoModeContext';

const COACHING_CACHE_KEY = 'ga-coaching-cache-v1';
const CACHE_VERSION = 1;
const CACHE_MAX_AGE = 60 * 60 * 1000; // 1 hour (shorter than squad since coaching status can change)

interface CoachInfo {
  name: string;
  imageUrl: string;
}

interface CoachingCacheData {
  version: number;
  timestamp: number;
  userId: string;
  hasActiveIndividualEnrollment: boolean;
  coachingChatChannelId: string | null;
  coachInfo: CoachInfo | null;
  promoIsEnabled: boolean;
  promoDestinationUrl: string | null;
  promoImageUrl: string | null;
}

/**
 * Load coaching data from localStorage
 */
function loadCoachingCache(userId: string): Partial<CoachingCacheData> | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(COACHING_CACHE_KEY);
    if (!stored) return null;

    const parsed: CoachingCacheData = JSON.parse(stored);

    // Validate version and user
    if (parsed.version !== CACHE_VERSION || parsed.userId !== userId) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - parsed.timestamp > CACHE_MAX_AGE) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save coaching data to localStorage
 */
function saveCoachingCache(userId: string, data: Omit<CoachingCacheData, 'version' | 'timestamp' | 'userId'>): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheData: CoachingCacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      userId,
      ...data,
    };
    localStorage.setItem(COACHING_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('[CoachingContext] Failed to save cache to localStorage:', error);
  }
}

interface CoachingContextValue {
  // Coaching enrollment status
  hasActiveIndividualEnrollment: boolean;
  coachingChatChannelId: string | null;
  coachInfo: CoachInfo | null;

  // Promo settings (for users without coaching)
  promoIsEnabled: boolean;
  promoDestinationUrl: string | null;
  promoImageUrl: string | null;

  // Convenience flags
  hasCoachingChat: boolean;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  refetch: () => Promise<void>;
}

const CoachingContext = createContext<CoachingContextValue | undefined>(undefined);

// Global cache to persist across re-renders and navigation
let globalCoachingData: {
  hasActiveIndividualEnrollment: boolean;
  coachingChatChannelId: string | null;
  coachInfo: CoachInfo | null;
  promoIsEnabled: boolean;
  promoDestinationUrl: string | null;
  promoImageUrl: string | null;
  fetchedForUserId: string | null;
} = {
  hasActiveIndividualEnrollment: false,
  coachingChatChannelId: null,
  coachInfo: null,
  promoIsEnabled: false,
  promoDestinationUrl: null,
  promoImageUrl: null,
  fetchedForUserId: null,
};

interface CoachingProviderProps {
  children: ReactNode;
}

/**
 * Global Coaching Provider
 *
 * Provides instant access to coaching data (chat channel, coach info, promo settings).
 * Data is fetched once at app startup and cached globally + in localStorage.
 *
 * This eliminates the ~1 second delay when opening chat by pre-loading coaching data.
 */
export function CoachingProvider({ children }: CoachingProviderProps) {
  const { user, isLoaded } = useUser();
  const { isDemoMode } = useDemoMode();
  const hasInitializedFromStorage = useRef(false);

  // Coaching state
  const [hasActiveIndividualEnrollment, setHasActiveIndividualEnrollment] = useState(globalCoachingData.hasActiveIndividualEnrollment);
  const [coachingChatChannelId, setCoachingChatChannelId] = useState<string | null>(globalCoachingData.coachingChatChannelId);
  const [coachInfo, setCoachInfo] = useState<CoachInfo | null>(globalCoachingData.coachInfo);
  const [promoIsEnabled, setPromoIsEnabled] = useState(globalCoachingData.promoIsEnabled);
  const [promoDestinationUrl, setPromoDestinationUrl] = useState<string | null>(globalCoachingData.promoDestinationUrl);
  const [promoImageUrl, setPromoImageUrl] = useState<string | null>(globalCoachingData.promoImageUrl);

  // Loading states
  const [isLoading, setIsLoading] = useState(!globalCoachingData.fetchedForUserId);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage on mount (only once)
  useEffect(() => {
    if (hasInitializedFromStorage.current || !user?.id) return;

    // Check localStorage for cached data
    const cached = loadCoachingCache(user.id);
    if (cached && !globalCoachingData.fetchedForUserId) {
      // Initialize from localStorage cache
      setHasActiveIndividualEnrollment(cached.hasActiveIndividualEnrollment ?? false);
      setCoachingChatChannelId(cached.coachingChatChannelId ?? null);
      setCoachInfo(cached.coachInfo ?? null);
      setPromoIsEnabled(cached.promoIsEnabled ?? false);
      setPromoDestinationUrl(cached.promoDestinationUrl ?? null);
      setPromoImageUrl(cached.promoImageUrl ?? null);

      // Also update global cache
      globalCoachingData.hasActiveIndividualEnrollment = cached.hasActiveIndividualEnrollment ?? false;
      globalCoachingData.coachingChatChannelId = cached.coachingChatChannelId ?? null;
      globalCoachingData.coachInfo = cached.coachInfo ?? null;
      globalCoachingData.promoIsEnabled = cached.promoIsEnabled ?? false;
      globalCoachingData.promoDestinationUrl = cached.promoDestinationUrl ?? null;
      globalCoachingData.promoImageUrl = cached.promoImageUrl ?? null;

      // Mark as having data (even if stale, shows instantly)
      setIsLoading(false);
    }

    hasInitializedFromStorage.current = true;
  }, [user?.id]);

  // Fetch coaching data
  const fetchCoachingData = useCallback(async (userId: string, isDemoMode: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Demo mode: use mock data
      if (isDemoMode) {
        const demoData = {
          hasActiveIndividualEnrollment: true,
          coachingChatChannelId: 'demo-coaching-channel',
          coachInfo: { name: 'Demo Coach', imageUrl: 'https://ui-avatars.com/api/?name=Demo+Coach&background=a07855&color=fff' },
          promoIsEnabled: false,
          promoDestinationUrl: null,
          promoImageUrl: null,
        };

        globalCoachingData = {
          ...demoData,
          fetchedForUserId: userId,
        };

        setHasActiveIndividualEnrollment(demoData.hasActiveIndividualEnrollment);
        setCoachingChatChannelId(demoData.coachingChatChannelId);
        setCoachInfo(demoData.coachInfo);
        setPromoIsEnabled(demoData.promoIsEnabled);
        setPromoDestinationUrl(demoData.promoDestinationUrl);
        setPromoImageUrl(demoData.promoImageUrl);
        setIsLoading(false);
        return;
      }

      // Fetch from API
      const response = await fetch('/api/user/org-coaching-promo');

      if (!response.ok) {
        // Non-200 response is OK for users without coaching/on platform domain
        const emptyData = {
          hasActiveIndividualEnrollment: false,
          coachingChatChannelId: null,
          coachInfo: null,
          promoIsEnabled: false,
          promoDestinationUrl: null,
          promoImageUrl: null,
        };

        globalCoachingData = {
          ...emptyData,
          fetchedForUserId: userId,
        };

        setHasActiveIndividualEnrollment(false);
        setCoachingChatChannelId(null);
        setCoachInfo(null);
        setPromoIsEnabled(false);
        setPromoDestinationUrl(null);
        setPromoImageUrl(null);
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      const fetchedData = {
        hasActiveIndividualEnrollment: data.hasActiveIndividualEnrollment || false,
        coachingChatChannelId: data.coachingChatChannelId || null,
        coachInfo: data.coachInfo || null,
        promoIsEnabled: data.isEnabled || false,
        promoDestinationUrl: data.destinationUrl || null,
        promoImageUrl: data.promo?.imageUrl || null,
      };

      // Update global cache
      globalCoachingData = {
        ...fetchedData,
        fetchedForUserId: userId,
      };

      setHasActiveIndividualEnrollment(fetchedData.hasActiveIndividualEnrollment);
      setCoachingChatChannelId(fetchedData.coachingChatChannelId);
      setCoachInfo(fetchedData.coachInfo);
      setPromoIsEnabled(fetchedData.promoIsEnabled);
      setPromoDestinationUrl(fetchedData.promoDestinationUrl);
      setPromoImageUrl(fetchedData.promoImageUrl);
      setIsLoading(false);

      // Save to localStorage for instant loading on next visit
      saveCoachingCache(userId, fetchedData);

    } catch (err) {
      console.error('Error fetching coaching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch coaching data');

      // Clear cache on error
      globalCoachingData = {
        hasActiveIndividualEnrollment: false,
        coachingChatChannelId: null,
        coachInfo: null,
        promoIsEnabled: false,
        promoDestinationUrl: null,
        promoImageUrl: null,
        fetchedForUserId: userId,
      };

      setHasActiveIndividualEnrollment(false);
      setCoachingChatChannelId(null);
      setCoachInfo(null);
      setPromoIsEnabled(false);
      setPromoDestinationUrl(null);
      setPromoImageUrl(null);
      setIsLoading(false);
    }
  }, []);

  // Manual refetch function
  const refetch = useCallback(async () => {
    if (user?.id || isDemoMode) {
      await fetchCoachingData(user?.id || 'demo-user', isDemoMode);
    }
  }, [user?.id, isDemoMode, fetchCoachingData]);

  // Initial fetch when user is available
  useEffect(() => {
    // In demo mode, skip waiting for Clerk to load
    if (!isDemoMode && !isLoaded) return;

    // No user = clear data (but not in demo mode)
    if (!user && !isDemoMode) {
      globalCoachingData = {
        hasActiveIndividualEnrollment: false,
        coachingChatChannelId: null,
        coachInfo: null,
        promoIsEnabled: false,
        promoDestinationUrl: null,
        promoImageUrl: null,
        fetchedForUserId: null,
      };
      setHasActiveIndividualEnrollment(false);
      setCoachingChatChannelId(null);
      setCoachInfo(null);
      setPromoIsEnabled(false);
      setPromoDestinationUrl(null);
      setPromoImageUrl(null);
      setIsLoading(false);
      return;
    }

    // In demo mode with no user, use demo user ID
    const userId = user?.id || 'demo-user';

    // Already fetched for this user = use cached data
    if (globalCoachingData.fetchedForUserId === userId) {
      setHasActiveIndividualEnrollment(globalCoachingData.hasActiveIndividualEnrollment);
      setCoachingChatChannelId(globalCoachingData.coachingChatChannelId);
      setCoachInfo(globalCoachingData.coachInfo);
      setPromoIsEnabled(globalCoachingData.promoIsEnabled);
      setPromoDestinationUrl(globalCoachingData.promoDestinationUrl);
      setPromoImageUrl(globalCoachingData.promoImageUrl);
      setIsLoading(false);
      return;
    }

    // Fetch for new user
    fetchCoachingData(userId, isDemoMode);
  }, [user, isLoaded, isDemoMode, fetchCoachingData]);

  return (
    <CoachingContext.Provider value={{
      hasActiveIndividualEnrollment,
      coachingChatChannelId,
      coachInfo,
      promoIsEnabled,
      promoDestinationUrl,
      promoImageUrl,
      hasCoachingChat: !!coachingChatChannelId,
      isLoading,
      error,
      refetch,
    }}>
      {children}
    </CoachingContext.Provider>
  );
}

/**
 * Hook to access the shared coaching data
 *
 * Returns the globally cached coaching data that was fetched at app startup.
 * No duplicate API calls - everyone gets the same cached data.
 *
 * Use this instead of fetching /api/user/org-coaching-promo directly
 * for instant access to coaching channel ID and coach info.
 */
export function useCoachingContext(): CoachingContextValue {
  const context = useContext(CoachingContext);
  if (context === undefined) {
    throw new Error('useCoachingContext must be used within a CoachingProvider');
  }
  return context;
}
