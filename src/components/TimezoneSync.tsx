'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useFirebaseUser } from '@/hooks/useFirebaseUser';

/**
 * TimezoneSync Component
 * 
 * Silently detects the user's browser timezone and syncs it to Firebase
 * if it differs from the stored value. This handles:
 * - First-time users who never had a timezone set
 * - Traveling users whose timezone has changed
 * 
 * Only makes an API call when the timezone actually changes,
 * minimizing unnecessary network requests.
 */
export function TimezoneSync() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const { userData, loading: firebaseLoading } = useFirebaseUser();
  const hasSynced = useRef(false);

  useEffect(() => {
    // Wait for both Clerk and Firebase to load
    if (!clerkLoaded || firebaseLoading) return;
    
    // Must be authenticated
    if (!user) return;
    
    // Only sync once per session to avoid duplicate calls
    if (hasSynced.current) return;

    // Detect browser timezone
    let browserTimezone: string;
    try {
      browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Fallback if Intl API not available (very rare)
      console.warn('[TimezoneSync] Could not detect browser timezone');
      return;
    }

    // Check if timezone needs to be updated
    const storedTimezone = userData?.timezone;
    
    if (browserTimezone && browserTimezone !== storedTimezone) {
      // Mark as synced to prevent duplicate calls
      hasSynced.current = true;
      
      // Sync to Firebase via API
      fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: browserTimezone }),
      })
        .then((res) => {
          if (res.ok) {
            console.log(`[TimezoneSync] Updated timezone: ${storedTimezone || 'none'} → ${browserTimezone}`);
          } else {
            console.error('[TimezoneSync] Failed to update timezone:', res.status);
            // Reset flag to allow retry on next mount
            hasSynced.current = false;
          }
        })
        .catch((err) => {
          console.error('[TimezoneSync] Error updating timezone:', err);
          // Reset flag to allow retry on next mount
          hasSynced.current = false;
        });
    }
  }, [user, clerkLoaded, userData, firebaseLoading]);

  // Renders nothing - purely a side-effect component
  return null;
}

