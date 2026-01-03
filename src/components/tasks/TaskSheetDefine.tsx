'use client';

import { useState, useEffect } from 'react';
import type { Task } from '@/types';
import { useDragToDismiss } from '@/hooks/useDragToDismiss';

interface TaskSheetDefineProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, isPrivate: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  task?: Task | null; // If provided, we're editing
}

export function TaskSheetDefine({
  isOpen,
  onClose,
  onSave,
  onDelete,
  task,
}: TaskSheetDefineProps) {
  const { sheetRef, handleRef, handleProps } = useDragToDismiss({ onClose });
  const [title, setTitle] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditMode = !!task;

  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title);
      setIsPrivate(task.isPrivate);
    } else if (isOpen && !task) {
      setTitle('');
      setIsPrivate(false);
    }
  }, [isOpen, task]);

  const handleSave = async () => {
    if (!title.trim()) return;

    // Capitalize first letter
    const capitalizedTitle = title.trim().charAt(0).toUpperCase() + title.trim().slice(1);

    setIsSaving(true);
    try {
      await onSave(capitalizedTitle, isPrivate);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container - Bottom sheet on mobile, centered card on desktop */}
      <div ref={sheetRef} className="relative w-full max-w-[500px] md:mx-4 bg-white dark:bg-[#171b22] rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
        {/* Grabber - Only on mobile (drag handle) */}
        <div ref={handleRef} {...handleProps} className="flex justify-center pt-3 pb-2 md:hidden touch-none select-none cursor-grab active:cursor-grabbing">
          <div className="w-9 h-1 bg-gray-300 dark:bg-[#262b35] rounded-full" />
        </div>

        {/* Close button - Desktop only */}
        <button
          onClick={onClose}
          className="hidden md:block absolute top-4 right-4 text-text-muted dark:text-[#7d8190] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="px-6 pt-5 md:pt-8 pb-5 space-y-4">
          {/* Title */}
          <p className="font-albert text-[20px] md:text-[24px] font-medium text-text-secondary dark:text-[#b2b6c2] leading-[1.3] tracking-[-1.5px]">
            {isEditMode ? 'Edit focus' : 'Define focus'}
          </p>

          {/* Question */}
          <p className="font-albert text-[28px] md:text-[36px] font-normal text-text-primary dark:text-[#f5f5f8] leading-[1.2] tracking-[-2px]">
            What positive step will you take?
          </p>

          {/* Input Area */}
          <div className="pt-6 pb-8 space-y-7">
            {/* Text Input (styled as placeholder) */}
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Write one thing you'll commit to today."
              className="w-full font-sans text-[20px] md:text-[24px] text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] leading-[1.2] tracking-[-0.5px] resize-none focus:outline-none min-h-[80px] bg-transparent dark:bg-transparent border-none appearance-none"
              rows={2}
              autoFocus
            />

            {/* Privacy Checkbox */}
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className="flex items-center gap-2 pt-6"
            >
              <div
                className={`w-4 h-4 rounded border ${
                  isPrivate
                    ? 'bg-accent-secondary border-accent-secondary'
                    : 'border-[#e1ddd8] dark:border-[#262b35]'
                } flex items-center justify-center`}
              >
                {isPrivate && (
                  <div className="w-2 h-2 bg-white rounded-sm" />
                )}
              </div>
              <span className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.2]">
                Keep this task private
              </span>
            </button>
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
      </div>
    </div>
  );
}

