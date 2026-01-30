/**
 * Program Instance Creation Utilities
 *
 * Provides shared logic for creating program_instances documents.
 * Used by:
 * - enrollUser.ts (on enrollment to ensure instance exists before sync)
 * - /api/instances/route.ts (lazy creation on API access)
 */

import { adminDb } from '@/lib/firebase-admin';
import { calculateCalendarWeeks, type CalendarWeek } from '@/lib/calendar-weeks';
import type { ProgramInstanceDay, Program, ProgramCohort } from '@/types';

/**
 * Distributes weeklyTasks to days based on each task's dayTag and the week's distribution setting.
 * This is used during instance creation to pre-populate days with tasks.
 *
 * IMPORTANT: The days array only contains ACTIVE program days (not a full calendar week).
 * For partial weeks (e.g., Tue start), the array has 4 elements for Tue-Fri, not 5 for Mon-Fri.
 * activeStartDay/activeEndDay parameters are now UNUSED - kept for backward compatibility
 * but the entire days array is considered active.
 */
function distributeTasksToDays(
  weeklyTasks: Array<{ id?: string; label: string; dayTag?: 'auto' | 'spread' | 'daily' | number; [key: string]: unknown }>,
  days: ProgramInstanceDay[],
  distribution: string | undefined,
  _activeStartDay?: number,  // DEPRECATED: days array only contains active days
  _activeEndDay?: number     // DEPRECATED: days array only contains active days
): ProgramInstanceDay[] {
  const numDays = days.length;
  if (numDays === 0 || weeklyTasks.length === 0) return days;

  // The entire days array is active (we only create active days now)
  const activeStartIdx = 0;
  const activeEndIdx = numDays - 1;
  const activeRange = numDays;

  // Helper to create a day task from a weekly task template
  const createDayTask = (task: typeof weeklyTasks[0]) => ({
    ...task,
    id: task.id || crypto.randomUUID(),
    source: 'week' as const,
  });

  // Categorize tasks by their dayTag
  const dailyTasks: typeof weeklyTasks = [];
  const spreadTasks: typeof weeklyTasks = [];
  const specificDayTasks: Map<number, typeof weeklyTasks> = new Map();
  const autoTasks: typeof weeklyTasks = [];

  for (const task of weeklyTasks) {
    const dayTag = task.dayTag;
    if (dayTag === 'daily') {
      dailyTasks.push(task);
    } else if (dayTag === 'spread') {
      spreadTasks.push(task);
    } else if (Array.isArray(dayTag)) {
      for (const dayNum of dayTag) {
        if (dayNum >= 1 && dayNum <= numDays) {
          const existing = specificDayTasks.get(dayNum) || [];
          existing.push(task);
          specificDayTasks.set(dayNum, existing);
        }
      }
    } else if (typeof dayTag === 'number' && dayTag >= 1 && dayTag <= numDays) {
      const existing = specificDayTasks.get(dayTag) || [];
      existing.push(task);
      specificDayTasks.set(dayTag, existing);
    } else {
      autoTasks.push(task);
    }
  }

  // Clone days to avoid mutation
  const updatedDays = days.map(d => ({ ...d, tasks: [...(d.tasks || [])] as unknown[] }));

  // Add daily tasks to ACTIVE days only
  for (const task of dailyTasks) {
    for (let dayIdx = activeStartIdx; dayIdx <= activeEndIdx; dayIdx++) {
      updatedDays[dayIdx].tasks.push(createDayTask(task));
    }
  }

  // Add specific-day tasks to their designated day (only if within active range)
  // For partial weeks, dayTag is the absolute day-of-week (1=Mon, 3=Wed, etc.)
  // The days array only contains ACTIVE days, so we offset by the first day's dayIndex
  const actualStartDayOfWeek = days[0]?.dayIndex || 1;
  for (const [dayNum, tasks] of specificDayTasks) {
    // Map absolute day-of-week to array index
    // e.g., for partial week starting Tue (actualStartDayOfWeek=2):
    //   dayNum=2 (Tue) → dayIdx=0, dayNum=3 (Wed) → dayIdx=1
    const dayIdx = dayNum - actualStartDayOfWeek;
    if (dayIdx >= 0 && dayIdx < numDays) {
      for (const task of tasks) {
        updatedDays[dayIdx].tasks.push(createDayTask(task));
      }
    }
  }

  // Spread tasks with dayTag: 'spread' evenly across ACTIVE days
  if (spreadTasks.length > 0 && activeRange > 0) {
    for (let taskIdx = 0; taskIdx < spreadTasks.length; taskIdx++) {
      let targetDayIdx: number;
      if (spreadTasks.length === 1) {
        targetDayIdx = activeStartIdx;
      } else {
        const offset = Math.round(taskIdx * (activeRange - 1) / (spreadTasks.length - 1));
        targetDayIdx = activeStartIdx + offset;
      }
      updatedDays[targetDayIdx].tasks.push(createDayTask(spreadTasks[taskIdx]));
    }
  }

  // Apply program distribution to 'auto' tasks within ACTIVE days
  if (autoTasks.length > 0 && activeRange > 0) {
    const distType = distribution || 'spread';
    if (distType === 'spread') {
      for (let taskIdx = 0; taskIdx < autoTasks.length; taskIdx++) {
        let targetDayIdx: number;
        if (autoTasks.length === 1) {
          targetDayIdx = activeStartIdx;
        } else {
          const offset = Math.round(taskIdx * (activeRange - 1) / (autoTasks.length - 1));
          targetDayIdx = activeStartIdx + offset;
        }
        updatedDays[targetDayIdx].tasks.push(createDayTask(autoTasks[taskIdx]));
      }
    } else if (distType === 'all_days') {
      for (const task of autoTasks) {
        for (let dayIdx = activeStartIdx; dayIdx <= activeEndIdx; dayIdx++) {
          updatedDays[dayIdx].tasks.push(createDayTask(task));
        }
      }
    } else if (distType === 'first_day') {
      for (const task of autoTasks) {
        updatedDays[activeStartIdx].tasks.push(createDayTask(task));
      }
    }
  }

  return updatedDays as ProgramInstanceDay[];
}

