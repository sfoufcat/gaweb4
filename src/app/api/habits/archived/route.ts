import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Habit } from '@/types';

// GET /api/habits/archived - Fetch archived habits for the user
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch archived habits (no orderBy to avoid index issues)
    const habitsSnapshot = await adminDb
      .collection('habits')
      .where('userId', '==', userId)
      .where('archived', '==', true)
      .get();
    
    const habits: Habit[] = [];
    habitsSnapshot.forEach((doc) => {
      habits.push({ id: doc.id, ...doc.data() } as Habit);
    });

    // Sort by createdAt in memory
    habits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ habits });
  } catch (error) {
    console.error('[Habits API] GET archived - Error fetching habits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch archived habits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

