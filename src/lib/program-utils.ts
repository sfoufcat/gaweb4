/**
 * Program Utility Functions
 *
 * Shared utilities for program management including week day index calculations
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { TaskDistribution } from '@/types';

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

  // Get all modules sorted by order
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

  // Group weeks by module and sort by order within each module
  const weeksByModule = new Map<string, WeekData[]>();

  // Initialize map with empty arrays for each module
  modules.forEach(m => weeksByModule.set(m.id, []));

  // Add weeks to their modules (or first module if unassigned)
  allWeeks.forEach(week => {
    if (week.moduleId && weeksByModule.has(week.moduleId)) {
      weeksByModule.get(week.moduleId)!.push(week);
    } else if (modules.length > 0) {
      // Assign to first module if no moduleId
      weeksByModule.get(modules[0].id)!.push(week);
    }
  });

  // Sort weeks within each module by order
  weeksByModule.forEach(moduleWeeks => {
    moduleWeeks.sort((a, b) => a.order - b.order);
  });

  // Build ordered list of all weeks (following module order)
  const orderedWeeks: WeekData[] = [];
  modules.forEach(module => {
    const moduleWeeks = weeksByModule.get(module.id) || [];
    orderedWeeks.push(...moduleWeeks);
  });

  // Recalculate day indices
  const batch = adminDb.batch();
  let currentDay = 1;
  let globalWeekNumber = 1;

  for (const week of orderedWeeks) {
    const startDay = currentDay;
    const endDay = Math.min(startDay + daysPerWeek - 1, totalDays);

    batch.update(adminDb.collection('program_weeks').doc(week.id), {
      startDayIndex: startDay,
      endDayIndex: endDay,
      weekNumber: globalWeekNumber,
      updatedAt: FieldValue.serverTimestamp(),
    });

    currentDay = endDay + 1;
    globalWeekNumber++;

    // Don't exceed total days
    if (currentDay > totalDays) break;
  }

  // Update module day ranges to match their weeks
  for (const module of modules) {
    const moduleWeeks = weeksByModule.get(module.id) || [];
    if (moduleWeeks.length > 0) {
      // Find the updated bounds for this module's weeks
      const moduleWeekIndices = moduleWeeks.map(w => orderedWeeks.indexOf(w)).filter(i => i >= 0);
      if (moduleWeekIndices.length > 0) {
        const firstWeekIdx = Math.min(...moduleWeekIndices);
        const lastWeekIdx = Math.max(...moduleWeekIndices);

        // Calculate the day range based on position
        const firstWeekStartDay = firstWeekIdx * daysPerWeek + 1;
        const lastWeekEndDay = Math.min((lastWeekIdx + 1) * daysPerWeek, totalDays);

        batch.update(adminDb.collection('program_modules').doc(module.id), {
          startDayIndex: firstWeekStartDay,
          endDayIndex: lastWeekEndDay,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  }

  await batch.commit();
  console.log(`[PROGRAM_UTILS] Recalculated day indices for ${orderedWeeks.length} weeks in program ${programId}`);
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
        distribution: 'repeat-daily',
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
      distribution: 'repeat-daily',
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
  if (weeklyTasks.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Use week setting, fall back to program setting, then default to 'spread'
  const distribution = weekData.distribution || programTaskDistribution || 'spread';
  const startDay = weekData.startDayIndex;
  const endDay = weekData.endDayIndex;
  const daysInWeek = endDay - startDay + 1;

  // Get existing days in this range
  const existingDaysSnapshot = await adminDb
    .collection('program_days')
    .where('programId', '==', programId)
    .where('dayIndex', '>=', startDay)
    .where('dayIndex', '<=', endDay)
    .get();

  const existingDays = new Map(
    existingDaysSnapshot.docs.map(doc => [doc.data().dayIndex as number, { id: doc.id, ...doc.data() }])
  );

  const batch = adminDb.batch();
  let created = 0,
    updated = 0,
    skipped = 0;

  if (distribution === 'repeat-daily') {
    // Copy all tasks to each day
    for (let d = startDay; d <= endDay; d++) {
      const existing = existingDays.get(d);

      if (existing && !overwriteExisting && (existing as { tasks?: unknown[] }).tasks?.length) {
        skipped++;
        continue;
      }

      const dayRef = existing
        ? adminDb.collection('program_days').doc((existing as { id: string }).id)
        : adminDb.collection('program_days').doc();

      const dayData = {
        programId,
        dayIndex: d,
        tasks: weeklyTasks,
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
    // Spread: distribute tasks across days
    const tasksPerDay = Math.ceil(weeklyTasks.length / daysInWeek);
    let taskIndex = 0;

    for (let d = startDay; d <= endDay && taskIndex < weeklyTasks.length; d++) {
      const dayTasks = weeklyTasks.slice(taskIndex, taskIndex + tasksPerDay);
      taskIndex += tasksPerDay;

      if (dayTasks.length === 0) continue;

      const existing = existingDays.get(d);

      if (existing && !overwriteExisting && (existing as { tasks?: unknown[] }).tasks?.length) {
        skipped++;
        continue;
      }

      const dayRef = existing
        ? adminDb.collection('program_days').doc((existing as { id: string }).id)
        : adminDb.collection('program_days').doc();

      const dayData = {
        programId,
        dayIndex: d,
        tasks: dayTasks,
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
  
  if (weeklyTasks.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Use cohort week setting, fall back to program setting, then default to 'spread'
  const distribution = cohortWeekContent.distribution || programTaskDistribution || 'spread';
  const startDay = weekData.startDayIndex;
  const endDay = weekData.endDayIndex;
  const daysInWeek = endDay - startDay + 1;

  // Get existing cohort days in this range
  const existingDaysSnapshot = await adminDb
    .collection('cohort_program_days')
    .where('cohortId', '==', cohortId)
    .where('programId', '==', programId)
    .where('dayIndex', '>=', startDay)
    .where('dayIndex', '<=', endDay)
    .get();

  const existingDays = new Map(
    existingDaysSnapshot.docs.map(doc => [doc.data().dayIndex as number, { id: doc.id, ...doc.data() }])
  );

  // Get program's organizationId for new documents
  const programDoc = await adminDb.collection('programs').doc(programId).get();
  const organizationId = programDoc.data()?.organizationId || '';

  const batch = adminDb.batch();
  let created = 0,
    updated = 0,
    skipped = 0;

  if (distribution === 'repeat-daily') {
    // Copy all tasks to each day
    for (let d = startDay; d <= endDay; d++) {
      const existing = existingDays.get(d);

      if (existing && !overwriteExisting && (existing as { tasks?: unknown[] }).tasks?.length) {
        skipped++;
        continue;
      }

      const dayRef = existing
        ? adminDb.collection('cohort_program_days').doc((existing as { id: string }).id)
        : adminDb.collection('cohort_program_days').doc();

      const dayData = {
        cohortId,
        programId,
        organizationId,
        dayIndex: d,
        tasks: weeklyTasks,
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
    // Spread: distribute tasks across days
    const tasksPerDay = Math.ceil(weeklyTasks.length / daysInWeek);
    let taskIndex = 0;

    for (let d = startDay; d <= endDay && taskIndex < weeklyTasks.length; d++) {
      const dayTasks = weeklyTasks.slice(taskIndex, taskIndex + tasksPerDay);
      taskIndex += tasksPerDay;

      if (dayTasks.length === 0) continue;

      const existing = existingDays.get(d);

      if (existing && !overwriteExisting && (existing as { tasks?: unknown[] }).tasks?.length) {
        skipped++;
        continue;
      }

      const dayRef = existing
        ? adminDb.collection('cohort_program_days').doc((existing as { id: string }).id)
        : adminDb.collection('cohort_program_days').doc();

      const dayData = {
        cohortId,
        programId,
        organizationId,
        dayIndex: d,
        tasks: dayTasks,
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
