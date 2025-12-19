'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import type { FirebaseUser } from '@/types';

interface UseServerUserReturn {
  userData: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  userId: string | undefined;
  hasIdentity: boolean;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch user data from server-side API
 * More secure than direct Firestore client access
 */
export function useServerUser(): UseServerUserReturn {
  const { user, isLoaded } = useUser();
  const [userData, setUserData] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = async () => {
    if (!user) {
      setUserData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();

      if (data.exists) {
        setUserData(data.user);
      } else {
        setUserData(null);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user data';
      setError(errorMessage);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isLoaded]);

  return {
    userData,
    loading,
    error,
    userId: user?.id,
    hasIdentity: !!userData?.identity,
    refetch: fetchUserData,
  };
}

