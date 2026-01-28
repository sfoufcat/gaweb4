'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { FirebaseUser } from '@/types';

export function useFirebaseUser() {
  const { user, isLoaded } = useUser();
  const [userData, setUserData] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !user) {
      setLoading(false);
      return;
    }

    // Guard: Firebase not initialized
    if (!db) {
      console.warn('[useFirebaseUser] Firebase not initialized');
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', user.id);

    // Set up real-time listener with error handling for Firestore internal errors
    const unsubscribe = onSnapshot(
      userRef,
      (doc) => {
        if (doc.exists()) {
          setUserData(doc.data() as FirebaseUser);
        }
        setLoading(false);
      },
      (error) => {
        // Firestore 11.x has a known bug with internal state assertions during rapid mount/unmount
        // These errors are safe to ignore - the listener will reconnect automatically
        if (error.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.debug('[useFirebaseUser] Firestore internal state error (safe to ignore):', error.message);
        } else {
          console.error('[useFirebaseUser] Firestore listener error:', error);
        }
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubscribe();
      } catch (e) {
        // Firestore 11.x bug - safe to ignore
        if (!(e instanceof Error && e.message?.includes('INTERNAL ASSERTION FAILED'))) {
          throw e;
        }
      }
    };
  }, [user, isLoaded]);

  return { 
    userData, 
    loading, 
    userId: user?.id,
    identity: userData?.identity,
    hasIdentity: !!userData?.identity,
  };
}

