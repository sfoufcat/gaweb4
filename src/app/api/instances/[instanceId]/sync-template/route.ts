/**
 * Program Instance: Sync from Template
 *
 * POST /api/instances/[instanceId]/sync-template
 *
 * Syncs template week content from the program to the instance.
 * This updates the instance with the latest template content while
 * preserving cohort/client-specific customizations.
 *
 * Body parameters:
 * - weekNumbers?: number[] - Optional: sync specific weeks only (omit for all)
 * - syncOptions?: TemplateSyncOptions - What fields to sync
 * - distributeAfterSync?: boolean - Whether to distribute weekly tasks to days
 * - overwriteDays?: boolean - Whether to overwrite day content (default: false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type {
  ProgramInstance,
  ProgramInstanceWeek,
  ProgramInstanceDay,
  ProgramTaskTemplate,
  ProgramInstanceTask,
  ProgramInstanceModule,
  ProgramModule,
  ProgramHabitTemplate,
  TemplateSyncOptions,
  ProgramEnrollment,
} from '@/types';
import { syncInstanceStructure } from '@/lib/program-utils';
import { dayIndexToDate, calculateCalendarWeeks } from '@/lib/calendar-weeks';

/**
 * Cleans up orphaned tasks from other instances for the same enrollment context.
 * Called before syncing tasks to ensure no duplicate tasks from old instances.
 */
async function cleanupOrphanedTasks(
  currentInstanceId: string,
  userId: string,
  cohortId?: string
): Promise<number> {
  let deleted = 0;

  // Query all program tasks for this user that have an instanceId
  const tasksQuery = await adminDb.collection('tasks')
    .where('userId', '==', userId)
    .where('sourceType', '==', 'program')
    .get();

  // Find tasks from OTHER instances
  const batch = adminDb.batch();
  for (const doc of tasksQuery.docs) {
    const data = doc.data();
    // Skip tasks from the current instance
    if (data.instanceId === currentInstanceId) continue;

    // Delete tasks from other instances
    // This handles orphaned tasks from old/deleted instances
    if (data.instanceId) {
      batch.delete(doc.ref);
      deleted++;
    }
  }

  if (deleted > 0) {
    await batch.commit();
    console.log(`[INSTANCE_SYNC_TEMPLATE] Cleaned up ${deleted} orphaned tasks from other instances for user ${userId}`);
  }

  return deleted;
}

type RouteParams = { params: Promise<{ instanceId: string }> };

interface SyncTemplateRequest {
  weekNumbers?: number[];
  syncOptions?: TemplateSyncOptions;
  distributeAfterSync?: boolean;
  overwriteDays?: boolean;
  // Structure sync options (when includeWeekends/lengthDays changed)
  overwriteStructure?: boolean;
  includeWeekends?: boolean;
  lengthDays?: number;
  // Module sync options
  syncModules?: boolean;           // Default true - sync modules from template
  moduleIds?: string[];            // Optional: sync specific modules only
}

/**
 * Ensure each task has a unique ID
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => ({
    ...task,
    id: task.id || crypto.randomUUID(),
  }));
}

/**
 * Convert task template to instance task with guaranteed ID
 */
function toInstanceTask(task: ProgramTaskTemplate): ProgramInstanceDay['tasks'][0] {
  return {
    id: task.id || crypto.randomUUID(),
    label: task.label,
    type: task.type,
    isPrimary: task.isPrimary,
    estimatedMinutes: task.estimatedMinutes,
    notes: task.notes,
    tag: task.tag,
    source: task.source,
  };
}

/**
 * Distribute weekly tasks to days based on distribution setting
 *
 * IMPORTANT: The days array only contains ACTIVE program days (not a full calendar week).
 * For partial weeks (e.g., Tue start), the array has 4 elements for Tue-Fri, not 5 for Mon-Fri.
 * activeStartDay/activeEndDay parameters are now UNUSED - kept for backward compatibility
 * but the entire days array is considered active.
 *
 * @param weeklyTasks - Tasks to distribute
 * @param days - Days to distribute tasks into (only active days, not full week)
 * @param distribution - Distribution setting ('spread', 'all_days', 'first_day')
 * @param _activeStartDay - DEPRECATED: days array only contains active days
 * @param _activeEndDay - DEPRECATED: days array only contains active days
 */
