import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// POST /api/habits/[id]/skip - Skip habit for today
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

    const today = new Date().toISOString().split('T')[0];
    const progress = habit?.progress || {
      currentCount: 0,
      lastCompletedDate: null,
      completionDates: [],
      skipDates: [],
    };

    // Check if already completed today (can't skip if completed)
    if (progress.completionDates.includes(today)) {
      return NextResponse.json(
        { error: 'Habit already completed today' },
        { status: 400 }
      );
    }

    // Check if already skipped today
    if (progress.skipDates?.includes(today)) {
      return NextResponse.json(
        { error: 'Habit already skipped today' },
        { status: 400 }
      );
    }

    // Update progress with skip
    const updatedProgress = {
      ...progress,
      skipDates: [...(progress.skipDates || []), today],
    };

    await habitRef.update({
      progress: updatedProgress,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ progress: updatedProgress });
  } catch (error) {
    console.error('Error skipping habit:', error);
    return NextResponse.json(
      { error: 'Failed to skip habit' },
      { status: 500 }
    );
  }
}















