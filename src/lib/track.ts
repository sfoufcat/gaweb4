/**
 * Track System Utilities - Server-Side Only
 * 
 * Server-side functions for managing user business track selection.
 * 
 * For shared constants (TRACKS, TrackInfo, etc.), import from track-constants.ts
 * 
 * Business tracks:
 * - content_creator: Content creators and influencers
 * - saas: SaaS founders building software products
 * - coach_consultant: Coaches and consultants
 * - ecom: E-commerce brand owners
 * - agency: Agency owners
 * - community_builder: Community builders and managers
 * - general: General entrepreneurs with hybrid models (legacy)
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from './firebase-admin';
import type { UserTrack } from '@/types';
import type { ClerkPublicMetadata } from './admin-utils-clerk';

// Re-export constants for backwards compatibility with existing server-side imports
export { TRACKS, getTrackInfo, isValidTrack } from './track-constants';
export type { TrackInfo } from './track-constants';

/**
 * Get a user's track from Clerk public metadata
 * Server-side only - reads from JWT token
 */
export async function getCurrentUserTrack(): Promise<UserTrack | null> {
  const { sessionClaims } = await auth();
  const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
  return publicMetadata?.track || null;
}

/**
 * Get a user's track by ID from both Clerk and Firebase
 */
export async function getUserTrack(userId: string): Promise<UserTrack | null> {
  try {
    // Try Clerk first (source of truth)
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const clerkTrack = (user.publicMetadata as ClerkPublicMetadata)?.track;
    
    if (clerkTrack) {
      return clerkTrack;
    }
    
    // Fall back to Firebase
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData?.track || null;
    }
    
    return null;
  } catch (error) {
    console.error('[TRACK] Error getting user track:', error);
    return null;
  }
}

/**
 * Set a user's track in both Clerk and Firebase
 * This is the single function to update track everywhere
 */
export async function setUserTrack(userId: string, track: UserTrack): Promise<boolean> {
  try {
    // Update Clerk public metadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    
    const metadataUpdate: ClerkPublicMetadata = {
      ...user.publicMetadata as ClerkPublicMetadata,
      track,
    };
    
    await client.users.updateUserMetadata(userId, {
      publicMetadata: metadataUpdate,
    });
    
    // Update Firebase
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.set(
      { 
        track, 
        updatedAt: new Date().toISOString() 
      }, 
      { merge: true }
    );
    
    console.log(`[TRACK] Updated user ${userId} track to: ${track}`);
    return true;
  } catch (error) {
    console.error('[TRACK] Error setting user track:', error);
    return false;
  }
}

/**
 * Clear a user's track (set to null) in both Clerk and Firebase
 */
export async function clearUserTrack(userId: string): Promise<boolean> {
  try {
    // Update Clerk public metadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    
    const currentMetadata = user.publicMetadata as ClerkPublicMetadata;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { track, ...restMetadata } = currentMetadata;
    
    await client.users.updateUserMetadata(userId, {
      publicMetadata: restMetadata,
    });
    
    // Update Firebase
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.set(
      { 
        track: null, 
        updatedAt: new Date().toISOString() 
      }, 
      { merge: true }
    );
    
    console.log(`[TRACK] Cleared track for user ${userId}`);
    return true;
  } catch (error) {
    console.error('[TRACK] Error clearing user track:', error);
    return false;
  }
}
