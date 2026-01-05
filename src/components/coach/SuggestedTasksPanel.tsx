'use client';

import { useState, useEffect } from 'react';
import {
  Check,
  X,
  Loader2,
  ListTodo,
  Calendar,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { SuggestedTask } from '@/types';

interface SuggestedTasksPanelProps {
  clientUserId?: string;
  onTaskAssigned?: (task: SuggestedTask) => void;
  compact?: boolean;
}

/**
 * SuggestedTasksPanel
 *
 * Displays pending suggested tasks from call summaries for coach review.
 * Allows quick approve/reject/assign actions.
 */
export function SuggestedTasksPanel({
  clientUserId,
  onTaskAssigned,
  compact = false,
}: SuggestedTasksPanelProps) {
  const [tasks, setTasks] = useState<SuggestedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [clientUserId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        status: 'pending_review',
      });

      if (clientUserId) {
        params.set('clientUserId', clientUserId);
      }

      const response = await fetch(`/api/coach/suggested-tasks?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Error fetching suggested tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (
    taskId: string,
    action: 'approve' | 'reject' | 'assign',
    options?: { listType?: 'focus' | 'backlog'; date?: string }
  ) => {
    try {
      setProcessingId(taskId);

      const response = await fetch(`/api/coach/suggested-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...options }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      const data = await response.json();

      // Remove from list
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      if (action === 'assign' && onTaskAssigned) {
        onTaskAssigned(data.task);
      }
    } catch (err) {
      console.error('Error updating task:', err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="ghost" size="sm" onClick={fetchTasks} className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          No pending tasks to review
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-medium">
          <ListTodo className="h-4 w-4" />
          Suggested Tasks
          <Badge variant="secondary" className="ml-1">
            {tasks.length}
          </Badge>
        </h3>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <SuggestedTaskItem
            key={task.id}
            task={task}
            processing={processingId === task.id}
            compact={compact}
            onApprove={() => handleAction(task.id, 'approve')}
            onReject={() => handleAction(task.id, 'reject')}
            onAssign={(listType, date) =>
              handleAction(task.id, 'assign', { listType, date })
            }
          />
        ))}
      </div>
    </div>
  );
}

interface SuggestedTaskItemProps {
  task: SuggestedTask;
  processing: boolean;
  compact: boolean;
  onApprove: () => void;
  onReject: () => void;
  onAssign: (listType: 'focus' | 'backlog', date: string) => void;
}

function SuggestedTaskItem({
  task,
  processing,
  compact,
  onApprove,
  onReject,
  onAssign,
}: SuggestedTaskItemProps) {
  const [showAssignOptions, setShowAssignOptions] = useState(false);
  const [listType, setListType] = useState<'focus' | 'backlog'>('backlog');

  const today = new Date().toISOString().split('T')[0];

  const handleAssign = () => {
    onAssign(listType, today);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md border bg-card">
        <span className="flex-1 text-sm truncate">{task.title}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => onAssign('backlog', today)}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onReject}
            disabled={processing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{task.title}</p>
          {task.notes && (
            <p className="text-xs text-muted-foreground mt-1">{task.notes}</p>
          )}
        </div>
      </div>

      {showAssignOptions ? (
        <div className="mt-3 flex items-center gap-2">
          <Select
            value={listType}
            onValueChange={(v) => setListType(v as 'focus' | 'backlog')}
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="focus">Daily Focus</SelectItem>
              <SelectItem value="backlog">Backlog</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            className="h-8"
            onClick={handleAssign}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Calendar className="h-3 w-3 mr-1" />
                Assign
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setShowAssignOptions(false)}
            disabled={processing}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
            onClick={() => setShowAssignOptions(true)}
            disabled={processing}
          >
            <Check className="h-3 w-3 mr-1" />
            Assign
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={onApprove}
            disabled={processing}
          >
            Approve Only
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onReject}
            disabled={processing}
          >
            <X className="h-3 w-3 mr-1" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
