// ============================================================================
// PROGRAM INSTANCES API - Part of 3-Collection Architecture
// ============================================================================
//
// This is part of the new simplified program system:
//   programs → program_instances → task_completions
//
// program_instances stores one document per enrollment (1:1) or cohort (group).
// All weeks/days/tasks are embedded in the instance document.
//
// See CLAUDE.md "Program System Architecture" for full documentation.
// ============================================================================

/**
 * Program Instances List API
 *
 * List and search program instances
 *
 * GET /api/instances - List instances with filters
 *
 * Query params:
 * - programId: Filter by program
 * - cohortId: Filter by cohort
 * - enrollmentId: Filter by enrollment (for 1:1 programs)
 * - userId: Filter by user (for individual instances)
 * - type: Filter by type ('individual' | 'cohort')
 * - limit: Max results (default: 50)
 * - offset: Pagination offset
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { ProgramInstance, ProgramInstanceDay, ProgramInstanceModule, ProgramModule } from '@/types';
import { calculateCalendarWeeks, type CalendarWeek } from '@/lib/calendar-weeks';

/**
 * Fetches and converts template modules to instance modules.
 * Used during instance creation to pre-populate modules with customizable copies.
 *
 * @param programId - The program ID to fetch modules for
 * @returns Array of ProgramInstanceModule ready for embedding in instance
 */
