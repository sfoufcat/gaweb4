import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';

const MAX_ACTIVE_HABITS = 3;

// POST /api/habits/[id]/restore - Restore an archived habit
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const habitRef = adminDb.collection('habits').doc(id);
    const habitDoc = await habitRef.get();

    if (!habitDoc.exists) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    const habit = habitDoc.data();

    // Verify ownership
    if (habit?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // MULTI-TENANCY: Verify habit belongs to current organization
    const organizationId = await getEffectiveOrgId();
    if (organizationId && habit?.organizationId && habit.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    // Verify habit is actually archived
    if (!habit?.archived) {
      return NextResponse.json({ error: 'Habit is not archived' }, { status: 400 });
    }

    // Check active habit count (3-habit limit)
    let activeHabitsQuery = adminDb
      .collection('habits')
      .where('userId', '==', userId)
      .where('archived', '==', false);

    // Scope to organization if applicable
    if (organizationId) {
      activeHabitsQuery = activeHabitsQuery.where('organizationId', '==', organizationId);
    }

    const activeHabitsSnapshot = await activeHabitsQuery.get();
    const activeHabitCount = activeHabitsSnapshot.size;

    if (activeHabitCount >= MAX_ACTIVE_HABITS) {
      return NextResponse.json(
        { 
          error: 'Habit limit reached',
          limitReached: true,
          currentCount: activeHabitCount,
          maxCount: MAX_ACTIVE_HABITS,
        },
        { status: 400 }
      );
    }

    // Restore the habit
    await habitRef.update({
      archived: false,
      status: 'active',
      archivedAt: null,
      archivedReason: null,
      restoredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true,
      message: 'Habit restored successfully',
    });
  } catch (error) {
    console.error('Error restoring habit:', error);
    return NextResponse.json(
      { error: 'Failed to restore habit' },
      { status: 500 }
    );
  }
}

