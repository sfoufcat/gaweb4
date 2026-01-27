/**
 * Coach API: Sync Module Habits to Enrolled Users
 *
 * POST /api/coach/org-programs/[programId]/sync-habits
 *
 * Syncs module-level habits to enrolled users based on their current module.
 * - Determines each user's current module from their enrollment start date
 * - Archives habits from previous modules (preserves progress history)
 * - Creates new habits for current module
 * - Preserves habits that exist in both old and new modules (continuous tracking)
 * - Respects 3-habit-per-module limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Program, ProgramEnrollment, ProgramHabitTemplate, ProgramModule, ProgramInstance, ProgramInstanceModule, FrequencyType, Habit } from '@/types';

/**
 * Map program habit frequency to Habit format
 */
function mapFrequency(template: ProgramHabitTemplate): {
  frequencyType: FrequencyType;
  frequencyValue: number | number[];
} {
  if (template.frequency === 'daily') {
    return { frequencyType: 'daily', frequencyValue: 1 };
  } else if (template.frequency === 'weekday') {
    return { frequencyType: 'weekly_specific_days', frequencyValue: [0, 1, 2, 3, 4] }; // Mon-Fri (0-indexed)
  } else {
    // custom - use customDays or default to Mon, Wed, Fri
    const days = template.customDays && template.customDays.length > 0
      ? template.customDays
      : [0, 2, 4]; // Mon, Wed, Fri (0-indexed)
    return { frequencyType: 'weekly_specific_days', frequencyValue: days };
  }
}

/**
 * Calculate user's current day index based on enrollment start date
 */
function calculateCurrentDayIndex(startedAt: string, includeWeekends: boolean = false): number {
  const startDate = new Date(startedAt);
  const today = new Date();

  // Reset times to compare dates only
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (includeWeekends) {
    // Simple day count (7-day weeks)
    const diffMs = today.getTime() - startDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  } else {
    // Count only weekdays (5-day weeks)
    let dayIndex = 0;
    const current = new Date(startDate);

    while (current <= today) {
      const dayOfWeek = current.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dayIndex++;
      }
      current.setDate(current.getDate() + 1);
    }

    return Math.max(1, dayIndex);
  }
}

/**
 * Find the module a user should be in based on their current day index
 * Works for both template modules (ProgramModule) and instance modules (ProgramInstanceModule)
 */
