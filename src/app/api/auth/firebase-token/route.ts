/**
 * API Route: Generate Firebase Custom Token from Clerk Session
 * 
 * This allows Clerk-authenticated users to also authenticate with Firebase,
 * enabling secure access to Firebase Storage and other Firebase services.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a Firebase custom token for this Clerk user
    // The userId from Clerk becomes the Firebase UID
    const firebaseToken = await adminAuth.createCustomToken(userId);
    
    return NextResponse.json({ token: firebaseToken });
  } catch (error) {
    console.error('[FIREBASE_TOKEN] Error creating token:', error);
    return NextResponse.json(
      { error: 'Failed to create Firebase token' }, 
      { status: 500 }
    );
  }
}











