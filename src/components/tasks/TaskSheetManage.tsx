'use client';

import type { Task } from '@/types';
import { Pencil, Trash2 } from 'lucide-react';

interface TaskSheetManageProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => Promise<void>;
  onNotYet: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  task: Task;
}

export function TaskSheetManage({
  isOpen,
  onClose,
  onComplete,
  onNotYet,
  onEdit,
  onDelete,
  task,
}: TaskSheetManageProps) {
  if (!isOpen) return null;

  const isCompleted = task.status === 'completed';

  const handleComplete = async () => {
    await onComplete();
    onClose();
  };

  const handleNotYet = () => {
    onNotYet();
    onClose();
  };

  const handleEdit = () => {
    onEdit();
    onClose();
  };

  const handleDelete = async () => {
    await onDelete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container - Bottom sheet on mobile, centered card on desktop */}
      <div className="relative w-full max-w-[500px] md:mx-4 bg-white dark:bg-[#171b22] rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
        {/* Grabber - Only on mobile */}
        <div className="flex justify-center pt-3 pb-2 md:hidden">
          <div className="w-9 h-1 bg-gray-300 dark:bg-[#262b35] rounded-full" />
        </div>

        {/* Close button - Desktop only */}
        <button
          onClick={onClose}
          className="hidden md:block absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="px-6 pt-5 md:pt-8 pb-0 space-y-4">
          {/* Title */}
          <p className="font-albert text-[20px] md:text-[24px] font-medium text-text-secondary dark:text-[#b2b6c2] leading-[1.3] tracking-[-1.5px]">
            Manage focus
          </p>

          {/* Question */}
          <p className="font-albert text-[28px] md:text-[36px] font-normal text-text-primary dark:text-[#f5f5f8] leading-[1.2] tracking-[-2px]">
            {isCompleted ? 'Well done!' : 'How did it go today?'}
          </p>

          {/* Task Card */}
          <div className="bg-[#f3f1ef] dark:bg-[#1e222a] rounded-[20px] p-4 flex items-center gap-3">
            {/* Task Title */}
            <div className="flex-1 min-w-0">
              <p className={`font-albert text-[16px] md:text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1px] truncate ${isCompleted ? 'line-through' : ''}`}>
                {task.title}
              </p>
            </div>

            {/* Edit Icon */}
            <button
              onClick={handleEdit}
              className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
            >
              <Pencil className="w-full h-full" strokeWidth={1.5} />
            </button>

            {/* Delete Icon */}
            <button
              onClick={handleDelete}
              className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 text-text-secondary dark:text-[#b2b6c2] hover:text-[#e74c3c] transition-colors"
            >
              <Trash2 className="w-full h-full" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6 md:pb-8 pt-6">
          {isCompleted ? (
            // If completed, show "Undo" button
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 md:py-4 px-4 rounded-full bg-white dark:bg-[#1e222a] text-text-primary dark:text-[#f5f5f8] border border-[#d7d2cc]/50 dark:border-[#262b35] font-sans font-bold text-[14px] md:text-[16px] tracking-[-0.5px] leading-[1.4] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleNotYet}
                className="flex-1 py-3 md:py-4 px-4 rounded-full bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] font-sans font-bold text-[14px] md:text-[16px] tracking-[-0.5px] leading-[1.4] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Mark incomplete
              </button>
            </>
          ) : (
            // If not completed, show normal completion buttons
            <>
              <button
                onClick={handleNotYet}
                className="flex-1 py-3 md:py-4 px-4 rounded-full bg-white dark:bg-[#1e222a] text-text-primary dark:text-[#f5f5f8] border border-[#d7d2cc]/50 dark:border-[#262b35] font-sans font-bold text-[14px] md:text-[16px] tracking-[-0.5px] leading-[1.4] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              >
                Not yet
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 py-3 md:py-4 px-4 rounded-full bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] font-sans font-bold text-[14px] md:text-[16px] tracking-[-0.5px] leading-[1.4] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                I did it!
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

