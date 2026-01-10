/**
 * Program Utility Functions
 *
 * =============================================================================
 * PROGRAM SYSTEM ARCHITECTURE
 * =============================================================================
 *
 * Programs have a 3-tier content system:
 *
 * 1. TEMPLATE LAYER (base program design):
 *    - program_modules  → Organizational containers (title only, day indices DERIVED from weeks)
 *    - program_weeks    → Week templates with weekNumber
 *    - program_days     → Day templates with tasks
 *
 * 2. EDITOR LAYER (coach customizations):
 *    - COHORT: cohort_week_content, cohort_program_days
 *    - 1:1 CLIENT: client_program_weeks, client_program_days
 *
 * 3. USER LAYER (what users see):
 *    - tasks collection → User's actual Daily Focus tasks
 *
 * DATA FLOW:
 *   Template → "Sync from Template" → Editor → Cron/manual sync → Daily Focus
 *
 * KEY RULES:
 * - Day editor is source of truth (if coach deletes task, it stays deleted)
 * - Week feeds into Day (Week → Day distribution)
 * - Modules are containers only (their day indices are DERIVED from their weeks)
 *
 * =============================================================================
 * CRITICAL: DAY INDEX CALCULATION FOR DISTRIBUTION
 * =============================================================================
 *
 * There are TWO types of day index calculations:
 *
 * 1. TEMPLATE DISTRIBUTION (program_days):
 *    Uses stored indices from program_weeks. These are simple sequential
 *    indices without calendar alignment.
 *
 * 2. COHORT/CLIENT DISTRIBUTION (cohort_program_days, client_program_days):
 *    MUST use calendar-aligned indices from calculateCalendarWeeks() with
 *    the cohort's startDate or enrollment's startedAt date.
 *
 *    This correctly accounts for:
 *    - Onboarding periods (partial weeks at start based on calendar weekday)
 *    - Calendar alignment (weeks start on Mondays)
 *
 *    Example: Client starts on Wednesday:
 *    - Onboarding = Days 1-2 (Wed-Fri before first Monday)
 *    - Week 1 = Days 3-9 (first full Mon-Sun week)
 *    - Week 2 = Days 10-16 (second full week)
 *
 *    Using template indices (Week 1 = Days 1-7) would be WRONG because
 *    they don't account for the client's actual start date!
 *
 * RULE: Week tasks must NEVER be distributed to another week's days.
 *
 * =============================================================================
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateCalendarWeeks, type CalendarWeek } from '@/lib/calendar-weeks';
import type { TaskDistribution, ProgramTaskTemplate } from '@/types';

interface ModuleData {
  id: string;
  order: number;
  programId: string;
}

interface WeekData {
  id: string;
  moduleId: string | null;
  order: number;
  weekNumber: number;
  startDayIndex: number;
  endDayIndex: number;
}

/**
 * Calculate which day indices should receive tasks for even distribution.
 *
 * Examples (for 7-day week, days 1-7):
 * - 2 tasks: [1, 4] (Monday, Thursday)
 * - 3 tasks: [1, 3, 5] (Monday, Wednesday, Friday)
 * - 4 tasks: [1, 3, 5, 7] (spread across week)
 * - 7 tasks: [1, 2, 3, 4, 5, 6, 7] (one per day)
 *
 * @param numTasks Number of tasks to spread
 * @param startDay First day index of the week
 * @param endDay Last day index of the week
 * @returns Array of day indices where tasks should be placed
 */
export function calculateSpreadDayIndices(numTasks: number, startDay: number, endDay: number): number[] {
  const daysInWeek = endDay - startDay + 1;

  if (numTasks <= 0) return [];
  if (numTasks >= daysInWeek) {
    // More tasks than days: return all days
    return Array.from({ length: daysInWeek }, (_, i) => startDay + i);
  }

  // Calculate evenly spaced indices
  const dayIndices: number[] = [];
  const interval = daysInWeek / numTasks;

  for (let i = 0; i < numTasks; i++) {
    // Use Math.floor to get the day index, offset by half interval for better centering
    const dayOffset = Math.floor(i * interval + interval / 2);
    dayIndices.push(startDay + Math.min(dayOffset, daysInWeek - 1));
  }

  // Deduplicate in case of rounding collisions
  return [...new Set(dayIndices)].sort((a, b) => a - b);
}


/**
 * Calculate day indices for a week based on week number and program settings.
 * This is used as a fallback when weeks don't have startDayIndex/endDayIndex set.
 *
 * @param weekNumber - The 1-based week number
 * @param includeWeekends - Whether the program includes weekends (7 days) or not (5 days)
 * @param totalDays - Total days in the program
 * @returns { startDayIndex, endDayIndex }
 */
export function calculateWeekDayIndices(
  weekNumber: number,
  includeWeekends: boolean,
  totalDays: number
): { startDayIndex: number; endDayIndex: number } {
  const daysPerWeek = includeWeekends ? 7 : 5;
  const startDayIndex = (weekNumber - 1) * daysPerWeek + 1;
  const endDayIndex = Math.min(startDayIndex + daysPerWeek - 1, totalDays);
  return { startDayIndex, endDayIndex };
}

/**
 * Recalculates the day indices for all weeks in a program based on module order and week order within modules.
 *
 * This function:
 * 1. Gets all modules sorted by order
 * 2. Gets all weeks, groups by moduleId, sorts by order within each module
 * 3. Assigns sequential day indices to weeks based on the program's daysPerWeek setting
 * 4. Updates module startDayIndex/endDayIndex to match their weeks
 *
 * @param programId - The ID of the program to recalculate
 */
