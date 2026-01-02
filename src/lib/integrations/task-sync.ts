/**
 * Task Sync Integration
 * 
 * Handles syncing tasks between the platform and external task managers
 * (Todoist and Asana).
 */

import { 
  getIntegration, 
  updateSyncStatus,
} from './token-manager';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { 
  TodoistSettings, 
  AsanaSettings, 
  TaskSyncRecord,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

interface InternalTask {
  id: string;
  type: 'daily_focus' | 'program_task' | 'coach_assigned';
  title: string;
  description?: string;
  dueDate?: string;  // ISO date string
  priority?: 'low' | 'medium' | 'high';
  clientUserId: string;
  completed?: boolean;
}

// =============================================================================
// TODOIST INTEGRATION
// =============================================================================

/**
 * Create a task in Todoist
 */
export async function createTodoistTask(
  orgId: string,
  task: InternalTask
): Promise<{ success: boolean; externalTaskId?: string; error?: string }> {
  try {
    const integration = await getIntegration(orgId, 'todoist', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Todoist not connected' };
    }

    const settings = integration.settings as TodoistSettings;

    // Build task payload
    const payload: Record<string, unknown> = {
      content: task.title,
      description: task.description || '',
    };

    // Add to project if configured
    if (settings.projectId) {
      payload.project_id = settings.projectId;
    }

    // Add due date if provided
    if (task.dueDate) {
      payload.due_date = task.dueDate.split('T')[0]; // YYYY-MM-DD format
    }

    // Map priority (Todoist uses 1-4, with 4 being highest)
    if (task.priority) {
      const priorityMap = { low: 1, medium: 2, high: 4 };
      payload.priority = priorityMap[task.priority];
    }

    // Add label if configured
    if (settings.labelId) {
      payload.labels = [settings.labelId];
    }

    const response = await fetch('https://api.todoist.com/rest/v2/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${integration.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[TODOIST] Create task failed:', error);
      await updateSyncStatus(orgId, integration.id, 'error', 'Failed to create task');
      return { success: false, error: 'Failed to create task in Todoist' };
    }

    const createdTask = await response.json();

    // Store sync record
    await storeSyncRecord(orgId, integration.id, 'todoist', task, createdTask.id);

    await updateSyncStatus(orgId, integration.id, 'success');

    console.log(`[TODOIST] Created task ${createdTask.id} for org ${orgId}`);

    return { success: true, externalTaskId: createdTask.id };
  } catch (error) {
    console.error('[TODOIST] Error creating task:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Complete a task in Todoist
 */
export async function completeTodoistTask(
  orgId: string,
  taskType: InternalTask['type'],
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const syncRecord = await getSyncRecord(orgId, 'todoist', taskType, taskId);
    
    if (!syncRecord) {
      return { success: true }; // Not synced, nothing to do
    }

    const integration = await getIntegration(orgId, 'todoist', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Todoist not connected' };
    }

    const response = await fetch(
      `https://api.todoist.com/rest/v2/tasks/${syncRecord.externalTaskId}/close`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      console.error('[TODOIST] Complete task failed:', error);
      return { success: false, error: 'Failed to complete task' };
    }

    // Update sync record
    await updateSyncRecordCompletion(orgId, syncRecord.id, true);

    return { success: true };
  } catch (error) {
    console.error('[TODOIST] Error completing task:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete a task from Todoist
 */
export async function deleteTodoistTask(
  orgId: string,
  taskType: InternalTask['type'],
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const syncRecord = await getSyncRecord(orgId, 'todoist', taskType, taskId);
    
    if (!syncRecord) {
      return { success: true };
    }

    const integration = await getIntegration(orgId, 'todoist', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Todoist not connected' };
    }

    const response = await fetch(
      `https://api.todoist.com/rest/v2/tasks/${syncRecord.externalTaskId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204 && response.status !== 404) {
      const error = await response.text();
      console.error('[TODOIST] Delete task failed:', error);
      return { success: false, error: 'Failed to delete task' };
    }

    // Delete sync record
    await deleteSyncRecord(orgId, syncRecord.id);

    return { success: true };
  } catch (error) {
    console.error('[TODOIST] Error deleting task:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// =============================================================================
// ASANA INTEGRATION
// =============================================================================

/**
 * Create a task in Asana
 */
export async function createAsanaTask(
  orgId: string,
  task: InternalTask
): Promise<{ success: boolean; externalTaskId?: string; error?: string }> {
  try {
    const integration = await getIntegration(orgId, 'asana', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Asana not connected' };
    }

    const settings = integration.settings as AsanaSettings;

    if (!settings.workspaceId) {
      return { success: false, error: 'Asana workspace not configured' };
    }

    // Build task payload
    const payload: Record<string, unknown> = {
      data: {
        name: task.title,
        notes: task.description || '',
        workspace: settings.workspaceId,
      },
    };

    // Add to project if configured
    if (settings.projectId) {
      (payload.data as Record<string, unknown>).projects = [settings.projectId];
    }

    // Add due date if provided
    if (task.dueDate) {
      (payload.data as Record<string, unknown>).due_on = task.dueDate.split('T')[0];
    }

    const response = await fetch('https://app.asana.com/api/1.0/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${integration.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[ASANA] Create task failed:', error);
      await updateSyncStatus(orgId, integration.id, 'error', 'Failed to create task');
      return { success: false, error: error.errors?.[0]?.message || 'Failed to create task' };
    }

    const result = await response.json();
    const createdTask = result.data;

    // Store sync record
    await storeSyncRecord(orgId, integration.id, 'asana', task, createdTask.gid);

    await updateSyncStatus(orgId, integration.id, 'success');

    console.log(`[ASANA] Created task ${createdTask.gid} for org ${orgId}`);

    return { success: true, externalTaskId: createdTask.gid };
  } catch (error) {
    console.error('[ASANA] Error creating task:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Complete a task in Asana
 */
export async function completeAsanaTask(
  orgId: string,
  taskType: InternalTask['type'],
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const syncRecord = await getSyncRecord(orgId, 'asana', taskType, taskId);
    
    if (!syncRecord) {
      return { success: true };
    }

    const integration = await getIntegration(orgId, 'asana', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Asana not connected' };
    }

    const response = await fetch(
      `https://app.asana.com/api/1.0/tasks/${syncRecord.externalTaskId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${integration.accessToken}`,
        },
        body: JSON.stringify({
          data: {
            completed: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[ASANA] Complete task failed:', error);
      return { success: false, error: 'Failed to complete task' };
    }

    // Update sync record
    await updateSyncRecordCompletion(orgId, syncRecord.id, true);

    return { success: true };
  } catch (error) {
    console.error('[ASANA] Error completing task:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete a task from Asana
 */
export async function deleteAsanaTask(
  orgId: string,
  taskType: InternalTask['type'],
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const syncRecord = await getSyncRecord(orgId, 'asana', taskType, taskId);
    
    if (!syncRecord) {
      return { success: true };
    }

    const integration = await getIntegration(orgId, 'asana', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Asana not connected' };
    }

    const response = await fetch(
      `https://app.asana.com/api/1.0/tasks/${syncRecord.externalTaskId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      console.error('[ASANA] Delete task failed:', error);
      return { success: false, error: 'Failed to delete task' };
    }

    // Delete sync record
    await deleteSyncRecord(orgId, syncRecord.id);

    return { success: true };
  } catch (error) {
    console.error('[ASANA] Error deleting task:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// =============================================================================
// UNIFIED TASK SYNC
// =============================================================================

/**
 * Sync a task to all connected task managers
 */
export async function syncTaskToExternalManagers(
  orgId: string,
  task: InternalTask
): Promise<{ todoist?: boolean; asana?: boolean }> {
  const results: { todoist?: boolean; asana?: boolean } = {};

  // Try Todoist
  try {
    const todoistResult = await createTodoistTask(orgId, task);
    results.todoist = todoistResult.success;
  } catch (error) {
    console.error('[TASK_SYNC] Todoist error:', error);
    results.todoist = false;
  }

  // Try Asana
  try {
    const asanaResult = await createAsanaTask(orgId, task);
    results.asana = asanaResult.success;
  } catch (error) {
    console.error('[TASK_SYNC] Asana error:', error);
    results.asana = false;
  }

  return results;
}

/**
 * Complete a task in all connected task managers
 */
export async function completeTaskInExternalManagers(
  orgId: string,
  taskType: InternalTask['type'],
  taskId: string
): Promise<{ todoist?: boolean; asana?: boolean }> {
  const results: { todoist?: boolean; asana?: boolean } = {};

  // Try Todoist
  try {
    const todoistResult = await completeTodoistTask(orgId, taskType, taskId);
    results.todoist = todoistResult.success;
  } catch (error) {
    console.error('[TASK_SYNC] Todoist complete error:', error);
    results.todoist = false;
  }

  // Try Asana
  try {
    const asanaResult = await completeAsanaTask(orgId, taskType, taskId);
    results.asana = asanaResult.success;
  } catch (error) {
    console.error('[TASK_SYNC] Asana complete error:', error);
    results.asana = false;
  }

  return results;
}

// =============================================================================
// SYNC RECORDS
// =============================================================================

/**
 * Store a sync record
 */
async function storeSyncRecord(
  orgId: string,
  integrationId: string,
  provider: 'todoist' | 'asana',
  task: InternalTask,
  externalTaskId: string
): Promise<void> {
  const syncRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('taskSyncRecords');

  await syncRef.add({
    integrationId,
    provider,
    internalTaskType: task.type,
    internalTaskId: task.id,
    clientUserId: task.clientUserId,
    externalTaskId,
    externalProjectId: null,
    lastSyncedAt: FieldValue.serverTimestamp(),
    syncDirection: 'pushed',
    isCompleted: task.completed || false,
  });
}

/**
 * Get a sync record
 */
async function getSyncRecord(
  orgId: string,
  provider: 'todoist' | 'asana',
  taskType: InternalTask['type'],
  taskId: string
): Promise<TaskSyncRecord | null> {
  const syncRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('taskSyncRecords');

  const snapshot = await syncRef
    .where('provider', '==', provider)
    .where('internalTaskType', '==', taskType)
    .where('internalTaskId', '==', taskId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as TaskSyncRecord;
}

/**
 * Update sync record completion status
 */
async function updateSyncRecordCompletion(
  orgId: string,
  recordId: string,
  isCompleted: boolean
): Promise<void> {
  const syncRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('taskSyncRecords')
    .doc(recordId);

  await syncRef.update({
    isCompleted,
    lastSyncedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Delete a sync record
 */
async function deleteSyncRecord(orgId: string, recordId: string): Promise<void> {
  const syncRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('taskSyncRecords')
    .doc(recordId);

  await syncRef.delete();
}

