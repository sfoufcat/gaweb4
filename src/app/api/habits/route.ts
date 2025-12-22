import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { CreateHabitRequest, Habit, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/habits - Fetch all habits for the user
 * 
 * MULTI-TENANCY: Habits are scoped per organization (with legacy fallback)
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    const allHabits: Habit[] = [];

    // If we have organizationId, fetch org-scoped habits first
    if (organizationId) {
      const habitsSnapshot = await adminDb
        .collection('habits')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .get();
      
      habitsSnapshot.forEach((doc) => {
        allHabits.push({ id: doc.id, ...doc.data() } as Habit);
      });
    }

    // Legacy fallback: Also fetch habits without organizationId (to be migrated)
    if (allHabits.length === 0) {
      const legacySnapshot = await adminDb
        .collection('habits')
        .where('userId', '==', userId)
        .get();
      
      legacySnapshot.forEach((doc) => {
        const data = doc.data();
        // Only include if no organizationId (legacy data) or matching org
        if (!data.organizationId || data.organizationId === organizationId) {
          // Avoid duplicates
          if (!allHabits.some(h => h.id === doc.id)) {
            allHabits.push({ id: doc.id, ...data } as Habit);
          }
        }
      });
    }

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

/**
 * POST /api/habits - Create a new habit
 * 
 * MULTI-TENANCY: Habits are scoped per organization
 */
export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    console.log('[Habits API] POST - User ID:', userId);
    
    if (!userId) {
      console.error('[Habits API] POST - No user ID found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
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
      organizationId, // Multi-tenancy: scope habit to organization
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