function distributeTasksToDays(
  weeklyTasks: ProgramTaskTemplate[],
  days: ProgramInstanceDay[],
  distribution?: string,
  _activeStartDay?: number,  // DEPRECATED
  _activeEndDay?: number     // DEPRECATED
): ProgramInstanceDay[] {
  const numDays = days.length;
  if (numDays === 0 || weeklyTasks.length === 0) return days;

  // The entire days array is active (we only create active days now)
  const activeStartIdx = 0;
  const activeEndIdx = numDays - 1;
  const activeRange = numDays;

  // Clone days and clear tasks for re-distribution
  const updatedDays = days.map(d => ({ ...d, tasks: [] as ProgramInstanceDay['tasks'] }));

  const distType = distribution || 'spread';

  if (distType === 'first_day') {
    // All tasks go to first ACTIVE day
    for (const task of weeklyTasks) {
      updatedDays[activeStartIdx].tasks.push(toInstanceTask(task));
    }
  } else if (distType === 'all_days') {
    // All tasks go to every ACTIVE day
    for (const task of weeklyTasks) {
      for (let dayIdx = activeStartIdx; dayIdx <= activeEndIdx; dayIdx++) {
        updatedDays[dayIdx].tasks.push(toInstanceTask(task));
      }
    }
  } else {
    // 'spread' - distribute evenly across ACTIVE days
    const numTasks = weeklyTasks.length;

    if (numTasks === 0 || activeRange === 0) return updatedDays;

    if (numTasks >= activeRange) {
      // More tasks than active days: distribute roughly evenly
      let taskIdx = 0;
      for (let d = activeStartIdx; d <= activeEndIdx; d++) {
        const remainingDays = activeEndIdx - d + 1;
        const remainingTasks = numTasks - taskIdx;
        const count = Math.ceil(remainingTasks / remainingDays);
        for (let j = 0; j < count && taskIdx < numTasks; j++) {
          updatedDays[d].tasks.push(toInstanceTask(weeklyTasks[taskIdx++]));
        }
      }
    } else {
      // Fewer tasks than active days: spread using intervals within active range
      for (let i = 0; i < numTasks; i++) {
        let targetDayIdx: number;
        if (numTasks === 1) {
          targetDayIdx = activeStartIdx;
        } else {
          const offset = Math.round(i * (activeRange - 1) / (numTasks - 1));
          targetDayIdx = activeStartIdx + offset;
        }
        updatedDays[targetDayIdx].tasks.push(toInstanceTask(weeklyTasks[i]));
      }
    }
  }

  return updatedDays;
}

/**
 * Get enrollments for a program instance
 * - For cohort instances: query by cohortId
 * - For individual instances: query by enrollmentId
 */
async function getEnrollmentsForInstance(instance: ProgramInstance): Promise<ProgramEnrollment[]> {
  console.log(`[INSTANCE_SYNC_TEMPLATE] getEnrollmentsForInstance: type=${instance.type}, cohortId=${instance.cohortId}, enrollmentId=${instance.enrollmentId}`);

  // Use same status filter as Week Save route: active, upcoming, or completed
  // (not 'cancelled' or 'paused')
  let query = adminDb.collection('program_enrollments')
    .where('status', 'in', ['active', 'upcoming', 'completed']);

  if (instance.type === 'cohort' && instance.cohortId) {
    query = query.where('cohortId', '==', instance.cohortId);
  } else if (instance.type === 'individual' && instance.enrollmentId) {
    query = query.where('__name__', '==', instance.enrollmentId);
  } else {
    console.log(`[INSTANCE_SYNC_TEMPLATE] getEnrollmentsForInstance: no cohortId or enrollmentId, returning []`);
    return [];
  }

  const snapshot = await query.get();
  console.log(`[INSTANCE_SYNC_TEMPLATE] getEnrollmentsForInstance: found ${snapshot.docs.length} enrollments`);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProgramEnrollment));
}

/**
 * Sync day tasks to user's tasks collection using the instance-based system.
 * Creates, updates, and DELETES tasks to match the instance.
 * (Full sync - removes tasks no longer in instance, unlike cron which only adds)
 */