export async function recalculateWeekDayIndices(programId: string): Promise<void> {
  // Get program to know daysPerWeek
  const programDoc = await adminDb.collection('programs').doc(programId).get();
  if (!programDoc.exists) {
    throw new Error(`Program ${programId} not found`);
  }

  const programData = programDoc.data();
  const includeWeekends = programData?.includeWeekends !== false;
  const daysPerWeek = includeWeekends ? 7 : 5;
  const totalDays = programData?.lengthDays || 30;

  // Get all modules
  const modulesSnapshot = await adminDb
    .collection('program_modules')
    .where('programId', '==', programId)
    .get();

  const modules: ModuleData[] = modulesSnapshot.docs
    .map(doc => ({
      id: doc.id,
      order: doc.data().order || 0,
      programId: doc.data().programId,
    }))
    .sort((a, b) => a.order - b.order);

  // Get all weeks
  const weeksSnapshot = await adminDb
    .collection('program_weeks')
    .where('programId', '==', programId)
    .get();

  const allWeeks: WeekData[] = weeksSnapshot.docs.map(doc => ({
    id: doc.id,
    moduleId: doc.data().moduleId || null,
    order: doc.data().order || 0,
    weekNumber: doc.data().weekNumber || 0,
    startDayIndex: doc.data().startDayIndex || 0,
    endDayIndex: doc.data().endDayIndex || 0,
  }));

  // Calculate week day indices sequentially, accounting for onboarding weeks
  // Sort weeks by weekNumber (0 = onboarding, 1+ = regular weeks)
  const sortedWeeks = [...allWeeks].sort((a, b) => a.weekNumber - b.weekNumber);

  const batch = adminDb.batch();
  let currentDay = 1; // Start from Day 1

  for (const week of sortedWeeks) {
    const weekNumber = week.weekNumber;
    if (weekNumber < 0) continue; // Skip invalid week numbers

    // Calculate how many days this week spans
    // Onboarding weeks (weekNumber = 0) use their existing length or default to daysPerWeek
    // Regular weeks use daysPerWeek
    let weekLength: number;
    if (weekNumber === 0) {
      // Onboarding week - preserve its existing length if valid, otherwise calculate from stored indices
      const existingLength = week.endDayIndex - week.startDayIndex + 1;
      weekLength = existingLength > 0 && existingLength <= daysPerWeek ? existingLength : daysPerWeek;
    } else {
      weekLength = daysPerWeek;
    }

    const startDay = currentDay;
    const endDay = Math.min(currentDay + weekLength - 1, totalDays);

    // Update the week's stored indices
    week.startDayIndex = startDay;
    week.endDayIndex = endDay;

    batch.update(adminDb.collection('program_weeks').doc(week.id), {
      startDayIndex: startDay,
      endDayIndex: endDay,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Move to next day range
    currentDay = endDay + 1;

    // Stop if we've exceeded total days
    if (currentDay > totalDays) break;
  }

  // Group weeks by module for deriving module indices
  const weeksByModule = new Map<string, WeekData[]>();
  modules.forEach(m => weeksByModule.set(m.id, []));

  allWeeks.forEach(week => {
    if (week.moduleId && weeksByModule.has(week.moduleId)) {
      weeksByModule.get(week.moduleId)!.push(week);
    } else if (modules.length > 0) {
      // Assign to first module if no moduleId
      weeksByModule.get(modules[0].id)!.push(week);
    }
  });

  // Derive module day ranges from their weeks (not calculated independently)
  for (const module of modules) {
    const moduleWeeks = weeksByModule.get(module.id) || [];
    if (moduleWeeks.length > 0) {
      // Module's day range = min startDayIndex to max endDayIndex of its weeks
      const startDayIndex = Math.min(...moduleWeeks.map(w => w.startDayIndex));
      const endDayIndex = Math.max(...moduleWeeks.map(w => w.endDayIndex));

      batch.update(adminDb.collection('program_modules').doc(module.id), {
        startDayIndex,
        endDayIndex,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
  console.log(`[PROGRAM_UTILS] Recalculated day indices for ${allWeeks.length} weeks in program ${programId}`);
}

/**
 * Creates or syncs weeks for a program based on its length.
 * This should be called when a program is created or when its duration changes.
 *
 * If weeks already exist, it will:
 * - Add new weeks if the program grew
 * - Mark extra weeks for potential removal if the program shrunk (doesn't delete to avoid data loss)
 *
 * @param programId - The ID of the program
 * @param organizationId - The organization ID
 * @param moduleId - Optional module ID to assign new weeks to (defaults to first module or null)
 * @returns Object containing created and existing week counts
 */
export async function syncProgramWeeks(
  programId: string,
  organizationId: string,
  moduleId?: string | null
): Promise<{ created: number; existing: number; total: number }> {
  // Get program to calculate weeks
  const programDoc = await adminDb.collection('programs').doc(programId).get();
  if (!programDoc.exists) {
    throw new Error(`Program ${programId} not found`);
  }

  const programData = programDoc.data();
  const totalDays = programData?.lengthDays || 30;
  const includeWeekends = programData?.includeWeekends !== false;
  const daysPerWeek = includeWeekends ? 7 : 5;
  const targetWeekCount = Math.ceil(totalDays / daysPerWeek);

  // Get existing weeks
  const existingWeeksSnapshot = await adminDb
    .collection('program_weeks')
    .where('programId', '==', programId)
    .get();

  const existingWeekNumbers = new Set(
    existingWeeksSnapshot.docs.map(doc => doc.data().weekNumber as number)
  );
  const existingCount = existingWeekNumbers.size;

  // If no module specified, try to get the first module
  let targetModuleId = moduleId;
  if (!targetModuleId) {
    const modulesSnapshot = await adminDb
      .collection('program_modules')
      .where('programId', '==', programId)
      .orderBy('order', 'asc')
      .limit(1)
      .get();

    if (!modulesSnapshot.empty) {
      targetModuleId = modulesSnapshot.docs[0].id;
    }
  }

  // Create missing weeks
  const batch = adminDb.batch();
  let createdCount = 0;

  for (let weekNum = 1; weekNum <= targetWeekCount; weekNum++) {
    if (!existingWeekNumbers.has(weekNum)) {
      const startDay = (weekNum - 1) * daysPerWeek + 1;
      const endDay = Math.min(startDay + daysPerWeek - 1, totalDays);

      const weekRef = adminDb.collection('program_weeks').doc();
      batch.set(weekRef, {
        programId,
        moduleId: targetModuleId || null,
        organizationId,
        order: weekNum,
        weekNumber: weekNum,
        startDayIndex: startDay,
        endDayIndex: endDay,
        distribution: 'spread',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      createdCount++;
    }
  }

  if (createdCount > 0) {
    await batch.commit();
    console.log(`[PROGRAM_UTILS] Created ${createdCount} weeks for program ${programId} (${existingCount} existed)`);
  }

  return {
    created: createdCount,
    existing: existingCount,
    total: targetWeekCount,
  };
}

/**
 * Creates initial weeks for a program based on its length and assigns them to a module.
 *
 * @param programId - The ID of the program
 * @param moduleId - The ID of the module to assign weeks to
 * @param organizationId - The organization ID
 * @returns The created weeks
 */
export async function createInitialWeeksForModule(
  programId: string,
  moduleId: string,
  organizationId: string
): Promise<{ id: string; weekNumber: number }[]> {
  // Get program to calculate weeks
  const programDoc = await adminDb.collection('programs').doc(programId).get();
  if (!programDoc.exists) {
    throw new Error(`Program ${programId} not found`);
  }

  const programData = programDoc.data();
  const totalDays = programData?.lengthDays || 30;
  const includeWeekends = programData?.includeWeekends !== false;
  const daysPerWeek = includeWeekends ? 7 : 5;
  const numWeeks = Math.ceil(totalDays / daysPerWeek);

  const batch = adminDb.batch();
  const createdWeeks: { id: string; weekNumber: number }[] = [];

  for (let weekIdx = 0; weekIdx < numWeeks; weekIdx++) {
    const weekNum = weekIdx + 1;
    const startDay = weekIdx * daysPerWeek + 1;
    const endDay = Math.min(startDay + daysPerWeek - 1, totalDays);

    const weekRef = adminDb.collection('program_weeks').doc();
    batch.set(weekRef, {
      programId,
      moduleId,
      organizationId,
      order: weekNum,
      weekNumber: weekNum,
      startDayIndex: startDay,
      endDayIndex: endDay,
      distribution: 'spread',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    createdWeeks.push({ id: weekRef.id, weekNumber: weekNum });
  }

  await batch.commit();
  console.log(`[PROGRAM_UTILS] Created ${numWeeks} initial weeks for module ${moduleId} in program ${programId}`);

  return createdWeeks;
}


/**
 * Distributes weekly tasks to program days based on the week's distribution setting.
 *
 * @param programId - The program ID
 * @param weekId - The week to distribute tasks for
 * @param options - Configuration options
 * @returns Object with counts of created/updated days
 */
export async function distributeWeeklyTasksToDays(
  programId: string,
  weekId: string,
  options: {
    overwriteExisting?: boolean; // If true, replaces existing day tasks. Default: false (skip)
    programTaskDistribution?: TaskDistribution; // Fallback if week doesn't have distribution set
  } = {}
): Promise<{ created: number; updated: number; skipped: number }> {
  const { overwriteExisting = false, programTaskDistribution } = options;

  // Fetch week data
  const weekDoc = await adminDb.collection('program_weeks').doc(weekId).get();
  if (!weekDoc.exists) {
    throw new Error('Week not found');
  }

  const weekData = weekDoc.data();
  if (!weekData || weekData.programId !== programId) {
    throw new Error('Week does not belong to this program');
  }

  const weeklyTasks = weekData.weeklyTasks || [];
  const weekNumber = weekData.weekNumber;

  // Distribution is always program-wide, never week-specific
  const distribution = programTaskDistribution ?? 'spread';

  // Get program settings for day calculation
  const programDoc = await adminDb.collection('programs').doc(programId).get();
  const programData = programDoc.data();
  const includeWeekends = programData?.includeWeekends !== false;
  const daysPerWeek = includeWeekends ? 7 : 5;
  const totalDays = programData?.lengthDays || 30;

  // Use the week's stored day indices - these are the source of truth
  // They correctly account for onboarding periods and custom week structures
  // CRITICAL: Week tasks must NEVER be distributed to another week's days
  const storedStartDay = weekData.startDayIndex;
  const storedEndDay = weekData.endDayIndex;

  if (!storedStartDay || !storedEndDay) {
    console.error('[PROGRAM_UTILS] Week missing day indices:', { weekId, storedStartDay, storedEndDay });
    return { created: 0, updated: 0, skipped: 0 };
  }

  const resolvedStartDay = storedStartDay;
  const resolvedEndDay = Math.min(storedEndDay, totalDays);

  console.log('[PROGRAM_UTILS] distributeWeeklyTasksToDays:', {
    weekId,
    weekNumber,
    daysPerWeek,
    distribution,
    startDayIndex: resolvedStartDay,
    endDayIndex: resolvedEndDay,
  });

  // NOTE: We continue even if weeklyTasks is empty - this allows clearing week-sourced tasks
  // while preserving manually added day tasks (source !== 'week')

  const daysInWeek = resolvedEndDay - resolvedStartDay + 1;

  console.log('[PROGRAM_UTILS] distributeWeeklyTasksToDays:', {
    weekId,
    distribution,
    startDay: resolvedStartDay,
    endDay: resolvedEndDay,
    daysInWeek,
    tasksCount: weeklyTasks.length,
    taskLabels: weeklyTasks.map((t: { label?: string }) => t.label).join(', '),
  });

  // Get existing days in this range
  const existingDaysSnapshot = await adminDb
    .collection('program_days')
    .where('programId', '==', programId)
    .where('dayIndex', '>=', resolvedStartDay)
    .where('dayIndex', '<=', resolvedEndDay)
    .get();

  const existingDays = new Map(
    existingDaysSnapshot.docs.map(doc => [doc.data().dayIndex as number, { id: doc.id, ...doc.data() }])
  );

  const batch = adminDb.batch();
  let created = 0,
    updated = 0,
    skipped = 0;

  if (distribution === 'repeat-daily') {
    // Copy all tasks to each day (with smart merging)
    for (let d = resolvedStartDay; d <= resolvedEndDay; d++) {
      const existing = existingDays.get(d);
      const existingData = existing as { id: string; tasks?: ProgramTaskTemplate[] } | undefined;

      // Get existing tasks and filter out week-sourced ones (they'll be replaced)
      const existingTasks = existingData?.tasks || [];
      const manualTasks = existingTasks.filter(t => t.source !== 'week');

      // Tag new tasks with source: 'week'
      const weekSourcedTasks = weeklyTasks.map((task: ProgramTaskTemplate) => ({
        ...task,
        source: 'week' as const,
      }));

      // Merge: manual tasks + new week tasks
      const mergedTasks = [...manualTasks, ...weekSourcedTasks];

      console.log(`[PROGRAM_UTILS] Day ${d} merge: kept ${manualTasks.length} manual, adding ${weekSourcedTasks.length} from week`);

      const dayRef = existing
        ? adminDb.collection('program_days').doc(existingData!.id)
        : adminDb.collection('program_days').doc();

      const dayData = {
        programId,
        dayIndex: d,
        tasks: mergedTasks,
        weekId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };

      if (existing) {
        batch.update(dayRef, dayData);
        updated++;
      } else {
        batch.set(dayRef, dayData);
        created++;
      }
    }
  } else {
    // Spread: distribute tasks evenly across days (with smart merging)
    // Calculate which days should receive tasks (evenly spaced)
    const spreadDays = calculateSpreadDayIndices(weeklyTasks.length, resolvedStartDay, resolvedEndDay);

    console.log(`[PROGRAM_UTILS] Spread distribution: ${weeklyTasks.length} tasks over days ${spreadDays.join(', ')}`);

    // Process ALL days in the week (to clear old week tasks from days that won't get new tasks)
    for (let d = resolvedStartDay; d <= resolvedEndDay; d++) {
      const existing = existingDays.get(d);
      const existingData = existing as { id: string; tasks?: ProgramTaskTemplate[] } | undefined;

      // Get existing tasks and filter out week-sourced ones (they'll be replaced)
      const existingTasks = existingData?.tasks || [];
      const manualTasks = existingTasks.filter(t => t.source !== 'week');

      // Check if this day should receive a task
      const taskIndexForDay = spreadDays.indexOf(d);
      let weekSourcedTasks: ProgramTaskTemplate[] = [];

      if (taskIndexForDay !== -1 && taskIndexForDay < weeklyTasks.length) {
        // This day gets a task - tag it with source: 'week'
        weekSourcedTasks = [{
          ...weeklyTasks[taskIndexForDay],
          source: 'week' as const,
        }];
      }

      // Merge: manual tasks + new week tasks (may be empty for non-spread days)
      const mergedTasks = [...manualTasks, ...weekSourcedTasks];

      // Skip if no change needed (no manual tasks and no new tasks)
      if (mergedTasks.length === 0 && !existing) continue;

      console.log(`[PROGRAM_UTILS] Day ${d} merge: kept ${manualTasks.length} manual, adding ${weekSourcedTasks.length} from week`);

      const dayRef = existing
        ? adminDb.collection('program_days').doc(existingData!.id)
        : adminDb.collection('program_days').doc();

      const dayData = {
        programId,
        dayIndex: d,
        tasks: mergedTasks,
        weekId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };

      if (existing) {
        batch.update(dayRef, dayData);
        updated++;
      } else {
        batch.set(dayRef, dayData);
        created++;
      }
    }
  }

  await batch.commit();
  console.log(
    `[PROGRAM_UTILS] Distributed tasks for week ${weekId}: ${created} created, ${updated} updated, ${skipped} skipped`
  );

  return { created, updated, skipped };
}

/**
 * Sync client_program_days with updated week task distribution.
 *
 * When week tasks are edited (added/deleted), this function updates any existing
 * client_program_days to reflect the changes while preserving manually-added tasks.
 *
 * Smart merge logic:
 * - Removes tasks with source: 'week' (they'll be replaced by new week tasks)
 * - Preserves tasks with source !== 'week' (manually added by coach)
 * - Merges new week-sourced tasks with preserved manual tasks
 *
 * @param programId - The program ID
 * @param weekId - The week ID that was edited
 * @param dayRange - The day index range covered by the week
 * @returns Counts of updated and skipped client_program_days
 */
export async function syncClientProgramDaysFromWeekDistribution(
  programId: string,
  weekId: string,
  dayRange: { startDayIndex: number; endDayIndex: number }
): Promise<{ updated: number; skipped: number }> {
  const { startDayIndex, endDayIndex } = dayRange;
  let updated = 0;
  let skipped = 0;

  console.log(`[PROGRAM_UTILS] syncClientProgramDaysFromWeekDistribution: programId=${programId}, weekId=${weekId}, range=${startDayIndex}-${endDayIndex}`);

  // 1. Get all active enrollments for this program (only individual/1:1 programs have client_program_days)
  const enrollmentsSnapshot = await adminDb
    .collection('program_enrollments')
    .where('programId', '==', programId)
    .where('status', 'in', ['active', 'upcoming'])
    .get();

  if (enrollmentsSnapshot.empty) {
    console.log(`[PROGRAM_UTILS] No active enrollments for program ${programId}`);
    return { updated: 0, skipped: 0 };
  }

  console.log(`[PROGRAM_UTILS] Found ${enrollmentsSnapshot.size} active enrollments to sync`);

  // 2. Get the updated program_days for this week's day range
  const programDaysSnapshot = await adminDb
    .collection('program_days')
    .where('programId', '==', programId)
    .where('dayIndex', '>=', startDayIndex)
    .where('dayIndex', '<=', endDayIndex)
    .get();

  // Build a map of dayIndex -> tasks for quick lookup
  const programDaysTasks = new Map<number, ProgramTaskTemplate[]>();
  programDaysSnapshot.docs.forEach(doc => {
    const data = doc.data();
    programDaysTasks.set(data.dayIndex, data.tasks || []);
  });

  console.log(`[PROGRAM_UTILS] Loaded program_days for ${programDaysTasks.size} days in range`);

  // 3. For each enrollment, update client_program_days in the day range
  for (const enrollmentDoc of enrollmentsSnapshot.docs) {
    const enrollmentId = enrollmentDoc.id;

    // Query client_program_days for this enrollment in the day range
    const clientDaysSnapshot = await adminDb
      .collection('client_program_days')
      .where('enrollmentId', '==', enrollmentId)
      .where('dayIndex', '>=', startDayIndex)
      .where('dayIndex', '<=', endDayIndex)
      .get();

    if (clientDaysSnapshot.empty) {
      // No client_program_days exist for this enrollment in this range - that's fine
      // The sync will fall through to program_days automatically
      skipped += (endDayIndex - startDayIndex + 1);
      continue;
    }

    // Update each client_program_day with smart merge
    for (const clientDayDoc of clientDaysSnapshot.docs) {
      const clientDayData = clientDayDoc.data();
      const dayIndex = clientDayData.dayIndex;
      const existingTasks: ProgramTaskTemplate[] = clientDayData.tasks || [];

      // Get the new week-sourced tasks from program_days
      const newWeekTasks = programDaysTasks.get(dayIndex) || [];

      // Smart merge: keep manual tasks, replace week-sourced tasks
      const manualTasks = existingTasks.filter(t => t.source !== 'week');
      const mergedTasks = [...manualTasks, ...newWeekTasks];

      // Only update if there's an actual change
      const existingWeekTaskCount = existingTasks.filter(t => t.source === 'week').length;
      const newWeekTaskCount = newWeekTasks.length;

      if (existingWeekTaskCount !== newWeekTaskCount ||
          JSON.stringify(existingTasks.filter(t => t.source === 'week')) !== JSON.stringify(newWeekTasks)) {
        await clientDayDoc.ref.update({
          tasks: mergedTasks,
          updatedAt: FieldValue.serverTimestamp(),
        });
        updated++;
        console.log(`[PROGRAM_UTILS] Updated client_program_day ${clientDayDoc.id} (enrollment=${enrollmentId}, dayIndex=${dayIndex}): kept ${manualTasks.length} manual, set ${newWeekTasks.length} week-sourced`);
      } else {
        skipped++;
      }
    }
  }

  console.log(`[PROGRAM_UTILS] syncClientProgramDaysFromWeekDistribution complete: ${updated} updated, ${skipped} skipped`);
  return { updated, skipped };
}


/**
 * Distribute cohort-specific weekly tasks to individual cohort program days.
 * Creates or updates cohort_program_days documents based on distribution settings.
 * 
 * @param programId - The program ID
 * @param weekId - The week ID (program_weeks doc)
 * @param cohortId - The cohort ID (program_cohorts doc)
 * @param options - Distribution options
 * @returns Counts of created, updated, and skipped days
 */
export async function distributeCohortWeeklyTasksToDays(
  programId: string,
  weekId: string,
  cohortId: string,
  options: {
    overwriteExisting?: boolean; // If true, replaces existing day tasks. Default: false (skip)
    programTaskDistribution?: TaskDistribution; // Fallback if cohort week doesn't have distribution set
  } = {}
): Promise<{ created: number; updated: number; skipped: number }> {
  const { overwriteExisting = false, programTaskDistribution } = options;

  // Fetch week data to get day range
  const weekDoc = await adminDb.collection('program_weeks').doc(weekId).get();
  if (!weekDoc.exists) {
    throw new Error('Week not found');
  }

  const weekData = weekDoc.data();
  if (!weekData || weekData.programId !== programId) {
    throw new Error('Week does not belong to this program');
  }

  // Fetch cohort week content for the weekly tasks
  const cohortWeekContentSnapshot = await adminDb
    .collection('cohort_week_content')
    .where('cohortId', '==', cohortId)
    .where('programWeekId', '==', weekId)
    .limit(1)
    .get();

  if (cohortWeekContentSnapshot.empty) {
    console.log(`[PROGRAM_UTILS] No cohort week content found for cohort ${cohortId}, week ${weekId}`);
    return { created: 0, updated: 0, skipped: 0 };
  }

  const cohortWeekContent = cohortWeekContentSnapshot.docs[0].data();
  const weeklyTasks = cohortWeekContent.weeklyTasks || [];
  const weekNumber = weekData.weekNumber;

  // NOTE: We continue even if weeklyTasks is empty - this allows clearing week-sourced tasks
  // while preserving manually added day tasks (source !== 'week')

  // Distribution is always program-wide, never week-specific
  const distribution = programTaskDistribution ?? 'spread';

  // Get program settings
  const programDocForCalc = await adminDb.collection('programs').doc(programId).get();
  const programDataForCalc = programDocForCalc.data();
  const totalDays = programDataForCalc?.lengthDays || 30;
  const includeWeekends = programDataForCalc?.includeWeekends !== false;

  // Fetch cohort to get start date for calendar-aligned day indices
  const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
  if (!cohortDoc.exists) {
    console.error('[PROGRAM_UTILS] Cohort not found:', cohortId);
    return { created: 0, updated: 0, skipped: 0 };
  }
  const cohortData = cohortDoc.data();
  const cohortStartDate = cohortData?.startDate;

  // Use calendar-aligned day indices based on the cohort's start date
  // This correctly accounts for onboarding periods based on when the cohort actually starts
  // CRITICAL: Week tasks must NEVER be distributed to another week's days
  let resolvedStartDay: number;
  let resolvedEndDay: number;

  if (cohortStartDate) {
    // Calculate calendar-aligned weeks for this cohort
    const calendarWeeks = calculateCalendarWeeks(cohortStartDate, totalDays, includeWeekends);

    // Find the week matching this weekNumber
    const calendarWeek = calendarWeeks.find((w: CalendarWeek) => w.weekNumber === weekNumber);

    if (calendarWeek) {
      resolvedStartDay = calendarWeek.startDayIndex;
      resolvedEndDay = Math.min(calendarWeek.endDayIndex, totalDays);
      console.log(`[PROGRAM_UTILS] Using calendar-aligned indices for cohort ${cohortId}, week ${weekNumber}: days ${resolvedStartDay}-${resolvedEndDay}`);
    } else {
      // Fallback to template indices if week not found in calendar
      console.warn(`[PROGRAM_UTILS] Week ${weekNumber} not found in calendar weeks, using template indices`);
      resolvedStartDay = weekData.startDayIndex;
      resolvedEndDay = Math.min(weekData.endDayIndex, totalDays);
    }
  } else {
    // No cohort start date - use template indices as fallback
    console.warn(`[PROGRAM_UTILS] Cohort ${cohortId} has no start date, using template indices`);
    resolvedStartDay = weekData.startDayIndex;
    resolvedEndDay = Math.min(weekData.endDayIndex, totalDays);
  }

  if (!resolvedStartDay || !resolvedEndDay) {
    console.error('[PROGRAM_UTILS] Could not resolve day indices for cohort distribution:', { weekId, cohortId, weekNumber, resolvedStartDay, resolvedEndDay });
    return { created: 0, updated: 0, skipped: 0 };
  }

  const daysInWeek = resolvedEndDay - resolvedStartDay + 1;

  // Get existing cohort days in this range
  const existingDaysSnapshot = await adminDb
    .collection('cohort_program_days')
    .where('cohortId', '==', cohortId)
    .where('programId', '==', programId)
    .where('dayIndex', '>=', resolvedStartDay)
    .where('dayIndex', '<=', resolvedEndDay)
    .get();

  const existingDays = new Map(
    existingDaysSnapshot.docs.map(doc => [doc.data().dayIndex as number, { id: doc.id, ...doc.data() }])
  );

  // Debug logging - trace what days were found
  console.log(`[DIST_DEBUG_COHORT] Query: cohortId=${cohortId}, programId=${programId}, dayIndex ${resolvedStartDay}-${resolvedEndDay}`);
  console.log(`[DIST_DEBUG_COHORT] Found ${existingDaysSnapshot.size} existing days`);
  existingDays.forEach((day, dayIndex) => {
    const dayData = day as { tasks?: ProgramTaskTemplate[] };
    const tasks = dayData.tasks || [];
    console.log(`[DIST_DEBUG_COHORT] Day ${dayIndex}: ${tasks.length} tasks, sources: [${tasks.map(t => t.source || 'undefined').join(', ')}]`);
  });

  // Get program's organizationId for new documents
  const programDoc = await adminDb.collection('programs').doc(programId).get();
  const organizationId = programDoc.data()?.organizationId || '';

  const batch = adminDb.batch();
  let created = 0,
    updated = 0,
    skipped = 0;

  if (distribution === 'repeat-daily') {
    // Copy all tasks to each day (with smart merging)
    for (let d = resolvedStartDay; d <= resolvedEndDay; d++) {
      const existing = existingDays.get(d);
      const existingData = existing as { id: string; tasks?: ProgramTaskTemplate[] } | undefined;

      // Get existing tasks and filter out week-sourced ones (they'll be replaced)
      const existingTasks = existingData?.tasks || [];
      const manualTasks = existingTasks.filter(t => t.source !== 'week');
      
      // Build a set of manual task labels for deduplication (case-insensitive)
      const manualTaskLabels = new Set(manualTasks.map(t => t.label?.toLowerCase()));

      // Tag new tasks with source: 'week', but skip if a manual task with same name exists
      const weekSourcedTasks = weeklyTasks
        .filter((task: ProgramTaskTemplate) => !manualTaskLabels.has(task.label?.toLowerCase()))
        .map((task: ProgramTaskTemplate) => ({
          ...task,
          source: 'week' as const,
        }));

      // Merge: manual tasks + new week tasks (deduplicated)
      const mergedTasks = [...manualTasks, ...weekSourcedTasks];

      console.log(`[PROGRAM_UTILS] Cohort day ${d} merge: kept ${manualTasks.length} manual, adding ${weekSourcedTasks.length} from week (${weeklyTasks.length - weekSourcedTasks.length} duplicates skipped)`);

      const dayRef = existing
        ? adminDb.collection('cohort_program_days').doc(existingData!.id)
        : adminDb.collection('cohort_program_days').doc();

      const dayData = {
        cohortId,
        programId,
        organizationId,
        dayIndex: d,
        tasks: mergedTasks,
        weekId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };

      if (existing) {
        batch.update(dayRef, dayData);
        updated++;
      } else {
        batch.set(dayRef, dayData);
        created++;
      }
    }
  } else {
    // Spread: distribute tasks evenly across days (with smart merging)
    const spreadDays = calculateSpreadDayIndices(weeklyTasks.length, resolvedStartDay, resolvedEndDay);

    console.log(`[PROGRAM_UTILS] Cohort spread distribution: ${weeklyTasks.length} tasks over days ${spreadDays.join(', ')}`);

    // Process ALL days in the week (to clear old week tasks from days that won't get new tasks)
    for (let d = resolvedStartDay; d <= resolvedEndDay; d++) {
      const existing = existingDays.get(d);
      const existingData = existing as { id: string; tasks?: ProgramTaskTemplate[] } | undefined;

      // Get existing tasks and filter out week-sourced ones (they'll be replaced)
      const existingTasks = existingData?.tasks || [];
      const manualTasks = existingTasks.filter(t => t.source !== 'week');
      
      // Build a set of manual task labels for deduplication (case-insensitive)
      const manualTaskLabels = new Set(manualTasks.map(t => t.label?.toLowerCase()));

      // Check if this day should receive a task
      const taskIndexForDay = spreadDays.indexOf(d);
      let weekSourcedTasks: ProgramTaskTemplate[] = [];

      if (taskIndexForDay !== -1 && taskIndexForDay < weeklyTasks.length) {
        const taskToAdd = weeklyTasks[taskIndexForDay];
        // Skip if a manual task with same name exists (deduplication)
        if (!manualTaskLabels.has(taskToAdd.label?.toLowerCase())) {
          weekSourcedTasks = [{
            ...taskToAdd,
            source: 'week' as const,
          }];
        }
      }

      // Merge: manual tasks + new week tasks (may be empty for non-spread days or duplicates)
      const mergedTasks = [...manualTasks, ...weekSourcedTasks];

      // Skip if no change needed (no manual tasks and no new tasks)
      if (mergedTasks.length === 0 && !existing) continue;

      console.log(`[PROGRAM_UTILS] Cohort day ${d} merge: kept ${manualTasks.length} manual, adding ${weekSourcedTasks.length} from week`);

      const dayRef = existing
        ? adminDb.collection('cohort_program_days').doc(existingData!.id)
        : adminDb.collection('cohort_program_days').doc();

      const dayData = {
        cohortId,
        programId,
        organizationId,
        dayIndex: d,
        tasks: mergedTasks,
        weekId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };

      if (existing) {
        batch.update(dayRef, dayData);
        updated++;
      } else {
        batch.set(dayRef, dayData);
        created++;
      }
    }
  }

  await batch.commit();
  console.log(
    `[PROGRAM_UTILS] Distributed cohort tasks for cohort ${cohortId}, week ${weekId}: ${created} created, ${updated} updated, ${skipped} skipped`
  );

  return { created, updated, skipped };
}


/**
 * Distributes weekly tasks from a client-specific week to client-specific days.
 * This is for 1:1 programs where a coach has customized content for a specific client.
 *
 * @param programId - The program ID
 * @param clientWeekId - The client week ID (client_program_weeks doc)
 * @param enrollmentId - The enrollment ID
 * @param options - Distribution options
 * @returns Counts of created, updated, and skipped days
 */
export async function distributeClientWeeklyTasksToDays(
  programId: string,
  clientWeekId: string,
  enrollmentId: string,
  options: {
    overwriteExisting?: boolean;
    programTaskDistribution?: TaskDistribution;
  } = {}
): Promise<{ created: number; updated: number; skipped: number }> {
  const { overwriteExisting = false, programTaskDistribution } = options;

  // Fetch client week data
  const clientWeekDoc = await adminDb.collection('client_program_weeks').doc(clientWeekId).get();
  if (!clientWeekDoc.exists) {
    throw new Error('Client week not found');
  }

  const clientWeekData = clientWeekDoc.data();
  if (!clientWeekData || clientWeekData.programId !== programId) {
    throw new Error('Client week does not belong to this program');
  }
  if (clientWeekData.enrollmentId !== enrollmentId) {
    throw new Error('Client week does not belong to this enrollment');
  }

  const weeklyTasks = clientWeekData.weeklyTasks || [];
  const weekNumber = clientWeekData.weekNumber;

  // NOTE: We continue even if weeklyTasks is empty - this allows clearing week-sourced tasks
  // while preserving manually added day tasks (source !== 'week')

  // Distribution is always program-wide, never week-specific
  const distribution = programTaskDistribution ?? 'spread';

  // Get program settings
  const programDoc = await adminDb.collection('programs').doc(programId).get();
  const programData = programDoc.data();
  const totalDays = programData?.lengthDays || 30;
  const includeWeekends = programData?.includeWeekends !== false;

  // Get enrollment to get start date for calendar-aligned day indices
  const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
  const enrollment = enrollmentDoc.data();
  const organizationId = enrollment?.organizationId || '';
  const userId = enrollment?.userId || '';
  const enrollmentStartDate = enrollment?.startedAt;

  // Use calendar-aligned day indices based on the enrollment's start date
  // This correctly accounts for onboarding periods based on when the client actually started
  // CRITICAL: Week tasks must NEVER be distributed to another week's days
  let resolvedStartDay: number;
  let resolvedEndDay: number;

  if (enrollmentStartDate) {
    // Calculate calendar-aligned weeks for this enrollment
    const calendarWeeks = calculateCalendarWeeks(enrollmentStartDate, totalDays, includeWeekends);

    // Find the week matching this weekNumber
    const calendarWeek = calendarWeeks.find((w: CalendarWeek) => w.weekNumber === weekNumber);

    if (calendarWeek) {
      resolvedStartDay = calendarWeek.startDayIndex;
      resolvedEndDay = Math.min(calendarWeek.endDayIndex, totalDays);
      console.log(`[PROGRAM_UTILS] Using calendar-aligned indices for enrollment ${enrollmentId}, week ${weekNumber}: days ${resolvedStartDay}-${resolvedEndDay}`);
    } else {
      // Fallback to client week's stored indices if week not found in calendar
      console.warn(`[PROGRAM_UTILS] Week ${weekNumber} not found in calendar weeks, using stored indices`);
      resolvedStartDay = clientWeekData.startDayIndex;
      resolvedEndDay = Math.min(clientWeekData.endDayIndex, totalDays);
    }
  } else {
    // No enrollment start date - use stored indices as fallback
    console.warn(`[PROGRAM_UTILS] Enrollment ${enrollmentId} has no start date, using stored indices`);
    resolvedStartDay = clientWeekData.startDayIndex;
    resolvedEndDay = Math.min(clientWeekData.endDayIndex, totalDays);
  }

  if (!resolvedStartDay || !resolvedEndDay) {
    console.error('[PROGRAM_UTILS] Could not resolve day indices for client distribution:', { clientWeekId, enrollmentId, weekNumber, resolvedStartDay, resolvedEndDay });
    return { created: 0, updated: 0, skipped: 0 };
  }

  // DEBUG: Log distribution decision chain
  console.log(`[PROGRAM_UTILS] distributeClientWeeklyTasksToDays called:`, {
    clientWeekId,
    enrollmentId,
    programId,
    weekNumber,
    programTaskDistribution,
    finalDistribution: distribution,
    weeklyTasksCount: weeklyTasks.length,
    resolvedStartDayIndex: resolvedStartDay,
    resolvedEndDayIndex: resolvedEndDay,
    overwriteExisting,
  });

  const daysInWeek = resolvedEndDay - resolvedStartDay + 1;

  // Get existing client days in this range
  const existingDaysSnapshot = await adminDb
    .collection('client_program_days')
    .where('enrollmentId', '==', enrollmentId)
    .where('programId', '==', programId)
    .where('dayIndex', '>=', resolvedStartDay)
    .where('dayIndex', '<=', resolvedEndDay)
    .get();

  const existingDays = new Map(
    existingDaysSnapshot.docs.map(doc => [doc.data().dayIndex as number, { id: doc.id, ...doc.data() }])
  );

  // Debug logging - trace what days were found
  console.log(`[DIST_DEBUG_CLIENT] Query: enrollmentId=${enrollmentId}, programId=${programId}, dayIndex ${resolvedStartDay}-${resolvedEndDay}`);
  console.log(`[DIST_DEBUG_CLIENT] Found ${existingDaysSnapshot.size} existing days`);
  existingDays.forEach((day, dayIndex) => {
    const dayData = day as { tasks?: ProgramTaskTemplate[] };
    const tasks = dayData.tasks || [];
    console.log(`[DIST_DEBUG_CLIENT] Day ${dayIndex}: ${tasks.length} tasks, sources: [${tasks.map(t => t.source || 'undefined').join(', ')}]`);
  });

  const batch = adminDb.batch();
  let created = 0,
    updated = 0,
    skipped = 0;

  console.log(`[PROGRAM_UTILS] Distribution mode: "${distribution}", existing days in range: ${existingDays.size}, days ${resolvedStartDay}-${resolvedEndDay}`);

  if (distribution === 'repeat-daily') {
    // Copy all tasks to each day (with smart merging)
    console.log(`[PROGRAM_UTILS] Using REPEAT-DAILY mode: copying ${weeklyTasks.length} tasks to all ${daysInWeek} days`);
    for (let d = resolvedStartDay; d <= resolvedEndDay; d++) {
      const existing = existingDays.get(d);
      const existingData = existing as { id: string; tasks?: ProgramTaskTemplate[] } | undefined;

      // Get existing tasks and filter out week-sourced ones (they'll be replaced)
      const existingTasks = existingData?.tasks || [];
      const manualTasks = existingTasks.filter(t => t.source !== 'week');
      
      // Build a set of manual task labels for deduplication (case-insensitive)
      const manualTaskLabels = new Set(manualTasks.map(t => t.label?.toLowerCase()));

      // Tag new tasks with source: 'week', but skip if a manual task with same name exists
      const weekSourcedTasks = weeklyTasks
        .filter((task: ProgramTaskTemplate) => !manualTaskLabels.has(task.label?.toLowerCase()))
        .map((task: ProgramTaskTemplate) => ({
          ...task,
          source: 'week' as const,
        }));

      // Merge: manual tasks + new week tasks (deduplicated)
      const mergedTasks = [...manualTasks, ...weekSourcedTasks];

      console.log(`[PROGRAM_UTILS] Client day ${d} merge: kept ${manualTasks.length} manual, adding ${weekSourcedTasks.length} from week (${weeklyTasks.length - weekSourcedTasks.length} duplicates skipped)`);

      const dayRef = existing
        ? adminDb.collection('client_program_days').doc(existingData!.id)
        : adminDb.collection('client_program_days').doc();

      const dayData = {
        enrollmentId,
        programId,
        organizationId,
        userId,
        dayIndex: d,
        tasks: mergedTasks,
        clientWeekId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };

      if (existing) {
        batch.update(dayRef, dayData);
        updated++;
      } else {
        batch.set(dayRef, dayData);
        created++;
      }
    }
  } else {
    // Spread: distribute tasks evenly across days (with smart merging)
    console.log(`[PROGRAM_UTILS] Using SPREAD mode: distributing ${weeklyTasks.length} tasks evenly across ${daysInWeek} days`);
    const spreadDays = calculateSpreadDayIndices(weeklyTasks.length, resolvedStartDay, resolvedEndDay);
    console.log(`[PROGRAM_UTILS] Spread calculation: tasks will go on days ${spreadDays.join(', ')}`);

    // Process ALL days in the week (to clear old week tasks from days that won't get new tasks)
    for (let d = resolvedStartDay; d <= resolvedEndDay; d++) {
      const existing = existingDays.get(d);
      const existingData = existing as { id: string; tasks?: ProgramTaskTemplate[] } | undefined;

      // Get existing tasks and filter out week-sourced ones (they'll be replaced)
      const existingTasks = existingData?.tasks || [];
      const manualTasks = existingTasks.filter(t => t.source !== 'week');
      
      // Build a set of manual task labels for deduplication (case-insensitive)
      const manualTaskLabels = new Set(manualTasks.map(t => t.label?.toLowerCase()));

      // Check if this day should receive a task
      const taskIndexForDay = spreadDays.indexOf(d);
      let weekSourcedTasks: ProgramTaskTemplate[] = [];

      if (taskIndexForDay !== -1 && taskIndexForDay < weeklyTasks.length) {
        const taskToAdd = weeklyTasks[taskIndexForDay];
        // Skip if a manual task with same name exists (deduplication)
        if (!manualTaskLabels.has(taskToAdd.label?.toLowerCase())) {
          weekSourcedTasks = [{
            ...taskToAdd,
            source: 'week' as const,
          }];
        }
      }

      // Merge: manual tasks + new week tasks (may be empty for non-spread days or duplicates)
      const mergedTasks = [...manualTasks, ...weekSourcedTasks];

      // Skip if no change needed (no manual tasks and no new tasks)
      if (mergedTasks.length === 0 && !existing) continue;

      console.log(`[PROGRAM_UTILS] Client day ${d} merge: kept ${manualTasks.length} manual, adding ${weekSourcedTasks.length} from week`);

      const dayRef = existing
        ? adminDb.collection('client_program_days').doc(existingData!.id)
        : adminDb.collection('client_program_days').doc();

      const dayData = {
        enrollmentId,
        programId,
        organizationId,
        userId,
        dayIndex: d,
        tasks: mergedTasks,
        clientWeekId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };

      if (existing) {
        batch.update(dayRef, dayData);
        updated++;
      } else {
        batch.set(dayRef, dayData);
        created++;
      }
    }
  }

  await batch.commit();
  console.log(
    `[PROGRAM_UTILS] Distributed client tasks for enrollment ${enrollmentId}, week ${clientWeekId}: ${created} created, ${updated} updated, ${skipped} skipped`
  );

  return { created, updated, skipped };
}
