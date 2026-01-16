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
  TemplateSyncOptions,
} from '@/types';

type RouteParams = { params: Promise<{ instanceId: string }> };

interface SyncTemplateRequest {
  weekNumbers?: number[];
  syncOptions?: TemplateSyncOptions;
  distributeAfterSync?: boolean;
  overwriteDays?: boolean;
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
 */
function distributeTasksToDays(
  weeklyTasks: ProgramTaskTemplate[],
  days: ProgramInstanceDay[],
  distribution?: string
): ProgramInstanceDay[] {
  if (!weeklyTasks.length || !days.length) return days;

  const distType = distribution || 'spread';
  const updatedDays = days.map(d => ({ ...d, tasks: [...(d.tasks || [])] }));

  if (distType === 'first_day') {
    // All tasks go to first day
    updatedDays[0].tasks = weeklyTasks.map(toInstanceTask);
  } else if (distType === 'all_days') {
    // All tasks go to every day
    for (const day of updatedDays) {
      day.tasks = weeklyTasks.map(toInstanceTask);
    }
  } else {
    // 'spread' - distribute evenly using interval-based positioning
    const numTasks = weeklyTasks.length;
    const numDays = updatedDays.length;

    // Clear all days first
    for (const day of updatedDays) {
      day.tasks = [];
    }

    if (numTasks >= numDays) {
      // More tasks than days: distribute roughly evenly
      let taskIdx = 0;
      for (let d = 0; d < numDays; d++) {
        const count = Math.ceil((numTasks - taskIdx) / (numDays - d));
        for (let j = 0; j < count && taskIdx < numTasks; j++) {
          updatedDays[d].tasks.push(toInstanceTask(weeklyTasks[taskIdx++]));
        }
      }
    } else {
      // Fewer tasks than days: spread using intervals
      const interval = numDays / numTasks;
      for (let i = 0; i < numTasks; i++) {
        const dayOffset = Math.floor(i * interval + interval / 2);
        const targetDay = Math.min(dayOffset, numDays - 1);
        updatedDays[targetDay].tasks.push(toInstanceTask(weeklyTasks[i]));
      }
    }
  }

  return updatedDays;
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

    let weeksUpdated = 0;
    let weeksCreated = 0;
    const updatedWeeks: ProgramInstanceWeek[] = [];

    // Process each template week
    for (const templateWeek of weeksToSync) {
      const existingWeek = instanceWeekMap.get(templateWeek.weekNumber);

      // Build synced week data
      const syncedWeek: ProgramInstanceWeek = {
        id: existingWeek?.id || templateWeek.id || crypto.randomUUID(),
        weekNumber: templateWeek.weekNumber,
        moduleId: templateWeek.moduleId,
        startDayIndex: templateWeek.startDayIndex,
        endDayIndex: templateWeek.endDayIndex,
        // Preserve existing calendar dates
        calendarStartDate: existingWeek?.calendarStartDate,
        calendarEndDate: existingWeek?.calendarEndDate,
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

      // Handle days
      if (overwriteDays || !existingWeek?.days?.length) {
        // Create fresh days from template structure
        // Use stored day indices if available, otherwise calculate from week number
        const daysPerWeekFromProgram = program.includeWeekends !== false ? 7 : 5;
        const weekStartDay = templateWeek.startDayIndex ?? ((templateWeek.weekNumber - 1) * daysPerWeekFromProgram + 1);
        const weekEndDay = templateWeek.endDayIndex ?? (weekStartDay + daysPerWeekFromProgram - 1);
        const numDays = weekEndDay - weekStartDay + 1;
        const days: ProgramInstanceDay[] = [];

        for (let i = 0; i < numDays; i++) {
          days.push({
            dayIndex: i + 1,
            globalDayIndex: weekStartDay + i,
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
          syncedWeek.distribution || 'spread'
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

    // Sort by week number
    finalWeeks.sort((a, b) => a.weekNumber - b.weekNumber);

    // Update the instance
    const now = new Date().toISOString();
    await adminDb.collection('program_instances').doc(instanceId).update({
      weeks: finalWeeks,
      lastSyncedFromTemplate: now,
      updatedAt: now,
    });

    console.log(
      `[INSTANCE_SYNC_TEMPLATE] Synced ${weeksUpdated + weeksCreated} weeks ` +
      `(${weeksCreated} created, ${weeksUpdated} updated) for instance ${instanceId}`
    );

    return NextResponse.json({
      success: true,
      weeksUpdated: weeksUpdated + weeksCreated,
      weeksCreated,
      weeksModified: weeksUpdated,
      message: `Synced ${weeksUpdated + weeksCreated} weeks from template`,
      lastSyncedFromTemplate: now,
      ...(distributeAfterSync && { distributed: true }),
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
