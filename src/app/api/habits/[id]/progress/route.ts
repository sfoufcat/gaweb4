import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { updateLastActivity } from '@/lib/analytics/lastActivity';
import { updateClientActivityStatus } from '@/lib/analytics/activity';

// POST /api/habits/[id]/progress - Mark habit as complete for today
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

    const today = new Date().toISOString().split('T')[0];
    const progress = habit?.progress || {
      currentCount: 0,
      lastCompletedDate: null,
      completionDates: [],
    };

    // Check if already completed today
    if (progress.completionDates.includes(today)) {
      return NextResponse.json(
        { error: 'Habit already completed today' },
        { status: 400 }
      );
    }

    // Update progress
    const updatedProgress = {
      currentCount: progress.currentCount + 1,
      lastCompletedDate: today,
      completionDates: [...progress.completionDates, today],
    };

    await habitRef.update({
      progress: updatedProgress,
      lastCompletionAt: new Date().toISOString(), // Denormalized for fast queries
      updatedAt: new Date().toISOString(),
    });

    // Update lastActivityAt for analytics (non-blocking)
    if (organizationId) {
      updateLastActivity(userId, organizationId, 'habit').catch(err => {
        console.error('[HABITS] Failed to update lastActivityAt:', err);
      });
      // Update activity status for real-time status updates (non-blocking)
      updateClientActivityStatus(organizationId, userId).catch(err => {
        console.error('[HABITS] Failed to update activity status:', err);
      });
    }

    return NextResponse.json({ 
      success: true,
      progress: updatedProgress 
    });
  } catch (error) {
    console.error('Error updating habit progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}

