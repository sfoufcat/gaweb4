/**
 * Program Instance Module API
 *
 * Manage individual module content within a program instance
 *
 * GET /api/instances/[instanceId]/modules/[moduleId] - Get module content
 * PATCH /api/instances/[instanceId]/modules/[moduleId] - Update module content
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { ProgramInstance, ProgramInstanceModule, ProgramHabitTemplate } from '@/types';

type RouteParams = { params: Promise<{ instanceId: string; moduleId: string }> };

/**
 * GET /api/instances/[instanceId]/modules/[moduleId]
 *
 * Returns the module data from the instance
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId, moduleId } = await params;

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

    // Find the module by templateModuleId (more stable than instance UUID)
    const module = (instance.modules || []).find(m => m.templateModuleId === moduleId);
    if (!module) {
      return NextResponse.json({ error: 'Module not found in instance' }, { status: 404 });
    }

    return NextResponse.json({ module });
  } catch (error) {
    console.error('[INSTANCE_MODULE_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch module' }, { status: 500 });
  }
}

/**
 * PATCH /api/instances/[instanceId]/modules/[moduleId]
 *
 * Updates module content (name, description, habits)
 * Sets hasLocalChanges: true to protect customizations during future syncs
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId, moduleId } = await params;
    const body = await request.json();

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

    // Find the module index by templateModuleId (more stable than instance UUID)
    const modules = instance.modules || [];
    const moduleIndex = modules.findIndex(m => m.templateModuleId === moduleId);
    if (moduleIndex === -1) {
      return NextResponse.json({ error: 'Module not found in instance' }, { status: 404 });
    }

    const existingModule = modules[moduleIndex];
    const now = new Date().toISOString();

    // Build updated module - only allow updating specific fields
    const updatedModule: ProgramInstanceModule = {
      ...existingModule,
      // Updateable fields
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.habits !== undefined && { habits: body.habits as ProgramHabitTemplate[] }),
      // Mark as customized
      hasLocalChanges: true,
      updatedAt: now,
    };

    // Update the modules array
    const updatedModules = [...modules];
    updatedModules[moduleIndex] = updatedModule;

    // Update the instance
    await adminDb.collection('program_instances').doc(instanceId).update({
      modules: updatedModules,
      updatedAt: now,
    });

    console.log(`[INSTANCE_MODULE_PATCH] Updated module ${moduleId} in instance ${instanceId}`);

    // Auto-sync habits to enrolled users if habits were updated
    if (body.habits !== undefined) {
      try {
        // Get the program ID from the instance
        const programId = instance.programId;

        // Determine which enrollments to sync based on instance type
        let enrollmentsToSync: string[] = [];

        if (instance.type === 'cohort' && instance.cohortId) {
          // For cohort instances, get all enrollments in this cohort
          const enrollmentsSnapshot = await adminDb
            .collection('program_enrollments')
            .where('cohortId', '==', instance.cohortId)
            .where('status', 'in', ['active', 'upcoming'])
            .get();
          enrollmentsToSync = enrollmentsSnapshot.docs.map(d => d.id);
          console.log(`[INSTANCE_MODULE_PATCH] Found ${enrollmentsToSync.length} cohort enrollments to sync habits`);
        } else if (instance.type === 'individual' && instance.enrollmentId) {
          // For individual instances, just sync this enrollment
          enrollmentsToSync = [instance.enrollmentId];
        }

        // Sync habits for each enrollment
        // Import sync logic inline to avoid circular dependencies
        if (enrollmentsToSync.length > 0 && programId) {
          // Fetch program for includeWeekends setting
          const programDoc = await adminDb.collection('programs').doc(programId).get();
          const program = programDoc.data();
          const includeWeekends = program?.includeWeekends !== false;

          // Fetch template modules for fallback
          const modulesSnapshot = await adminDb
            .collection('program_modules')
            .where('programId', '==', programId)
            .orderBy('order', 'asc')
            .get();
          const templateModules = modulesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

          for (const enrollmentId of enrollmentsToSync) {
            const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
            if (!enrollmentDoc.exists) continue;

            const enrollment = enrollmentDoc.data();
            const userId = enrollment?.userId;
            if (!userId) continue;

            // Calculate current day index
            // Use startedAt, startDate, or default to today (for users who haven't started yet)
            const startDateStr = enrollment.startedAt || enrollment.startDate;
            let currentDayIndex = 1; // Default to day 1 if no start date or before start

            if (startDateStr) {
              const startDate = new Date(startDateStr);
              const today = new Date();
              startDate.setHours(0, 0, 0, 0);
              today.setHours(0, 0, 0, 0);

              if (includeWeekends) {
                currentDayIndex = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              } else {
                const current = new Date(startDate);
                let dayCount = 0;
                while (current <= today) {
                  const dayOfWeek = current.getDay();
                  if (dayOfWeek !== 0 && dayOfWeek !== 6) dayCount++;
                  current.setDate(current.getDate() + 1);
                }
                currentDayIndex = Math.max(1, dayCount);
              }
            }

            // Ensure day index is at least 1 (for users who haven't started or are before start)
            currentDayIndex = Math.max(1, currentDayIndex);

            // Find the current module (from instance modules)
            const instanceModules = updatedModules;
            const sortedModules = [...instanceModules].sort((a, b) => a.order - b.order);
            let currentModule = sortedModules.find(
              m => currentDayIndex >= m.startDayIndex && currentDayIndex <= m.endDayIndex
            );

            // Fallback: if no module found, use first module (for day 0/1 or users before start)
            if (!currentModule && sortedModules.length > 0) {
              const lastModule = sortedModules[sortedModules.length - 1];
              if (currentDayIndex > lastModule.endDayIndex) {
                currentModule = lastModule;
              } else {
                // User is before first module or in day 0/1 - use first module
                currentModule = sortedModules[0];
              }
            }

            if (!currentModule) {
              console.log(`[INSTANCE_MODULE_PATCH] No modules available for user ${userId}`);
              continue;
            }

            const habitsToSync = currentModule.habits || [];
            console.log(`[INSTANCE_MODULE_PATCH] Syncing ${habitsToSync.length} habits to user ${userId} (day ${currentDayIndex}, module ${currentModule.name})`);

            // Get existing habits for this user/program
            const existingHabitsSnapshot = await adminDb
              .collection('habits')
              .where('userId', '==', userId)
              .where('organizationId', '==', organizationId)
              .where('programId', '==', programId)
              .where('source', 'in', ['module_default', 'program_default'])
              .get();

            const existingByTitle = new Map<string, { id: string; archived?: boolean; moduleId?: string }>();
            existingHabitsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              existingByTitle.set(data.text, { id: doc.id, archived: data.archived, moduleId: data.moduleId });
            });

            // Archive habits not in current module
            const syncingTitles = new Set(habitsToSync.map(h => h.title));
            for (const [title, habit] of Array.from(existingByTitle.entries())) {
              if (!syncingTitles.has(title) && !habit.archived) {
                await adminDb.collection('habits').doc(habit.id).update({
                  archived: true,
                  status: 'archived',
                  updatedAt: now,
                });
              }
            }

            // Create or update habits (max 3)
            let count = 0;
            for (const template of habitsToSync) {
              if (count >= 3) break;

              const existing = existingByTitle.get(template.title);
              const frequencyType = template.frequency === 'daily' ? 'daily' : 'weekly_specific_days';
              const frequencyValue = template.frequency === 'daily' ? 1 :
                (template.frequency === 'weekday' ? [0, 1, 2, 3, 4] : (template.customDays || [0, 2, 4]));

              if (existing) {
                // Update existing
                await adminDb.collection('habits').doc(existing.id).update({
                  linkedRoutine: template.description || null,
                  frequencyType,
                  frequencyValue,
                  moduleId: currentModule.templateModuleId,
                  source: 'module_default',
                  archived: false,
                  status: 'active',
                  updatedAt: now,
                });
              } else {
                // Create new
                await adminDb.collection('habits').add({
                  userId,
                  organizationId,
                  text: template.title,
                  linkedRoutine: template.description || null,
                  frequencyType,
                  frequencyValue,
                  reminder: null,
                  targetRepetitions: null,
                  progress: { currentCount: 0, lastCompletedDate: null, completionDates: [], skipDates: [] },
                  archived: false,
                  status: 'active',
                  source: 'module_default',
                  programId,
                  moduleId: currentModule.templateModuleId,
                  createdAt: now,
                  updatedAt: now,
                });
              }
              count++;
            }
          }
          console.log(`[INSTANCE_MODULE_PATCH] Habit sync completed for ${enrollmentsToSync.length} enrollments`);
        }
      } catch (syncError) {
        // Log but don't fail the request - habit sync is secondary
        console.error('[INSTANCE_MODULE_PATCH] Error syncing habits:', syncError);
      }
    }

    return NextResponse.json({
      success: true,
      module: updatedModule,
    });
  } catch (error) {
    console.error('[INSTANCE_MODULE_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}
