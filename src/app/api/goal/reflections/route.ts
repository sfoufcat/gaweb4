import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { DailyReflection, WeeklyReflection } from '@/types';

/**
 * GET /api/goal/reflections
 * Fetches all reflections for the user's active goal
 * Query params:
 * - type: 'daily' | 'weekly' | 'all' (default: 'all')
 * - limit: number (default: 20)
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get user's active goal ID (from user document)
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ reflections: [] });
    }

    const userData = userDoc.data();
    
    // For now, we use the user's goal directly. GoalId is the same as the goal string for simplicity.
    // In a more complex system, goals would have their own IDs.
    const goalId = userData?.goal ? `${userId}_goal` : null;
    
    if (!goalId) {
      return NextResponse.json({ reflections: [] });
    }

    // Fetch reflections from subcollection
    let query = adminDb
      .collection('users')
      .doc(userId)
      .collection('reflections')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (type !== 'all') {
      query = adminDb
        .collection('users')
        .doc(userId)
        .collection('reflections')
        .where('type', '==', type)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();
    const reflections = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      reflections,
      goalId,
    });
  } catch (error) {
    console.error('Error fetching reflections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goal/reflections
 * Creates a new reflection
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, ...reflectionData } = body;

    if (!type || !['daily', 'weekly'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid reflection type' },
        { status: 400 }
      );
    }

    // Get user's active goal
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const goalId = userData?.goal ? `${userId}_goal` : null;

    if (!goalId) {
      return NextResponse.json(
        { error: 'No active goal found' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const reflectionId = `${type}_${Date.now()}`;

    const newReflection = {
      userId,
      goalId,
      type,
      ...reflectionData,
      createdAt: now,
      updatedAt: now,
    };

    // Save to subcollection
    await adminDb
      .collection('users')
      .doc(userId)
      .collection('reflections')
      .doc(reflectionId)
      .set(newReflection);

    return NextResponse.json({
      success: true,
      reflection: {
        id: reflectionId,
        ...newReflection,
      },
    });
  } catch (error) {
    console.error('Error creating reflection:', error);
    return NextResponse.json(
      { error: 'Failed to create reflection' },
      { status: 500 }
    );
  }
}














