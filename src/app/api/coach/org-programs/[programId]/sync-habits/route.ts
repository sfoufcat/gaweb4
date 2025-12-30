/**
 * Coach API: Sync Program Habits to Enrolled Users
 * 
 * POST /api/coach/org-programs/[programId]/sync-habits
 * 
 * Syncs the program's defaultHabits to all currently enrolled users.
 * - Creates new habits for users who don't have them
 * - Updates existing habits (preserving user progress)
 * - Respects the 3-habit limit per user
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Program, ProgramEnrollment, ProgramHabitTemplate, FrequencyType, Habit } from '@/types';

/**
 * Map program habit frequency to Habit format
 */
function mapFrequency(frequency: ProgramHabitTemplate['frequency']): {
  frequencyType: FrequencyType;
  frequencyValue: number | number[];
} {
  if (frequency === 'daily') {
    return { frequencyType: 'daily', frequencyValue: 1 };
  } else if (frequency === 'weekday') {
    return { frequencyType: 'weekly_specific_days', frequencyValue: [1, 2, 3, 4, 5] }; // Mon-Fri
  } else {
    // custom defaults to Mon, Wed, Fri
    return { frequencyType: 'weekly_specific_days', frequencyValue: [1, 3, 5] };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;

    // 1. Fetch the program and verify ownership
    const programDoc = await adminDb.collection('programs').doc(programId).get();

    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = { id: programDoc.id, ...programDoc.data() } as Program;

    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // 2. Get program's default habits
    const defaultHabits = program.defaultHabits || [];

    if (defaultHabits.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No default habits configured for this program',
        summary: { usersProcessed: 0, habitsCreated: 0, habitsUpdated: 0 },
      });
    }

    // 3. Get all active/upcoming enrollments for this program
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'upcoming'])
      .get();

    if (enrollmentsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No active enrollments to sync',
        summary: { usersProcessed: 0, habitsCreated: 0, habitsUpdated: 0 },
      });
    }

    const enrollments = enrollmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ProgramEnrollment[];

    console.log(`[SYNC_HABITS] Processing ${enrollments.length} enrollments for program ${programId}`);

    // 4. Process each enrolled user
    let totalCreated = 0;
    let totalUpdated = 0;
    let usersProcessed = 0;
    const now = new Date().toISOString();
    const maxHabits = 3;

    for (const enrollment of enrollments) {
      const userId = enrollment.userId;

      // Get user's existing habits from this program
      const existingHabitsSnapshot = await adminDb
        .collection('habits')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .where('programId', '==', programId)
        .where('source', '==', 'program_default')
        .get();

      // Create a map of existing habits by title for easy lookup
      const existingByTitle = new Map<string, Habit & { docId: string }>();
      existingHabitsSnapshot.docs.forEach(doc => {
        const habit = { id: doc.id, docId: doc.id, ...doc.data() } as Habit & { docId: string };
        existingByTitle.set(habit.text, habit);
      });

      // Count all active habits for this user in this org (for 3-habit limit)
      const allHabitsSnapshot = await adminDb
        .collection('habits')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .where('archived', '==', false)
        .get();

      let currentHabitCount = allHabitsSnapshot.size;
      let userCreated = 0;
      let userUpdated = 0;

      for (const template of defaultHabits) {
        const existingHabit = existingByTitle.get(template.title);
        const { frequencyType, frequencyValue } = mapFrequency(template.frequency);

        if (existingHabit) {
          // UPDATE existing habit - preserve progress, createdAt, etc.
          await adminDb.collection('habits').doc(existingHabit.docId).update({
            linkedRoutine: template.description || null,
            frequencyType,
            frequencyValue,
            updatedAt: now,
          });
          userUpdated++;
        } else {
          // CREATE new habit (if under limit)
          if (currentHabitCount < maxHabits) {
            const habitData = {
              userId,
              organizationId,
              text: template.title,
              linkedRoutine: template.description || null,
              frequencyType,
              frequencyValue,
              reminder: null,
              targetRepetitions: null,
              progress: {
                currentCount: 0,
                lastCompletedDate: null,
                completionDates: [],
                skipDates: [],
              },
              archived: false,
              status: 'active',
              source: 'program_default' as const,
              programId,
              createdAt: now,
              updatedAt: now,
            };

            await adminDb.collection('habits').add(habitData);
            currentHabitCount++;
            userCreated++;
          }
        }
      }

      totalCreated += userCreated;
      totalUpdated += userUpdated;
      usersProcessed++;

      console.log(`[SYNC_HABITS] User ${userId}: created ${userCreated}, updated ${userUpdated}`);
    }

    console.log(`[SYNC_HABITS] Completed sync for program ${programId}: ${usersProcessed} users, ${totalCreated} created, ${totalUpdated} updated`);

    return NextResponse.json({
      success: true,
      message: `Synced habits to ${usersProcessed} users`,
      summary: {
        usersProcessed,
        habitsCreated: totalCreated,
        habitsUpdated: totalUpdated,
      },
    });
  } catch (error) {
    console.error('[SYNC_HABITS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to sync habits' }, { status: 500 });
  }
}