interface TemplateWeek {
  id?: string;
  weekNumber: number;
  moduleId?: string;
  name?: string;
  theme?: string;
  description?: string;
  startDayIndex?: number;
  endDayIndex?: number;
  weeklyTasks?: Array<{ id?: string; label: string; dayTag?: 'auto' | 'spread' | 'daily' | number }>;
  weeklyHabits?: unknown[];
  weeklyPrompt?: string;
  distribution?: string;
  currentFocus?: string[];
  notes?: string[];
  manualNotes?: string;
  linkedCallEventIds?: string[];
  linkedCourseIds?: string[];
  linkedArticleIds?: string[];
  linkedDownloadIds?: string[];
  linkedLinkIds?: string[];
  linkedQuestionnaireIds?: string[];
  linkedSummaryIds?: string[];
}

/**
 * Maps calendar weeks to instance weeks with task distribution
 */
function buildInstanceWeeks(
  sortedCalendarWeeks: CalendarWeek[],
  templateWeeks: TemplateWeek[],
  isNewFormat: boolean
) {
  return sortedCalendarWeeks.map((calendarWeek) => {
    let templateWeek: TemplateWeek | undefined;

    if (isNewFormat) {
      templateWeek = templateWeeks.find((w) => w.weekNumber === calendarWeek.weekNumber);
    } else {
      const calendarIndex = sortedCalendarWeeks.indexOf(calendarWeek);
      templateWeek = templateWeeks[calendarIndex];
    }

    const startDayIndex = calendarWeek.startDayIndex;
    const endDayIndex = calendarWeek.endDayIndex;

    // For partial weeks (e.g., Tue start), actualStartDayOfWeek=2
    // calendarWeek.startDate is always Monday, so we offset by (actualStartDayOfWeek - 1)
    const actualStartOffset = (calendarWeek.actualStartDayOfWeek || 1) - 1;

    const getCalendarDateForDay = (programDayIndex: number): string | undefined => {
      if (!calendarWeek.startDate) return undefined;
      const startDate = new Date(calendarWeek.startDate);
      // Offset from Monday by actualStartOffset + programDayIndex
      // e.g., Tue start (offset=1), day 0 → Mon+1=Tue, day 1 → Mon+2=Wed
      startDate.setDate(startDate.getDate() + actualStartOffset + programDayIndex);
      return startDate.toISOString().split('T')[0];
    };

    // Create only ACTIVE program days (not displayDaysCount which is for UI blur)
    // endDayIndex - startDayIndex + 1 = actual program days in this week
    const activeDaysCount = endDayIndex - startDayIndex + 1;
    let days: ProgramInstanceDay[] = [];
    for (let i = 0; i < activeDaysCount; i++) {
      days.push({
        dayIndex: i + 1,  // 1-based program day within this week (1=first active day)
        globalDayIndex: startDayIndex + i,
        calendarDate: getCalendarDateForDay(i),
        tasks: [],
        habits: [],
      });
    }

    const weeklyTasks = (templateWeek?.weeklyTasks || []).map((t) => ({
      ...t,
      id: t.id || crypto.randomUUID(),
    }));

    if (weeklyTasks.length > 0) {
      days = distributeTasksToDays(
        weeklyTasks,
        days,
        templateWeek?.distribution,
        calendarWeek.actualStartDayOfWeek,
        calendarWeek.actualEndDayOfWeek
      );
    }

    return {
      id: templateWeek?.id || crypto.randomUUID(),
      weekNumber: calendarWeek.weekNumber,
      templateWeekNumber: templateWeek?.weekNumber,
      moduleId: templateWeek?.moduleId,
      name: templateWeek?.name,
      theme: templateWeek?.theme,
      description: templateWeek?.description,
      weeklyTasks,
      weeklyHabits: templateWeek?.weeklyHabits || [],
      weeklyPrompt: templateWeek?.weeklyPrompt,
      distribution: templateWeek?.distribution,
      startDayIndex,
      endDayIndex,
      calendarStartDate: calendarWeek.startDate,
      calendarEndDate: calendarWeek.endDate,
      actualStartDayOfWeek: calendarWeek.actualStartDayOfWeek,
      actualEndDayOfWeek: calendarWeek.actualEndDayOfWeek,
      displayDaysCount: calendarWeek.displayDaysCount,
      days,
      currentFocus: templateWeek?.currentFocus,
      notes: templateWeek?.notes,
      manualNotes: templateWeek?.manualNotes,
      linkedCallEventIds: templateWeek?.linkedCallEventIds,
      linkedCourseIds: templateWeek?.linkedCourseIds,
      linkedArticleIds: templateWeek?.linkedArticleIds,
      linkedDownloadIds: templateWeek?.linkedDownloadIds,
      linkedLinkIds: templateWeek?.linkedLinkIds,
      linkedQuestionnaireIds: templateWeek?.linkedQuestionnaireIds,
      linkedSummaryIds: templateWeek?.linkedSummaryIds,
    };
  });
}

