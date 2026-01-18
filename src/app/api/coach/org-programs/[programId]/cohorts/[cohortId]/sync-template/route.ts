/**
 * Coach API: Sync Template to Cohort
 *
 * POST /api/coach/org-programs/[programId]/cohorts/[cohortId]/sync-template
 *
 * Syncs template week content (program_weeks) to cohort-specific weeks (cohort_week_content).
 * This populates the Editor Layer for cohorts from the Template Layer.
 *
 * Body parameters:
 * - weekNumbers?: number[] - Optional: sync specific weeks only (omit for all)
 * - syncOptions: TemplateSyncOptions - What fields to sync
 * - distributeAfterSync?: boolean - Whether to distribute to days after syncing
 *
 * ARCHITECTURE NOTE:
 * This is the Template → Editor sync for cohorts.
 * Template (program_weeks) → Editor (cohort_week_content) → Distribution → cohort_program_days
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramWeek, CohortWeekContent, TemplateSyncOptions, ProgramTaskTemplate } from '@/types';

type RouteParams = { params: Promise<{ programId: string; cohortId: string }> };

interface SyncTemplateRequest {
  weekNumbers?: number[];
  syncOptions?: TemplateSyncOptions;
  distributeAfterSync?: boolean;
}

/**
 * Process tasks to ensure each has a unique ID for robust matching.
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => ({
    ...task,
    id: task.id || crypto.randomUUID(),
  }));
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId } = await params;
    const body: SyncTemplateRequest = await request.json();

    const { weekNumbers, syncOptions = {}, distributeAfterSync = false } = body;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data()!;
    if (program.type !== 'group') {
      return NextResponse.json(
        { error: 'Template sync to cohort is only available for group programs' },
        { status: 400 }
      );
    }

    // Verify cohort exists and belongs to this program
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists || cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Fetch template weeks
    const templateWeeksSnapshot = await adminDb
      .collection('program_weeks')
      .where('programId', '==', programId)
      .orderBy('weekNumber', 'asc')
      .get();

    if (templateWeeksSnapshot.empty) {
      return NextResponse.json({
        success: true,
        weeksUpdated: 0,
        message: 'No template weeks to sync',
      });
    }

    // Filter by weekNumbers if provided
    let templateWeeks = templateWeeksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as (ProgramWeek & { id: string })[];

    if (weekNumbers && weekNumbers.length > 0) {
      templateWeeks = templateWeeks.filter(w => weekNumbers.includes(w.weekNumber));
    }

    // Get existing cohort week content
    const existingContentSnapshot = await adminDb
      .collection('cohort_week_content')
      .where('cohortId', '==', cohortId)
      .get();

    const existingByWeekId = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    existingContentSnapshot.docs.forEach(doc => {
      const data = doc.data();
      existingByWeekId.set(data.programWeekId, doc);
    });

    const now = FieldValue.serverTimestamp();
    let weeksUpdated = 0;
    let weeksCreated = 0;

    // Process each template week
    for (const templateWeek of templateWeeks) {
      const existingDoc = existingByWeekId.get(templateWeek.id);

      // Build the sync data based on options
      const syncData: Record<string, unknown> = {
        updatedAt: now,
        lastSyncedAt: now,
        // Always sync positional info
        weekNumber: templateWeek.weekNumber,
        moduleId: templateWeek.moduleId,
        startDayIndex: templateWeek.startDayIndex,
        endDayIndex: templateWeek.endDayIndex,
      };

      // Sync content based on options (default to true for all)
      if (syncOptions.syncTasks !== false) {
        syncData.weeklyTasks = processTasksWithIds(templateWeek.weeklyTasks);
      }
      if (syncOptions.syncPrompt !== false) {
        syncData.weeklyPrompt = templateWeek.weeklyPrompt || null;
      }
      if (syncOptions.syncHabits !== false) {
        syncData.weeklyHabits = templateWeek.weeklyHabits || null;
      }
      if (syncOptions.syncName !== false) {
        syncData.name = templateWeek.name || null;
        syncData.description = templateWeek.description || null;
      }
      if (syncOptions.syncTheme !== false) {
        syncData.theme = templateWeek.theme || null;
      }
      if (syncOptions.syncFocus !== false) {
        syncData.currentFocus = templateWeek.currentFocus || null;
      }
      if (syncOptions.syncNotes !== false) {
        syncData.notes = templateWeek.notes || null;
      }

      if (existingDoc) {
        // Update existing cohort week content
        const existingData = existingDoc.data() as CohortWeekContent;

        // Preserve cohort-specific data if options say so
        if (syncOptions.preserveClientLinks) {
          delete syncData.linkedSummaryIds;
          delete syncData.linkedCallEventIds;
        }
        if (syncOptions.preserveManualNotes && existingData.manualNotes) {
          delete syncData.manualNotes;
        }
        if (syncOptions.preserveRecordings && (existingData.coachRecordingUrl || existingData.coachRecordingNotes)) {
          delete syncData.coachRecordingUrl;
          delete syncData.coachRecordingNotes;
        }

        await existingDoc.ref.update(syncData);
        weeksUpdated++;
      } else {
        // Create new cohort week content
        const newContent = {
          cohortId,
          programWeekId: templateWeek.id,
          programId,
          organizationId,
          // Initialize cohort-specific fields as empty
          coachRecordingUrl: null,
          coachRecordingNotes: null,
          linkedSummaryIds: [],
          linkedCallEventIds: [],
          manualNotes: null,
          // Content from template
          weeklyTasks: processTasksWithIds(templateWeek.weeklyTasks),
          weeklyHabits: templateWeek.weeklyHabits || [],
          weeklyPrompt: templateWeek.weeklyPrompt || null,
          name: templateWeek.name || null,
          description: templateWeek.description || null,
          theme: templateWeek.theme || null,
          currentFocus: templateWeek.currentFocus || null,
          notes: templateWeek.notes || null,
          distribution: null, // Inherit from program
          // Positional info
          weekNumber: templateWeek.weekNumber,
          moduleId: templateWeek.moduleId,
          startDayIndex: templateWeek.startDayIndex,
          endDayIndex: templateWeek.endDayIndex,
          // Timestamps
          createdAt: now,
          updatedAt: now,
          lastSyncedAt: now,
        };

        await adminDb.collection('cohort_week_content').add(newContent);
        weeksCreated++;
      }
    }

    console.log(
      `[COHORT_SYNC_TEMPLATE] Synced ${weeksUpdated + weeksCreated} weeks ` +
      `(${weeksCreated} created, ${weeksUpdated} updated) for cohort ${cohortId}`
    );

    // ALSO update program_instances collection (new architecture)
    // This ensures the UI (which reads from program_instances) gets the updated data
    try {
      const instancesSnapshot = await adminDb.collection('program_instances')
        .where('cohortId', '==', cohortId)
        .where('type', '==', 'cohort')
        .limit(1)
        .get();

      if (!instancesSnapshot.empty) {
        const instanceDoc = instancesSnapshot.docs[0];
        const instanceData = instanceDoc.data();
        const instanceWeeks = instanceData.weeks || [];

        // Update or add weeks based on template
        const updatedWeeks = [...instanceWeeks];
        for (const templateWeek of templateWeeks) {
          const weekIdx = updatedWeeks.findIndex(w => w.weekNumber === templateWeek.weekNumber);

          const weekUpdate: Record<string, unknown> = {
            weekNumber: templateWeek.weekNumber,
            moduleId: templateWeek.moduleId,
            startDayIndex: templateWeek.startDayIndex,
            endDayIndex: templateWeek.endDayIndex,
            updatedAt: new Date().toISOString(),
          };

          // Apply sync options
          if (syncOptions.syncTasks !== false) {
            weekUpdate.weeklyTasks = processTasksWithIds(templateWeek.weeklyTasks);
          }
          if (syncOptions.syncPrompt !== false) {
            weekUpdate.weeklyPrompt = templateWeek.weeklyPrompt || null;
          }
          if (syncOptions.syncHabits !== false) {
            weekUpdate.weeklyHabits = templateWeek.weeklyHabits || null;
          }
          if (syncOptions.syncName !== false) {
            weekUpdate.name = templateWeek.name || null;
            weekUpdate.description = templateWeek.description || null;
          }
          if (syncOptions.syncTheme !== false) {
            weekUpdate.theme = templateWeek.theme || null;
          }
          if (syncOptions.syncFocus !== false) {
            weekUpdate.currentFocus = templateWeek.currentFocus || null;
          }
          if (syncOptions.syncNotes !== false) {
            weekUpdate.notes = templateWeek.notes || null;
          }

          if (weekIdx >= 0) {
            // Preserve existing data if options say so
            const existing = updatedWeeks[weekIdx];
            if (syncOptions.preserveClientLinks) {
              weekUpdate.linkedSummaryIds = existing.linkedSummaryIds;
              weekUpdate.linkedCallEventIds = existing.linkedCallEventIds;
            }
            if (syncOptions.preserveManualNotes && existing.manualNotes) {
              weekUpdate.manualNotes = existing.manualNotes;
            }
            if (syncOptions.preserveRecordings && (existing.coachRecordingUrl || existing.coachRecordingNotes)) {
              weekUpdate.coachRecordingUrl = existing.coachRecordingUrl;
              weekUpdate.coachRecordingNotes = existing.coachRecordingNotes;
            }
            // Preserve days and calendar dates
            weekUpdate.days = existing.days || [];
            weekUpdate.calendarStartDate = existing.calendarStartDate;
            weekUpdate.calendarEndDate = existing.calendarEndDate;

            updatedWeeks[weekIdx] = { ...existing, ...weekUpdate };
          } else {
            // Add new week
            updatedWeeks.push({
              ...weekUpdate,
              days: [],
            });
          }
        }

        // Sort by weekNumber: 0 (onboarding), 1+ (regular), -1 (closing) last
        updatedWeeks.sort((a, b) => {
          if (a.weekNumber === -1) return 1;
          if (b.weekNumber === -1) return -1;
          return a.weekNumber - b.weekNumber;
        });

        await instanceDoc.ref.update({
          weeks: updatedWeeks,
          updatedAt: now,
          lastSyncedFromTemplate: now,
        });

        console.log(`[COHORT_SYNC_TEMPLATE] Also updated program_instances doc ${instanceDoc.id}`);
      } else {
        console.log(`[COHORT_SYNC_TEMPLATE] No program_instances doc found for cohort ${cohortId} (will be created on first access)`);
      }
    } catch (instanceErr) {
      console.error('[COHORT_SYNC_TEMPLATE] Failed to update program_instances (non-fatal):', instanceErr);
      // Don't fail the request - the old collection was updated successfully
    }

    // Optionally distribute to days after sync
    let distributionResult = null;
    if (distributeAfterSync) {
      try {
        const { distributeCohortWeeklyTasksToDays } = await import('@/lib/program-utils');

        // Distribute each synced week
        let totalCreated = 0;
        let totalUpdated = 0;
        for (const templateWeek of templateWeeks) {
          const result = await distributeCohortWeeklyTasksToDays(
            programId,
            templateWeek.id,
            cohortId,
            {
              overwriteExisting: true,
              programTaskDistribution: program.taskDistribution,
            }
          );
          totalCreated += result.created || 0;
          totalUpdated += result.updated || 0;
        }

        distributionResult = { daysCreated: totalCreated, daysUpdated: totalUpdated };
        console.log(`[COHORT_SYNC_TEMPLATE] Distributed: ${totalCreated} created, ${totalUpdated} updated`);
      } catch (distErr) {
        console.error('[COHORT_SYNC_TEMPLATE] Distribution failed:', distErr);
        // Don't fail the whole request
      }
    }

    return NextResponse.json({
      success: true,
      weeksUpdated: weeksUpdated + weeksCreated,
      weeksCreated,
      weeksModified: weeksUpdated,
      message: `Synced ${weeksUpdated + weeksCreated} weeks to cohort`,
      ...(distributionResult && { distribution: distributionResult }),
    });
  } catch (error) {
    console.error('[COHORT_SYNC_TEMPLATE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to sync template to cohort' }, { status: 500 });
  }
}
