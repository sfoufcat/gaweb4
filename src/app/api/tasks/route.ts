import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateAlignmentForToday } from '@/lib/alignment';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Task, CreateTaskRequest, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/tasks?date=YYYY-MM-DD
 * Returns all tasks for a specific date for the authenticated user
 * Also migrates any pending tasks from previous days to today's backlog
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    // MULTI-TENANCY: Get effective org ID for filtering
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    // Fetch tasks for the requested date, filtered by organization
    let tasksRef = adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', date);
    
    // Filter by organization if available (multi-tenancy)
    if (organizationId) {
      tasksRef = tasksRef.where('organizationId', '==', organizationId);
    }

    const snapshot = await tasksRef.get();
    const tasks: Task[] = [];

    snapshot.forEach((doc) => {
      tasks.push({ id: doc.id, ...doc.data() } as Task);
    });

    // Try to migrate pending tasks from previous days (within same organization)
    // This is wrapped in try/catch so it doesn't break the API if index is missing
    try {
      let previousTasksQuery = adminDb
        .collection('tasks')
        .where('userId', '==', userId)
        .where('status', '==', 'pending')
        .where('date', '<', date);
      
      // Filter by organization for multi-tenancy
      if (organizationId) {
        previousTasksQuery = previousTasksQuery.where('organizationId', '==', organizationId);
      }
      
      const previousTasksSnapshot = await previousTasksQuery.get();

      // Migration attempted
      const tasksToMigrate: Task[] = [];
      previousTasksSnapshot.forEach((doc) => {
        tasksToMigrate.push({ id: doc.id, ...doc.data() } as Task);
      });

      // Migrate previous pending tasks to today's backlog
      if (tasksToMigrate.length > 0) {
        const backlogTasks = tasks.filter(t => t.listType === 'backlog');
        let maxBacklogOrder = backlogTasks.length > 0 ? Math.max(...backlogTasks.map(t => t.order)) : -1;

        const batch = adminDb.batch();
        const now = new Date().toISOString();

        for (const task of tasksToMigrate) {
          maxBacklogOrder++;
          const updatedTask: Task = {
            ...task,
            date, // Update to today
            listType: 'backlog', // Move to backlog
            order: maxBacklogOrder,
            updatedAt: now,
          };

          const taskRef = adminDb.collection('tasks').doc(task.id);
          batch.update(taskRef, {
            date,
            listType: 'backlog',
            order: maxBacklogOrder,
            updatedAt: now,
          });

          // Add to our tasks array for the response
          tasks.push(updatedTask);
        }

        // Commit all migrations in a batch
        await batch.commit();
        console.log(`✅ Migrated ${tasksToMigrate.length} pending tasks to ${date}`);
      }
    } catch (migrationError) {
      // If migration fails (likely due to missing index), log it but don't crash
      const errorMessage = migrationError instanceof Error ? migrationError.message : String(migrationError);
      console.error('⚠️  Task migration failed (this is OK if index is not created yet):', errorMessage);
      
      if (errorMessage && errorMessage.includes('index')) {
        console.error('');
        console.error('📋 ACTION REQUIRED: Create a Firestore Composite Index');
        console.error('   The migration query requires a composite index on the tasks collection.');
        console.error('   Please check your server logs for a link to create the index.');
        console.error('   After creating the index, wait a few minutes and refresh.');
        console.error('');
      }
      
      // Continue without migration - return today's tasks only
    }

    // Clean up completed backlog tasks from previous days (within same organization)
    // These tasks clutter the backlog and should be removed after the day ends
    try {
      let cleanupQuery = adminDb
        .collection('tasks')
        .where('userId', '==', userId)
        .where('status', '==', 'completed')
        .where('listType', '==', 'backlog')
        .where('date', '<', date);
      
      // Filter by organization for multi-tenancy
      if (organizationId) {
        cleanupQuery = cleanupQuery.where('organizationId', '==', organizationId);
      }
      
      const completedBacklogSnapshot = await cleanupQuery.get();

      if (!completedBacklogSnapshot.empty) {
        const batch = adminDb.batch();
        completedBacklogSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`🧹 Cleaned up ${completedBacklogSnapshot.size} completed backlog tasks from previous days`);
      }
    } catch (cleanupError) {
      // If cleanup fails (likely due to missing index), log it but don't crash
      const errorMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      console.error('⚠️  Backlog cleanup failed (this is OK if index is not created yet):', errorMessage);
    }

    // Sort by listType (focus first) then by order
    tasks.sort((a, b) => {
      if (a.listType === b.listType) {
        return a.order - b.order;
      }
      return a.listType === 'focus' ? -1 : 1;
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch tasks', message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Creates a new task
 * 
 * Supports optional program fields:
 * - sourceType: 'user' | 'program' (defaults to 'user')
 * - programEnrollmentId: string (if task is from a program)
 * - programDayIndex: number (which program day this task is from)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateTaskRequest = await request.json();
    const { 
      title, 
      date, 
      isPrivate, 
      listType,
      // Program-related fields (optional)
      sourceType,
      programEnrollmentId,
      programDayIndex,
    } = body;

    // Validation
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Get existing tasks for this date to determine order and listType (within org)
    const existingTasksSnapshot = await adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('date', '==', date)
      .get();

    const existingTasks: Task[] = [];
    existingTasksSnapshot.forEach((doc) => {
      existingTasks.push({ id: doc.id, ...doc.data() } as Task);
    });

    // Count tasks in focus list
    const focusTasks = existingTasks.filter((t) => t.listType === 'focus');
    const backlogTasks = existingTasks.filter((t) => t.listType === 'backlog');

    // Determine listType: if focus has < 3 tasks, add to focus, otherwise backlog
    let finalListType: 'focus' | 'backlog' = listType || (focusTasks.length < 3 ? 'focus' : 'backlog');

    // If explicitly requesting focus but focus is full, move to backlog
    if (finalListType === 'focus' && focusTasks.length >= 3) {
      finalListType = 'backlog';
    }

    // Determine order: add to end of the list
    const tasksInList = finalListType === 'focus' ? focusTasks : backlogTasks;
    const maxOrder = tasksInList.length > 0 ? Math.max(...tasksInList.map((t) => t.order)) : -1;
    const order = maxOrder + 1;

    const now = new Date().toISOString();
    const taskData: Omit<Task, 'id'> = {
      userId,
      organizationId,                    // Multi-tenancy: scope task to organization
      title: title.trim(),
      status: 'pending',
      listType: finalListType,
      order,
      date,
      isPrivate: isPrivate || false,
      createdAt: now,
      updatedAt: now,
      // Program-related fields (defaults to user-created task)
      sourceType: sourceType || 'user',
      programEnrollmentId: programEnrollmentId || null,
      programDayIndex: programDayIndex || null,
    };

    const docRef = await adminDb.collection('tasks').add(taskData);
    const task: Task = { id: docRef.id, ...taskData };

    // Update alignment when a focus task is created for today (org-scoped)
    const today = new Date().toISOString().split('T')[0];
    if (finalListType === 'focus' && date === today) {
      try {
        await updateAlignmentForToday(userId, organizationId, { didSetTasks: true });
      } catch (alignmentError) {
        // Don't fail task creation if alignment update fails
        console.error('[TASKS] Alignment update failed:', alignmentError);
      }
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task', message: errorMessage },
      { status: 500 }
    );
  }
}

