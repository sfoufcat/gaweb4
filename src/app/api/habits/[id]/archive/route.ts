import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';

// POST /api/habits/[id]/archive - Mark habit as complete and archive
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

    // Archive the habit
    await habitRef.update({
      archived: true,
      status: 'completed', // Set explicit status
      archivedAt: new Date().toISOString(),
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