async function fetchAndConvertModules(programId: string): Promise<ProgramInstanceModule[]> {
  const modulesSnapshot = await adminDb.collection('program_modules')
    .where('programId', '==', programId)
    .orderBy('order', 'asc')
    .get();

  const now = new Date().toISOString();

  return modulesSnapshot.docs.map(doc => {
    const m = doc.data() as ProgramModule;
    return {
      id: crypto.randomUUID(),
      templateModuleId: doc.id,
      order: m.order,
      name: m.name,
      description: m.description,
      habits: m.habits || [],
      startDayIndex: m.startDayIndex,
      endDayIndex: m.endDayIndex,
      linkedCourseIds: m.linkedCourseIds,
      hasLocalChanges: false,
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Distributes weeklyTasks to days based on each task's dayTag and the week's distribution setting.
 * This is used during instance creation to pre-populate days with tasks.
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
  weeklyTasks: Array<{ id?: string; label: string; dayTag?: 'auto' | 'spread' | 'daily' | number; [key: string]: unknown }>,
  days: ProgramInstanceDay[],
  distribution: string | undefined,
  _activeStartDay?: number,  // DEPRECATED
  _activeEndDay?: number     // DEPRECATED
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
  const dailyTasks: typeof weeklyTasks = [];      // dayTag: 'daily' → all active days
  const spreadTasks: typeof weeklyTasks = [];     // dayTag: 'spread' → spread evenly across active days
  const specificDayTasks: Map<number, typeof weeklyTasks> = new Map(); // dayTag: 1-7 → specific day
  const autoTasks: typeof weeklyTasks = [];       // dayTag: undefined/'auto' → use program distribution

  for (const task of weeklyTasks) {
    const dayTag = task.dayTag;
    if (dayTag === 'daily') {
      dailyTasks.push(task);
    } else if (dayTag === 'spread') {
      spreadTasks.push(task);
    } else if (Array.isArray(dayTag)) {
      // Multiple specific days - add task to each specified day within active range
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
      // dayTag: undefined, 'auto', or invalid → use program distribution
      autoTasks.push(task);
    }
  }

  // Clone days to avoid mutation - use 'any' to allow flexible task structure
  const updatedDays = days.map(d => ({ ...d, tasks: [...(d.tasks || [])] as unknown[] }));

  // Add daily tasks to ACTIVE days only
  for (const task of dailyTasks) {
    for (let dayIdx = activeStartIdx; dayIdx <= activeEndIdx; dayIdx++) {
      updatedDays[dayIdx].tasks.push(createDayTask(task));
    }
  }

  // Add specific-day tasks to their designated day (only if within active range)
  for (const [dayNum, tasks] of specificDayTasks) {
    const dayIdx = dayNum - 1; // dayTag is 1-based, array is 0-based
    if (dayIdx >= activeStartIdx && dayIdx <= activeEndIdx) {
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
        // Spread within active range
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

/**
 * GET /api/instances
 * Returns a list of program instances
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const cohortId = searchParams.get('cohortId');
    const enrollmentId = searchParams.get('enrollmentId');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') as 'individual' | 'cohort' | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    // Note: We can't filter 'deletedAt == null' because Firestore doesn't match
    // documents where the field doesn't exist. We filter in-memory instead.
    let query = adminDb.collection('program_instances')
      .where('organizationId', '==', organizationId);

    if (programId) {
      query = query.where('programId', '==', programId);
    }

    if (cohortId) {
      query = query.where('cohortId', '==', cohortId);
    }

    if (enrollmentId) {
      query = query.where('enrollmentId', '==', enrollmentId);
    }

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    if (type) {
      query = query.where('type', '==', type);
    }

    // Execute query with ordering and pagination
    // Note: When querying by cohortId, we expect at most 1 instance per cohort,
    // so we can skip ordering to avoid requiring a composite index
    let snapshot;
    try {
      if (cohortId) {
        // Simple query for single cohort - no ordering needed
        snapshot = await query.limit(limit + 1).get();
      } else {
        // Full query with ordering for list views
        snapshot = await query
          .orderBy('createdAt', 'desc')
          .limit(limit + 1)
          .offset(offset)
          .get();
      }
    } catch (queryError) {
      // If the composite index doesn't exist, fall back to simple query
      console.warn('[INSTANCES_LIST_GET] Index query failed, using fallback:', queryError);
      snapshot = await query.limit(limit + 1).get();
    }

    // Filter out soft-deleted documents in-memory
    // (Firestore 'where field == null' doesn't match documents missing the field)
    const activeDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.deletedAt;
    });

    const hasMore = activeDocs.length > limit;
    const docs = hasMore ? activeDocs.slice(0, limit) : activeDocs;

    // Map to instances (without full weeks data for list view)
    const instances: Array<Omit<ProgramInstance, 'weeks'> & { weekCount: number; dayCount: number }> = docs.map(doc => {
      const data = doc.data();
      const weeks = data.weeks || [];

      return {
        id: doc.id,
        programId: data.programId,
        organizationId: data.organizationId,
        type: data.type,
        userId: data.userId,
        enrollmentId: data.enrollmentId,
        cohortId: data.cohortId,
        startDate: data.startDate,
        endDate: data.endDate,
        includeWeekends: data.includeWeekends,
        dailyFocusSlots: data.dailyFocusSlots,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
        lastSyncedFromTemplate: data.lastSyncedFromTemplate?.toDate?.()?.toISOString?.() || data.lastSyncedFromTemplate,
        weekCount: weeks.length,
        dayCount: weeks.reduce((sum: number, w: { days?: unknown[] }) => sum + (w.days?.length || 0), 0),
      };
    });

    // Enrich with user/cohort names
    const enrichedInstances = await Promise.all(instances.map(async (instance) => {
      if (instance.type === 'cohort' && instance.cohortId) {
        const cohortDoc = await adminDb.collection('program_cohorts').doc(instance.cohortId).get();
        return {
          ...instance,
          cohortName: cohortDoc.data()?.name || 'Unknown Cohort',
        };
      } else if (instance.type === 'individual' && instance.userId) {
        const userDoc = await adminDb.collection('users').doc(instance.userId).get();
        const userData = userDoc.data();
        return {
          ...instance,
          userName: userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'Unknown User',
          userImageUrl: userData?.imageUrl,
        };
      }
      return instance;
    }));

    // Auto-create instance for cohort if none exists (migration support)
    if (cohortId && enrichedInstances.length === 0 && programId) {
      console.log(`[INSTANCES_LIST_GET] No instance found for cohort ${cohortId}, auto-creating...`);

      try {
        // Fetch program and cohort data
        const [programDoc, cohortDoc] = await Promise.all([
          adminDb.collection('programs').doc(programId).get(),
          adminDb.collection('program_cohorts').doc(cohortId).get(),
        ]);

        if (programDoc.exists && cohortDoc.exists) {
          const programData = programDoc.data();
          const cohortData = cohortDoc.data();

          // Verify ownership
          if (programData?.organizationId === organizationId && cohortData?.programId === programId) {
            const includeWeekends = programData.includeWeekends !== false;
            const daysPerWeek = includeWeekends ? 7 : 5;
            const totalDays = programData.lengthDays || 28;

            // Calculate calendar weeks from cohort start date
            // Include ALL weeks (including Week 0 onboarding) for proper date mapping
            // Fallback: use today if startDate is missing
            let calendarWeeks: CalendarWeek[] = [];
            const effectiveCohortStartDate = cohortData.startDate || new Date().toISOString().split('T')[0];
            if (effectiveCohortStartDate) {
              calendarWeeks = calculateCalendarWeeks(effectiveCohortStartDate, totalDays, includeWeekends);
            }
            // Sort all calendar weeks by start day for consistent ordering
            const sortedCalendarWeeks = [...calendarWeeks].sort((a, b) => a.startDayIndex - b.startDayIndex);

            let weeks: Array<{
              id: string;
              weekNumber: number;
              templateWeekNumber?: number;
              moduleId?: string;
              name?: string;
              theme?: string;
              weeklyTasks: Array<{ id: string; label: string; [key: string]: unknown }>;
              weeklyHabits: unknown[];
              weeklyPrompt?: string;
              distribution?: string;
              startDayIndex?: number;
              endDayIndex?: number;
              days: ProgramInstanceDay[];
            }> = [];

            // NEW: First try to read from programs.weeks[] (embedded template weeks)
            if (programData.weeks && Array.isArray(programData.weeks) && programData.weeks.length > 0) {
              console.log(`[INSTANCES_LIST_GET] Using embedded weeks from program (${programData.weeks.length} weeks)`);

              // Detect format: new format has weekNumber=0 (onboarding), old format starts at 1
              const hasOnboarding = programData.weeks.some((w: { weekNumber: number }) => w.weekNumber === 0);
              const isNewFormat = hasOnboarding;

              console.log(`[INSTANCES_LIST_GET] Template format: ${isNewFormat ? 'NEW (0, 1-N, -1)' : 'OLD (1-N)'}`);

              // Map calendar weeks to instance weeks using weekNumber-based matching
              weeks = sortedCalendarWeeks.map((calendarWeek) => {
                type TemplateWeek = {
                  id?: string;
                  weekNumber: number;
                  moduleId?: string;
                  name?: string;
                  theme?: string;
                  description?: string;
                  startDayIndex?: number;
                  endDayIndex?: number;
                  weeklyTasks?: Array<{ id?: string; label: string }>;
                  weeklyHabits?: unknown[];
                  weeklyPrompt?: string;
                  distribution?: string;
                  // Client-facing summary fields
                  currentFocus?: string[];
                  notes?: string[];
                  manualNotes?: string;
                  // Linked resources
                  linkedCallEventIds?: string[];
                  linkedCourseIds?: string[];
                  linkedArticleIds?: string[];
                  linkedDownloadIds?: string[];
                  linkedLinkIds?: string[];
                  linkedQuestionnaireIds?: string[];
                  linkedSummaryIds?: string[];
                  // Resource assignments with cadence
                  resourceAssignments?: unknown[];
                  courseAssignments?: unknown[];
                };

                let templateWeek: TemplateWeek | undefined;

                if (isNewFormat) {
                  // NEW FORMAT: Direct weekNumber matching (0, 1, 2, ..., -1)
                  templateWeek = programData.weeks.find((w: TemplateWeek) => w.weekNumber === calendarWeek.weekNumber);
                } else {
                  // OLD FORMAT (Lazy Migration): Template weeks are [1, 2, 3, ..., N]
                  // Map by position: calendarWeek at index i → templateWeek at index i
                  const calendarIndex = sortedCalendarWeeks.indexOf(calendarWeek);
                  templateWeek = programData.weeks[calendarIndex];
                }

                const startDayIndex = calendarWeek.startDayIndex;
                const endDayIndex = calendarWeek.endDayIndex;

                // For partial weeks (e.g., Tue start), actualStartDayOfWeek=2 means we offset from Monday
                const actualStartDayOfWeek = calendarWeek.actualStartDayOfWeek || 1;
                const actualStartOffset = actualStartDayOfWeek - 1; // 0 for Mon, 1 for Tue, etc.

                // Helper to get calendar date for each day (offset by actualStartDayOfWeek)
                const getCalendarDateForDay = (dayOffset: number): string | undefined => {
                  if (!calendarWeek.startDate) return undefined;
                  const startDate = new Date(calendarWeek.startDate);
                  // Offset from Monday by actualStartOffset + dayOffset
                  // e.g., Tue start (offset=1), day 0 → Mon+1=Tue, day 1 → Mon+2=Wed
                  startDate.setDate(startDate.getDate() + actualStartOffset + dayOffset);
                  return startDate.toISOString().split('T')[0];
                };

                // Create only ACTIVE program days (not displayDaysCount which is for UI blur)
                // endDayIndex - startDayIndex + 1 = actual program days in this week
                const activeDaysCount = endDayIndex - startDayIndex + 1;
                let days: ProgramInstanceDay[] = [];
                for (let i = 0; i < activeDaysCount; i++) {
                  days.push({
                    dayIndex: i + 1,  // 1-based program day within this week
                    globalDayIndex: startDayIndex + i,
                    calendarDate: getCalendarDateForDay(i),
                    tasks: [],
                    habits: [],
                  });
                }

                // Prepare weeklyTasks with IDs
                const weeklyTasks = (templateWeek?.weeklyTasks || []).map((t) => ({
                  ...t,
                  id: t.id || crypto.randomUUID(),
                }));

                // Distribute tasks to days
                if (weeklyTasks.length > 0) {
                  days = distributeTasksToDays(
                    weeklyTasks,
                    days,
                    templateWeek?.distribution
                  );
                }

                return {
                  id: templateWeek?.id || crypto.randomUUID(),
                  weekNumber: calendarWeek.weekNumber, // Always use calendar weekNumber (0, 1, 2, ..., -1)
                  templateWeekNumber: templateWeek?.weekNumber, // Preserve original for reference
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
                  // Client-facing summary fields
                  currentFocus: templateWeek?.currentFocus,
                  notes: templateWeek?.notes,
                  manualNotes: templateWeek?.manualNotes,
                  // Linked resources
                  linkedCallEventIds: templateWeek?.linkedCallEventIds,
                  linkedCourseIds: templateWeek?.linkedCourseIds,
                  linkedArticleIds: templateWeek?.linkedArticleIds,
                  linkedDownloadIds: templateWeek?.linkedDownloadIds,
                  linkedLinkIds: templateWeek?.linkedLinkIds,
                  linkedQuestionnaireIds: templateWeek?.linkedQuestionnaireIds,
                  linkedSummaryIds: templateWeek?.linkedSummaryIds,
                  // Resource assignments with cadence and lesson mapping
                  resourceAssignments: templateWeek?.resourceAssignments || [],
                  courseAssignments: templateWeek?.courseAssignments || [],
                };
              });
            } else {
              // FALLBACK: Read from program_weeks collection (legacy data)
              console.log(`[INSTANCES_LIST_GET] Falling back to program_weeks collection`);
              const weeksSnapshot = await adminDb.collection('program_weeks')
                .where('programId', '==', programId)
                .orderBy('weekNumber', 'asc')
                .get();

              // Detect format: new format has weekNumber=0 (onboarding), old format starts at 1
              const hasOnboarding = weeksSnapshot.docs.some(doc => doc.data().weekNumber === 0);
              const isNewFormat = hasOnboarding;

              console.log(`[INSTANCES_LIST_GET] Legacy collection format: ${isNewFormat ? 'NEW (0, 1-N, -1)' : 'OLD (1-N)'}`);

              // Map calendar weeks to instance weeks using weekNumber-based matching
              weeks = sortedCalendarWeeks.map((calendarWeek) => {
                let weekDoc;
                let weekData;

                if (isNewFormat) {
                  // NEW FORMAT: Direct weekNumber matching
                  weekDoc = weeksSnapshot.docs.find(doc => doc.data().weekNumber === calendarWeek.weekNumber);
                  weekData = weekDoc?.data();
                } else {
                  // OLD FORMAT (Lazy Migration): Map by position
                  const calendarIndex = sortedCalendarWeeks.indexOf(calendarWeek);
                  weekDoc = weeksSnapshot.docs[calendarIndex];
                  weekData = weekDoc?.data();
                }

                const startDayIndex = calendarWeek.startDayIndex;
                const endDayIndex = calendarWeek.endDayIndex;

                // For partial weeks (e.g., Tue start), actualStartDayOfWeek=2 means we offset from Monday
                const actualStartDayOfWeek = calendarWeek.actualStartDayOfWeek || 1;
                const actualStartOffset = actualStartDayOfWeek - 1; // 0 for Mon, 1 for Tue, etc.

                // Helper to get calendar date for each day (offset by actualStartDayOfWeek)
                const getCalendarDateForDay = (dayOffset: number): string | undefined => {
                  if (!calendarWeek.startDate) return undefined;
                  const startDate = new Date(calendarWeek.startDate);
                  // Offset from Monday by actualStartOffset + dayOffset
                  // e.g., Tue start (offset=1), day 0 → Mon+1=Tue, day 1 → Mon+2=Wed
                  startDate.setDate(startDate.getDate() + actualStartOffset + dayOffset);
                  return startDate.toISOString().split('T')[0];
                };

                // Create only ACTIVE program days (not displayDaysCount which is for UI blur)
                // endDayIndex - startDayIndex + 1 = actual program days in this week
                const activeDaysCount = endDayIndex - startDayIndex + 1;
                let days: ProgramInstanceDay[] = [];
                for (let i = 0; i < activeDaysCount; i++) {
                  days.push({
                    dayIndex: i + 1,  // 1-based program day within this week
                    globalDayIndex: startDayIndex + i,
                    calendarDate: getCalendarDateForDay(i),
                    tasks: [],
                    habits: [],
                  });
                }

                // Prepare weeklyTasks with IDs
                const weeklyTasks = (weekData?.weeklyTasks || []).map((t: { id?: string; label: string }) => ({
                  ...t,
                  id: t.id || crypto.randomUUID(),
                }));

                // Distribute tasks to days
                if (weeklyTasks.length > 0) {
                  days = distributeTasksToDays(
                    weeklyTasks,
                    days,
                    weekData?.distribution
                  );
                }

                return {
                  id: weekDoc?.id || crypto.randomUUID(),
                  weekNumber: calendarWeek.weekNumber, // Always use calendar weekNumber
                  templateWeekNumber: weekData?.weekNumber, // Preserve original
                  moduleId: weekData?.moduleId,
                  name: weekData?.name,
                  theme: weekData?.theme,
                  description: weekData?.description,
                  weeklyTasks,
                  weeklyHabits: weekData?.weeklyHabits || [],
                  weeklyPrompt: weekData?.weeklyPrompt,
                  distribution: weekData?.distribution,
                  startDayIndex,
                  endDayIndex,
                  calendarStartDate: calendarWeek.startDate,
                  calendarEndDate: calendarWeek.endDate,
                  actualStartDayOfWeek: calendarWeek.actualStartDayOfWeek,
                  actualEndDayOfWeek: calendarWeek.actualEndDayOfWeek,
                  displayDaysCount: calendarWeek.displayDaysCount,
                  days,
                  // Client-facing summary fields
                  currentFocus: weekData?.currentFocus,
                  notes: weekData?.notes,
                  manualNotes: weekData?.manualNotes,
                  // Linked resources
                  linkedCallEventIds: weekData?.linkedCallEventIds,
                  linkedCourseIds: weekData?.linkedCourseIds,
                  linkedArticleIds: weekData?.linkedArticleIds,
                  linkedDownloadIds: weekData?.linkedDownloadIds,
                  linkedLinkIds: weekData?.linkedLinkIds,
                  linkedQuestionnaireIds: weekData?.linkedQuestionnaireIds,
                  linkedSummaryIds: weekData?.linkedSummaryIds,
                  // Resource assignments with cadence and lesson mapping
                  resourceAssignments: weekData?.resourceAssignments || [],
                  courseAssignments: weekData?.courseAssignments || [],
                };
              });
            }

            // Fetch and convert modules for this instance
            const modules = await fetchAndConvertModules(programId);
            console.log(`[INSTANCES_LIST_GET] Fetched ${modules.length} modules for cohort instance`);

            // Create the instance
            const instanceData = {
              programId,
              organizationId,
              type: 'cohort' as const,
              cohortId,
              startDate: cohortData.startDate,
              endDate: cohortData.endDate,
              includeWeekends: programData.includeWeekends !== false,
              dailyFocusSlots: programData.dailyFocusSlots || 3,
              weeks,
              modules,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            const newInstanceRef = await adminDb.collection('program_instances').add(instanceData);
            console.log(`[INSTANCES_LIST_GET] Auto-created instance ${newInstanceRef.id} for cohort ${cohortId} with ${modules.length} modules`);

            // Return the newly created instance
            return NextResponse.json({
              instances: [{
                id: newInstanceRef.id,
                ...instanceData,
                weekCount: weeks.length,
                dayCount: weeks.reduce((sum, w) => sum + w.days.length, 0),
                cohortName: cohortData.name || 'Unknown Cohort',
              }],
              hasMore: false,
              offset: 0,
              limit,
              autoCreated: true,
            });
          }
        }
      } catch (createError) {
        console.error('[INSTANCES_LIST_GET] Auto-create failed:', createError);
        // Fall through to return empty results
      }
    }

    // Auto-create instance for individual enrollment if none exists
    if (enrollmentId && enrichedInstances.length === 0 && programId) {
      console.log(`[INSTANCES_LIST_GET] No instance found for enrollment ${enrollmentId}, auto-creating...`);

      try {
        // Fetch enrollment and program data
        const [enrollmentDoc, programDoc] = await Promise.all([
          adminDb.collection('program_enrollments').doc(enrollmentId).get(),
          adminDb.collection('programs').doc(programId).get(),
        ]);

        if (enrollmentDoc.exists && programDoc.exists) {
          const enrollmentData = enrollmentDoc.data();
          const programData = programDoc.data();

          // Verify ownership
          if (programData?.organizationId === organizationId && enrollmentData?.programId === programId) {
            const includeWeekends = programData.includeWeekends !== false;
            const daysPerWeek = includeWeekends ? 7 : 5;
            const totalDays = programData.lengthDays || 28;

            // Calculate calendar weeks from enrollment start date
            // Include ALL weeks (including Week 0 onboarding) for proper date mapping
            // Fallback: use startedAt or today if startDate is missing
            let calendarWeeks: CalendarWeek[] = [];
            const effectiveStartDate = enrollmentData.startDate || enrollmentData.startedAt || new Date().toISOString().split('T')[0];
            if (effectiveStartDate) {
              calendarWeeks = calculateCalendarWeeks(effectiveStartDate, totalDays, includeWeekends);
            }
            // Sort all calendar weeks by start day for consistent ordering
            const sortedCalendarWeeks = [...calendarWeeks].sort((a, b) => a.startDayIndex - b.startDayIndex);

            let weeks: Array<{
              id: string;
              weekNumber: number;
              templateWeekNumber?: number;
              moduleId?: string;
              name?: string;
              theme?: string;
              weeklyTasks: Array<{ id: string; label: string; [key: string]: unknown }>;
              weeklyHabits: unknown[];
              weeklyPrompt?: string;
              distribution?: string;
              startDayIndex?: number;
              endDayIndex?: number;
              days: ProgramInstanceDay[];
            }> = [];

            // Read from programs.weeks[] (embedded template weeks)
            if (programData.weeks && Array.isArray(programData.weeks) && programData.weeks.length > 0) {
              console.log(`[INSTANCES_LIST_GET] Using embedded weeks from program (${programData.weeks.length} weeks) for enrollment`);

              // Detect format: new format has weekNumber=0 (onboarding), old format starts at 1
              const hasOnboarding = programData.weeks.some((w: { weekNumber: number }) => w.weekNumber === 0);
              const isNewFormat = hasOnboarding;

              console.log(`[INSTANCES_LIST_GET] Template format for enrollment: ${isNewFormat ? 'NEW (0, 1-N, -1)' : 'OLD (1-N)'}`);

              // Map calendar weeks to instance weeks using weekNumber-based matching
              weeks = sortedCalendarWeeks.map((calendarWeek) => {
                type TemplateWeek = {
                  id?: string;
                  weekNumber: number;
                  moduleId?: string;
                  name?: string;
                  theme?: string;
                  description?: string;
                  startDayIndex?: number;
                  endDayIndex?: number;
                  weeklyTasks?: Array<{ id?: string; label: string }>;
                  weeklyHabits?: unknown[];
                  weeklyPrompt?: string;
                  distribution?: string;
                  // Client-facing summary fields
                  currentFocus?: string[];
                  notes?: string[];
                  manualNotes?: string;
                  // Linked resources
                  linkedCallEventIds?: string[];
                  linkedCourseIds?: string[];
                  linkedArticleIds?: string[];
                  linkedDownloadIds?: string[];
                  linkedLinkIds?: string[];
                  linkedQuestionnaireIds?: string[];
                  linkedSummaryIds?: string[];
                  // Resource assignments with cadence
                  resourceAssignments?: unknown[];
                  courseAssignments?: unknown[];
                };

                let templateWeek: TemplateWeek | undefined;

                if (isNewFormat) {
                  // NEW FORMAT: Direct weekNumber matching (0, 1, 2, ..., -1)
                  templateWeek = programData.weeks.find((w: TemplateWeek) => w.weekNumber === calendarWeek.weekNumber);
                } else {
                  // OLD FORMAT (Lazy Migration): Template weeks are [1, 2, 3, ..., N]
                  // Map by position: calendarWeek at index i → templateWeek at index i
                  const calendarIndex = sortedCalendarWeeks.indexOf(calendarWeek);
                  templateWeek = programData.weeks[calendarIndex];
                }

                const startDayIndex = calendarWeek.startDayIndex;
                const endDayIndex = calendarWeek.endDayIndex;

                // For partial weeks (e.g., Tue start), actualStartDayOfWeek=2 means we offset from Monday
                const actualStartDayOfWeek = calendarWeek.actualStartDayOfWeek || 1;
                const actualStartOffset = actualStartDayOfWeek - 1; // 0 for Mon, 1 for Tue, etc.

                // Helper to get calendar date for each day (offset by actualStartDayOfWeek)
                const getCalendarDateForDay = (dayOffset: number): string | undefined => {
                  if (!calendarWeek.startDate) return undefined;
                  const startDate = new Date(calendarWeek.startDate);
                  // Offset from Monday by actualStartOffset + dayOffset
                  // e.g., Tue start (offset=1), day 0 → Mon+1=Tue, day 1 → Mon+2=Wed
                  startDate.setDate(startDate.getDate() + actualStartOffset + dayOffset);
                  return startDate.toISOString().split('T')[0];
                };

                // Create only ACTIVE program days (not displayDaysCount which is for UI blur)
                // endDayIndex - startDayIndex + 1 = actual program days in this week
                const activeDaysCount = endDayIndex - startDayIndex + 1;
                let days: ProgramInstanceDay[] = [];
                for (let i = 0; i < activeDaysCount; i++) {
                  days.push({
                    dayIndex: i + 1,  // 1-based program day within this week
                    globalDayIndex: startDayIndex + i,
                    calendarDate: getCalendarDateForDay(i),
                    tasks: [],
                    habits: [],
                  });
                }

                // Prepare weeklyTasks with IDs
                const weeklyTasks = (templateWeek?.weeklyTasks || []).map((t) => ({
                  ...t,
                  id: t.id || crypto.randomUUID(),
                }));

                // Distribute tasks to days
                if (weeklyTasks.length > 0) {
                  days = distributeTasksToDays(
                    weeklyTasks,
                    days,
                    templateWeek?.distribution
                  );
                }

                return {
                  id: templateWeek?.id || crypto.randomUUID(),
                  weekNumber: calendarWeek.weekNumber, // Always use calendar weekNumber (0, 1, 2, ..., -1)
                  templateWeekNumber: templateWeek?.weekNumber, // Preserve original for reference
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
                  // Client-facing summary fields
                  currentFocus: templateWeek?.currentFocus,
                  notes: templateWeek?.notes,
                  manualNotes: templateWeek?.manualNotes,
                  // Linked resources
                  linkedCallEventIds: templateWeek?.linkedCallEventIds,
                  linkedCourseIds: templateWeek?.linkedCourseIds,
                  linkedArticleIds: templateWeek?.linkedArticleIds,
                  linkedDownloadIds: templateWeek?.linkedDownloadIds,
                  linkedLinkIds: templateWeek?.linkedLinkIds,
                  linkedQuestionnaireIds: templateWeek?.linkedQuestionnaireIds,
                  linkedSummaryIds: templateWeek?.linkedSummaryIds,
                  // Resource assignments with cadence and lesson mapping
                  resourceAssignments: templateWeek?.resourceAssignments || [],
                  courseAssignments: templateWeek?.courseAssignments || [],
                };
              });
            } else {
              // FALLBACK: Read from program_weeks collection (legacy data)
              console.log(`[INSTANCES_LIST_GET] Falling back to program_weeks collection for enrollment`);
              const weeksSnapshot = await adminDb.collection('program_weeks')
                .where('programId', '==', programId)
                .orderBy('weekNumber', 'asc')
                .get();

              // Detect format: new format has weekNumber=0 (onboarding), old format starts at 1
              const hasOnboarding = weeksSnapshot.docs.some(doc => doc.data().weekNumber === 0);
              const isNewFormat = hasOnboarding;

              console.log(`[INSTANCES_LIST_GET] Legacy collection format for enrollment: ${isNewFormat ? 'NEW (0, 1-N, -1)' : 'OLD (1-N)'}`);

              // Map calendar weeks to instance weeks using weekNumber-based matching
              weeks = sortedCalendarWeeks.map((calendarWeek) => {
                let weekDoc;
                let weekData;

                if (isNewFormat) {
                  // NEW FORMAT: Direct weekNumber matching
                  weekDoc = weeksSnapshot.docs.find(doc => doc.data().weekNumber === calendarWeek.weekNumber);
                  weekData = weekDoc?.data();
                } else {
                  // OLD FORMAT (Lazy Migration): Map by position
                  const calendarIndex = sortedCalendarWeeks.indexOf(calendarWeek);
                  weekDoc = weeksSnapshot.docs[calendarIndex];
                  weekData = weekDoc?.data();
                }

                const startDayIndex = calendarWeek.startDayIndex;
                const endDayIndex = calendarWeek.endDayIndex;

                // For partial weeks (e.g., Tue start), actualStartDayOfWeek=2 means we offset from Monday
                const actualStartDayOfWeek = calendarWeek.actualStartDayOfWeek || 1;
                const actualStartOffset = actualStartDayOfWeek - 1; // 0 for Mon, 1 for Tue, etc.

                // Helper to get calendar date for each day (offset by actualStartDayOfWeek)
                const getCalendarDateForDay = (dayOffset: number): string | undefined => {
                  if (!calendarWeek.startDate) return undefined;
                  const startDate = new Date(calendarWeek.startDate);
                  // Offset from Monday by actualStartOffset + dayOffset
                  // e.g., Tue start (offset=1), day 0 → Mon+1=Tue, day 1 → Mon+2=Wed
                  startDate.setDate(startDate.getDate() + actualStartOffset + dayOffset);
                  return startDate.toISOString().split('T')[0];
                };

                // Create only ACTIVE program days (not displayDaysCount which is for UI blur)
                // endDayIndex - startDayIndex + 1 = actual program days in this week
                const activeDaysCount = endDayIndex - startDayIndex + 1;
                let days: ProgramInstanceDay[] = [];
                for (let i = 0; i < activeDaysCount; i++) {
                  days.push({
                    dayIndex: i + 1,  // 1-based program day within this week
                    globalDayIndex: startDayIndex + i,
                    calendarDate: getCalendarDateForDay(i),
                    tasks: [],
                    habits: [],
                  });
                }

                // Prepare weeklyTasks with IDs
                const weeklyTasks = (weekData?.weeklyTasks || []).map((t: { id?: string; label: string }) => ({
                  ...t,
                  id: t.id || crypto.randomUUID(),
                }));

                // Distribute tasks to days
                if (weeklyTasks.length > 0) {
                  days = distributeTasksToDays(
                    weeklyTasks,
                    days,
                    weekData?.distribution
                  );
                }

                return {
                  id: weekDoc?.id || crypto.randomUUID(),
                  weekNumber: calendarWeek.weekNumber, // Always use calendar weekNumber
                  templateWeekNumber: weekData?.weekNumber, // Preserve original
                  moduleId: weekData?.moduleId,
                  name: weekData?.name,
                  theme: weekData?.theme,
                  description: weekData?.description,
                  weeklyTasks,
                  weeklyHabits: weekData?.weeklyHabits || [],
                  weeklyPrompt: weekData?.weeklyPrompt,
                  distribution: weekData?.distribution,
                  startDayIndex,
                  endDayIndex,
                  calendarStartDate: calendarWeek.startDate,
                  calendarEndDate: calendarWeek.endDate,
                  actualStartDayOfWeek: calendarWeek.actualStartDayOfWeek,
                  actualEndDayOfWeek: calendarWeek.actualEndDayOfWeek,
                  displayDaysCount: calendarWeek.displayDaysCount,
                  days,
                  // Client-facing summary fields
                  currentFocus: weekData?.currentFocus,
                  notes: weekData?.notes,
                  manualNotes: weekData?.manualNotes,
                  // Linked resources
                  linkedCallEventIds: weekData?.linkedCallEventIds,
                  linkedCourseIds: weekData?.linkedCourseIds,
                  linkedArticleIds: weekData?.linkedArticleIds,
                  linkedDownloadIds: weekData?.linkedDownloadIds,
                  linkedLinkIds: weekData?.linkedLinkIds,
                  linkedQuestionnaireIds: weekData?.linkedQuestionnaireIds,
                  linkedSummaryIds: weekData?.linkedSummaryIds,
                  // Resource assignments with cadence and lesson mapping
                  resourceAssignments: weekData?.resourceAssignments || [],
                  courseAssignments: weekData?.courseAssignments || [],
                };
              });
            }

            // Fetch and convert modules for this instance
            const modules = await fetchAndConvertModules(programId);
            console.log(`[INSTANCES_LIST_GET] Fetched ${modules.length} modules for enrollment instance`);

            // Create the instance for individual enrollment
            // Use effectiveStartDate (already calculated with fallbacks) for startDate
            const instanceData = {
              programId,
              organizationId,
              type: 'individual' as const,
              enrollmentId,
              userId: enrollmentData.userId,
              startDate: effectiveStartDate,  // Use effectiveStartDate with fallbacks
              endDate: enrollmentData.endDate,
              includeWeekends: programData.includeWeekends !== false,
              dailyFocusSlots: programData.dailyFocusSlots || 3,
              weeks,
              modules,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            const newInstanceRef = await adminDb.collection('program_instances').add(instanceData);
            console.log(`[INSTANCES_LIST_GET] Auto-created instance ${newInstanceRef.id} for enrollment ${enrollmentId} with ${modules.length} modules`);

            // Fetch user name for the response
            let userName = 'Unknown User';
            let userImageUrl: string | undefined;
            if (enrollmentData.userId) {
              const userDoc = await adminDb.collection('users').doc(enrollmentData.userId).get();
              const userData = userDoc.data();
              if (userData) {
                userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown User';
                userImageUrl = userData.imageUrl;
              }
            }

            // Return the newly created instance
            return NextResponse.json({
              instances: [{
                id: newInstanceRef.id,
                ...instanceData,
                weekCount: weeks.length,
                dayCount: weeks.reduce((sum, w) => sum + w.days.length, 0),
                userName,
                userImageUrl,
              }],
              hasMore: false,
              offset: 0,
              limit,
              autoCreated: true,
            });
          }
        }
      } catch (createError) {
        console.error('[INSTANCES_LIST_GET] Auto-create for enrollment failed:', createError);
        // Fall through to return empty results
      }
    }

    return NextResponse.json({
      instances: enrichedInstances,
      hasMore,
      offset,
      limit,
    });
  } catch (error) {
    console.error('[INSTANCES_LIST_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch instances' }, { status: 500 });
  }
}
