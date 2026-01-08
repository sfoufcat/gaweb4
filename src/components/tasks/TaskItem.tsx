'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, AlertTriangle } from 'lucide-react';
import { AITaskHelpButton } from '@/components/ai-support/AITaskHelpButton';
import { getTaskArchiveStatus, getArchiveWarningText } from '@/lib/task-archive-status';
import type { Task } from '@/types';

interface TaskItemProps {
  task: Task;
  onClick: () => void;
  isDraggable?: boolean;
  /** Track display name for program tasks (e.g., "Creator", "SaaS") */
  trackDisplayName?: string;
  /** Callback when task is updated (e.g., AI updates title) */
  onTaskUpdate?: () => void;
}

export function TaskItem({ task, onClick, isDraggable = true, trackDisplayName, onTaskUpdate }: TaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isCompleted = task.status === 'completed';
  const isProgramTask = task.sourceType === 'program';
  const archiveStatus = getTaskArchiveStatus(task);
  const showStaleWarning = task.listType === 'backlog' && archiveStatus.isStale && !isCompleted;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${
        isCompleted ? 'bg-[#f3f1ef] dark:bg-[#1d222b]' : 'bg-white dark:bg-[#171b22]'
      } rounded-[20px] p-4 transition-all duration-200`}
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle - Only apply drag listeners here */}
        {isDraggable && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-text-muted dark:text-[#7d8190] hover:text-text-secondary dark:hover:text-[#b2b6c2] transition-colors flex-shrink-0"
            onClick={(e) => e.stopPropagation()} // Prevent click from triggering task click
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

        {/* Clickable area - separate from drag handle */}
        <div
          onClick={onClick}
          className="flex items-center gap-2 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
        >
          {/* Checkbox with animated checkmark */}
          <div
            className={`w-6 h-6 rounded-md border ${
              isCompleted
                ? 'border-brand-accent'
                : 'border-[#e1ddd8] dark:border-[#262b35]'
            } flex items-center justify-center flex-shrink-0 transition-all duration-300 bg-white dark:bg-[#181d26]`}
          >
            {isCompleted && (
              <div className="w-4 h-4 bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300" />
            )}
          </div>

          {/* Title */}
          <p
            className={`flex-1 font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] transition-all duration-300 ${
              isCompleted ? 'line-through text-text-primary dark:text-[#f5f5f8]' : 'text-text-primary dark:text-[#f5f5f8]'
            }`}
          >
            {task.title}
          </p>

          {/* Private Indicator */}
          {task.isPrivate && (
            <div className="flex items-center gap-1 text-text-muted dark:text-[#7d8190] flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="font-sans text-[11px] leading-[1.2]">Private</span>
            </div>
          )}
        </div>

        {/* Stale Task Warning - shows when task has been in backlog 5+ days */}
        {showStaleWarning && (
          <div
            className="flex items-center text-amber-600 dark:text-amber-400 flex-shrink-0"
            title={getArchiveWarningText(archiveStatus)}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
        )}

        {/* AI Help Button - only show for incomplete tasks */}
        {!isCompleted && (
          <AITaskHelpButton task={{ id: task.id, title: task.title }} onTaskUpdate={onTaskUpdate} />
        )}
      </div>

      {/* Program Task Tag - "Pre-filled from your X Starter Program" */}
      {isProgramTask && trackDisplayName && (
        <p className="mt-2 ml-10 font-sans text-[11px] text-text-muted dark:text-[#7d8190] leading-[1.2]">
          Pre-filled from your {trackDisplayName} Starter Program
        </p>
      )}
    </div>
  );
}

// Non-draggable task item for backlog
export function TaskItemStatic({ task, onClick, trackDisplayName, onTaskUpdate }: Omit<TaskItemProps, 'isDraggable'>) {
  const isCompleted = task.status === 'completed';
  const isProgramTask = task.sourceType === 'program';
  const archiveStatus = getTaskArchiveStatus(task);
  const showStaleWarning = task.listType === 'backlog' && archiveStatus.isStale && !isCompleted;

  return (
    <div
      className={`${
        isCompleted ? 'bg-[#f3f1ef] dark:bg-[#1d222b]' : 'bg-white dark:bg-[#171b22]'
      } rounded-[20px] p-4 transition-all duration-200`}
    >
      <div className="flex items-center gap-2">
        {/* Clickable area for checkbox and title */}
        <div
          onClick={onClick}
          className="flex items-center gap-2 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
        >
          {/* Checkbox with animated checkmark */}
          <div
            className={`w-6 h-6 rounded-md border ${
              isCompleted
                ? 'border-brand-accent'
                : 'border-[#e1ddd8] dark:border-[#262b35]'
            } flex items-center justify-center flex-shrink-0 transition-all duration-300 bg-white dark:bg-[#181d26]`}
          >
            {isCompleted && (
              <div className="w-4 h-4 bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300" />
            )}
          </div>

          {/* Title */}
          <p
            className={`flex-1 font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] transition-all duration-300 ${
              isCompleted ? 'line-through text-text-primary dark:text-[#f5f5f8]' : 'text-text-primary dark:text-[#f5f5f8]'
            }`}
          >
            {task.title}
          </p>

          {/* Private Indicator */}
          {task.isPrivate && (
            <div className="flex items-center gap-1 text-text-muted dark:text-[#7d8190] flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="font-sans text-[11px] leading-[1.2]">Private</span>
            </div>
          )}
        </div>

        {/* Stale Task Warning - shows when task has been in backlog 5+ days */}
        {showStaleWarning && (
          <div
            className="flex items-center text-amber-600 dark:text-amber-400 flex-shrink-0"
            title={getArchiveWarningText(archiveStatus)}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
        )}

        {/* AI Help Button - only show for incomplete tasks */}
        {!isCompleted && (
          <AITaskHelpButton task={{ id: task.id, title: task.title }} onTaskUpdate={onTaskUpdate} />
        )}
      </div>

      {/* Program Task Tag - "Pre-filled from your X Starter Program" */}
      {isProgramTask && trackDisplayName && (
        <p className="mt-2 ml-8 font-sans text-[11px] text-text-muted dark:text-[#7d8190] leading-[1.2]">
          Pre-filled from your {trackDisplayName} Starter Program
        </p>
      )}
    </div>
  );
}

