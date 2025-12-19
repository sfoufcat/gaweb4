'use client';

import { useState } from 'react';
import { X, Target, Check, Edit3 } from 'lucide-react';
import type { HelpCompleteTaskResponse } from '@/types';

interface AIHelpCompleteModalProps {
  response: HelpCompleteTaskResponse;
  task: { id: string; title: string };
  onUpdateTitle: (newTitle: string) => Promise<void>;
  onClose: () => void;
}

export function AIHelpCompleteModal({
  response,
  task,
  onUpdateTitle,
  onClose,
}: AIHelpCompleteModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const hasNewTitle = response.suggestedTaskTitle && response.suggestedTaskTitle !== task.title;
  
  async function handleUpdateTitle() {
    if (!response.suggestedTaskTitle) return;
    
    setIsUpdating(true);
    try {
      await onUpdateTitle(response.suggestedTaskTitle);
    } finally {
      setIsUpdating(false);
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#171b22] rounded-[24px] shadow-xl animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent-secondary dark:text-[#b8896a]" />
              <h3 className="font-albert text-[20px] text-text-primary dark:text-[#f5f5f8] font-semibold tracking-[-1px]">
                Plan to complete
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
          </div>
          
          {/* Task title */}
          <div className="mb-4 p-4 bg-[#f9f7f5] dark:bg-[#1d222b] rounded-[16px]">
            <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] uppercase tracking-wide mb-1">
              Your task
            </p>
            <p className="font-albert text-[18px] text-text-primary dark:text-[#f5f5f8] font-semibold tracking-[-0.5px]">
              &quot;{task.title}&quot;
            </p>
          </div>
        </div>
        
        {/* Breakdown Steps */}
        <div className="px-6 py-4">
          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] mb-3">
            Try this micro-plan:
          </p>
          
          <div className="space-y-3">
            {response.breakdown.map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-[#f9f7f5] dark:bg-[#1d222b] rounded-[12px]"
              >
                <div className="w-6 h-6 rounded-full bg-accent-secondary/20 dark:bg-[#b8896a]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="font-sans text-[12px] font-semibold text-accent-secondary dark:text-[#b8896a]">
                    {index + 1}
                  </span>
                </div>
                <p className="font-sans text-[14px] text-text-primary dark:text-[#f5f5f8] leading-[1.5]">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Suggested New Title */}
        {hasNewTitle && (
          <div className="px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-[16px]">
              <Edit3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-sans text-[12px] text-emerald-700 dark:text-emerald-400 mb-1">
                  Suggested clearer title:
                </p>
                <p className="font-albert text-[16px] text-emerald-800 dark:text-emerald-300 font-medium tracking-[-0.5px]">
                  &quot;{response.suggestedTaskTitle}&quot;
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-all"
          >
            Close
          </button>
          {hasNewTitle && (
            <button
              onClick={handleUpdateTitle}
              disabled={isUpdating}
              className={`flex-1 py-3 rounded-full font-sans text-[14px] font-medium flex items-center justify-center gap-2 transition-all ${
                isUpdating
                  ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-not-allowed'
                  : 'bg-emerald-500 dark:bg-emerald-600 text-white hover:opacity-90'
              }`}
            >
              <Check className="w-4 h-4" />
              {isUpdating ? 'Updating...' : 'Update task title'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}



