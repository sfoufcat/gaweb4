import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateAlignmentForToday } from '@/lib/alignment';
import type { MorningCheckIn } from '@/types';

// GET - Fetch today's check-in
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const checkInRef = adminDb.collection('users').doc(userId).collection('checkins').doc(date);
    const checkInDoc = await checkInRef.get();

    if (!checkInDoc.exists) {
      return NextResponse.json({ checkIn: null });
    }

    return NextResponse.json({ checkIn: { id: checkInDoc.id, ...checkInDoc.data() } });
  } catch (error: any) {
    console.error('Error fetching check-in:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch check-in' }, { status: 500 });
  }
}

// POST - Start a new check-in
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];
    const checkInRef = adminDb.collection('users').doc(userId).collection('checkins').doc(today);
    const existingDoc = await checkInRef.get();

    // If check-in already exists, return it
    if (existingDoc.exists) {
      return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
    }

    const now = new Date().toISOString();
    const newCheckIn: Omit<MorningCheckIn, 'id'> = {
      date: today,
      userId,
      emotionalState: 'neutral',
      manifestIdentityCompleted: false,
      manifestGoalCompleted: false,
      tasksPlanned: false,
      createdAt: now,
      updatedAt: now,
    };

    await checkInRef.set(newCheckIn);

    return NextResponse.json({ checkIn: { id: today, ...newCheckIn } }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating check-in:', error);
    return NextResponse.json({ error: error.message || 'Failed to create check-in' }, { status: 500 });
  }
}

// PATCH - Update check-in progress
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    const today = new Date().toISOString().split('T')[0];
    const checkInRef = adminDb.collection('users').doc(userId).collection('checkins').doc(today);
    const existingDoc = await checkInRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
    }

    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await checkInRef.update(updatedData);
    const updatedDoc = await checkInRef.get();

    // Update alignment when morning check-in is completed
    if (updates.completedAt) {
      try {
        // Check if tasks were also planned (from the Plan Day step)
        const didSetTasks = updates.tasksPlanned === true;
        
        await updateAlignmentForToday(userId, {
          didMorningCheckin: true,
          didSetTasks: didSetTasks || undefined, // Only set if true
        });
      } catch (alignmentError) {
        // Don't fail the check-in if alignment update fails
        console.error('[MORNING_CHECKIN] Alignment update failed:', alignmentError);
      }
    }

    return NextResponse.json({ checkIn: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error: any) {
    console.error('Error updating check-in:', error);
    return NextResponse.json({ error: error.message || 'Failed to update check-in' }, { status: 500 });
  }
}

