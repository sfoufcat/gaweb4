import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { CreateHabitRequest, Habit } from '@/types';

// GET /api/habits - Fetch all habits for the user
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user habits (no archived filter to support legacy data)
    const habitsSnapshot = await adminDb
      .collection('habits')
      .where('userId', '==', userId)
      .get();
    
    const allHabits: Habit[] = [];
    habitsSnapshot.forEach((doc) => {
      allHabits.push({ id: doc.id, ...doc.data() } as Habit);
    });

    // Filter out explicitly archived habits in memory (handles legacy data with missing 'archived' field)
    const activeHabits = allHabits.filter(h => h.archived !== true);

    // Sort by createdAt in memory
    activeHabits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ habits: activeHabits });
  } catch (error) {
    console.error('[Habits API] GET - Error fetching habits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch habits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/habits - Create a new habit
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    console.log('[Habits API] POST - User ID:', userId);
    
    if (!userId) {
      console.error('[Habits API] POST - No user ID found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateHabitRequest = await req.json();
    console.log('[Habits API] POST - Request body:', JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.text || !body.frequencyType) {
      console.error('[Habits API] POST - Missing required fields:', { 
        hasText: !!body.text, 
        hasFrequencyType: !!body.frequencyType 
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    
    // Build habit object, conditionally including optional fields
    const habitData: Record<string, unknown> = {
      userId,
      text: body.text.trim(),
      frequencyType: body.frequencyType,
      frequencyValue: body.frequencyValue,
      reminder: body.reminder,
      targetRepetitions: body.targetRepetitions,
      progress: {
        currentCount: 0,
        lastCompletedDate: null,
        completionDates: [],
        skipDates: [],
      },
      archived: false,
      status: 'active', // Set initial status
      source: 'user', // Mark as user-created (vs 'track_default' from program engine)
      createdAt: now,
      updatedAt: now,
    };
    
    // Only add linkedRoutine if it has a value
    if (body.linkedRoutine && body.linkedRoutine.trim()) {
      habitData.linkedRoutine = body.linkedRoutine.trim();
    }
    
    const habit = habitData as Omit<Habit, 'id'>;

    console.log('[Habits API] POST - Creating habit:', JSON.stringify(habit, null, 2));

    const docRef = await adminDb.collection('habits').add(habit);
    console.log('[Habits API] POST - Habit created with ID:', docRef.id);
    
    const newHabit: Habit = { id: docRef.id, ...habit };

    return NextResponse.json({ habit: newHabit }, { status: 201 });
  } catch (error) {
    console.error('[Habits API] POST - Error creating habit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Habits API] POST - Error stack:', errorStack);
    console.error('[Habits API] POST - Error message:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to create habit', details: errorMessage },
      { status: 500 }
    );
  }
}

