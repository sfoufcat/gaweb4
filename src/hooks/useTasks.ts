import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '@/types';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface UseTasksOptions {
  date: string; // ISO date (YYYY-MM-DD)
}

interface UseTasksReturn {
  tasks: Task[];
  focusTasks: Task[];
  backlogTasks: Task[];
  isLoading: boolean;
  error: string | null;
  createTask: (data: Omit<CreateTaskRequest, 'date'>) => Promise<Task | null>;
  updateTask: (id: string, updates: UpdateTaskRequest) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  markComplete: (id: string) => Promise<Task | null>;
  reorderTasks: (reorderedTasks: Task[]) => Promise<boolean>;
  fetchTasks: () => Promise<void>;
}

export function useTasks({ date }: UseTasksOptions): UseTasksReturn {
  const { isDemoMode } = useDemoMode();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Demo tasks for demo mode
  const demoTasks: Task[] = useMemo(() => {
    if (!isDemoMode) return [];
    
    return [
      {
        id: 'demo-task-1',
        userId: 'demo-user',
        organizationId: 'demo-org',
        title: 'Complete morning workout routine 💪',
        status: 'completed',
        listType: 'focus' as const,
        order: 0,
        date,
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      {
        id: 'demo-task-2',
        userId: 'demo-user',
        organizationId: 'demo-org',
        title: 'Review weekly goals and progress',
        status: 'pending',
        listType: 'focus' as const,
        order: 1,
        date,
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-task-3',
        userId: 'demo-user',
        organizationId: 'demo-org',
        title: 'Read 20 pages of current book 📚',
        status: 'pending',
        listType: 'focus' as const,
        order: 2,
        date,
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-task-4',
        userId: 'demo-user',
        organizationId: 'demo-org',
        title: 'Prepare healthy meal plan for tomorrow',
        status: 'pending',
        listType: 'backlog' as const,
        order: 0,
        date,
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }, [isDemoMode, date]);

  // Fetch tasks for the specified date
  const fetchTasks = useCallback(async () => {
    // Demo mode: use demo tasks
    if (isDemoMode) {
      setTasks(demoTasks);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks?date=${date}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tasks');
      }

      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [date, isDemoMode, demoTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Create a new task
  const createTask = useCallback(
    async (data: Omit<CreateTaskRequest, 'date'>): Promise<Task | null> => {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, date }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create task');
        }

        // Optimistically update local state
        setTasks((prev) => {
          const newTasks = [...prev, result.task];
          // Sort by listType and order
          newTasks.sort((a, b) => {
            if (a.listType === b.listType) {
              return a.order - b.order;
            }
            return a.listType === 'focus' ? -1 : 1;
          });
          return newTasks;
        });

        return result.task;
      } catch (err) {
        console.error('Error creating task:', err);
        setError(err instanceof Error ? err.message : 'Failed to create task');
        return null;
      }
    },
    [date]
  );

  // Update a task
  const updateTask = useCallback(
    async (id: string, updates: UpdateTaskRequest): Promise<Task | null> => {
      try {
        const response = await fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update task');
        }

        // Optimistically update local state
        setTasks((prev) =>
          prev.map((task) => (task.id === id ? result.task : task))
        );

        return result.task;
      } catch (err) {
        console.error('Error updating task:', err);
        setError(err instanceof Error ? err.message : 'Failed to update task');
        return null;
      }
    },
    []
  );

  // Delete a task
  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete task');
      }

      // Optimistically update local state
      setTasks((prev) => prev.filter((task) => task.id !== id));

      return true;
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      return false;
    }
  }, []);

  // Mark task as complete
  const markComplete = useCallback(
    async (id: string): Promise<Task | null> => {
      return updateTask(id, { status: 'completed' });
    },
    [updateTask]
  );

  // Reorder tasks (after drag and drop)
  const reorderTasks = useCallback(async (reorderedTasks: Task[]): Promise<boolean> => {
    // FIRST: Optimistically update the UI immediately
    setTasks((prevTasks) => {
      // Get the IDs of tasks being reordered
      const _reorderedIds = new Set(reorderedTasks.map(t => t.id));
      
      // Keep tasks that aren't being reordered, update the ones that are
      const updatedTasks = prevTasks.map(task => {
        const reordered = reorderedTasks.find(rt => rt.id === task.id);
        return reordered || task;
      });
      
      // Sort by listType and order
      updatedTasks.sort((a, b) => {
        if (a.listType === b.listType) {
          return a.order - b.order;
        }
        return a.listType === 'focus' ? -1 : 1;
      });
      
      return updatedTasks;
    });

    // THEN: Sync with server in the background
    try {
      const updatePromises = reorderedTasks.map((task) =>
        fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: task.order, listType: task.listType }),
        })
      );

      const responses = await Promise.all(updatePromises);
      const allSucceeded = responses.every((res) => res.ok);

      if (!allSucceeded) {
        console.error('Some tasks failed to reorder on server');
        // Optionally refetch to get server state
        // await fetchTasks();
      }

      return allSucceeded;
    } catch (err) {
      console.error('Error reordering tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to reorder tasks');
      // Optionally refetch to restore server state
      // await fetchTasks();
      return false;
    }
  }, []);

  // Separate tasks by listType
  const focusTasks = tasks.filter((task) => task.listType === 'focus');
  const backlogTasks = tasks.filter((task) => task.listType === 'backlog');

  return {
    tasks,
    focusTasks,
    backlogTasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    markComplete,
    reorderTasks,
    fetchTasks,
  };
}

