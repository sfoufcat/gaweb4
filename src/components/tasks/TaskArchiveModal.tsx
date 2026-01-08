'use client';

import { useState, useEffect } from 'react';
import { Archive, RotateCcw, Loader2 } from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getTaskArchiveStatus } from '@/lib/task-archive-status';
import type { Task } from '@/types';

interface TaskArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void; // Callback to refresh task list
}

export function TaskArchiveModal({ isOpen, onClose, onRestore }: TaskArchiveModalProps) {
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Fetch archived tasks when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchArchivedTasks();
    }
  }, [isOpen]);

  const fetchArchivedTasks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tasks/archived');
      if (response.ok) {
        const data = await response.json();
        setArchivedTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching archived tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (taskId: string) => {
    setRestoringId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/restore`, {
        method: 'POST',
      });
      if (response.ok) {
        // Remove from local list
        setArchivedTasks((prev) => prev.filter((t) => t.id !== taskId));
        // Trigger parent refresh
        onRestore();
      }
    } catch (error) {
      console.error('Error restoring task:', error);
    } finally {
      setRestoringId(null);
    }
  };

  // Shared content for both Dialog and Drawer
  const content = (
    <div className="px-6 py-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#1d222b] flex items-center justify-center">
          <Archive className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
        </div>
        <div>
          <h2 className="font-albert text-[20px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
            Archived Tasks
          </h2>
          <p className="font-sans text-[12px] text-text-muted dark:text-[#7d8190]">
            Tasks are permanently deleted 30 days after archive
          </p>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : archivedTasks.length === 0 ? (
          <div className="text-center py-8 text-text-muted dark:text-[#7d8190]">
            <p className="font-sans text-[14px]">No archived tasks</p>
          </div>
        ) : (
          archivedTasks.map((task) => {
            const archiveStatus = getTaskArchiveStatus(task);
            return (
              <div
                key={task.id}
                className="bg-[#f3f1ef] dark:bg-[#1d222b] rounded-xl p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-albert text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] truncate">
                    {task.title}
                  </p>
                  <p className="font-sans text-[11px] text-text-muted dark:text-[#7d8190]">
                    {archiveStatus.daysUntilDelete > 0
                      ? `Deletes in ${archiveStatus.daysUntilDelete} day${archiveStatus.daysUntilDelete !== 1 ? 's' : ''}`
                      : 'Deletes soon'}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(task.id)}
                  disabled={restoringId === task.id}
                  className="p-2 rounded-lg bg-white dark:bg-[#262b35] text-text-secondary hover:text-brand-accent transition-colors disabled:opacity-50"
                  title="Restore to backlog"
                >
                  {restoringId === task.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="w-full mt-4 py-3 rounded-full bg-[#f3f1ef] dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8] font-sans font-medium text-[14px] hover:bg-[#e8e4e0] dark:hover:bg-[#262b35] transition-colors"
      >
        Close
      </button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[450px] p-0">{content}</DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-[500px] mx-auto">{content}</DrawerContent>
    </Drawer>
  );
}
