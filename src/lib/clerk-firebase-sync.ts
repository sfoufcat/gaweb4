import { auth, currentUser } from '@clerk/nextjs/server';
import { adminDb } from './firebase-admin';

/**
 * Sync Clerk user data to Firebase Firestore
 */
export async function syncClerkUserToFirebase() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    throw new Error('User not authenticated');
  }

  const userRef = adminDb.collection('users').doc(userId);
  const userDoc = await userRef.get();

  const userData = {
    id: userId,
    email: user.emailAddresses[0]?.emailAddress || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    imageUrl: user.imageUrl || '',
    createdAt: user.createdAt,
    updatedAt: new Date().toISOString(),
  };

  // Check if user is a coach - coaches skip user onboarding
  const publicMetadata = user.publicMetadata as { role?: string; orgRole?: string } | undefined;
  const isCoach = publicMetadata?.role === 'coach' || 
                  publicMetadata?.orgRole === 'super_coach' || 
                  publicMetadata?.orgRole === 'coach';

  if (!userDoc.exists) {
    // Create new user document
    // Coaches skip user onboarding - they have their own coach onboarding flow
    if (isCoach) {
      await userRef.set({
        ...userData,
        createdAt: new Date().toISOString(),
        hasCompletedOnboarding: true, // Coaches bypass user onboarding
      });
    } else {
      // Regular users get initial onboarding status
      await userRef.set({
        ...userData,
        createdAt: new Date().toISOString(),
        onboardingStatus: 'welcome',
        hasCompletedOnboarding: false,
      });
    }
  } else {
    // Update existing user document
    await userRef.update(userData);
  }

  return userData;
}

/**
 * Get user data from Firebase
 */
export async function getFirebaseUser(userId: string) {
  const userRef = adminDb.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return null;
  }

  return userDoc.data();
}

