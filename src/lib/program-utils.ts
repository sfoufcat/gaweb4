/**
 * Program Utility Functions
 *
 * Shared utilities for program management including week day index calculations
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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
