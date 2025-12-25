'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Target, Edit3, Sparkles } from 'lucide-react';
import type { HelpCompleteTaskResponse } from '@/types';

interface AIHelpCompleteModalProps {
  response: HelpCompleteTaskResponse | null;
  task: { id: string; title: string };
  isLoading?: boolean;
  error?: string | null;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  onClose: () => void;
}

// AI Loading Skeleton Component
function AILoadingSkeleton() {
  return (
    <div className="flex flex-col items-center py-8">
      {/* Animated Sparkles Icon */}
      <div className="w-16 h-16 rounded-full bg-[#a07855]/10 dark:bg-[#b8896a]/10 flex items-center justify-center mb-5 animate-ai-pulse">
        <Sparkles className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]" />
      </div>
      
      {/* Loading text */}
      <p className="font-albert text-[18px] text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-2">
        Crafting your plan...
      </p>
      <p className="font-sans text-[14px] text-text-muted dark:text-[#7d8190] mb-8">
        AI is analyzing your task
      </p>
      
      {/* Shimmer skeleton lines */}
      <div className="w-full space-y-3 px-2">
        <div className="h-14 rounded-[12px] bg-gradient-to-r from-[#f3f1ef] via-[#e8e4df] to-[#f3f1ef] dark:from-[#1d222b] dark:via-[#262b35] dark:to-[#1d222b] animate-shimmer bg-[length:200%_100%]" />
        <div className="h-14 rounded-[12px] bg-gradient-to-r from-[#f3f1ef] via-[#e8e4df] to-[#f3f1ef] dark:from-[#1d222b] dark:via-[#262b35] dark:to-[#1d222b] animate-shimmer bg-[length:200%_100%]" style={{ animationDelay: '0.1s' }} />
        <div className="h-14 rounded-[12px] bg-gradient-to-r from-[#f3f1ef] via-[#e8e4df] to-[#f3f1ef] dark:from-[#1d222b] dark:via-[#262b35] dark:to-[#1d222b] animate-shimmer bg-[length:200%_100%]" style={{ animationDelay: '0.2s' }} />
        <div className="h-14 w-3/4 rounded-[12px] bg-gradient-to-r from-[#f3f1ef] via-[#e8e4df] to-[#f3f1ef] dark:from-[#1d222b] dark:via-[#262b35] dark:to-[#1d222b] animate-shimmer bg-[length:200%_100%]" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  );
}

// Error State Component
function ErrorState({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-8 px-6">
      <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <X className="w-7 h-7 text-red-500 dark:text-red-400" />
      </div>
      <h3 className="font-albert text-[20px] text-text-primary dark:text-[#f5f5f8] tracking-[-1px] mb-2 text-center">
        Something went wrong
      </h3>
      <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] mb-6 text-center">
        {error}
      </p>
      <button
        onClick={onClose}
        className="px-6 py-3 rounded-full font-sans text-[14px] font-medium bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
      >
        Close
      </button>
    </div>
  );
}

export function AIHelpCompleteModal({
  response,
  task,
  isLoading = false,
  error = null,
  onUpdateTitle,
  onClose,
}: AIHelpCompleteModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const hasNewTitle = response?.suggestedTaskTitle && response.suggestedTaskTitle !== task.title;
  
  async function handleUpdateTitle() {
    if (!response?.suggestedTaskTitle) return;
    
    setIsUpdating(true);
    try {
      await onUpdateTitle(response.suggestedTaskTitle);
    } finally {
      setIsUpdating(false);
    }
  }

  if (!mounted) return null;
  
  const modalContent = (
    <>
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-backdrop-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="w-full max-w-lg bg-white dark:bg-[#171b22] rounded-[24px] shadow-xl animate-modal-zoom-in pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Show loading skeleton */}
          {isLoading && (
            <div className="p-6">
              {/* Header with task title visible during loading */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
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
              
              {/* Task title card */}
              <div className="mb-4 p-4 bg-[#f9f7f5] dark:bg-[#1d222b] rounded-[16px]">
                <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] uppercase tracking-wide mb-1">
                  Your task
                </p>
                <p className="font-albert text-[18px] text-text-primary dark:text-[#f5f5f8] font-semibold tracking-[-0.5px]">
                  &quot;{task.title}&quot;
                </p>
              </div>
              
              <AILoadingSkeleton />
            </div>
          )}
          
          {/* Show error state */}
          {!isLoading && error && (
            <ErrorState error={error} onClose={onClose} />
          )}
          
          {/* Show content when loaded */}
          {!isLoading && !error && response && (
            <>
              {/* Header */}
              <div className="p-6 pb-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
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
                      <div className="w-6 h-6 rounded-full bg-[#a07855] dark:bg-[#b8896a] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="font-sans text-[12px] font-semibold text-white">
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
                  <div className="flex items-start gap-3 p-4 bg-[#a07855]/15 dark:bg-[#b8896a]/20 border border-[#a07855]/25 dark:border-[#b8896a]/35 rounded-[16px]">
                    <Edit3 className="w-5 h-5 text-[#a07855] dark:text-[#b8896a] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-sans text-[12px] text-[#a07855] dark:text-[#b8896a] font-medium mb-1">
                        Suggested clearer title:
                      </p>
                      <p className="font-albert text-[16px] text-text-primary dark:text-[#f5f5f8] font-medium tracking-[-0.5px]">
                        &quot;{response.suggestedTaskTitle}&quot;
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="p-6 pt-4 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] rounded-xl font-sans font-semibold text-[14px] hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
                >
                  Close
                </button>
                {hasNewTitle && (
                  <button
                    onClick={handleUpdateTitle}
                    disabled={isUpdating}
                    className={`flex-1 py-3 px-4 rounded-xl font-sans font-semibold text-[14px] flex items-center justify-center gap-2 transition-all ${
                      isUpdating
                        ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-not-allowed'
                        : 'bg-[#a07855] dark:bg-[#b8896a] text-white hover:opacity-90'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    {isUpdating ? 'Updating...' : 'Update task title'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  // Use portal to render at document body level
  return createPortal(modalContent, document.body);
}
