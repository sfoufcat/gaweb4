/**
 * Task Sync API
 * 
 * POST /api/coach/integrations/tasks/sync
 * 
 * Sync a task to connected task managers (Todoist/Asana).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  syncTaskToExternalManagers,
  completeTaskInExternalManagers,
} from '@/lib/integrations';

interface SyncTaskRequest {
  action: 'create' | 'complete';
  task: {
    id: string;
    type: 'daily_focus' | 'program_task' | 'coach_assigned';
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high';
    clientUserId: string;
    completed?: boolean;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body: SyncTaskRequest = await req.json();
    const { action, task } = body;

    if (!action || !task) {
      return NextResponse.json(
        { error: 'Missing required fields: action, task' },
        { status: 400 }
      );
    }

    if (!['create', 'complete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: create or complete' },
        { status: 400 }
      );
    }

    if (!task.id || !task.type || !task.clientUserId) {
      return NextResponse.json(
        { error: 'Task must have id, type, and clientUserId' },
        { status: 400 }
      );
    }

    let results;

    if (action === 'create') {
      if (!task.title) {
        return NextResponse.json(
          { error: 'Task title is required for create action' },
          { status: 400 }
        );
      }

      results = await syncTaskToExternalManagers(organizationId, task);
    } else {
      results = await completeTaskInExternalManagers(
        organizationId,
        task.type,
        task.id
      );
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[TASK_SYNC_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



