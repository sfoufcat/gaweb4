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
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data() as FirebaseUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isLoaded]);

  return { 
    userData, 
    loading, 
    userId: user?.id,
    identity: userData?.identity,
    hasIdentity: !!userData?.identity,
  };
}

