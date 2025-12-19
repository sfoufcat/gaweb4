'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { signInWithCustomToken, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Hook to sync Clerk authentication with Firebase Auth
 * 
 * This enables Firebase Storage (and other Firebase services) to recognize
 * Clerk-authenticated users via Firebase custom tokens.
 */
export function useFirebaseAuth() {
  const { isSignedIn, userId } = useAuth();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSigningIn = useRef(false);

  const signInToFirebase = useCallback(async () => {
    if (!isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    // Already signed in to Firebase with correct user
    if (auth?.currentUser?.uid === userId) {
      setFirebaseUser(auth.currentUser);
      setLoading(false);
      return;
    }

    // Prevent concurrent sign-in attempts
    if (isSigningIn.current) {
      return;
    }

    try {
      isSigningIn.current = true;
      setError(null);
      setLoading(true);
      
      // Check if Firebase auth is initialized
      if (!auth) {
        throw new Error('Firebase auth not initialized');
      }
      
      const response = await fetch('/api/auth/firebase-token');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get Firebase token');
      }
      
      const { token } = await response.json();
      const userCredential = await signInWithCustomToken(auth, token);
      setFirebaseUser(userCredential.user);
    } catch (err) {
      console.error('[useFirebaseAuth] Sign-in error:', err);
      setError(err instanceof Error ? err.message : 'Firebase authentication failed');
    } finally {
      isSigningIn.current = false;
      setLoading(false);
    }
  }, [isSignedIn, userId]);

  useEffect(() => {
    // If Firebase auth is not initialized, skip
    if (!auth) {
      setLoading(false);
      return () => {};
    }

    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      
      // If Clerk is signed in but Firebase is not, trigger sign in
      if (isSignedIn && !user && !isSigningIn.current) {
        signInToFirebase();
      } else if (!isSignedIn || user) {
        setLoading(false);
      }
    });

    // Initial sign-in attempt
    if (isSignedIn && !auth.currentUser && !isSigningIn.current) {
      signInToFirebase();
    } else if (!isSignedIn) {
      setLoading(false);
    }

    return () => unsubscribe();
  }, [isSignedIn, signInToFirebase]);

  // Sign out of Firebase when Clerk signs out
  useEffect(() => {
    if (!isSignedIn && firebaseUser && auth) {
      auth.signOut();
    }
  }, [isSignedIn, firebaseUser]);

  return { 
    firebaseUser, 
    loading, 
    error,
    isAuthenticated: !!firebaseUser,
    retry: signInToFirebase,
  };
}