/**
 * Ensures a cohort instance exists for a group program.
 * Creates the instance if it doesn't exist.
 *
 * @returns Instance ID if created or already exists, null if creation failed
 */
export async function ensureCohortInstanceExists(
  programId: string,
  cohortId: string,
  organizationId: string
): Promise<string | null> {
  // Check if instance already exists
  const existingInstance = await adminDb.collection('program_instances')
    .where('programId', '==', programId)
    .where('cohortId', '==', cohortId)
    .limit(1)
    .get();

  if (!existingInstance.empty) {
    console.log(`[PROGRAM_INSTANCES] Cohort instance already exists: ${existingInstance.docs[0].id}`);
    return existingInstance.docs[0].id;
  }

  console.log(`[PROGRAM_INSTANCES] Creating cohort instance for cohortId: ${cohortId}`);

  // Fetch program and cohort
  const [programDoc, cohortDoc] = await Promise.all([
    adminDb.collection('programs').doc(programId).get(),
    adminDb.collection('program_cohorts').doc(cohortId).get(),
  ]);

  if (!programDoc.exists || !cohortDoc.exists) {
    console.error(`[PROGRAM_INSTANCES] Program or cohort not found: programId=${programId}, cohortId=${cohortId}`);
    return null;
  }

  const programData = programDoc.data() as Program;
  const cohortData = cohortDoc.data() as ProgramCohort;

  // Verify ownership
  if (programData.organizationId !== organizationId) {
    console.error(`[PROGRAM_INSTANCES] Organization mismatch: expected ${organizationId}, got ${programData.organizationId}`);
    return null;
  }

  const includeWeekends = programData.includeWeekends !== false;
  const totalDays = programData.lengthDays || 28;

  // Calculate calendar weeks from cohort start date
  if (!cohortData.startDate) {
    console.error(`[PROGRAM_INSTANCES] Cohort ${cohortId} has no startDate`);
    return null;
  }

  const calendarWeeks = calculateCalendarWeeks(cohortData.startDate, totalDays, includeWeekends);
  const sortedCalendarWeeks = [...calendarWeeks].sort((a, b) => a.startDayIndex - b.startDayIndex);

  // Get template weeks from program
  let templateWeeks: TemplateWeek[] = [];
  let isNewFormat = false;

  if (programData.weeks && Array.isArray(programData.weeks) && programData.weeks.length > 0) {
    templateWeeks = programData.weeks as TemplateWeek[];
    isNewFormat = templateWeeks.some((w) => w.weekNumber === 0);
    console.log(`[PROGRAM_INSTANCES] Using embedded weeks (${templateWeeks.length} weeks), format: ${isNewFormat ? 'NEW' : 'OLD'}`);
  } else {
    // Fallback to program_weeks collection
    const weeksSnapshot = await adminDb.collection('program_weeks')
      .where('programId', '==', programId)
      .orderBy('weekNumber', 'asc')
      .get();

    templateWeeks = weeksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TemplateWeek));
    isNewFormat = templateWeeks.some((w) => w.weekNumber === 0);
    console.log(`[PROGRAM_INSTANCES] Using program_weeks collection (${templateWeeks.length} weeks), format: ${isNewFormat ? 'NEW' : 'OLD'}`);
  }

  const weeks = buildInstanceWeeks(sortedCalendarWeeks, templateWeeks, isNewFormat);

  // Create the instance
  const instanceData = {
    programId,
    organizationId,
    type: 'cohort' as const,
    cohortId,
    startDate: cohortData.startDate,
    endDate: cohortData.endDate,
    includeWeekends,
    dailyFocusSlots: programData.dailyFocusSlots || 3,
    weeks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const newInstanceRef = await adminDb.collection('program_instances').add(instanceData);
  console.log(`[PROGRAM_INSTANCES] Created cohort instance: ${newInstanceRef.id}`);

  return newInstanceRef.id;
}

