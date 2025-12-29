'use client';

import { useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import type { SuggestTasksResponse } from '@/types';

interface AISuggestTasksModalProps {
  response: SuggestTasksResponse;
  currentTaskCount: number;
  onAddTasks: (tasks: { title: string }[]) => Promise<void>;
  onClose: () => void;
}

export function AISuggestTasksModal({
  response,
  currentTaskCount,
  onAddTasks,
  onClose,
}: AISuggestTasksModalProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(
    new Set(response.suggestedTasks.map((_, i) => i))
  );
  const [isAdding, setIsAdding] = useState(false);
  
  const slotsAvailable = 3 - currentTaskCount;
  
  function toggleTask(index: number) {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      // Check if we can add more
      if (newSelected.size < slotsAvailable) {
        newSelected.add(index);
      }
    }
    setSelectedTasks(newSelected);
  }
  
  async function handleAddTasks() {
    if (selectedTasks.size === 0) return;
    
    setIsAdding(true);
    try {
      const tasksToAdd = response.suggestedTasks
        .filter((_, i) => selectedTasks.has(i))
        .slice(0, slotsAvailable);
      await onAddTasks(tasksToAdd);
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
              <Sparkles className="w-5 h-5 text-accent-secondary dark:text-brand-accent" />
              <h3 className="font-albert text-[20px] text-text-primary dark:text-[#f5f5f8] font-semibold tracking-[-1px]">
                AI suggestions for today
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
          </div>
          
          {/* Slots info */}
          {slotsAvailable < response.suggestedTasks.length && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <p className="font-sans text-[13px] text-amber-700 dark:text-amber-400">
                You can only add {slotsAvailable} task{slotsAvailable !== 1 ? 's' : ''} (Daily Focus max is 3)
              </p>
            </div>
          )}
        </div>
        
        {/* Tasks List */}
        <div className="px-6 py-4 space-y-2 max-h-[300px] overflow-y-auto">
          {response.suggestedTasks.map((task, index) => {
            const isSelected = selectedTasks.has(index);
            const canSelect = isSelected || selectedTasks.size < slotsAvailable;
            
            return (
              <button
                key={index}
                onClick={() => toggleTask(index)}
                disabled={!canSelect && !isSelected}
                className={`w-full p-4 rounded-[16px] text-left transition-all flex items-start gap-3 ${
                  isSelected
                    ? 'bg-accent-secondary/10 dark:bg-brand-accent/10 border-2 border-accent-secondary dark:border-brand-accent'
                    : canSelect
                    ? 'bg-[#f9f7f5] dark:bg-[#1d222b] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] border-2 border-transparent'
                    : 'bg-[#f9f7f5] dark:bg-[#1d222b] opacity-50 cursor-not-allowed border-2 border-transparent'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isSelected
                    ? 'bg-accent-secondary dark:bg-brand-accent'
                    : 'border-2 border-[#e1ddd8] dark:border-[#3d414d] bg-white dark:bg-[#171b22]'
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <p className="font-albert text-[16px] text-text-primary dark:text-[#f5f5f8] font-medium tracking-[-0.5px] leading-[1.4]">
                  {task.title}
                </p>
              </button>
            );
          })}
        </div>
        
        {/* Notes */}
        {response.notes && (
          <div className="px-6 pb-4">
            <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2] italic leading-[1.5]">
              &quot;{response.notes}&quot;
            </p>
          </div>
        )}
        
        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full font-sans text-[14px] font-medium text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleAddTasks}
            disabled={selectedTasks.size === 0 || isAdding}
            className={`flex-1 py-3 rounded-full font-sans text-[14px] font-medium transition-all ${
              selectedTasks.size === 0 || isAdding
                ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-not-allowed'
                : 'bg-accent-secondary dark:bg-brand-accent text-white hover:opacity-90'
            }`}
          >
            {isAdding ? 'Adding...' : `Add ${selectedTasks.size} task${selectedTasks.size !== 1 ? 's' : ''} to today`}
          </button>
        </div>
      </div>
    </div>
  );
}



