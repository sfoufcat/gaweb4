/**
 * Debug API: Analyze program tasks to find source of unexpected tasks
 *
 * GET /api/tasks/debug-program-tasks - List all program tasks with their source info
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const organizationId = await getEffectiveOrgId();

    // Get all tasks for today
    const tasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', date)
      .get();

    // Get user's active enrollments
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    const enrollments = enrollmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Enhanced task info type
    type TaskInfo = {
      id: string;
      title: string;
      instanceId?: string;
      instanceTaskId?: string;
      enrollmentId?: string;
      dayIndex?: number;
      sourceType?: string;
      source?: string;
      createdAt?: string;
      organizationId?: string;
    };

    // Group tasks by source
    const tasksBySource: Record<string, TaskInfo[]> = {
      program: [],
      user: [],
      other: [],
    };

    // Collect unique instance IDs and enrollment IDs from tasks
    const instanceIds = new Set<string>();
    const enrollmentIds = new Set<string>();

    // ALL tasks for detailed inspection
    const allTasks: TaskInfo[] = [];

    tasksSnapshot.forEach((doc) => {
      const data = doc.data();
      const task: TaskInfo = {
        id: doc.id,
        title: data.title || data.label || 'Untitled',
        instanceId: data.instanceId,
        instanceTaskId: data.instanceTaskId,
        enrollmentId: data.programEnrollmentId,
        dayIndex: data.dayIndex || data.programDayIndex,
        sourceType: data.sourceType,
        source: data.source,
        createdAt: data.createdAt,
        organizationId: data.organizationId,
      };

      allTasks.push(task);

      if (data.instanceId) instanceIds.add(data.instanceId);
      if (data.programEnrollmentId) enrollmentIds.add(data.programEnrollmentId);

      if (data.sourceType === 'program' || data.sourceType === 'program_day' || data.sourceType === 'program_week' || data.source === 'program') {
        tasksBySource.program.push(task);
      } else if (!data.sourceType || data.sourceType === 'user') {
        tasksBySource.user.push(task);
      } else {
        tasksBySource.other.push(task);
      }
    });

    // Get instance details
    const instances: Record<string, { programId: string; type: string; cohortId?: string; enrollmentId?: string }> = {};
    for (const instanceId of instanceIds) {
      const doc = await adminDb.collection('program_instances').doc(instanceId).get();
      if (doc.exists) {
        const data = doc.data()!;
        instances[instanceId] = {
          programId: data.programId,
          type: data.type,
          cohortId: data.cohortId,
          enrollmentId: data.enrollmentId,
        };
      }
    }

    // Get program names
    const programIds = new Set<string>();
    Object.values(instances).forEach(i => programIds.add(i.programId));
    enrollments.forEach(e => {
      const enrollment = e as { programId?: string };
      if (enrollment.programId) programIds.add(enrollment.programId);
    });

    const programs: Record<string, string> = {};
    for (const programId of programIds) {
      const doc = await adminDb.collection('programs').doc(programId).get();
      if (doc.exists) {
        programs[programId] = doc.data()?.name || 'Unknown';
      }
    }

    // Check for mismatched enrollments (tasks from enrollments user shouldn't have)
    const userEnrollmentIds = new Set(enrollments.map(e => e.id));
    const orphanedTasks = tasksBySource.program.filter(t =>
      t.enrollmentId && !userEnrollmentIds.has(t.enrollmentId)
    );

    // Find tasks with instanceIds that don't match user's enrollments
    const userInstanceIds = new Set<string>();
    for (const enrollment of enrollments) {
      const e = enrollment as { id: string; cohortId?: string };
      // Individual enrollment instance
      const indivDoc = await adminDb.collection('program_instances')
        .where('enrollmentId', '==', e.id)
        .where('type', '==', 'individual')
        .limit(1)
        .get();
      if (!indivDoc.empty) {
        userInstanceIds.add(indivDoc.docs[0].id);
      }
      // Cohort instance
      if (e.cohortId) {
        const cohortDoc = await adminDb.collection('program_instances')
          .where('cohortId', '==', e.cohortId)
          .where('type', '==', 'cohort')
          .limit(1)
          .get();
        if (!cohortDoc.empty) {
          userInstanceIds.add(cohortDoc.docs[0].id);
        }
      }
    }

    // Tasks from instances user shouldn't have access to
    const tasksFromWrongInstances = allTasks.filter(t =>
      t.instanceId && !userInstanceIds.has(t.instanceId)
    );

    // Tasks with program source but no instance (old system - potentially leaked)
    const programTasksWithoutInstance = allTasks.filter(t =>
      (t.sourceType === 'program' || t.source === 'program') && !t.instanceId
    );

    return NextResponse.json({
      success: true,
      date,
      organizationId,
      summary: {
        totalTasks: tasksSnapshot.size,
        programTasks: tasksBySource.program.length,
        userTasks: tasksBySource.user.length,
        otherTasks: tasksBySource.other.length,
        activeEnrollments: enrollments.length,
        orphanedTasks: orphanedTasks.length,
        tasksFromWrongInstances: tasksFromWrongInstances.length,
        programTasksWithoutInstance: programTasksWithoutInstance.length,
      },
      activeEnrollments: enrollments.map(e => {
        const enrollment = e as { id: string; programId: string; cohortId?: string; organizationId?: string };
        return {
          id: enrollment.id,
          programId: enrollment.programId,
          programName: programs[enrollment.programId] || 'Unknown',
          cohortId: enrollment.cohortId,
          organizationId: enrollment.organizationId,
        };
      }),
      userInstanceIds: Array.from(userInstanceIds),
      programTasks: tasksBySource.program.map(t => ({
        ...t,
        instanceInfo: t.instanceId ? instances[t.instanceId] : null,
        programName: t.instanceId && instances[t.instanceId]
          ? programs[instances[t.instanceId].programId]
          : 'Unknown',
        isOrphan: t.enrollmentId ? !userEnrollmentIds.has(t.enrollmentId) : false,
        isFromWrongInstance: t.instanceId ? !userInstanceIds.has(t.instanceId) : false,
      })),
      tasksFromWrongInstances,
      programTasksWithoutInstance,
      allTasks, // Full list for debugging
      orphanedTasks: orphanedTasks.length > 0 ? orphanedTasks : 'None - all tasks match active enrollments',
    });
  } catch (error) {
    console.error('[DEBUG_PROGRAM_TASKS] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
