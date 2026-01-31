'use client';

import { useState, useEffect } from 'react';
import { Flag, Lock } from 'lucide-react';
import type { Task, TaskPriority } from '@/types';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

interface TaskSheetDefineProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, isPrivate: boolean, priority?: TaskPriority) => Promise<void>;
  onDelete?: () => Promise<void>;
  task?: Task | null; // If provided, we're editing
}

const priorityColors = {
  high: 'text-red-500 dark:text-red-400',
  medium: 'text-orange-500 dark:text-orange-400',
  low: 'text-yellow-500 dark:text-yellow-400',
} as const;

export function TaskSheetDefine({
  isOpen,
  onClose,
  onSave,
  onDelete,
  task,
}: TaskSheetDefineProps) {
  const [title, setTitle] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Use dialog on desktop (md and above), drawer on mobile
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const isEditMode = !!task;

  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title);
      setIsPrivate(task.isPrivate);
      setPriority(task.priority);
    } else if (isOpen && !task) {
      setTitle('');
      setIsPrivate(false);
      setPriority(undefined);
    }
  }, [isOpen, task]);

  const handleSave = async () => {
    if (!title.trim()) return;

    // Capitalize first letter
    const capitalizedTitle = title.trim().charAt(0).toUpperCase() + title.trim().slice(1);

    setIsSaving(true);
    try {
      await onSave(capitalizedTitle, isPrivate, priority);
      onClose();
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Failed to delete task:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Cycle through priority: none → high → medium → low → none
  const cyclePriority = () => {
    if (!priority) setPriority('high');
    else if (priority === 'high') setPriority('medium');
    else if (priority === 'medium') setPriority('low');
    else setPriority(undefined);
  };

  // Shared content for both dialog and drawer
  const content = (
    <>
      {/* Content */}
      <div className="px-6 pt-5 md:pt-6 pb-5 space-y-4">
        {/* Title */}
        <p className="font-albert text-[20px] md:text-[24px] font-medium text-text-secondary dark:text-[#b2b6c2] leading-[1.3] tracking-[-1.5px]">
          {isEditMode ? 'Edit focus' : 'Define focus'}
        </p>

        {/* Question */}
        <p className="font-albert text-[28px] md:text-[36px] font-normal text-text-primary dark:text-[#f5f5f8] leading-[1.2] tracking-[-2px]">
          What positive step will you take?
        </p>

        {/* Input Area */}
        <div className="pt-6 pb-4">
          {/* Text Input (styled as placeholder) */}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Write one thing you'll commit to today."
            className="w-full font-sans text-[20px] md:text-[24px] text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] leading-[1.2] tracking-[-0.5px] resize-none focus:outline-none min-h-[80px] bg-transparent dark:bg-transparent border-none appearance-none"
            rows={2}
            autoFocus
          />

          {/* Priority & Private toggles - side by side */}
          <div className="flex items-center gap-2 pt-6">
            {/* Priority Toggle */}
            <button
              type="button"
              onClick={cyclePriority}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
                priority
                  ? `${priorityColors[priority]} border-current/30 bg-current/5`
                  : 'text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
              title={priority ? `Priority: ${priority}` : 'Set priority'}
            >
              <Flag className="w-4 h-4" fill={priority ? 'currentColor' : 'none'} />
              <span className="text-sm font-medium capitalize">
                {priority || 'Priority'}
              </span>
            </button>

            {/* Private Toggle */}
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
                isPrivate
                  ? 'text-brand-accent border-brand-accent/30 bg-brand-accent/5'
                  : 'text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
              title={isPrivate ? 'Private task' : 'Make private'}
            >
              <Lock className="w-4 h-4" strokeWidth={isPrivate ? 2.5 : 2} />
              <span className="text-sm font-medium">Private</span>
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 md:pb-8 pt-2 space-y-3">
        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!title.trim() || isSaving}
          className="w-full bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-[32px] py-3 md:py-4 font-bold text-[14px] md:text-[16px] tracking-[-0.5px] leading-[1.4] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        {/* Delete Button (only in edit mode) */}
        {isEditMode && onDelete && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full bg-white dark:bg-[#1e222a] border-[0.3px] border-[rgba(215,210,204,0.5)] dark:border-[#262b35] text-[#e74c3c] rounded-[32px] py-3 md:py-4 font-bold text-[14px] md:text-[16px] tracking-[-0.5px] leading-[1.4] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>
    </>
  );

  // Desktop: use Dialog
  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[500px] p-0 gap-0">
          <VisuallyHidden.Root>
            <DialogTitle>{isEditMode ? 'Edit focus' : 'Define focus'}</DialogTitle>
          </VisuallyHidden.Root>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: use Drawer
  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent className="max-w-[500px] mx-auto">
        <VisuallyHidden.Root>
          <DrawerTitle>{isEditMode ? 'Edit focus' : 'Define focus'}</DrawerTitle>
        </VisuallyHidden.Root>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
