/**
 * Cohort Week Content API
 * Manages cohort-specific week content (recordings, summaries, notes)
 *
 * GET - Fetch cohort week content (or empty template if none exists)
 * PUT - Create or update cohort week content (upsert)
 * PATCH - Partial update of cohort week content
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { CohortWeekContent, ProgramTaskTemplate } from '@/types';

/**
 * Process tasks to ensure each has a unique ID for robust matching.
 * Preserves existing IDs, generates new UUIDs for tasks without IDs.
 * Also strips runtime completion data that should never be stored in templates.
 */
function processTasksWithIds(tasks: ProgramTaskTemplate[] | undefined): ProgramTaskTemplate[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((task) => {
    // Strip runtime completion data - should never be stored in templates
    // These fields are populated at read time by merging with actual task status
    const { completed, completedAt, taskId, ...cleanTask } = task as ProgramTaskTemplate & {
      completed?: boolean;
      completedAt?: string;
      taskId?: string;
    };
    return {
      ...cleanTask,
      id: task.id || crypto.randomUUID(),
    };
  });
}

type RouteParams = { params: Promise<{ programId: string; cohortId: string; weekId: string }> };

/**
 * GET /api/coach/org-programs/[programId]/cohorts/[cohortId]/week-content/[weekId]
 * Returns the cohort-specific week content, or an empty template if none exists
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId, weekId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Verify cohort exists and belongs to this program
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists || cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Verify week exists and belongs to this program
    const weekDoc = await adminDb.collection('program_weeks').doc(weekId).get();
    if (!weekDoc.exists || weekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Try to find existing cohort week content
    const contentQuery = await adminDb
      .collection('cohort_week_content')
      .where('cohortId', '==', cohortId)
      .where('programWeekId', '==', weekId)
      .limit(1)
      .get();

    if (!contentQuery.empty) {
      const doc = contentQuery.docs[0];
      const content = {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data()?.createdAt?.toDate?.()?.toISOString?.() || doc.data()?.createdAt,
        updatedAt: doc.data()?.updatedAt?.toDate?.()?.toISOString?.() || doc.data()?.updatedAt,
      } as CohortWeekContent;

      return NextResponse.json({ content, exists: true });
    }

    // Return empty template (content doesn't exist yet)
    const emptyContent: Omit<CohortWeekContent, 'id' | 'createdAt' | 'updatedAt'> = {
      cohortId,
      programWeekId: weekId,
      programId,
      organizationId,
      coachRecordingUrl: undefined,
      coachRecordingNotes: undefined,
      linkedSummaryIds: [],
      linkedCallEventIds: [],
      manualNotes: undefined,
      weeklyTasks: [],
      weeklyHabits: [],
      weeklyPrompt: undefined,
      distribution: undefined,
    };

    return NextResponse.json({ content: emptyContent, exists: false });
  } catch (error) {
    console.error('[COHORT_WEEK_CONTENT_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch cohort week content' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-programs/[programId]/cohorts/[cohortId]/week-content/[weekId]
 * Create or update cohort week content (upsert)
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId, weekId } = await params;
    const body = await request.json();

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Verify cohort exists and belongs to this program
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists || cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Verify week exists and belongs to this program
    const weekDoc = await adminDb.collection('program_weeks').doc(weekId).get();
    if (!weekDoc.exists || weekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Check if content already exists
    const existingQuery = await adminDb
      .collection('cohort_week_content')
      .where('cohortId', '==', cohortId)
      .where('programWeekId', '==', weekId)
      .limit(1)
      .get();

    const contentData = {
      cohortId,
      programWeekId: weekId,
      programId,
      organizationId,
      coachRecordingUrl: body.coachRecordingUrl?.trim() || null,
      coachRecordingNotes: body.coachRecordingNotes?.trim() || null,
      linkedSummaryIds: body.linkedSummaryIds || [],
      linkedCallEventIds: body.linkedCallEventIds || [],
      manualNotes: body.manualNotes?.trim() || null,
      // Weekly tasks and distribution
      weeklyTasks: processTasksWithIds(body.weeklyTasks),
      weeklyHabits: body.weeklyHabits || [],
      weeklyPrompt: body.weeklyPrompt?.trim() || null,
      distribution: body.distribution || null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    let contentId: string;
    let isNew = false;

    if (!existingQuery.empty) {
      // Update existing
      contentId = existingQuery.docs[0].id;
      await adminDb.collection('cohort_week_content').doc(contentId).update(contentData);
      console.log(`[COHORT_WEEK_CONTENT_PUT] Updated content ${contentId}`);
    } else {
      // Create new
      const docRef = await adminDb.collection('cohort_week_content').add({
        ...contentData,
        createdAt: FieldValue.serverTimestamp(),
      });
      contentId = docRef.id;
      isNew = true;
      console.log(`[COHORT_WEEK_CONTENT_PUT] Created content ${contentId}`);
    }

    // Fetch the saved content
    const savedDoc = await adminDb.collection('cohort_week_content').doc(contentId).get();
    const savedContent = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
    } as CohortWeekContent;

    // Trigger task distribution to cohort days if requested
    let distributionResult = null;
    let syncResult = null;
    if (body.distributeTasksNow === true && body.weeklyTasks?.length > 0) {
      try {
        // Import dynamically to avoid circular dependency issues
        const { distributeCohortWeeklyTasksToDays } = await import('@/lib/program-utils');
        const programData = programDoc.data();
        distributionResult = await distributeCohortWeeklyTasksToDays(
          programId,
          weekId,
          cohortId,
          { 
            overwriteExisting: body.overwriteExistingTasks ?? false,
            programTaskDistribution: programData?.taskDistribution,
          }
        );
        console.log(`[COHORT_WEEK_CONTENT_PUT] Distributed tasks: ${JSON.stringify(distributionResult)}`);

        // Sync to cohort members
        const { syncProgramTasksToCohort } = await import('@/lib/sync-cohort-tasks');
        const today = new Date().toISOString().split('T')[0];
        syncResult = await syncProgramTasksToCohort({
          programId,
          cohortId,
          date: today,
          mode: 'fill-empty',
        });
        console.log(`[COHORT_WEEK_CONTENT_PUT] Synced to members: ${syncResult.totalTasksCreated} tasks created`);
      } catch (distErr) {
        console.error('[COHORT_WEEK_CONTENT_PUT] Distribution/sync failed:', distErr);
        // Don't fail the whole request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      content: savedContent,
      created: isNew,
      ...(distributionResult && { distribution: distributionResult }),
      ...(syncResult && { memberSync: { tasksCreated: syncResult.totalTasksCreated, membersProcessed: syncResult.membersProcessed } }),
    });
  } catch (error) {
    console.error('[COHORT_WEEK_CONTENT_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to save cohort week content' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/org-programs/[programId]/cohorts/[cohortId]/week-content/[weekId]
 * Partial update of cohort week content (creates if doesn't exist)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, cohortId, weekId } = await params;
    const body = await request.json();

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Verify cohort exists and belongs to this program
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (!cohortDoc.exists || cohortDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Verify week exists and belongs to this program
    const weekDoc = await adminDb.collection('program_weeks').doc(weekId).get();
    if (!weekDoc.exists || weekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Check if content already exists
    const existingQuery = await adminDb
      .collection('cohort_week_content')
      .where('cohortId', '==', cohortId)
      .where('programWeekId', '==', weekId)
      .limit(1)
      .get();

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.coachRecordingUrl !== undefined) {
      updateData.coachRecordingUrl = body.coachRecordingUrl?.trim() || null;
    }
    if (body.coachRecordingNotes !== undefined) {
      updateData.coachRecordingNotes = body.coachRecordingNotes?.trim() || null;
    }
    if (body.linkedSummaryIds !== undefined) {
      updateData.linkedSummaryIds = body.linkedSummaryIds || [];
    }
    if (body.linkedCallEventIds !== undefined) {
      updateData.linkedCallEventIds = body.linkedCallEventIds || [];
    }
    if (body.manualNotes !== undefined) {
      updateData.manualNotes = body.manualNotes?.trim() || null;
    }
    // Weekly tasks and distribution
    if (body.weeklyTasks !== undefined) {
      updateData.weeklyTasks = processTasksWithIds(body.weeklyTasks);
    }
    if (body.weeklyHabits !== undefined) {
      updateData.weeklyHabits = body.weeklyHabits || [];
    }
    if (body.weeklyPrompt !== undefined) {
      updateData.weeklyPrompt = body.weeklyPrompt?.trim() || null;
    }
    if (body.distribution !== undefined) {
      updateData.distribution = body.distribution || null;
    }

    let contentId: string;
    let isNew = false;

    if (!existingQuery.empty) {
      // Update existing
      contentId = existingQuery.docs[0].id;
      await adminDb.collection('cohort_week_content').doc(contentId).update(updateData);
      console.log(`[COHORT_WEEK_CONTENT_PATCH] Updated content ${contentId}`);
    } else {
      // Create new with provided fields
      const createData = {
        cohortId,
        programWeekId: weekId,
        programId,
        organizationId,
        coachRecordingUrl: null,
        coachRecordingNotes: null,
        linkedSummaryIds: [],
        linkedCallEventIds: [],
        manualNotes: null,
        weeklyTasks: [],
        weeklyHabits: [],
        weeklyPrompt: null,
        distribution: null,
        ...updateData,
        createdAt: FieldValue.serverTimestamp(),
      };
      const docRef = await adminDb.collection('cohort_week_content').add(createData);
      contentId = docRef.id;
      isNew = true;
      console.log(`[COHORT_WEEK_CONTENT_PATCH] Created content ${contentId}`);
    }

    // Fetch the saved content
    const savedDoc = await adminDb.collection('cohort_week_content').doc(contentId).get();
    const savedContent = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
    } as CohortWeekContent;

    // Trigger task distribution and sync to cohort members if requested
    let distributionResult = null;
    let syncResult = null;
    const hasWeeklyTasks = (updateData.weeklyTasks as ProgramTaskTemplate[] | undefined)?.length ?? 0 > 0;
    if (body.distributeTasksNow === true && hasWeeklyTasks) {
      try {
        const { distributeCohortWeeklyTasksToDays } = await import('@/lib/program-utils');
        const programData = programDoc.data();
        distributionResult = await distributeCohortWeeklyTasksToDays(
          programId,
          weekId,
          cohortId,
          { 
            overwriteExisting: body.overwriteExistingTasks ?? false,
            programTaskDistribution: programData?.taskDistribution,
          }
        );
        console.log(`[COHORT_WEEK_CONTENT_PATCH] Distributed tasks: ${JSON.stringify(distributionResult)}`);

        // Sync to cohort members
        const { syncProgramTasksToCohort } = await import('@/lib/sync-cohort-tasks');
        const today = new Date().toISOString().split('T')[0];
        syncResult = await syncProgramTasksToCohort({
          programId,
          cohortId,
          date: today,
          mode: 'fill-empty',
        });
        console.log(`[COHORT_WEEK_CONTENT_PATCH] Synced to members: ${syncResult.totalTasksCreated} tasks created`);
      } catch (distErr) {
        console.error('[COHORT_WEEK_CONTENT_PATCH] Distribution/sync failed:', distErr);
      }
    }

    return NextResponse.json({
      success: true,
      content: savedContent,
      created: isNew,
      ...(distributionResult && { distribution: distributionResult }),
      ...(syncResult && { memberSync: { tasksCreated: syncResult.totalTasksCreated, membersProcessed: syncResult.membersProcessed } }),
    });
  } catch (error) {
    console.error('[COHORT_WEEK_CONTENT_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update cohort week content' }, { status: 500 });
  }
}
