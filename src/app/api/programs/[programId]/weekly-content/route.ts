import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { getTodayInTimezone } from '@/lib/timezone';
import type { ProgramWeek, ProgramTaskTemplate, ProgramHabitTemplate, UnifiedEvent, CallSummary, DiscoverArticle, ProgramInstanceDay, WeekResourceAssignment } from '@/types';
import type { DiscoverCourse } from '@/types/discover';

/**
 * Helper to format a date as YYYY-MM-DD in a specific timezone
 * Uses Intl.DateTimeFormat to get timezone-aware date string
 */
function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Helper to convert task template to instance task
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
    source: 'week' as const,
  };
}

/**
 * Re-distributes tasks for a partial week using the correct active range.
 * Used for migrating stale instances where tasks were distributed before the fix.
 *
 * IMPORTANT: The `days` array contains ONLY active days (e.g., 4 days for Tue-Fri).
 * The activeStartDay/activeEndDay parameters are calendar metadata for UI rendering,
 * NOT for array indexing. Distribution always uses the full array (indices 0 to length-1).
 */
function redistributeTasksForPartialWeek(
  weeklyTasks: ProgramTaskTemplate[],
  days: ProgramInstanceDay[],
  distribution: string | undefined,
  _activeStartDay: number,  // UNUSED - kept for API compatibility
  _activeEndDay: number     // UNUSED - kept for API compatibility
): ProgramInstanceDay[] {
  const numDays = days.length;
  if (numDays === 0 || weeklyTasks.length === 0) return days;

  // The days array only contains ACTIVE days - always use full array range
  const activeStartIdx = 0;
  const activeEndIdx = numDays - 1;
  const activeRange = numDays;

  // Clone days and clear tasks for re-distribution
  const updatedDays = days.map(d => ({ ...d, tasks: [] as ProgramInstanceDay['tasks'] }));

  const distType = distribution || 'spread';

  if (distType === 'first_day') {
    for (const task of weeklyTasks) {
      updatedDays[activeStartIdx].tasks.push(toInstanceTask(task));
    }
  } else if (distType === 'all_days') {
    for (const task of weeklyTasks) {
      for (let dayIdx = activeStartIdx; dayIdx <= activeEndIdx; dayIdx++) {
        updatedDays[dayIdx].tasks.push(toInstanceTask(task));
      }
    }
  } else {
    // 'spread' - use same formula as distributeTasksToDays for consistency
    // Formula: offset = round(i * (activeRange - 1) / (numTasks - 1))
    // This maps tasks 0..N-1 to days 0..R-1, allowing multiple tasks per day
    const numTasks = weeklyTasks.length;
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

  return updatedDays;
}

/**
 * Weekly content response for client program view
 */
export interface WeeklyContentResponse {
  success: boolean;
  week: {
    weekNumber: number;
    name?: string;
    theme?: string;
    description?: string;
    weeklyPrompt?: string;
    currentFocus?: string[];  // Weekly outcomes
    notes?: string[];         // Coach notes (reminder items)
    manualNotes?: string;     // Coach manual notes
    startDayIndex: number;
    endDayIndex: number;
    calendarStartDate?: string;
    calendarEndDate?: string;
    // Partial week info (for blurring inactive days)
    actualStartDayOfWeek?: number;  // 1-5 for Mon-Fri (1 = full week, >1 = partial start)
    actualEndDayOfWeek?: number;    // 1-5 for Mon-Fri (5 = full week, <5 = partial end)
    // Resource assignments with cadence and lesson mapping
    resourceAssignments?: WeekResourceAssignment[];
  } | null;
  days: Array<{
    dayIndex: number;          // Calendar position (1=Mon, 2=Tue, etc.) for partial week detection
    programDayIndex?: number | null;  // For resource assignment lookups (matches dayTag)
    globalDayIndex: number;
    calendarDate?: string;
    dayName: string;           // "Monday", "Tuesday", etc.
    isToday: boolean;
    isPast: boolean;
    tasks: ProgramTaskTemplate[];
    habits?: ProgramHabitTemplate[];
    // Linked content
    linkedEventIds?: string[];
    linkedArticleIds?: string[];
    linkedDownloadIds?: string[];
    linkedLinkIds?: string[];
    linkedQuestionnaireIds?: string[];
    linkedCourseIds?: string[];
    linkedSummaryIds?: string[];
  }>;
  // Resource assignments (top-level for easy access by client components)
  resourceAssignments: WeekResourceAssignment[];
  // Resolved resources for the week
  events: UnifiedEvent[];
  courses: DiscoverCourse[];
  articles: DiscoverArticle[];
  downloads: Array<{ id: string; title: string; fileUrl: string; fileType?: string; }>;
  links: Array<{ id: string; title: string; url: string; description?: string; }>;
  questionnaires: Array<{ id: string; title: string; slug?: string; }>;
  videos: Array<{ id: string; title: string; thumbnailUrl?: string; }>;
  summaries: CallSummary[];
}

/**
 * GET /api/programs/[programId]/weekly-content
 *
 * Get weekly content for the client program view.
 * Returns current week's theme, description, prompt, days with tasks/resources, and outcomes.
 *
 * Query params:
 * - weekNumber (optional): Specific week to fetch. Defaults to current week based on enrollment progress.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;
    const { searchParams } = new URL(request.url);
    const requestedWeekNumber = searchParams.get('weekNumber');

    // Demo mode response
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoResponse(getDemoWeeklyContent());
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();

    // Fetch user timezone for consistent date calculations
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userTimezone = userDoc.exists ? (userDoc.data()?.timezone || 'UTC') : 'UTC';

    // Verify enrollment
    const enrollmentSnapshot = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (enrollmentSnapshot.empty) {
      return NextResponse.json({ error: 'Not enrolled in this program' }, { status: 403 });
    }

    const enrollment = enrollmentSnapshot.docs[0].data();
    const enrollmentId = enrollmentSnapshot.docs[0].id;

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data()!;

    // Verify org
    if (organizationId && program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Get program configuration
    const includeWeekends = program.includeWeekends !== false;
    const daysPerWeek = includeWeekends ? 7 : 5;

    // Calculate current day and week using user's timezone
    // Parse startedAt as date-only to avoid timezone conversion issues
    const startDateStr = enrollment.startedAt.split('T')[0]; // "2024-01-27"
    const startDate = new Date(startDateStr + 'T12:00:00'); // Noon avoids DST edge cases
    const todayStr = getTodayInTimezone(userTimezone);
    const today = new Date(todayStr + 'T12:00:00'); // Use noon to avoid DST edge cases
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Calculate current day index (accounting for weekday-only programs)
    let currentDayIndex: number;
    if (includeWeekends) {
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      currentDayIndex = Math.max(1, daysSinceStart + 1);
    } else {
      // Count only weekdays for 5-day programs
      let weekdays = 0;
      const d = new Date(startDate);
      while (d <= today) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) weekdays++;
        d.setDate(d.getDate() + 1);
      }
      currentDayIndex = Math.max(1, weekdays);
    }

    // Try to get instance-based data first (new system)
    // First try individual instance for this enrollment
    let instanceSnapshot = await adminDb
      .collection('program_instances')
      .where('programId', '==', programId)
      .where('enrollmentId', '==', enrollmentId)
      .where('type', '==', 'individual')
      .limit(1)
      .get();

    // If no individual instance found and enrollment has a cohortId, try cohort instance
    if (instanceSnapshot.empty && enrollment.cohortId) {
      console.log(`[WEEKLY_CONTENT] No individual instance, trying cohort instance for cohortId: ${enrollment.cohortId}`);
      instanceSnapshot = await adminDb
        .collection('program_instances')
        .where('programId', '==', programId)
        .where('cohortId', '==', enrollment.cohortId)
        .where('type', '==', 'cohort')
        .limit(1)
        .get();
    }

    let weekData: WeeklyContentResponse['week'] = null;
    let daysData: WeeklyContentResponse['days'] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Track week-level resources (collected while processing weeks)
    let weekLinkedCallEventIds: string[] = [];
    let weekLinkedArticleIds: string[] = [];
    let weekLinkedDownloadIds: string[] = [];
    let weekLinkedLinkIds: string[] = [];
    let weekLinkedCourseIds: string[] = [];
    let weekLinkedSummaryIds: string[] = [];
    let weekLinkedQuestionnaireIds: string[] = [];
    let weekResourceAssignments: WeekResourceAssignment[] = [];

    if (!instanceSnapshot.empty) {
      // Use instance data (new system)
      const instanceDoc = instanceSnapshot.docs[0];
      const instance = instanceDoc.data();
      const weeks = instance.weeks || [];

      // Fetch task completions from tasks collection for this user/instance
      // This provides the completion status to merge with instance tasks
      const taskCompletionsSnapshot = await adminDb.collection('tasks')
        .where('userId', '==', userId)
        .where('instanceId', '==', instanceDoc.id)
        .get();

      // Build a map of instanceTaskId -> completion data
      const completionMap = new Map<string, { completed: boolean; completedAt?: string }>();
      for (const doc of taskCompletionsSnapshot.docs) {
        const data = doc.data();
        if (data.instanceTaskId) {
          completionMap.set(data.instanceTaskId, {
            completed: data.completed === true || data.status === 'completed',
            completedAt: data.completedAt,
          });
        }
      }

      // Find current week
      let targetWeek = weeks.find((w: { weekNumber: number; startDayIndex?: number; endDayIndex?: number }) => {
        if (requestedWeekNumber) {
          return w.weekNumber === parseInt(requestedWeekNumber);
        }
        return currentDayIndex >= (w.startDayIndex || 1) && currentDayIndex <= (w.endDayIndex || 999);
      });

      // Fallback to first week if not found
      if (!targetWeek && weeks.length > 0) {
        targetWeek = requestedWeekNumber
          ? weeks.find((w: { weekNumber: number }) => w.weekNumber === parseInt(requestedWeekNumber))
          : weeks[0];
      }

      if (targetWeek) {
        // MIGRATION: Check for stale task distribution patterns
        let migratedDays: ProgramInstanceDay[] = targetWeek.days || [];
        let needsPersist = false;

        if (targetWeek.weeklyTasks?.length && migratedDays.length) {
          // Count total tasks distributed across days
          const totalDistributedTasks = migratedDays.reduce((sum, d) => sum + (d.tasks?.length || 0), 0);
          const hasDistributedTasks = totalDistributedTasks > 0;

          // MIGRATION CHECK: For partial weeks with spread distribution, check if first day has no tasks
          // This is a symptom of the old bug that used actualStartDayOfWeek as array index offset
          const isSpreadDistribution = !targetWeek.distribution || targetWeek.distribution === 'spread';
          const firstDayHasNoTasks = migratedDays[0]?.tasks?.length === 0;
          const numTasks = targetWeek.weeklyTasks.length;
          const numDays = migratedDays.length;

          // With spread distribution of N tasks across M days where N >= M, every day should have at least 1 task
          // If first day has 0 tasks but we have enough tasks to fill all days, it's a buggy distribution
          const shouldHaveTasksOnFirstDay = isSpreadDistribution && numTasks >= numDays && numDays > 1;
          const needsRedistribution = hasDistributedTasks && shouldHaveTasksOnFirstDay && firstDayHasNoTasks;

          if (needsRedistribution) {
            console.log(`[WEEKLY_CONTENT] MIGRATION: Detected buggy distribution - first day has no tasks`);
            console.log(`[WEEKLY_CONTENT] numTasks=${numTasks}, numDays=${numDays}, distribution=${targetWeek.distribution || 'spread'}`);

            // Re-distribute tasks correctly
            migratedDays = redistributeTasksForPartialWeek(
              targetWeek.weeklyTasks,
              migratedDays,
              targetWeek.distribution,
              targetWeek.actualStartDayOfWeek || 1,
              targetWeek.actualEndDayOfWeek || daysPerWeek
            );
            needsPersist = true;
          }
        }

        // SYNC: For cohort enrollments, ALWAYS use cohort instance resources (they're the source of truth)
        // For non-cohort enrollments, use individual instance resources or sync from template
        weekResourceAssignments = targetWeek.resourceAssignments || [];

        // If enrollment is in a cohort, check cohort instance for latest resources
        if (enrollment.cohortId) {
          const cohortInstanceSnap = await adminDb
            .collection('program_instances')
            .where('programId', '==', programId)
            .where('cohortId', '==', enrollment.cohortId)
            .where('type', '==', 'cohort')
            .limit(1)
            .get();

          if (!cohortInstanceSnap.empty) {
            const cohortInstance = cohortInstanceSnap.docs[0].data();
            const cohortWeeks = cohortInstance.weeks || [];
            const cohortWeek = cohortWeeks.find((cw: { weekNumber: number; resourceAssignments?: WeekResourceAssignment[] }) =>
              cw.weekNumber === targetWeek.weekNumber
            );
            if (cohortWeek?.resourceAssignments?.length) {
              // Cohort has resources - use them (even if individual instance has different ones)
              const cohortResourcesJson = JSON.stringify(cohortWeek.resourceAssignments);
              const individualResourcesJson = JSON.stringify(weekResourceAssignments);
              if (cohortResourcesJson !== individualResourcesJson) {
                console.log(`[WEEKLY_CONTENT] SYNC: Using cohort instance resourceAssignments for week ${targetWeek.weekNumber}`);
                weekResourceAssignments = cohortWeek.resourceAssignments;
                targetWeek.resourceAssignments = cohortWeek.resourceAssignments;
                needsPersist = true;
              }
            }
          }
        }

        // If still empty (no cohort or cohort has no resources), try template
        if (weekResourceAssignments.length === 0) {
          const templateWeeks = program.weeks || [];
          const templateWeek = templateWeeks.find((tw: ProgramWeek) => tw.weekNumber === targetWeek.weekNumber);
          if (templateWeek?.resourceAssignments?.length) {
            console.log(`[WEEKLY_CONTENT] SYNC: Copying resourceAssignments from template to instance week ${targetWeek.weekNumber}`);
            weekResourceAssignments = templateWeek.resourceAssignments;
            targetWeek.resourceAssignments = templateWeek.resourceAssignments;
            needsPersist = true;
          }
        }

        // Persist any migrations/syncs to Firestore
        if (needsPersist) {
          const instanceDoc = instanceSnapshot.docs[0];
          const instanceData = instanceDoc.data();
          const weekIndex = instanceData.weeks.findIndex((w: { weekNumber: number }) => w.weekNumber === targetWeek.weekNumber);
          if (weekIndex !== -1) {
            instanceData.weeks[weekIndex].days = migratedDays;
            instanceData.weeks[weekIndex].resourceAssignments = weekResourceAssignments;
            await instanceDoc.ref.update({
              weeks: instanceData.weeks,
              updatedAt: new Date().toISOString()
            });
            console.log(`[WEEKLY_CONTENT] SYNC: Persisted updates to instance ${instanceDoc.id}`);
            // NOTE: Task sync to user's tasks collection happens via:
            // 1. Coach saving week content (distributeTasksNow)
            // 2. Cron job for daily tasks
            // 3. Enrollment creation
            // 4. Sync-template endpoint
            // NOT on client read - that would be wrong
          }
        }

        weekData = {
          weekNumber: targetWeek.weekNumber,
          name: targetWeek.name,
          theme: targetWeek.theme,
          description: targetWeek.description,
          weeklyPrompt: targetWeek.weeklyPrompt,
          currentFocus: targetWeek.currentFocus,
          notes: targetWeek.notes,
          manualNotes: targetWeek.manualNotes,
          startDayIndex: targetWeek.startDayIndex || 1,
          endDayIndex: targetWeek.endDayIndex || 7,
          calendarStartDate: targetWeek.calendarStartDate,
          calendarEndDate: targetWeek.calendarEndDate,
          // Partial week info for client UI blurring
          actualStartDayOfWeek: targetWeek.actualStartDayOfWeek,
          actualEndDayOfWeek: targetWeek.actualEndDayOfWeek,
          // Resource assignments with cadence and lesson mapping
          resourceAssignments: weekResourceAssignments,
        };

        // Collect week-level resources
        weekLinkedCallEventIds = targetWeek.linkedCallEventIds || [];
        weekLinkedArticleIds = targetWeek.linkedArticleIds || [];
        weekLinkedDownloadIds = targetWeek.linkedDownloadIds || [];
        weekLinkedLinkIds = targetWeek.linkedLinkIds || [];
        weekLinkedCourseIds = targetWeek.linkedCourseIds || [];
        weekLinkedSummaryIds = targetWeek.linkedSummaryIds || [];
        weekLinkedQuestionnaireIds = targetWeek.linkedQuestionnaireIds || [];

        // Generate days for the full week (5 days for weekday programs, 7 for weekend-inclusive)
        // Then look up task/resource data from instance days
        const instanceDays = migratedDays;
        // Instance days are indexed 1, 2, 3... for ACTIVE days only
        // For partial weeks, we need to map calendar day to instance day
        const actualStartDayOfWeek = targetWeek.actualStartDayOfWeek || 1;
        const actualEndDayOfWeek = targetWeek.actualEndDayOfWeek || daysPerWeek;
        const instanceDayMap = new Map(instanceDays.map((d: ProgramInstanceDay) => [d.calendarDate, d]));

        // Calculate the week's calendar start date (Monday of this week)
        // Use calendarStartDate from instance week if available, otherwise calculate
        let weekCalendarStart: Date;
        if (targetWeek.calendarStartDate) {
          weekCalendarStart = new Date(targetWeek.calendarStartDate);
        } else {
          // Fallback: calculate from enrollment start + week's startDayIndex
          weekCalendarStart = new Date(startDate);
          if (includeWeekends) {
            weekCalendarStart.setDate(weekCalendarStart.getDate() + (targetWeek.startDayIndex || 1) - 1);
          } else {
            let daysToSkip = (targetWeek.startDayIndex || 1) - 1;
            while (daysToSkip > 0) {
              weekCalendarStart.setDate(weekCalendarStart.getDate() + 1);
              const dow = weekCalendarStart.getDay();
              if (dow !== 0 && dow !== 6) daysToSkip--;
            }
          }
          // Align to Monday of the week
          const dow = weekCalendarStart.getDay();
          if (dow !== 1 && dow !== 0) {
            weekCalendarStart.setDate(weekCalendarStart.getDate() - (dow - 1));
          } else if (dow === 0) {
            weekCalendarStart.setDate(weekCalendarStart.getDate() - 6);
          }
        }

        // Generate all days in the week (5 for weekday programs)
        for (let dayIdx = 1; dayIdx <= daysPerWeek; dayIdx++) {
          const dayDate = new Date(weekCalendarStart);
          dayDate.setDate(dayDate.getDate() + dayIdx - 1);
          const dayDateOfWeek = dayDate.getDay();

          // For 5-day programs, skip weekend days (shouldn't happen if weekCalendarStart is Monday)
          if (!includeWeekends && (dayDateOfWeek === 0 || dayDateOfWeek === 6)) {
            continue;
          }

          const calendarDate = formatDateInTimezone(dayDate, userTimezone);
          const globalDayIndex = (targetWeek.startDayIndex || 1) + dayIdx - 1;

          // Look up instance day by calendarDate (simpler and more reliable than index math)
          const instanceDay = instanceDayMap.get(calendarDate);

          // Inherit week-level resources if day-level is empty
          const dayEventIds = instanceDay?.linkedEventIds?.length ? instanceDay.linkedEventIds : weekLinkedCallEventIds;
          const dayArticleIds = instanceDay?.linkedArticleIds?.length ? instanceDay.linkedArticleIds : weekLinkedArticleIds;
          const dayDownloadIds = instanceDay?.linkedDownloadIds?.length ? instanceDay.linkedDownloadIds : weekLinkedDownloadIds;
          const dayLinkIds = instanceDay?.linkedLinkIds?.length ? instanceDay.linkedLinkIds : weekLinkedLinkIds;
          const dayCourseIds = instanceDay?.linkedCourseIds?.length ? instanceDay.linkedCourseIds : weekLinkedCourseIds;
          const daySummaryIds = instanceDay?.linkedSummaryIds?.length ? instanceDay.linkedSummaryIds : weekLinkedSummaryIds;
          const dayQuestionnaireIds = instanceDay?.linkedQuestionnaireIds?.length ? instanceDay.linkedQuestionnaireIds : weekLinkedQuestionnaireIds;

          // Merge completion status from tasks collection into instance tasks
          const tasksWithCompletion = (instanceDay?.tasks || []).map((task: ProgramInstanceDay['tasks'][0]) => {
            const completion = completionMap.get(task.id);
            return {
              ...task,
              completed: completion?.completed || false,
              completedAt: completion?.completedAt,
            };
          });

          daysData.push({
            dayIndex: dayIdx, // Calendar position (1=Mon, 2=Tue, etc.) for partial week detection
            programDayIndex: instanceDay?.dayIndex ?? null, // For resource assignment lookups
            globalDayIndex,
            calendarDate,
            dayName: dayNames[dayDateOfWeek],
            isToday: dayDate.toDateString() === today.toDateString(),
            isPast: dayDate < today,
            tasks: tasksWithCompletion,
            habits: instanceDay?.habits || [],
            linkedEventIds: dayEventIds,
            linkedArticleIds: dayArticleIds,
            linkedDownloadIds: dayDownloadIds,
            linkedLinkIds: dayLinkIds,
            linkedQuestionnaireIds: dayQuestionnaireIds,
            linkedCourseIds: dayCourseIds,
            linkedSummaryIds: daySummaryIds,
          });
        }
      }
    } else {
      // Fallback to template-based data (legacy system)
      const weeks = program.weeks || [];

      // Find current week
      let targetWeek = weeks.find((w: ProgramWeek) => {
        if (requestedWeekNumber) {
          return w.weekNumber === parseInt(requestedWeekNumber);
        }
        return currentDayIndex >= w.startDayIndex && currentDayIndex <= w.endDayIndex;
      });

      if (!targetWeek && weeks.length > 0) {
        targetWeek = requestedWeekNumber
          ? weeks.find((w: ProgramWeek) => w.weekNumber === parseInt(requestedWeekNumber))
          : weeks[0];
      }

      if (targetWeek) {
        // Collect resource assignments (with lessonDayMapping for courses)
        weekResourceAssignments = targetWeek.resourceAssignments || [];

        weekData = {
          weekNumber: targetWeek.weekNumber,
          name: targetWeek.name,
          theme: targetWeek.theme,
          description: targetWeek.description,
          weeklyPrompt: targetWeek.weeklyPrompt,
          currentFocus: targetWeek.currentFocus,
          notes: targetWeek.notes,
          manualNotes: targetWeek.manualNotes,
          startDayIndex: targetWeek.startDayIndex,
          endDayIndex: targetWeek.endDayIndex,
          // Resource assignments with cadence and lesson mapping
          resourceAssignments: weekResourceAssignments,
        };

        // Collect week-level resources
        weekLinkedCallEventIds = targetWeek.linkedCallEventIds || [];
        weekLinkedArticleIds = targetWeek.linkedArticleIds || [];
        weekLinkedDownloadIds = targetWeek.linkedDownloadIds || [];
        weekLinkedLinkIds = targetWeek.linkedLinkIds || [];
        weekLinkedCourseIds = targetWeek.linkedCourseIds || [];
        weekLinkedSummaryIds = targetWeek.linkedSummaryIds || [];
        weekLinkedQuestionnaireIds = targetWeek.linkedQuestionnaireIds || [];

        // Generate days from week range (respect includeWeekends)
        // Convert program day index to calendar date (skip weekends for 5-day programs)
        let weekStartDate = new Date(startDate);
        if (includeWeekends) {
          weekStartDate.setDate(weekStartDate.getDate() + targetWeek.startDayIndex - 1);
        } else {
          // For 5-day programs, count only weekdays
          let programDaysToSkip = targetWeek.startDayIndex - 1;
          while (programDaysToSkip > 0) {
            weekStartDate.setDate(weekStartDate.getDate() + 1);
            const dow = weekStartDate.getDay();
            if (dow !== 0 && dow !== 6) programDaysToSkip--;
          }
        }

        // For 5-day programs on weekends, shift to next Monday
        let adjustedWeekStartDate = new Date(weekStartDate);
        if (!includeWeekends && isWeekend && !requestedWeekNumber) {
          // Calculate days until Monday
          const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
          adjustedWeekStartDate = new Date(today);
          adjustedWeekStartDate.setDate(today.getDate() + daysUntilMonday);
        }

        // Generate days - for 5-day programs, we need to iterate more to skip weekends
        const maxIterations = includeWeekends ? 7 : 9; // Allow extra iterations for skipping weekends
        let addedDays = 0;
        for (let i = 0; i < maxIterations && addedDays < daysPerWeek; i++) {
          const dayDate = new Date(adjustedWeekStartDate);
          dayDate.setDate(dayDate.getDate() + i);
          const dayDateOfWeek = dayDate.getDay();

          // For 5-day programs, skip weekends
          if (!includeWeekends && (dayDateOfWeek === 0 || dayDateOfWeek === 6)) {
            continue;
          }

          addedDays++;
          const globalDayIndex = targetWeek.startDayIndex + addedDays - 1;

          // Distribute tasks based on distribution setting
          let dayTasks: ProgramTaskTemplate[] = [];
          const distribution = targetWeek.distribution || 'repeat-daily';

          if (distribution === 'repeat-daily') {
            dayTasks = targetWeek.weeklyTasks || [];
          } else if (distribution === 'spread') {
            // Spread tasks across days
            const allTasks = targetWeek.weeklyTasks || [];
            const tasksPerDay = Math.ceil(allTasks.length / daysPerWeek);
            const startIdx = (addedDays - 1) * tasksPerDay;
            dayTasks = allTasks.slice(startIdx, startIdx + tasksPerDay);
          }

          daysData.push({
            dayIndex: addedDays,
            globalDayIndex,
            calendarDate: formatDateInTimezone(dayDate, userTimezone),
            dayName: dayNames[dayDateOfWeek],
            isToday: dayDate.toDateString() === today.toDateString(),
            isPast: dayDate < today,
            tasks: dayTasks,
            habits: targetWeek.weeklyHabits,
            linkedEventIds: targetWeek.linkedCallEventIds,
            linkedArticleIds: targetWeek.linkedArticleIds,
            linkedDownloadIds: targetWeek.linkedDownloadIds,
            linkedLinkIds: targetWeek.linkedLinkIds,
            linkedQuestionnaireIds: targetWeek.linkedQuestionnaireIds,
            linkedCourseIds: targetWeek.linkedCourseIds,
            linkedSummaryIds: targetWeek.linkedSummaryIds,
          });
        }
      }
    }

    // Collect all linked resource IDs from week and days
    const allLinkedEventIds = new Set<string>();
    const allLinkedArticleIds = new Set<string>();
    const allLinkedDownloadIds = new Set<string>();
    const allLinkedLinkIds = new Set<string>();
    const allLinkedCourseIds = new Set<string>();
    const allLinkedSummaryIds = new Set<string>();
    const allLinkedQuestionnaireIds = new Set<string>();
    const allLinkedVideoIds = new Set<string>();

    // First, collect week-level resources
    weekLinkedCallEventIds.forEach(id => allLinkedEventIds.add(id));
    weekLinkedArticleIds.forEach(id => allLinkedArticleIds.add(id));
    weekLinkedDownloadIds.forEach(id => allLinkedDownloadIds.add(id));
    weekLinkedLinkIds.forEach(id => allLinkedLinkIds.add(id));
    weekLinkedCourseIds.forEach(id => allLinkedCourseIds.add(id));
    weekLinkedSummaryIds.forEach(id => allLinkedSummaryIds.add(id));
    weekLinkedQuestionnaireIds.forEach(id => allLinkedQuestionnaireIds.add(id));

    // Collect resource IDs from resourceAssignments (new cadence system)
    for (const assignment of weekResourceAssignments) {
      if (assignment.resourceType === 'course') {
        allLinkedCourseIds.add(assignment.resourceId);
      } else if (assignment.resourceType === 'article') {
        allLinkedArticleIds.add(assignment.resourceId);
      } else if (assignment.resourceType === 'download') {
        allLinkedDownloadIds.add(assignment.resourceId);
      } else if (assignment.resourceType === 'link') {
        allLinkedLinkIds.add(assignment.resourceId);
      } else if (assignment.resourceType === 'questionnaire') {
        allLinkedQuestionnaireIds.add(assignment.resourceId);
      } else if (assignment.resourceType === 'video') {
        allLinkedVideoIds.add(assignment.resourceId);
      }
    }

    // Then collect from days (day-level resources)
    for (const day of daysData) {
      day.linkedEventIds?.forEach(id => allLinkedEventIds.add(id));
      day.linkedArticleIds?.forEach(id => allLinkedArticleIds.add(id));
      day.linkedDownloadIds?.forEach(id => allLinkedDownloadIds.add(id));
      day.linkedLinkIds?.forEach(id => allLinkedLinkIds.add(id));
      day.linkedCourseIds?.forEach(id => allLinkedCourseIds.add(id));
      day.linkedSummaryIds?.forEach(id => allLinkedSummaryIds.add(id));
      day.linkedQuestionnaireIds?.forEach(id => allLinkedQuestionnaireIds.add(id));
    }

    // Fetch linked resources
    const [events, courses, articles, downloads, links, questionnaires, videos, summaries] = await Promise.all([
      fetchDocsByIds<UnifiedEvent>('events', Array.from(allLinkedEventIds)),
      fetchDocsByIds<DiscoverCourse>('courses', Array.from(allLinkedCourseIds)),
      fetchDocsByIds<DiscoverArticle>('articles', Array.from(allLinkedArticleIds)),
      fetchDocsByIds<{ id: string; title: string; fileUrl: string; fileType?: string; }>('downloads', Array.from(allLinkedDownloadIds)),
      fetchDocsByIds<{ id: string; title: string; url: string; description?: string; }>('links', Array.from(allLinkedLinkIds)),
      fetchDocsByIds<{ id: string; title: string; slug?: string; }>('questionnaires', Array.from(allLinkedQuestionnaireIds)),
      fetchDocsByIds<{ id: string; title: string; thumbnailUrl?: string; }>('videos', Array.from(allLinkedVideoIds)),
      fetchDocsByIds<CallSummary>('call_summaries', Array.from(allLinkedSummaryIds)),
    ]);

    return NextResponse.json({
      success: true,
      week: weekData,
      days: daysData,
      resourceAssignments: weekResourceAssignments,
      events,
      courses,
      articles,
      downloads,
      links,
      questionnaires,
      videos,
      summaries,
    } as WeeklyContentResponse);

  } catch (error) {
    console.error('[WEEKLY_CONTENT] Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

// Helper to fetch documents by IDs
async function fetchDocsByIds<T>(collection: string, ids: string[]): Promise<T[]> {
  if (ids.length === 0) return [];

  const results: T[] = [];
  const batchSize = 30; // Firestore 'in' query limit

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const snapshot = await adminDb.collection(collection).where('__name__', 'in', batch).get();
    snapshot.docs.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() } as T);
    });
  }

  return results;
}

// Demo data for weekly content
function getDemoWeeklyContent(): WeeklyContentResponse {
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    success: true,
    week: {
      weekNumber: 2,
      name: 'Week 2: Building Momentum',
      theme: 'Establishing Your Routine',
      description: 'This week we focus on creating sustainable habits and building the daily routines that will support your long-term success.',
      weeklyPrompt: 'What does your ideal morning routine look like, and what\'s one small step you can take to move closer to it?',
      currentFocus: [
        'Complete daily morning reflection',
        'Track your habits consistently',
        'Connect with your accountability partner',
      ],
      notes: [
        'Remember to celebrate small wins',
        'Focus on progress, not perfection',
        'Reach out if you need support',
      ],
      manualNotes: 'Great progress last week! This week, focus on consistency over intensity. The goal is to make these habits automatic.',
      startDayIndex: 8,
      endDayIndex: 14,
    },
    days: Array.from({ length: 5 }, (_, i) => {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - today.getDay() + 1 + i); // Start from Monday

      return {
        dayIndex: i + 1,
        globalDayIndex: 8 + i,
        calendarDate: dayDate.toISOString().split('T')[0],
        dayName: dayNames[dayDate.getDay()],
        isToday: dayDate.toDateString() === today.toDateString(),
        isPast: dayDate < today,
        tasks: [
          { id: `task-${i}-1`, label: 'Morning reflection', isPrimary: true, type: 'task' as const },
          { id: `task-${i}-2`, label: 'Complete daily lesson', isPrimary: false, type: 'learning' as const },
          { id: `task-${i}-3`, label: 'Evening journaling', isPrimary: false, type: 'task' as const },
        ],
        linkedEventIds: i === 2 ? ['demo-event-1'] : [],
        linkedArticleIds: i === 0 ? ['demo-article-1'] : [],
        linkedCourseIds: i === 1 ? ['demo-course-1'] : [],
      };
    }),
    events: [{
      id: 'demo-event-1',
      title: 'Weekly Group Call',
      description: 'Join us for Q&A and progress check-in',
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      startTime: '10:00',
      endTime: '11:00',
      organizationId: 'demo-org',
    }] as UnifiedEvent[],
    courses: [{
      id: 'demo-course-1',
      title: 'Habit Formation Fundamentals',
      shortDescription: 'Learn the science of building lasting habits',
      coverImageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
      category: 'Mindset',
      organizationId: 'demo-org',
    }] as DiscoverCourse[],
    articles: [{
      id: 'demo-article-1',
      title: 'The Power of Morning Routines',
      coverImageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
      authorName: 'Coach Adam',
      readingTimeMinutes: 5,
      organizationId: 'demo-org',
    }] as DiscoverArticle[],
    resourceAssignments: [],
    downloads: [],
    links: [],
    questionnaires: [],
    videos: [],
    summaries: [],
  };
}
