import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/guest/session
 * Save guest onboarding data to Firebase
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, ...data } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validate session ID format
    if (!sessionId.startsWith('guest_')) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Get country from Vercel geo headers (only on first request for this session)
    const headersList = await headers();
    const country = headersList.get('x-vercel-ip-country') || null;

    // Get existing data to merge
    const docRef = adminDb.collection('guestSessions').doc(sessionId);
    const existingDoc = await docRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : {};

    // Merge new data with existing
    const updatedData = {
      ...existingData,
      ...data,
      sessionId,
      updatedAt: new Date().toISOString(),
      // Set createdAt only if this is a new document
      createdAt: existingData?.createdAt || new Date().toISOString(),
      // Set country only if not already set (preserve first detected country)
      country: existingData?.country || country,
    };

    // Save to Firebase
    await docRef.set(updatedData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[GUEST_SESSION_POST]', error);
    return NextResponse.json(
      { error: 'Failed to save guest session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/guest/session
 * Retrieve guest session data from Firebase
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validate session ID format
    if (!sessionId.startsWith('guest_')) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Get from Firebase
    const docRef = adminDb.collection('guestSessions').doc(sessionId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { session: null },
        { status: 200 }
      );
    }

    return NextResponse.json({ session: doc.data() });
  } catch (error) {
    console.error('[GUEST_SESSION_GET]', error);
    return NextResponse.json(
      { error: 'Failed to get guest session' },
      { status: 500 }
    );
  }
}



