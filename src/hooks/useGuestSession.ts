'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getOrCreateGuestSessionId,
  getGuestSessionId,
  clearGuestSession,
  saveGuestDataLocally,
  getGuestDataLocally,
  saveGuestDataToFirebase,
  getGuestDataFromFirebase,
  type GuestOnboardingData,
} from '@/lib/guest-session';

interface UseGuestSessionReturn {
  /** The guest session ID */
  sessionId: string | null;
  /** Whether the session is being initialized */
  isLoading: boolean;
  /** Current guest data */
  data: GuestOnboardingData;
  /** Save data to both local storage and Firebase */
  saveData: (data: Partial<GuestOnboardingData>) => Promise<boolean>;
  /** Refresh data from Firebase */
  refreshData: () => Promise<void>;
  /** Clear the guest session */
  clearSession: () => void;
  /** Check if guest has completed payment */
  hasCompletedPayment: boolean;
}

/**
 * Hook for managing guest session data
 * 
 * Usage:
 * ```tsx
 * const { sessionId, data, saveData, isLoading } = useGuestSession();
 * 
 * const handleContinue = async () => {
 *   await saveData({ workdayStyle: 'busy' });
 *   router.push('/start/obstacles');
 * };
 * ```
 */
export function useGuestSession(): UseGuestSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<GuestOnboardingData>({});

  // Initialize session and load data
  useEffect(() => {
    const init = async () => {
      // Get or create session ID
      const id = getOrCreateGuestSessionId();
      setSessionId(id);

      // Load local data first (immediate)
      const localData = getGuestDataLocally();
      setData(localData);

      // Then try to get Firebase data (might have more recent data)
      if (id) {
        const firebaseData = await getGuestDataFromFirebase(id);
        if (firebaseData) {
          // Merge Firebase data with local data (Firebase takes precedence)
          const merged = { ...localData, ...firebaseData };
          setData(merged);
          // Update local storage with merged data
          saveGuestDataLocally(merged);
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  // Save data to both local and Firebase
  const saveData = useCallback(async (newData: Partial<GuestOnboardingData>): Promise<boolean> => {
    // Save locally first (immediate feedback)
    const updated = saveGuestDataLocally(newData);
    setData(updated);

    // Get current session ID
    const currentSessionId = sessionId || getGuestSessionId();
    if (!currentSessionId) {
      console.error('No guest session ID available');
      return false;
    }

    // Save to Firebase in background
    const success = await saveGuestDataToFirebase(currentSessionId, newData);
    return success;
  }, [sessionId]);

  // Refresh data from Firebase
  const refreshData = useCallback(async () => {
    const currentSessionId = sessionId || getGuestSessionId();
    if (!currentSessionId) return;

    const firebaseData = await getGuestDataFromFirebase(currentSessionId);
    if (firebaseData) {
      setData(firebaseData);
      saveGuestDataLocally(firebaseData);
    }
  }, [sessionId]);

  // Clear session
  const clearSession = useCallback(() => {
    clearGuestSession();
    setSessionId(null);
    setData({});
  }, []);

  // Check if payment was completed (used after Stripe redirect)
  const hasCompletedPayment = Boolean(data.selectedPlan);

  return {
    sessionId,
    isLoading,
    data,
    saveData,
    refreshData,
    clearSession,
    hasCompletedPayment,
  };
}