/**
 * Ensures an individual enrollment instance exists.
 * Creates the instance if it doesn't exist.
 *
 * @returns Instance ID if created or already exists, null if creation failed
 */
export async function ensureEnrollmentInstanceExists(
  programId: string,
  enrollmentId: string,
  organizationId: string
): Promise<string | null> {
  // Check if instance already exists
  const existingInstance = await adminDb.collection('program_instances')
    .where('programId', '==', programId)
    .where('enrollmentId', '==', enrollmentId)
    .limit(1)
    .get();

  if (!existingInstance.empty) {
    console.log(`[PROGRAM_INSTANCES] Enrollment instance already exists: ${existingInstance.docs[0].id}`);
    return existingInstance.docs[0].id;
  }

  console.log(`[PROGRAM_INSTANCES] Creating enrollment instance for enrollmentId: ${enrollmentId}`);

  // Fetch program and enrollment
  const [programDoc, enrollmentDoc] = await Promise.all([
    adminDb.collection('programs').doc(programId).get(),
    adminDb.collection('program_enrollments').doc(enrollmentId).get(),
  ]);

  if (!programDoc.exists || !enrollmentDoc.exists) {
    console.error(`[PROGRAM_INSTANCES] Program or enrollment not found: programId=${programId}, enrollmentId=${enrollmentId}`);
    return null;
  }

  const programData = programDoc.data() as Program;
  const enrollmentData = enrollmentDoc.data();

  // Verify ownership
  if (programData.organizationId !== organizationId) {
    console.error(`[PROGRAM_INSTANCES] Organization mismatch: expected ${organizationId}, got ${programData.organizationId}`);
    return null;
  }

  const includeWeekends = programData.includeWeekends !== false;
  const totalDays = programData.lengthDays || 28;

  // Get effective start date
  const effectiveStartDate = enrollmentData?.startDate || enrollmentData?.startedAt || new Date().toISOString().split('T')[0];

  const calendarWeeks = calculateCalendarWeeks(effectiveStartDate, totalDays, includeWeekends);
  const sortedCalendarWeeks = [...calendarWeeks].sort((a, b) => a.startDayIndex - b.startDayIndex);

  // Get template weeks from program
  let templateWeeks: TemplateWeek[] = [];
  let isNewFormat = false;

  if (programData.weeks && Array.isArray(programData.weeks) && programData.weeks.length > 0) {
    templateWeeks = programData.weeks as TemplateWeek[];
    isNewFormat = templateWeeks.some((w) => w.weekNumber === 0);
    console.log(`[PROGRAM_INSTANCES] Using embedded weeks (${templateWeeks.length} weeks), format: ${isNewFormat ? 'NEW' : 'OLD'}`);
  } else {
    // Fallback to program_weeks collection
    const weeksSnapshot = await adminDb.collection('program_weeks')
      .where('programId', '==', programId)
      .orderBy('weekNumber', 'asc')
      .get();

    templateWeeks = weeksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TemplateWeek));
    isNewFormat = templateWeeks.some((w) => w.weekNumber === 0);
    console.log(`[PROGRAM_INSTANCES] Using program_weeks collection (${templateWeeks.length} weeks), format: ${isNewFormat ? 'NEW' : 'OLD'}`);
  }

  const weeks = buildInstanceWeeks(sortedCalendarWeeks, templateWeeks, isNewFormat);

  // Create the instance
  const instanceData = {
    programId,
    organizationId,
    type: 'individual' as const,
    enrollmentId,
    userId: enrollmentData?.userId,
    startDate: effectiveStartDate,
    endDate: enrollmentData?.endDate,
    includeWeekends,
    dailyFocusSlots: programData.dailyFocusSlots || 3,
    weeks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const newInstanceRef = await adminDb.collection('program_instances').add(instanceData);
  console.log(`[PROGRAM_INSTANCES] Created enrollment instance: ${newInstanceRef.id}`);

  return newInstanceRef.id;
}

