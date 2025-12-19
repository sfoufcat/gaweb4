import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { generateTransformationText } from '@/lib/anthropic';
import type { FirebaseUser } from '@/types';

/**
 * GET /api/onboarding/transformation
 * Generates personalized transformation text based on user's onboarding data
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user data from Firebase
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data() as FirebaseUser;
    
    // Extract relevant data for transformation text
    const businessStage = userData.onboarding?.businessStage;
    const peerAccountability = userData.onboarding?.peerAccountability;
    const goal = userData.goal;
    const identity = userData.identity;

    // Generate the transformation text using AI
    const result = await generateTransformationText({
      businessStage,
      peerAccountability,
      goal,
      identity,
    });

    return NextResponse.json({
      text: result.text,
      businessStage,
      error: result.error,
    });

  } catch (error) {
    console.error('[TRANSFORMATION_API_ERROR]', error);
    return NextResponse.json(
      { 
        error: 'Internal Error',
        text: 'With daily consistency and the right system, you\'ll overcome the obstacles holding you back. This journey will transform how you work and what you achieve.'
      }, 
      { status: 500 }
    );
  }
}






