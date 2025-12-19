import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { HabitFormData } from '@/types';

// GET /api/habits/[id] - Fetch a single habit
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const habitDoc = await adminDb.collection('habits').doc(id).get();

    if (!habitDoc.exists) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    const habitData = habitDoc.data();
    const habit = { id: habitDoc.id, ...habitData };

    // Verify ownership
    if (habitData?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ habit });
  } catch (error) {
    console.error('Error fetching habit:', error);
    return NextResponse.json(
      { error: 'Failed to fetch habit' },
      { status: 500 }
    );
  }
}

// PATCH /api/habits/[id] - Update a habit
export async function PATCH(
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

    const body: Partial<HabitFormData> = await req.json();
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    if (body.text !== undefined) updates.text = body.text.trim();
    if (body.linkedRoutine !== undefined) updates.linkedRoutine = body.linkedRoutine.trim() || null;
    if (body.frequencyType !== undefined) updates.frequencyType = body.frequencyType;
    if (body.frequencyValue !== undefined) updates.frequencyValue = body.frequencyValue;
    if (body.reminder !== undefined) updates.reminder = body.reminder;
    if (body.targetRepetitions !== undefined) updates.targetRepetitions = body.targetRepetitions;

    await habitRef.update(updates);

    const updatedDoc = await habitRef.get();
    const updatedHabit = { id: updatedDoc.id, ...updatedDoc.data() };

    return NextResponse.json({ habit: updatedHabit });
  } catch (error) {
    console.error('Error updating habit:', error);
    return NextResponse.json(
      { error: 'Failed to update habit' },
      { status: 500 }
    );
  }
}

// DELETE /api/habits/[id] - Delete a habit (actually archives it)
export async function DELETE(
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

    // Archive instead of delete
    await habitRef.update({
      archived: true,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error archiving habit:', error);
    return NextResponse.json(
      { error: 'Failed to archive habit' },
      { status: 500 }
    );
  }
}