async function syncInstanceDayTasksToUser(
  instanceId: string,
  userId: string,
  dayIndex: number,
  tasks: ProgramInstanceTask[],
  calendarDate: string,
  organizationId: string | undefined
): Promise<number> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();
  let created = 0, updated = 0, deleted = 0;

  // Get org's focus limit setting
  let focusLimit = 3; // Default
  if (organizationId) {
    try {
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      const orgSettings = orgSettingsDoc.data();
      focusLimit = orgSettings?.defaultDailyFocusSlots ?? 3;
    } catch {
      // Fallback to 3 if org settings can't be fetched
    }
  }

  // Get existing tasks for this instance + day + user
  const existingTasksQuery = await adminDb.collection('tasks')
    .where('userId', '==', userId)
    .where('instanceId', '==', instanceId)
    .where('dayIndex', '==', dayIndex)
    .get();

  const existingTasksByInstanceTaskId = new Map<string, { id: string; listType?: string }>();
  for (const doc of existingTasksQuery.docs) {
    const data = doc.data();
    if (data.instanceTaskId) {
      existingTasksByInstanceTaskId.set(data.instanceTaskId, {
        id: doc.id,
        listType: data.listType,
      });
    }
  }

  // Count how many focus tasks the user already has for this date (excluding this instance's tasks)
  let existingFocusCount = 0;
  if (calendarDate) {
    const focusTasksQuery = await adminDb.collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', calendarDate)
      .where('listType', '==', 'focus')
      .get();
    // Count focus tasks that are NOT from this instance (to avoid double counting)
    existingFocusCount = focusTasksQuery.docs.filter(doc => doc.data().instanceId !== instanceId).length;
  }

  let availableFocusSlots = focusLimit - existingFocusCount;
  const processedInstanceTaskIds = new Set<string>();

  // Separate primary and non-primary tasks
  const primaryTasks = tasks.filter(t => t.isPrimary);
  const nonPrimaryTasks = tasks.filter(t => !t.isPrimary);

  // Process primary tasks first (try to put in Focus)
  for (const task of primaryTasks) {
    processedInstanceTaskIds.add(task.id);
    const existing = existingTasksByInstanceTaskId.get(task.id);

    if (existing) {
      // Update existing task - preserve listType if already set
      const taskRef = adminDb.collection('tasks').doc(existing.id);
      batch.update(taskRef, {
        label: task.label,
        title: task.label,
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes || null,
        notes: task.notes || null,
        tag: task.tag || null,
        date: calendarDate,
        updatedAt: now,
      });
      updated++;
    } else {
      // Create new task
      const listType = availableFocusSlots > 0 ? 'focus' : 'backlog';
      if (listType === 'focus') {
        availableFocusSlots--;
      }

      const taskRef = adminDb.collection('tasks').doc();
      batch.set(taskRef, {
        userId,
        instanceId,
        instanceTaskId: task.id,
        label: task.label,
        title: task.label,
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes || null,
        notes: task.notes || null,
        tag: task.tag || null,
        source: 'program',
        sourceType: 'program',
        listType,
        status: 'pending',
        order: created,
        isPrivate: false,
        dayIndex,
        date: calendarDate,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        ...(organizationId && { organizationId }),
      });
      created++;
    }
  }

  // Process non-primary tasks (always go to backlog for new tasks)
  for (const task of nonPrimaryTasks) {
    processedInstanceTaskIds.add(task.id);
    const existing = existingTasksByInstanceTaskId.get(task.id);

    if (existing) {
      // Update existing task - preserve listType
      const taskRef = adminDb.collection('tasks').doc(existing.id);
      batch.update(taskRef, {
        label: task.label,
        title: task.label,
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes || null,
        notes: task.notes || null,
        tag: task.tag || null,
        date: calendarDate,
        updatedAt: now,
      });
      updated++;
    } else {
      // Create new task
      const taskRef = adminDb.collection('tasks').doc();
      batch.set(taskRef, {
        userId,
        instanceId,
        instanceTaskId: task.id,
        label: task.label,
        title: task.label,
        isPrimary: task.isPrimary,
        type: task.type || 'task',
        estimatedMinutes: task.estimatedMinutes || null,
        notes: task.notes || null,
        tag: task.tag || null,
        source: 'program',
        sourceType: 'program',
        listType: 'backlog',
        status: 'pending',
        order: created,
        isPrivate: false,
        dayIndex,
        date: calendarDate,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        ...(organizationId && { organizationId }),
      });
      created++;
    }
  }

  // Delete tasks that are no longer in the instance (template removed them)
  for (const [instanceTaskId, existing] of existingTasksByInstanceTaskId.entries()) {
    if (!processedInstanceTaskIds.has(instanceTaskId)) {
      const taskRef = adminDb.collection('tasks').doc(existing.id);
      batch.delete(taskRef);
      deleted++;
    }
  }

  await batch.commit();
  console.log(`[INSTANCE_SYNC_TEMPLATE] syncInstanceDayTasksToUser: ${created} created, ${updated} updated, ${deleted} deleted for user ${userId} day ${dayIndex}`);

  return created;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId } = await params;
    const body: SyncTemplateRequest = await request.json();

    const {
      weekNumbers,
      syncOptions = {},
      distributeAfterSync = false,
      overwriteDays = false,
      overwriteStructure = false,
      includeWeekends,
      lengthDays,
      syncModules = true,
      moduleIds,
    } = body;

    // Fetch the instance
    const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
    if (!instanceDoc.exists) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const instance = { id: instanceDoc.id, ...instanceDoc.data() } as ProgramInstance;

    // Verify ownership
    if (instance.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Handle structure sync (when includeWeekends or lengthDays changed)
    if (overwriteStructure && includeWeekends !== undefined && lengthDays !== undefined) {
      try {
        const result = await syncInstanceStructure(instanceId, instance.programId, {
          includeWeekends,
          lengthDays,
        });
        return NextResponse.json({
          success: true,
          structureSynced: true,
          weeksUpdated: result.weeksUpdated,
          weeksAdded: result.weeksAdded,
          weeksRemoved: result.weeksRemoved,
        });
      } catch (structureError) {
        console.error('[SYNC_TEMPLATE] Structure sync error:', structureError);
        return NextResponse.json({ error: 'Failed to sync instance structure' }, { status: 500 });
      }
    }

    // Fetch the template program
    const programDoc = await adminDb.collection('programs').doc(instance.programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program template not found' }, { status: 404 });
    }

    const program = programDoc.data()!;
    const templateWeeks: Array<{
      id?: string;
      weekNumber: number;
      moduleId?: string;
      name?: string;
      theme?: string;
      description?: string;
      weeklyPrompt?: string;
      weeklyTasks?: ProgramTaskTemplate[];
      weeklyHabits?: unknown[];
      currentFocus?: string[];
      notes?: string[];
      distribution?: string;
      startDayIndex?: number;
      endDayIndex?: number;
      // Resource assignments
      resourceAssignments?: Array<{
        id: string;
        resourceType: 'course' | 'article' | 'download' | 'link' | 'questionnaire' | 'video';
        resourceId: string;
        dayTag: 'week' | 'daily' | 'spread' | number | number[];
        title?: string;
        order?: number;
        lessonDayMapping?: Record<string, number>;
      }>;
      linkedArticleIds?: string[];
      linkedDownloadIds?: string[];
      linkedLinkIds?: string[];
      linkedCourseIds?: string[];
      linkedQuestionnaireIds?: string[];
    }> = program.weeks || [];

    if (!templateWeeks.length) {
      // Try falling back to program_weeks collection
      const weeksSnapshot = await adminDb.collection('program_weeks')
        .where('programId', '==', instance.programId)
        .orderBy('weekNumber', 'asc')
        .get();

      if (weeksSnapshot.empty) {
        return NextResponse.json({
          success: true,
          weeksUpdated: 0,
          message: 'No template weeks to sync',
        });
      }

      for (const doc of weeksSnapshot.docs) {
        const data = doc.data();
        templateWeeks.push({
          id: doc.id,
          weekNumber: data.weekNumber,
          moduleId: data.moduleId,
          name: data.name,
          theme: data.theme,
          description: data.description,
          weeklyPrompt: data.weeklyPrompt,
          weeklyTasks: data.weeklyTasks,
          weeklyHabits: data.weeklyHabits,
          currentFocus: data.currentFocus,
          notes: data.notes,
          distribution: data.distribution,
          startDayIndex: data.startDayIndex,
          endDayIndex: data.endDayIndex,
        });
      }
    }

    // Filter by weekNumbers if provided
    const weeksToSync = weekNumbers?.length
      ? templateWeeks.filter(w => weekNumbers.includes(w.weekNumber))
      : templateWeeks;

    // Create a map of instance weeks by weekNumber for quick lookup
    const instanceWeekMap = new Map<number, ProgramInstanceWeek>();
    for (const week of instance.weeks || []) {
      instanceWeekMap.set(week.weekNumber, week);
    }

    // Calculate calendar weeks from instance start date for correct day indices
    // This handles partial onboarding weeks (e.g., Tuesday start = 4 active days, not 5)
    const programIncludeWeekends = program.includeWeekends !== false;
    const programTotalDays = program.lengthDays || 30;
    const calendarWeeks = instance.startDate
      ? calculateCalendarWeeks(instance.startDate, programTotalDays, programIncludeWeekends)
      : [];
    const calendarByWeekNumber = new Map(calendarWeeks.map(cw => [cw.weekNumber, cw]));

    let weeksUpdated = 0;
    let weeksCreated = 0;
    const updatedWeeks: ProgramInstanceWeek[] = [];

    // Process each template week
    for (const templateWeek of weeksToSync) {
      const existingWeek = instanceWeekMap.get(templateWeek.weekNumber);

      // Get calculated calendar week for correct day indices
      // This handles partial onboarding (e.g., Tuesday start = 4 active days)
      const calendarWeek = calendarByWeekNumber.get(templateWeek.weekNumber);

      // Build synced week data
      // Priority for startDayIndex/endDayIndex: calculated calendar > template > fallback
      const syncedWeek: ProgramInstanceWeek = {
        id: existingWeek?.id || templateWeek.id || crypto.randomUUID(),
        weekNumber: templateWeek.weekNumber,
        moduleId: templateWeek.moduleId,
        startDayIndex: calendarWeek?.startDayIndex ?? templateWeek.startDayIndex,
        endDayIndex: calendarWeek?.endDayIndex ?? templateWeek.endDayIndex,
        // Use calculated calendar dates, fallback to existing
        calendarStartDate: calendarWeek?.startDate ?? existingWeek?.calendarStartDate,
        calendarEndDate: calendarWeek?.endDate ?? existingWeek?.calendarEndDate,
        // Use calculated partial week indicators for task distribution
        actualStartDayOfWeek: calendarWeek?.actualStartDayOfWeek ?? existingWeek?.actualStartDayOfWeek,
        actualEndDayOfWeek: calendarWeek?.actualEndDayOfWeek ?? existingWeek?.actualEndDayOfWeek,
        displayDaysCount: calendarWeek?.displayDaysCount ?? existingWeek?.displayDaysCount,
        // Initialize with existing or empty
        weeklyTasks: existingWeek?.weeklyTasks || [],
        days: existingWeek?.days || [],
        updatedAt: new Date().toISOString(),
      };

      // Sync content based on options (default to true for all)
      if (syncOptions.syncName !== false) {
        syncedWeek.name = templateWeek.name;
        syncedWeek.description = templateWeek.description;
      } else if (existingWeek) {
        syncedWeek.name = existingWeek.name;
        syncedWeek.description = existingWeek.description;
      }

      if (syncOptions.syncTheme !== false) {
        syncedWeek.theme = templateWeek.theme;
      } else if (existingWeek) {
        syncedWeek.theme = existingWeek.theme;
      }

      if (syncOptions.syncTasks !== false) {
        syncedWeek.weeklyTasks = processTasksWithIds(templateWeek.weeklyTasks);
      } else if (existingWeek) {
        syncedWeek.weeklyTasks = existingWeek.weeklyTasks;
      }

      if (syncOptions.syncPrompt !== false) {
        syncedWeek.weeklyPrompt = templateWeek.weeklyPrompt;
      } else if (existingWeek) {
        syncedWeek.weeklyPrompt = existingWeek.weeklyPrompt;
      }

      if (syncOptions.syncHabits !== false) {
        syncedWeek.weeklyHabits = templateWeek.weeklyHabits as ProgramInstanceWeek['weeklyHabits'];
      } else if (existingWeek) {
        syncedWeek.weeklyHabits = existingWeek.weeklyHabits;
      }

      if (syncOptions.syncFocus !== false) {
        syncedWeek.currentFocus = templateWeek.currentFocus;
      } else if (existingWeek) {
        syncedWeek.currentFocus = existingWeek.currentFocus;
      }

      if (syncOptions.syncNotes !== false) {
        syncedWeek.notes = templateWeek.notes;
      } else if (existingWeek) {
        syncedWeek.notes = existingWeek.notes;
      }

      // Sync resourceAssignments (courses, articles, downloads, links, questionnaires, videos)
      if (syncOptions.syncResources !== false) {
        syncedWeek.resourceAssignments = templateWeek.resourceAssignments || [];
        syncedWeek.linkedArticleIds = templateWeek.linkedArticleIds || [];
        syncedWeek.linkedDownloadIds = templateWeek.linkedDownloadIds || [];
        syncedWeek.linkedLinkIds = templateWeek.linkedLinkIds || [];
        syncedWeek.linkedCourseIds = templateWeek.linkedCourseIds || [];
        syncedWeek.linkedQuestionnaireIds = templateWeek.linkedQuestionnaireIds || [];
      } else if (existingWeek) {
        syncedWeek.resourceAssignments = existingWeek.resourceAssignments;
        syncedWeek.linkedArticleIds = existingWeek.linkedArticleIds;
        syncedWeek.linkedDownloadIds = existingWeek.linkedDownloadIds;
        syncedWeek.linkedLinkIds = existingWeek.linkedLinkIds;
        syncedWeek.linkedCourseIds = existingWeek.linkedCourseIds;
        syncedWeek.linkedQuestionnaireIds = existingWeek.linkedQuestionnaireIds;
      }

      // Always preserve cohort/client-specific content unless explicitly overwritten
      if (syncOptions.preserveRecordings !== false && existingWeek) {
        syncedWeek.coachRecordingUrl = existingWeek.coachRecordingUrl;
        syncedWeek.coachRecordingNotes = existingWeek.coachRecordingNotes;
      }

      if (syncOptions.preserveClientLinks !== false && existingWeek) {
        syncedWeek.linkedSummaryIds = existingWeek.linkedSummaryIds;
        syncedWeek.linkedCallEventIds = existingWeek.linkedCallEventIds;
      }

      if (syncOptions.preserveManualNotes !== false && existingWeek) {
        syncedWeek.manualNotes = existingWeek.manualNotes;
      }

      // Preserve distribution setting if exists, otherwise use template
      syncedWeek.distribution = existingWeek?.distribution || templateWeek.distribution as ProgramInstanceWeek['distribution'];

      // Handle days - regenerate if:
      // 1. overwriteDays is true, OR
      // 2. No existing days, OR
      // 3. Calculated boundaries differ from existing days (data corruption fix)
      const existingDayIndices = existingWeek?.days?.map(d => d.globalDayIndex) || [];
      const existingStartDay = existingDayIndices.length > 0 ? Math.min(...existingDayIndices) : 0;
      const existingEndDay = existingDayIndices.length > 0 ? Math.max(...existingDayIndices) : 0;
      const boundariesMismatch = calendarWeek && (
        existingStartDay !== calendarWeek.startDayIndex ||
        existingEndDay !== calendarWeek.endDayIndex
      );
      const needsDayRegeneration = overwriteDays || !existingWeek?.days?.length || boundariesMismatch;

      if (needsDayRegeneration) {
        // Create fresh days from template structure
        // Priority: calculated calendar (accurate) > template stored > fallback calculation
        // The calendarWeek values account for partial weeks (e.g., Tuesday start = 4 active days)
        const daysPerWeekFromProgram = program.includeWeekends !== false ? 7 : 5;
        let weekStartDay: number;
        let weekEndDay: number;

        if (calendarWeek) {
          // Best: use calculated calendar values (handles partial weeks correctly)
          weekStartDay = calendarWeek.startDayIndex;
          weekEndDay = calendarWeek.endDayIndex;
        } else if (templateWeek.startDayIndex !== undefined && templateWeek.endDayIndex !== undefined) {
          // Fallback: use template stored indices
          weekStartDay = templateWeek.startDayIndex;
          weekEndDay = templateWeek.endDayIndex;
        } else if (templateWeek.weekNumber === 0) {
          // Legacy fallback: Onboarding - days 1 to daysPerWeek
          weekStartDay = 1;
          weekEndDay = Math.min(daysPerWeekFromProgram, programTotalDays);
        } else if (templateWeek.weekNumber === -1) {
          // Legacy fallback: Closing - last daysPerWeek days
          weekStartDay = Math.max(1, programTotalDays - daysPerWeekFromProgram + 1);
          weekEndDay = programTotalDays;
        } else {
          // Legacy fallback: Regular weeks - sequential after onboarding
          weekStartDay = daysPerWeekFromProgram + (templateWeek.weekNumber - 1) * daysPerWeekFromProgram + 1;
          weekEndDay = Math.min(weekStartDay + daysPerWeekFromProgram - 1, programTotalDays - daysPerWeekFromProgram);
        }
        const numDays = weekEndDay - weekStartDay + 1;
        const days: ProgramInstanceDay[] = [];

        // Calculate calendar dates for each day
        // For partial weeks (e.g., Tue start), actualStartDayOfWeek=2 means we offset from Monday
        const actualStartDayOfWeek = calendarWeek?.actualStartDayOfWeek || 1;
        const actualStartOffset = actualStartDayOfWeek - 1; // 0 for Mon, 1 for Tue, etc.

        // Get the week's calendar start date (Monday of this week)
        const weekCalendarStartDate = calendarWeek?.startDate || syncedWeek.calendarStartDate;

        for (let i = 0; i < numDays; i++) {
          // Calculate calendar date for this day
          let calendarDate: string | undefined;
          if (weekCalendarStartDate) {
            const baseDate = new Date(weekCalendarStartDate);
            // Offset from Monday by actualStartOffset + i
            // e.g., Tue start (offset=1), i=0 → Mon+1=Tue, i=1 → Mon+2=Wed
            baseDate.setDate(baseDate.getDate() + actualStartOffset + i);
            calendarDate = baseDate.toISOString().split('T')[0];
          }

          days.push({
            dayIndex: i + 1,
            globalDayIndex: weekStartDay + i,
            calendarDate,
            tasks: [],
            habits: [],
          });
        }
        syncedWeek.days = days;
      } else {
        // Preserve existing days
        syncedWeek.days = existingWeek.days;
      }

      // Optionally distribute tasks to days
      if (distributeAfterSync && syncedWeek.weeklyTasks?.length) {
        syncedWeek.days = distributeTasksToDays(
          syncedWeek.weeklyTasks,
          syncedWeek.days,
          syncedWeek.distribution || 'spread',
          syncedWeek.actualStartDayOfWeek,
          syncedWeek.actualEndDayOfWeek
        );
      }

      updatedWeeks.push(syncedWeek);

      if (existingWeek) {
        weeksUpdated++;
      } else {
        weeksCreated++;
      }
    }

    // Merge updated weeks with existing weeks that weren't synced
    const finalWeeks: ProgramInstanceWeek[] = [];
    const syncedWeekNumbers = new Set(updatedWeeks.map(w => w.weekNumber));

    // Add all synced weeks
    for (const week of updatedWeeks) {
      finalWeeks.push(week);
    }

    // Add existing weeks that weren't in the sync scope
    for (const week of instance.weeks || []) {
      if (!syncedWeekNumbers.has(week.weekNumber)) {
        finalWeeks.push(week);
      }
    }

    // Sort by week number: 0 (onboarding) first, then 1, 2, 3..., then -1 (closing) last
    finalWeeks.sort((a, b) => {
      if (a.weekNumber === -1) return 1;
      if (b.weekNumber === -1) return -1;
      return a.weekNumber - b.weekNumber;
    });

    // ========================================
    // MODULE SYNC
    // ========================================
    let modulesUpdated = 0;
    let modulesCreated = 0;
    let finalModules: ProgramInstanceModule[] = instance.modules || [];

    if (syncModules) {
      // Fetch template modules from program_modules collection
      const templateModulesSnap = await adminDb
        .collection('program_modules')
        .where('programId', '==', instance.programId)
        .orderBy('order', 'asc')
        .get();

      const templateModules = templateModulesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ProgramModule[];

      // Filter by moduleIds if provided
      const modulesToSync = moduleIds?.length
        ? templateModules.filter(m => moduleIds.includes(m.id))
        : templateModules;

      // Build a map of existing instance modules by templateModuleId
      const existingByTemplateId = new Map<string, ProgramInstanceModule>(
        (instance.modules || []).map(m => [m.templateModuleId, m])
      );

      const syncedModules: ProgramInstanceModule[] = [];
      const syncedTemplateIds = new Set<string>();

      for (const template of modulesToSync) {
        const existing = existingByTemplateId.get(template.id);
        syncedTemplateIds.add(template.id);

        if (existing) {
          // Update existing module
          // If hasLocalChanges, preserve customizations; otherwise sync from template
          const updatedModule: ProgramInstanceModule = {
            ...existing,
            // Always sync structural fields
            order: template.order,
            startDayIndex: template.startDayIndex,
            endDayIndex: template.endDayIndex,
            linkedCourseIds: template.linkedCourseIds,
            // Only sync content if NOT customized locally
            ...(existing.hasLocalChanges ? {} : {
              name: template.name,
              description: template.description,
              habits: template.habits || [],
            }),
            lastSyncedFromTemplate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          syncedModules.push(updatedModule);
          modulesUpdated++;
        } else {
          // Create new instance module from template
          const newModule: ProgramInstanceModule = {
            id: crypto.randomUUID(),
            templateModuleId: template.id,
            order: template.order,
            name: template.name,
            description: template.description,
            habits: template.habits || [],
            startDayIndex: template.startDayIndex,
            endDayIndex: template.endDayIndex,
            linkedCourseIds: template.linkedCourseIds,
            hasLocalChanges: false,
            lastSyncedFromTemplate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          syncedModules.push(newModule);
          modulesCreated++;
        }
      }

      // Add existing modules that weren't in the sync scope (if moduleIds was specified)
      if (moduleIds?.length) {
        for (const [templateId, existingModule] of existingByTemplateId) {
          if (!syncedTemplateIds.has(templateId)) {
            syncedModules.push(existingModule);
          }
        }
      }

      // Sort by order
      syncedModules.sort((a, b) => a.order - b.order);
      finalModules = syncedModules;

      console.log(
        `[INSTANCE_SYNC_TEMPLATE] Synced ${modulesUpdated + modulesCreated} modules ` +
        `(${modulesCreated} created, ${modulesUpdated} updated) for instance ${instanceId}`
      );
    }

    // Update the instance
    const now = new Date().toISOString();
    await adminDb.collection('program_instances').doc(instanceId).update({
      weeks: finalWeeks,
      modules: finalModules,
      lastSyncedFromTemplate: now,
      updatedAt: now,
    });

    console.log(
      `[INSTANCE_SYNC_TEMPLATE] Synced ${weeksUpdated + weeksCreated} weeks ` +
      `(${weeksCreated} created, ${weeksUpdated} updated) for instance ${instanceId}`
    );

    // Sync distributed tasks to user's tasks collection
    let userTasksSynced = 0;
    console.log(`[INSTANCE_SYNC_TEMPLATE] DEBUG: distributeAfterSync=${distributeAfterSync}, instance.startDate=${instance.startDate}`);
    console.log(`[INSTANCE_SYNC_TEMPLATE] DEBUG: updatedWeeks=${updatedWeeks.length}, first week days=${updatedWeeks[0]?.days?.length}, tasks on first active day=${updatedWeeks[0]?.days?.find(d => d.tasks?.length)?.tasks?.length || 0}`);

    if (distributeAfterSync) {
      try {
        const enrollments = await getEnrollmentsForInstance(instance);
        console.log(`[INSTANCE_SYNC_TEMPLATE] Syncing tasks for ${enrollments.length} enrolled users`);

        // Clean up orphaned tasks from other instances before syncing
        let totalOrphansDeleted = 0;
        for (const enrollment of enrollments) {
          const orphansDeleted = await cleanupOrphanedTasks(
            instanceId,
            enrollment.userId,
            instance.cohortId
          );
          totalOrphansDeleted += orphansDeleted;
        }
        if (totalOrphansDeleted > 0) {
          console.log(`[INSTANCE_SYNC_TEMPLATE] Total orphaned tasks cleaned up: ${totalOrphansDeleted}`);
        }

        for (const enrollment of enrollments) {
          for (const week of updatedWeeks) {
            for (const day of week.days || []) {
              // Calculate calendarDate if missing (same fallback as Week Save)
              let effectiveCalendarDate = day.calendarDate;
              if (!effectiveCalendarDate && instance.startDate && typeof day.globalDayIndex === 'number') {
                const includeWeekends = instance.includeWeekends !== false;
                const calculatedDate = dayIndexToDate(instance.startDate, day.globalDayIndex, includeWeekends);
                effectiveCalendarDate = calculatedDate.toISOString().split('T')[0];
                console.log(`[INSTANCE_SYNC_TEMPLATE] Calculated calendarDate for day ${day.globalDayIndex}: ${effectiveCalendarDate}`);
              }

              if (effectiveCalendarDate && day.tasks?.length > 0) {
                const created = await syncInstanceDayTasksToUser(
                  instanceId,
                  enrollment.userId,
                  day.globalDayIndex,
                  day.tasks as ProgramInstanceTask[],
                  effectiveCalendarDate,
                  instance.organizationId
                );
                userTasksSynced += created;
              }
            }
          }
        }

        console.log(`[INSTANCE_SYNC_TEMPLATE] Created ${userTasksSynced} user tasks`);
      } catch (syncError) {
        // Don't fail the whole operation if user task sync fails
        console.error('[INSTANCE_SYNC_TEMPLATE] User task sync error:', syncError);
      }
    }

    return NextResponse.json({
      success: true,
      weeksUpdated: weeksUpdated + weeksCreated,
      weeksCreated,
      weeksModified: weeksUpdated,
      modulesUpdated: modulesUpdated + modulesCreated,
      modulesCreated,
      modulesModified: modulesUpdated,
      message: `Synced ${weeksUpdated + weeksCreated} weeks and ${modulesUpdated + modulesCreated} modules from template`,
      lastSyncedFromTemplate: now,
      ...(distributeAfterSync && { distributed: true, userTasksSynced }),
    });
  } catch (error) {
    console.error('[INSTANCE_SYNC_TEMPLATE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to sync template to instance' }, { status: 500 });
  }
}
