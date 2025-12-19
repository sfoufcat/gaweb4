'use client';

import { useState } from 'react';
import { X, Sparkles, Plus, AlertCircle } from 'lucide-react';
import type { TrackSpecificHelpResponse, UserTrack } from '@/types';

// Track display names
const TRACK_DISPLAY_NAMES: Record<UserTrack, string> = {
  content_creator: 'Content Creator',
  saas: 'SaaS Builder',
  agency: 'Agency Builder',
  ecom: 'E-commerce Founder',
  coach_consultant: 'Coach/Consultant',
  community_builder: 'Community Builder',
  general: 'Entrepreneur',
};

interface AITrackHelpModalProps {
  response: TrackSpecificHelpResponse;
  track: UserTrack;
  currentTaskCount: number;
  onAddTask: (title: string) => Promise<void>;
  onClose: () => void;
}

export function AITrackHelpModal({
  response,
  track,
  currentTaskCount,
  onAddTask,
  onClose,
}: AITrackHelpModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  
  const isFull = currentTaskCount >= 3;
  const trackName = TRACK_DISPLAY_NAMES[track] || 'your track';
  
  async function handleAddTask() {
    if (isFull) return;
    
    setIsAdding(true);
    try {
      await onAddTask(response.suggestedTask.title);
    } finally {
      setIsAdding(false);
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#171b22] rounded-[24px] shadow-xl animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-secondary dark:text-[#b8896a]" />
              <h3 className="font-albert text-[20px] text-text-primary dark:text-[#f5f5f8] font-semibold tracking-[-1px]">
                One thing to do today
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
          </div>
          
          {/* Track label */}
          <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2] mb-4">
            Recommended for {trackName}s:
          </p>
        </div>
        
        {/* Suggested Task */}
        <div className="px-6 py-4">
          <div className="p-5 bg-gradient-to-br from-[#f9f7f5] to-[#f3f1ef] dark:from-[#1d222b] dark:to-[#181d26] rounded-[20px] border border-[#e1ddd8] dark:border-[#2a3040]">
            <p className="font-albert text-[20px] text-text-primary dark:text-[#f5f5f8] font-semibold tracking-[-0.5px] leading-[1.4] mb-4">
              {response.suggestedTask.title}
            </p>
            
            {/* Reason */}
            <div className="flex items-start gap-2">
              <div className="w-1 h-full bg-accent-secondary/40 dark:bg-[#b8896a]/40 rounded-full flex-shrink-0" />
              <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] italic">
                &quot;{response.reason}&quot;
              </p>
            </div>
          </div>
        </div>
        
        {/* Full warning */}
        {isFull && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="font-sans text-[13px] text-amber-700 dark:text-amber-400">
                Daily Focus is full (max 3 tasks). Remove one to add this.
              </p>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full font-sans text-[14px] font-medium text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-all"
          >
            Close
          </button>
          <button
            onClick={handleAddTask}
            disabled={isFull || isAdding}
            className={`flex-1 py-3 rounded-full font-sans text-[14px] font-medium flex items-center justify-center gap-2 transition-all ${
              isFull || isAdding
                ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-not-allowed'
                : 'bg-accent-secondary dark:bg-[#b8896a] text-white hover:opacity-90'
            }`}
          >
            <Plus className="w-4 h-4" />
            {isAdding ? 'Adding...' : 'Add as task'}
          </button>
        </div>
      </div>
    </div>
  );
}

