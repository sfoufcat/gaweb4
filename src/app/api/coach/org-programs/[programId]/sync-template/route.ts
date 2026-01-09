/**
 * Coach API: Sync Template to Client Weeks
 *
 * POST /api/coach/org-programs/[programId]/sync-template
 *   Body: {
 *     enrollmentIds: string[] | 'all',
 *     syncOptions: TemplateSyncOptions,
 *     weekNumbers?: number[]  // Optional: sync specific weeks only
 *   }
 *
 * This endpoint syncs template week content to client-specific weeks.
 * It respects the sync options to preserve client-specific content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramWeek, ClientProgramWeek, TemplateSyncOptions, TemplateSyncResult } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body = await request.json();

    const { enrollmentIds, syncOptions = {}, weekNumbers } = body as {
      enrollmentIds: string[] | 'all';
      syncOptions?: TemplateSyncOptions;
      weekNumbers?: number[];
    };

    if (!enrollmentIds) {
      return NextResponse.json({ error: 'enrollmentIds is required (array or "all")' }, { status: 400 });
    }

    // Verify program exists, belongs to this org, and is an individual program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const program = programDoc.data();
    if (program?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }
    if (program?.type !== 'individual') {
      return NextResponse.json({ error: 'Template sync is only available for individual programs' }, { status: 400 });
    }

    // Fetch template weeks
    let templateWeeksQuery = adminDb
      .collection('program_weeks')
      .where('programId', '==', programId);

    const templateWeeksSnapshot = await templateWeeksQuery.orderBy('weekNumber', 'asc').get();

    if (templateWeeksSnapshot.empty) {
      return NextResponse.json({
        success: true,
        syncResult: {
          success: true,
          clientsUpdated: 0,
          weeksUpdated: 0,
        } as TemplateSyncResult,
        message: 'No template weeks to sync',
      });
    }

    // Filter template weeks by weekNumbers if provided
    let templateWeeks = templateWeeksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as (ProgramWeek & { id: string })[];

    if (weekNumbers && weekNumbers.length > 0) {
      templateWeeks = templateWeeks.filter(w => weekNumbers.includes(w.weekNumber));
    }

    // Determine which enrollments to sync
    let targetEnrollmentIds: string[] = [];

    if (enrollmentIds === 'all') {
      // Get all active enrollments for this program
      const enrollmentsSnapshot = await adminDb
        .collection('program_enrollments')
        .where('programId', '==', programId)
        .where('status', 'in', ['active', 'upcoming'])
        .get();

      targetEnrollmentIds = enrollmentsSnapshot.docs.map(doc => doc.id);
    } else {
      targetEnrollmentIds = enrollmentIds;
    }

    if (targetEnrollmentIds.length === 0) {
      return NextResponse.json({
        success: true,
        syncResult: {
          success: true,
          clientsUpdated: 0,
          weeksUpdated: 0,
        } as TemplateSyncResult,
        message: 'No enrollments to sync',
      });
    }

    const result: TemplateSyncResult = {
      success: true,
      clientsUpdated: 0,
      weeksUpdated: 0,
      errors: [],
    };

    const now = FieldValue.serverTimestamp();

    // Process each enrollment
    for (const enrollmentId of targetEnrollmentIds) {
      try {
        // Verify enrollment exists
        const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
        if (!enrollmentDoc.exists || enrollmentDoc.data()?.programId !== programId) {
          result.errors?.push({
            enrollmentId,
            userId: 'unknown',
            error: 'Enrollment not found or does not belong to this program',
          });
          continue;
        }

        const enrollment = enrollmentDoc.data()!;

        // Get existing client weeks for this enrollment
        const clientWeeksSnapshot = await adminDb
          .collection('client_program_weeks')
          .where('enrollmentId', '==', enrollmentId)
          .get();

        const existingClientWeeks = new Map<string, FirebaseFirestore.DocumentSnapshot>();
        clientWeeksSnapshot.docs.forEach(doc => {
          const data = doc.data();
          // Key by programWeekId (template week ID)
          existingClientWeeks.set(data.programWeekId, doc);
        });

        const batch = adminDb.batch();
        let weeksUpdatedForClient = 0;

        for (const templateWeek of templateWeeks) {
          const existingClientWeekDoc = existingClientWeeks.get(templateWeek.id);

          if (existingClientWeekDoc) {
            // Update existing client week
            const existingData = existingClientWeekDoc.data() as ClientProgramWeek;
            const updateData: Record<string, unknown> = {
              updatedAt: now,
              lastSyncedAt: now,
              hasLocalChanges: false,
              // Always sync positional info
              weekNumber: templateWeek.weekNumber,
              moduleId: templateWeek.moduleId,
              order: templateWeek.order,
              startDayIndex: templateWeek.startDayIndex,
              endDayIndex: templateWeek.endDayIndex,
            };

            // Sync content based on options
            if (syncOptions.syncTasks !== false) {
              updateData.weeklyTasks = templateWeek.weeklyTasks || null;
            }
            if (syncOptions.syncFocus !== false) {
              updateData.currentFocus = templateWeek.currentFocus || null;
            }
            if (syncOptions.syncNotes !== false) {
              updateData.notes = templateWeek.notes || null;
            }
            if (syncOptions.syncHabits !== false) {
              updateData.weeklyHabits = templateWeek.weeklyHabits || null;
            }
            if (syncOptions.syncPrompt !== false) {
              updateData.weeklyPrompt = templateWeek.weeklyPrompt || null;
            }

            // Sync name/theme based on options (default to true for backward compatibility)
            if (syncOptions.syncName !== false) {
              updateData.name = templateWeek.name || null;
              updateData.description = templateWeek.description || null;
            }
            if (syncOptions.syncTheme !== false) {
              updateData.theme = templateWeek.theme || null;
            }
            // Don't sync distribution - let it inherit from program setting
            // This allows each client week to fall back to the program's taskDistribution

            // Preserve client-specific content if requested
            if (syncOptions.preserveClientLinks) {
              // Don't overwrite linkedSummaryIds and linkedCallEventIds
              delete updateData.linkedSummaryIds;
              delete updateData.linkedCallEventIds;
            }
            if (syncOptions.preserveManualNotes && existingData.manualNotes) {
              // Don't overwrite manualNotes
              delete updateData.manualNotes;
            }
            if (syncOptions.preserveRecordings && (existingData.coachRecordingUrl || existingData.coachRecordingNotes)) {
              // Don't overwrite recording fields
              delete updateData.coachRecordingUrl;
              delete updateData.coachRecordingNotes;
            }

            batch.update(existingClientWeekDoc.ref, updateData);
            weeksUpdatedForClient++;
          } else {
            // Create new client week (template week was added after client content was initialized)
            const clientWeekRef = adminDb.collection('client_program_weeks').doc();
            const newClientWeek = {
              enrollmentId,
              programWeekId: templateWeek.id,
              programId,
              organizationId,
              userId: enrollment.userId,

              // Positional info
              weekNumber: templateWeek.weekNumber,
              moduleId: templateWeek.moduleId,
              order: templateWeek.order,
              startDayIndex: templateWeek.startDayIndex,
              endDayIndex: templateWeek.endDayIndex,

              // Content
              name: templateWeek.name || null,
              theme: templateWeek.theme || null,
              description: templateWeek.description || null,
              weeklyPrompt: templateWeek.weeklyPrompt || null,
              weeklyTasks: templateWeek.weeklyTasks || null,
              weeklyHabits: templateWeek.weeklyHabits || null,
              currentFocus: templateWeek.currentFocus || null,
              notes: templateWeek.notes || null,
              distribution: undefined, // Let it inherit from program setting

              // Client-specific (start empty)
              linkedSummaryIds: [],
              linkedCallEventIds: [],
              coachRecordingUrl: null,
              coachRecordingNotes: null,
              manualNotes: null,
              fillSource: null,

              // Sync tracking
              hasLocalChanges: false,
              lastSyncedAt: now,
              createdAt: now,
              updatedAt: now,
            };

            batch.set(clientWeekRef, newClientWeek);
            weeksUpdatedForClient++;
          }
        }

        await batch.commit();
        result.clientsUpdated++;
        result.weeksUpdated += weeksUpdatedForClient;

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.errors?.push({
          enrollmentId,
          userId: 'unknown',
          error: errorMessage,
        });
      }
    }

    // If there were any errors, mark success as false
    if (result.errors && result.errors.length > 0) {
      result.success = result.clientsUpdated > 0; // Partial success if some worked
    }

    console.log(`[COACH_SYNC_TEMPLATE] Synced ${result.weeksUpdated} weeks for ${result.clientsUpdated} clients in program ${programId}`);

    return NextResponse.json({
      success: result.success,
      syncResult: result,
      message: `Synced ${result.weeksUpdated} weeks for ${result.clientsUpdated} clients`,
    });
  } catch (error) {
    console.error('[COACH_SYNC_TEMPLATE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to sync template' }, { status: 500 });
  }
}