/**
 * Update an instance week with proper distribution and user task sync.
 * This is the programmatic equivalent of the PATCH /api/instances/[instanceId]/weeks/[weekNum] endpoint.
 *
 * Use this when you need to update week content from server-side code and ensure
 * tasks are properly distributed to days and synced to users' tasks collection.
 */
export async function updateInstanceWeekWithSync(
  instanceId: string,
  weekNumber: number,
  updates: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    weeklyTasks?: Array<{ id?: string; label: string; type?: string; isPrimary?: boolean; dayTag?: string | number; [key: string]: any }>;
    theme?: string;
    description?: string;
    currentFocus?: string[];
    notes?: string[];
    distribution?: string;
    distributeTasksNow?: boolean;
  },
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the instance
    const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
    if (!instanceDoc.exists) {
      return { success: false, error: 'Instance not found' };
    }

    const data = instanceDoc.data();
    if (data?.organizationId !== organizationId) {
      return { success: false, error: 'Instance not found in organization' };
    }

    const weeks = data?.weeks || [];
    const weekIndex = weeks.findIndex((w: { weekNumber: number }) => w.weekNumber === weekNumber);
    if (weekIndex === -1) {
      return { success: false, error: 'Week not found' };
    }

    // Build updated week
    const existingWeek = weeks[weekIndex];
    const updatedWeek = {
      ...existingWeek,
      hasLocalChanges: true,
    };

    // Apply updates
    if (updates.theme !== undefined) updatedWeek.theme = updates.theme;
    if (updates.description !== undefined) updatedWeek.description = updates.description;
    if (updates.currentFocus !== undefined) updatedWeek.currentFocus = updates.currentFocus;
    if (updates.notes !== undefined) updatedWeek.notes = updates.notes;
    if (updates.weeklyTasks !== undefined) {
      // Process tasks to ensure IDs
      updatedWeek.weeklyTasks = updates.weeklyTasks.map(t => ({
        ...t,
        id: t.id || crypto.randomUUID(),
      }));
    }

    // Get distribution setting
    const distribution = updates.distribution || updatedWeek.distribution || 'spread';

    // If distributeTasksNow is true, distribute weekly tasks to days
    if (updates.distributeTasksNow && updatedWeek.weeklyTasks?.length > 0) {
      const days = updatedWeek.days || [];
      const numDays = days.length;

      if (numDays > 0) {
        // Clear old week-sourced tasks
        for (const day of days) {
          day.tasks = (day.tasks || []).filter((t: { source?: string }) => t.source !== 'week');
        }

        // Distribute tasks using the same logic as the API endpoint
        const weeklyTasks = updatedWeek.weeklyTasks;

        // Categorize by dayTag
        const dailyTasks: typeof weeklyTasks = [];
        const autoTasks: typeof weeklyTasks = [];

        for (const task of weeklyTasks) {
          if (task.dayTag === 'daily') {
            dailyTasks.push(task);
          } else {
            autoTasks.push(task);
          }
        }

        // Daily tasks go to all days
        for (const task of dailyTasks) {
          for (const day of days) {
            day.tasks = [...(day.tasks || []), { ...task, source: 'week' }];
          }
        }

        // Auto/spread tasks distributed evenly
        if (autoTasks.length > 0) {
          if (distribution === 'spread') {
            for (let taskIdx = 0; taskIdx < autoTasks.length; taskIdx++) {
              const targetDayIdx = autoTasks.length === 1
                ? 0
                : Math.round(taskIdx * (numDays - 1) / (autoTasks.length - 1));
              days[targetDayIdx].tasks = [...(days[targetDayIdx].tasks || []), { ...autoTasks[taskIdx], source: 'week' }];
            }
          } else if (distribution === 'repeat-daily' || distribution === 'all_days') {
            for (const task of autoTasks) {
              for (const day of days) {
                day.tasks = [...(day.tasks || []), { ...task, source: 'week' }];
              }
            }
          } else {
            // Default: first day
            for (const task of autoTasks) {
              days[0].tasks = [...(days[0].tasks || []), { ...task, source: 'week' }];
            }
          }
        }

        updatedWeek.days = days;
      }
    }

    // Save to Firestore
    const updatedWeeks = [...weeks];
    updatedWeeks[weekIndex] = updatedWeek;

    await adminDb.collection('program_instances').doc(instanceId).update({
      weeks: updatedWeeks,
      updatedAt: new Date().toISOString(),
    });

    // Sync to users' tasks collection for individual instances
    if (updates.distributeTasksNow && data?.type === 'individual' && data?.userId) {
      const batch = adminDb.batch();
      const now = new Date().toISOString();
      let tasksCreated = 0;

      for (const day of updatedWeek.days || []) {
        if (!day.calendarDate || typeof day.globalDayIndex !== 'number') continue;

        // Get existing tasks for this instance + day
        const existingTasksQuery = await adminDb.collection('tasks')
          .where('userId', '==', data.userId)
          .where('instanceId', '==', instanceId)
          .where('dayIndex', '==', day.globalDayIndex)
          .get();

        const existingTaskIds = new Set(existingTasksQuery.docs.map(doc => doc.data().instanceTaskId));

        // Create new tasks that don't already exist
        for (const task of day.tasks || []) {
          if (existingTaskIds.has(task.id)) continue;

          const taskRef = adminDb.collection('tasks').doc();
          batch.set(taskRef, {
            userId: data.userId,
            organizationId: data.organizationId,
            instanceId,
            instanceTaskId: task.id,
            label: task.label,
            title: task.label,
            originalTitle: task.label,
            isPrimary: task.isPrimary || false,
            type: task.type || 'task',
            sourceType: 'program',
            listType: task.isPrimary ? 'focus' : 'backlog',
            dayIndex: day.globalDayIndex,
            programDayIndex: day.globalDayIndex,
            programEnrollmentId: data.enrollmentId,
            programId: data.programId,
            date: day.calendarDate,
            status: 'pending',
            order: tasksCreated,
            isPrivate: false,
            completed: false,
            completedAt: null,
            createdAt: now,
            updatedAt: now,
          });
          tasksCreated++;
        }
      }

      if (tasksCreated > 0) {
        await batch.commit();
        console.log(`[PROGRAM_INSTANCES] Created ${tasksCreated} tasks for user ${data.userId}`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[PROGRAM_INSTANCES] updateInstanceWeekWithSync error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
