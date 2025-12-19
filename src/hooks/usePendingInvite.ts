'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pendingInviteToken';

interface PendingInvitePayload {
  inviterUserId: string;
  inviterSquadId: string;
  squadName: string;
  squadType: 'private' | 'public' | 'premium';
  joinCode?: string;
  requiresPremium?: boolean;
}

interface PendingInvite {
  token: string;
  payload: PendingInvitePayload | null;
  inviterName: string;
}

/**
 * Hook to manage pending invite tokens across the app
 * 
 * Used to:
 * - Store invite token when user needs to authenticate
 * - Preserve token through onboarding flow
 * - Clear token after successful join or rejection
 */
export function usePendingInvite() {
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load pending invite from sessionStorage on mount
  useEffect(() => {
    const loadPendingInvite = async () => {
      try {
        const token = sessionStorage.getItem(STORAGE_KEY);
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Validate the token
        const response = await fetch('/api/squad/validate-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          // Invalid token - clear it
          sessionStorage.removeItem(STORAGE_KEY);
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setPendingInvite({
          token,
          payload: data.payload,
          inviterName: data.inviterName || 'Your friend',
        });
      } catch (error) {
        console.error('Error loading pending invite:', error);
        sessionStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadPendingInvite();
  }, []);

  // Store a new pending invite
  const storePendingInvite = useCallback((token: string) => {
    sessionStorage.setItem(STORAGE_KEY, token);
  }, []);

  // Clear the pending invite
  const clearPendingInvite = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPendingInvite(null);
  }, []);

  // Get just the token (for use in forms/redirects)
  const getToken = useCallback(() => {
    return sessionStorage.getItem(STORAGE_KEY);
  }, []);

  // Check if there's a premium squad invite pending
  const hasPremiumInvitePending = pendingInvite?.payload?.squadType === 'premium';

  return {
    pendingInvite,
    isLoading,
    storePendingInvite,
    clearPendingInvite,
    getToken,
    hasPremiumInvitePending,
  };
}