function getCurrentModule<T extends { order: number; startDayIndex: number; endDayIndex: number }>(
  modules: T[],
  currentDayIndex: number
): T | null {
  // Sort modules by order
  const sortedModules = [...modules].sort((a, b) => a.order - b.order);

  // Find module where currentDayIndex falls within startDayIndex...endDayIndex
  for (const module of sortedModules) {
    if (currentDayIndex >= module.startDayIndex && currentDayIndex <= module.endDayIndex) {
      return module;
    }
  }

  // If user is past all modules, return the last module
  if (sortedModules.length > 0 && currentDayIndex > sortedModules[sortedModules.length - 1].endDayIndex) {
    return sortedModules[sortedModules.length - 1];
  }

  // If user hasn't started yet, return first module
  if (sortedModules.length > 0 && currentDayIndex < sortedModules[0].startDayIndex) {
    return sortedModules[0];
  }

  return null;
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

    // 2. Get all modules for this program
    const modulesSnapshot = await adminDb
      .collection('program_modules')
      .where('programId', '==', programId)
      .orderBy('order', 'asc')
      .get();

    const modules = modulesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ProgramModule[];

    // Check if program has modules with habits
    const modulesWithHabits = modules.filter(m => m.habits && m.habits.length > 0);

    // Fallback to program.defaultHabits if no modules have habits
    const useModuleHabits = modulesWithHabits.length > 0;

    if (!useModuleHabits && (!program.defaultHabits || program.defaultHabits.length === 0)) {
      return NextResponse.json({
        success: true,
        message: 'No habits configured for this program',
        summary: { usersProcessed: 0, habitsCreated: 0, habitsUpdated: 0, habitsArchived: 0 },
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
        summary: { usersProcessed: 0, habitsCreated: 0, habitsUpdated: 0, habitsArchived: 0 },
      });
    }

    const enrollments = enrollmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ProgramEnrollment[];

    console.log(`[SYNC_HABITS] Processing ${enrollments.length} enrollments for program ${programId}, useModuleHabits: ${useModuleHabits}`);

    // 4. Process each enrolled user
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalArchived = 0;
    let usersProcessed = 0;
    const now = new Date().toISOString();
    const maxHabitsPerModule = 3;

    for (const enrollment of enrollments) {
      const userId = enrollment.userId;
      const includeWeekends = program.includeWeekends !== false;

      // Calculate user's current day index
      const currentDayIndex = calculateCurrentDayIndex(enrollment.startedAt, includeWeekends);

      // Determine which habits to sync
      let habitsToSync: ProgramHabitTemplate[] = [];
      let currentModuleId: string | null = null;

      // Check if there's a program instance for this enrollment (instance modules take priority)
      // For cohort enrollments, look up by cohortId; for individual enrollments, look up by enrollmentId
      let instanceSnapshot;
      if (enrollment.cohortId) {
        // Cohort enrollment - find the cohort's shared instance
        instanceSnapshot = await adminDb
          .collection('program_instances')
          .where('cohortId', '==', enrollment.cohortId)
          .limit(1)
          .get();
        if (instanceSnapshot.empty) {
          console.log(`[SYNC_HABITS] User ${userId}: no cohort instance found for cohort ${enrollment.cohortId}`);
        }
      } else {
        // Individual enrollment - find the enrollment's instance
        instanceSnapshot = await adminDb
          .collection('program_instances')
          .where('enrollmentId', '==', enrollment.id)
          .limit(1)
          .get();
      }

      const instance = instanceSnapshot?.docs[0]?.data() as ProgramInstance | undefined;
      const instanceModules: ProgramInstanceModule[] = instance?.modules || [];

      if (instanceModules.length > 0) {
        // Use instance modules (customized per enrollment/cohort)
        const currentInstanceModule = getCurrentModule(instanceModules, currentDayIndex) as ProgramInstanceModule | null;
        if (currentInstanceModule) {
          // Use templateModuleId for backward compatibility with habit tracking
          currentModuleId = currentInstanceModule.templateModuleId;
          habitsToSync = currentInstanceModule.habits || [];
          console.log(`[SYNC_HABITS] User ${userId}: day ${currentDayIndex}, instance module "${currentInstanceModule.name}" (template: ${currentModuleId}), ${habitsToSync.length} habits (from instance)`);
        }
      } else if (useModuleHabits) {
        // Fall back to template modules if no instance modules exist
        const currentModule = getCurrentModule(modules, currentDayIndex);
        if (currentModule) {
          currentModuleId = currentModule.id;
          habitsToSync = currentModule.habits || [];
          console.log(`[SYNC_HABITS] User ${userId}: day ${currentDayIndex}, module "${currentModule.name}" (${currentModuleId}), ${habitsToSync.length} habits (from template)`);
        }
      } else {
        // Fallback to program-level habits (legacy)
        habitsToSync = program.defaultHabits || [];
        console.log(`[SYNC_HABITS] User ${userId}: using program-level habits (legacy), ${habitsToSync.length} habits`);
      }

      // Get user's existing module habits for this program
      const existingHabitsSnapshot = await adminDb
        .collection('habits')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .where('programId', '==', programId)
        .where('source', 'in', ['module_default', 'program_default'])
        .get();

      // Create maps of existing habits
      const existingByTitle = new Map<string, Habit & { docId: string }>();
      const existingByModuleId = new Map<string, (Habit & { docId: string })[]>();

      existingHabitsSnapshot.docs.forEach(doc => {
        const habit = { id: doc.id, docId: doc.id, ...doc.data() } as Habit & { docId: string };
        existingByTitle.set(habit.text, habit);

        const moduleId = habit.moduleId || 'none';
        if (!existingByModuleId.has(moduleId)) {
          existingByModuleId.set(moduleId, []);
        }
        existingByModuleId.get(moduleId)!.push(habit);
      });

      let userCreated = 0;
      let userUpdated = 0;
      let userArchived = 0;

      // Track which habit titles we're syncing
      const syncingTitles = new Set(habitsToSync.map(h => h.title));

      // Archive habits from other modules that aren't in the current module
      for (const [moduleId, habits] of existingByModuleId) {
        // Skip habits from current module
        if (moduleId === currentModuleId) continue;

        for (const habit of habits) {
          // If this habit title exists in the new module, update it instead of archiving
          if (syncingTitles.has(habit.text)) {
            // Will be handled in the create/update loop below
            continue;
          }

          // Archive habits that are not in the new module
          if (!habit.archived) {
            await adminDb.collection('habits').doc(habit.docId).update({
              archived: true,
              status: 'archived',
              updatedAt: now,
            });
            userArchived++;
          }
        }
      }

      // Create or update habits for current module
      let currentModuleHabitCount = 0;

      for (const template of habitsToSync) {
        // Check per-module limit
        if (currentModuleHabitCount >= maxHabitsPerModule) {
          console.log(`[SYNC_HABITS] User ${userId}: reached ${maxHabitsPerModule} habit limit for module, skipping remaining`);
          break;
        }

        const existingHabit = existingByTitle.get(template.title);
        const { frequencyType, frequencyValue } = mapFrequency(template);

        if (existingHabit) {
          // UPDATE existing habit - preserve progress, update moduleId if needed
          const updateData: Record<string, unknown> = {
            linkedRoutine: template.description || null,
            frequencyType,
            frequencyValue,
            updatedAt: now,
          };

          // Update moduleId and source if moving to module-based
          if (useModuleHabits && currentModuleId) {
            updateData.moduleId = currentModuleId;
            updateData.source = 'module_default';
          }

          // Unarchive if it was archived
          if (existingHabit.archived) {
            updateData.archived = false;
            updateData.status = 'active';
          }

          await adminDb.collection('habits').doc(existingHabit.docId).update(updateData);
          userUpdated++;
          currentModuleHabitCount++;
        } else {
          // CREATE new habit
          const habitData: Record<string, unknown> = {
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
            source: useModuleHabits ? 'module_default' : 'program_default',
            programId,
            createdAt: now,
            updatedAt: now,
          };

          if (useModuleHabits && currentModuleId) {
            habitData.moduleId = currentModuleId;
          }

          await adminDb.collection('habits').add(habitData);
          userCreated++;
          currentModuleHabitCount++;
        }
      }

      totalCreated += userCreated;
      totalUpdated += userUpdated;
      totalArchived += userArchived;
      usersProcessed++;

      console.log(`[SYNC_HABITS] User ${userId}: created ${userCreated}, updated ${userUpdated}, archived ${userArchived}`);
    }

    console.log(`[SYNC_HABITS] Completed sync for program ${programId}: ${usersProcessed} users, ${totalCreated} created, ${totalUpdated} updated, ${totalArchived} archived`);

    return NextResponse.json({
      success: true,
      message: `Synced habits to ${usersProcessed} users`,
      summary: {
        usersProcessed,
        habitsCreated: totalCreated,
        habitsUpdated: totalUpdated,
        habitsArchived: totalArchived,
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
