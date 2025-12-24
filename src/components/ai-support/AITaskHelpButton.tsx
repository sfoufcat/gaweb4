'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { AIHelpCompleteModal } from './AIHelpCompleteModal';
import type { HelpCompleteTaskResponse } from '@/types';

interface AITaskHelpButtonProps {
  task: { id: string; title: string };
  onTaskUpdate?: () => void;
}

/**
 * AI Help button that appears next to each task
 * When clicked, fetches AI assistance for completing the task and shows a modal
 */
export function AITaskHelpButton({ task, onTaskUpdate }: AITaskHelpButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [response, setResponse] = useState<HelpCompleteTaskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    // Prevent triggering parent click handlers
    e.stopPropagation();
    
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        action: 'help_complete_task',
        track: 'general',
        dailyTasks: [{ id: task.id, title: task.title }],
        backlogTasks: [],
        starterProgramContext: {
          id: null,
          name: null,
          dayNumber: null,
        },
        selectedTaskId: task.id,
      };
      
      const res = await fetch('/api/ai-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI help');
      }
      
      setResponse(data.data as HelpCompleteTaskResponse);
      setShowModal(true);
    } catch (err) {
      console.error('[AITaskHelpButton] Error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateTitle(newTitle: string) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to update task');
      }
      
      setShowModal(false);
      setResponse(null);
      onTaskUpdate?.();
    } catch (err) {
      console.error('[AITaskHelpButton] Error updating task:', err);
    }
  }

  function handleClose() {
    setShowModal(false);
    setResponse(null);
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="p-1.5 rounded-lg text-text-muted dark:text-[#7d8190] hover:text-accent-secondary dark:hover:text-[#b8896a] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-all flex-shrink-0"
        title="Get AI help to complete this task"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </button>
      
      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-500 text-white rounded-lg text-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          {error}
        </div>
      )}
      
      {/* Help Complete Modal */}
      {showModal && response && (
        <AIHelpCompleteModal
          response={response}
          task={task}
          onUpdateTitle={handleUpdateTitle}
          onClose={handleClose}
        />
      )}
    </>
  );
}


