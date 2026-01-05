/**
 * Admin API: Migrate Individual Program Content
 *
 * POST /api/admin/migrate/individual-program-content
 *
 * Migrates existing 1:1 (individual) program enrollments to have client-specific content.
 * For each enrollment in an individual program, copies template weeks to client_program_weeks.
 *
 * Query params:
 *   - programId: Optional - migrate specific program only
 *   - dryRun: If true, only report what would be migrated without making changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth, currentUser } from '@clerk/nextjs/server';
import type { Program, ProgramEnrollment, ProgramWeek, ClientProgramWeek } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a super admin (platform admin)
    const user = await currentUser();
    const isSuperAdmin = user?.publicMetadata?.role === 'super_admin';

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const specificProgramId = searchParams.get('programId');
    const dryRun = searchParams.get('dryRun') === 'true';

    const results = {
      programsProcessed: 0,
      enrollmentsProcessed: 0,
      clientWeeksCreated: 0,
      callSummariesRelinked: 0,
      errors: [] as Array<{ programId: string; enrollmentId?: string; error: string }>,
    };

    // Find all individual programs
    let programsQuery = adminDb
      .collection('programs')
      .where('type', '==', 'individual');

    if (specificProgramId) {
      programsQuery = programsQuery.where('__name__', '==', specificProgramId);
    }

    const programsSnapshot = await programsQuery.get();

    if (programsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No individual programs found to migrate',
        results,
        dryRun,
      });
    }

    console.log(`[MIGRATION] Found ${programsSnapshot.size} individual programs to process`);

    for (const programDoc of programsSnapshot.docs) {
      const program = { id: programDoc.id, ...programDoc.data() } as Program & { id: string };
      results.programsProcessed++;

      try {
        // Get all active/upcoming enrollments for this program
        const enrollmentsSnapshot = await adminDb
          .collection('program_enrollments')
          .where('programId', '==', program.id)
          .where('status', 'in', ['active', 'upcoming'])
          .get();

        if (enrollmentsSnapshot.empty) {
          console.log(`[MIGRATION] Program ${program.id} has no active enrollments, skipping`);
          continue;
        }

        // Get all template weeks for this program
        const templateWeeksSnapshot = await adminDb
          .collection('program_weeks')
          .where('programId', '==', program.id)
          .orderBy('weekNumber', 'asc')
          .get();

        if (templateWeeksSnapshot.empty) {
          console.log(`[MIGRATION] Program ${program.id} has no template weeks, skipping`);
          continue;
        }

        const templateWeeks = templateWeeksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as (ProgramWeek & { id: string })[];

        console.log(`[MIGRATION] Processing ${enrollmentsSnapshot.size} enrollments for program ${program.id} (${program.name})`);

        for (const enrollmentDoc of enrollmentsSnapshot.docs) {
          const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment & { id: string };
          results.enrollmentsProcessed++;

          try {
            // Check if client weeks already exist for this enrollment
            const existingClientWeeksSnapshot = await adminDb
              .collection('client_program_weeks')
              .where('enrollmentId', '==', enrollment.id)
              .limit(1)
              .get();

            if (!existingClientWeeksSnapshot.empty) {
              console.log(`[MIGRATION] Enrollment ${enrollment.id} already has client weeks, skipping`);
              continue;
            }

            if (dryRun) {
              // In dry run mode, just count what would be created
              results.clientWeeksCreated += templateWeeks.length;
              console.log(`[MIGRATION DRY RUN] Would create ${templateWeeks.length} client weeks for enrollment ${enrollment.id}`);
              continue;
            }

            // Create client weeks from template
            const batch = adminDb.batch();
            const now = new Date().toISOString();

            for (const templateWeek of templateWeeks) {
              const clientWeekRef = adminDb.collection('client_program_weeks').doc();

              const clientWeekData: Omit<ClientProgramWeek, 'id'> = {
                enrollmentId: enrollment.id,
                programWeekId: templateWeek.id,
                programId: program.id,
                organizationId: program.organizationId,
                userId: enrollment.userId,

                // Positional info
                weekNumber: templateWeek.weekNumber,
                moduleId: templateWeek.moduleId,
                order: templateWeek.order,
                startDayIndex: templateWeek.startDayIndex,
                endDayIndex: templateWeek.endDayIndex,

                // Content (copied from template)
                name: templateWeek.name,
                theme: templateWeek.theme,
                description: templateWeek.description,
                weeklyPrompt: templateWeek.weeklyPrompt,
                weeklyTasks: templateWeek.weeklyTasks,
                weeklyHabits: templateWeek.weeklyHabits,
                currentFocus: templateWeek.currentFocus,
                notes: templateWeek.notes,
                distribution: templateWeek.distribution || 'repeat-daily',

                // Client-specific (start empty, will be populated later)
                linkedSummaryIds: [],
                linkedCallEventIds: [],
                coachRecordingUrl: undefined,
                coachRecordingNotes: undefined,
                manualNotes: undefined,
                fillSource: undefined,

                // Sync tracking
                hasLocalChanges: false,
                lastSyncedAt: now,
                createdAt: now,
                updatedAt: now,
              };

              batch.set(clientWeekRef, clientWeekData);
              results.clientWeeksCreated++;
            }

            await batch.commit();
            console.log(`[MIGRATION] Created ${templateWeeks.length} client weeks for enrollment ${enrollment.id}`);

            // Re-link any existing call summaries for this client/program to their client weeks
            const summariesSnapshot = await adminDb
              .collection('call_summaries')
              .where('programId', '==', program.id)
              .where('clientUserId', '==', enrollment.userId)
              .get();

            if (!summariesSnapshot.empty) {
              for (const summaryDoc of summariesSnapshot.docs) {
                const summary = summaryDoc.data();

                // Find which template week this summary was linked to (if any)
                for (const templateWeek of templateWeeks) {
                  if (templateWeek.linkedSummaryIds?.includes(summaryDoc.id)) {
                    // Find the corresponding client week
                    const clientWeekSnapshot = await adminDb
                      .collection('client_program_weeks')
                      .where('enrollmentId', '==', enrollment.id)
                      .where('programWeekId', '==', templateWeek.id)
                      .limit(1)
                      .get();

                    if (!clientWeekSnapshot.empty) {
                      // Add the summary to the client week
                      await adminDb
                        .collection('client_program_weeks')
                        .doc(clientWeekSnapshot.docs[0].id)
                        .update({
                          linkedSummaryIds: [...(clientWeekSnapshot.docs[0].data().linkedSummaryIds || []), summaryDoc.id],
                          updatedAt: now,
                        });
                      results.callSummariesRelinked++;
                      console.log(`[MIGRATION] Re-linked summary ${summaryDoc.id} to client week ${clientWeekSnapshot.docs[0].id}`);
                    }
                    break; // Summary can only be in one week
                  }
                }
              }
            }

          } catch (enrollmentError) {
            const errorMessage = enrollmentError instanceof Error ? enrollmentError.message : 'Unknown error';
            results.errors.push({
              programId: program.id,
              enrollmentId: enrollment.id,
              error: errorMessage,
            });
            console.error(`[MIGRATION] Error processing enrollment ${enrollment.id}:`, enrollmentError);
          }
        }

      } catch (programError) {
        const errorMessage = programError instanceof Error ? programError.message : 'Unknown error';
        results.errors.push({
          programId: program.id,
          error: errorMessage,
        });
        console.error(`[MIGRATION] Error processing program ${program.id}:`, programError);
      }
    }

    console.log('[MIGRATION] Complete:', results);

    return NextResponse.json({
      success: results.errors.length === 0,
      message: dryRun
        ? `Dry run complete. Would create ${results.clientWeeksCreated} client weeks for ${results.enrollmentsProcessed} enrollments.`
        : `Migration complete. Created ${results.clientWeeksCreated} client weeks for ${results.enrollmentsProcessed} enrollments.`,
      results,
      dryRun,
    });
  } catch (error) {
    console.error('[MIGRATION] Error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
