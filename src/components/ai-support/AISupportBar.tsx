'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Lightbulb, Target, Loader2 } from 'lucide-react';
import { useTrack } from '@/hooks/useTrack';
import { useActiveEnrollment } from '@/hooks/useActiveEnrollment';
import { useTasks } from '@/hooks/useTasks';
import { AISuggestTasksModal } from './AISuggestTasksModal';
import { AIHelpCompleteModal } from './AIHelpCompleteModal';
import { AITrackHelpModal } from './AITrackHelpModal';
import type { UserTrack, AIAction, SuggestTasksResponse, HelpCompleteTaskResponse, TrackSpecificHelpResponse } from '@/types';

// =============================================================================
// TRACK LABEL MAPPING
// =============================================================================

const TRACK_HELP_LABELS: Record<UserTrack, string> = {
  content_creator: 'Content Creator help',
  saas: 'SaaS builder help',
  agency: 'Agency builder help',
  ecom: 'E-com founder help',
  coach_consultant: 'Coaching business help',
  community_builder: 'Community builder help',
  general: 'Track-specific help',
};

interface AISupportBarProps {
  onTasksChange?: () => void;
}

export function AISupportBar({ onTasksChange }: AISupportBarProps) {
  const { track, isLoading: trackLoading } = useTrack();
  const { enrollment, program, progress, isLoading: enrollmentLoading } = useActiveEnrollment();
  const today = new Date().toISOString().split('T')[0];
  const { focusTasks, backlogTasks, isLoading: tasksLoading, createTask, updateTask, fetchTasks } = useTasks({ date: today });
  
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [showHelpCompleteModal, setShowHelpCompleteModal] = useState(false);
  const [showTrackHelpModal, setShowTrackHelpModal] = useState(false);
  
  // Response data
  const [suggestResponse, setSuggestResponse] = useState<SuggestTasksResponse | null>(null);
  const [helpCompleteResponse, setHelpCompleteResponse] = useState<HelpCompleteTaskResponse | null>(null);
  const [trackHelpResponse, setTrackHelpResponse] = useState<TrackSpecificHelpResponse | null>(null);
  const [selectedTaskForHelp, setSelectedTaskForHelp] = useState<{ id: string; title: string } | null>(null);
  
  // Task picker for "Help me complete a task"
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  
  // Mobile carousel tracking
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  
  const isDataLoading = trackLoading || enrollmentLoading || tasksLoading;
  
  // Determine if user has tasks - this affects button order
  const hasTasks = focusTasks.length > 0;
  
  // Track carousel scroll position
  const handleCarouselScroll = useCallback(() => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const itemWidth = window.innerWidth * 0.85 + 12; // 85vw + gap-3 (12px)
    const index = Math.round(scrollLeft / itemWidth);
    setCarouselIndex(Math.min(Math.max(index, 0), 2));
  }, []);
  
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    
    carousel.addEventListener('scroll', handleCarouselScroll);
    return () => carousel.removeEventListener('scroll', handleCarouselScroll);
  }, [handleCarouselScroll]);
  
  // Get track-specific label for third button
  const trackHelpLabel = track ? TRACK_HELP_LABELS[track] : 'Track-specific help';
  
  // Call the AI support API
  async function callAISupport(action: AIAction, taskId?: string): Promise<boolean> {
    setIsLoading(true);
    setError(null);
    setActiveAction(action);
    
    try {
      const payload = {
        action,
        track: track || 'general',
        dailyTasks: focusTasks.map(t => ({ id: t.id, title: t.title })),
        backlogTasks: backlogTasks.map(t => ({ id: t.id, title: t.title })),
        starterProgramContext: {
          id: enrollment?.programId || null,
          name: program?.name || null,
          dayNumber: progress?.currentDay || null,
        },
        selectedTaskId: taskId || null,
      };
      
      const response = await fetch('/api/ai-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get AI support');
      }
      
      // Store response based on action
      switch (action) {
        case 'suggest_tasks_for_today':
          setSuggestResponse(data.data as SuggestTasksResponse);
          setShowSuggestModal(true);
          break;
        case 'help_complete_task':
          setHelpCompleteResponse(data.data as HelpCompleteTaskResponse);
          setShowHelpCompleteModal(true);
          break;
        case 'track_specific_help':
          setTrackHelpResponse(data.data as TrackSpecificHelpResponse);
          setShowTrackHelpModal(true);
          break;
      }
      
      return true;
    } catch (err) {
      console.error('[AISupportBar] Error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }
  
  // Handle "Suggest tasks for today" button
  function handleSuggestTasks() {
    // If already 3 tasks, show message
    if (focusTasks.length >= 3) {
      setError('You already have 3 tasks planned. Remove one or complete a task first.');
      return;
    }
    callAISupport('suggest_tasks_for_today');
  }
  
  // Handle "Help me complete a task" button
  function handleHelpComplete() {
    if (focusTasks.length === 0) {
      setError("You don't have any tasks planned for today yet. Add one first.");
      return;
    }
    // Show task picker if multiple tasks
    if (focusTasks.length === 1) {
      // Only one task, use it directly
      setSelectedTaskForHelp({ id: focusTasks[0].id, title: focusTasks[0].title });
      callAISupport('help_complete_task', focusTasks[0].id);
    } else {
      setShowTaskPicker(true);
    }
  }
  
  // Handle task selection from picker
  function handleTaskSelected(task: { id: string; title: string }) {
    setShowTaskPicker(false);
    setSelectedTaskForHelp(task);
    callAISupport('help_complete_task', task.id);
  }
  
  // Handle "Track-specific help" button
  function handleTrackHelp() {
    callAISupport('track_specific_help');
  }
  
  // Handle adding suggested tasks to today
  async function handleAddSuggestedTasks(tasks: { title: string }[]) {
    const currentCount = focusTasks.length;
    const slotsAvailable = 3 - currentCount;
    const tasksToAdd = tasks.slice(0, slotsAvailable);
    
    for (const task of tasksToAdd) {
      await createTask({ title: task.title, isPrivate: false });
    }
    
    setShowSuggestModal(false);
    setSuggestResponse(null);
    await fetchTasks();
    onTasksChange?.();
  }
  
  // Handle updating task title
  async function handleUpdateTaskTitle(taskId: string, newTitle: string) {
    await updateTask(taskId, { title: newTitle });
    setShowHelpCompleteModal(false);
    setHelpCompleteResponse(null);
    setSelectedTaskForHelp(null);
    await fetchTasks();
    onTasksChange?.();
  }
  
  // Handle adding track-specific task
  async function handleAddTrackTask(title: string) {
    if (focusTasks.length >= 3) {
      setError('Daily Focus is full. Remove a task first.');
      return;
    }
    await createTask({ title, isPrivate: false });
    setShowTrackHelpModal(false);
    setTrackHelpResponse(null);
    await fetchTasks();
    onTasksChange?.();
  }
  
  // Clear error after 5 seconds
  if (error) {
    setTimeout(() => setError(null), 5000);
  }
  
  if (isDataLoading) {
    return (
      <div className="mb-4">
        <div className="bg-[#f9f7f5] dark:bg-transparent rounded-[20px] p-4 animate-pulse">
          <div className="h-5 w-40 bg-[#e1ddd8] dark:bg-[#262b35] rounded mb-3" />
          <div className="flex gap-2">
            <div className="h-9 flex-1 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
            <div className="h-9 flex-1 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
            <div className="h-9 flex-1 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="mb-4">
        {/* Main Bar */}
        <div className="bg-[#f9f7f5] dark:bg-transparent rounded-[20px] p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
            <span className="font-albert text-[15px] text-text-primary dark:text-[#f5f5f8] font-medium tracking-[-0.5px]">
              Need help with today?
            </span>
          </div>
          
          {/* Action Buttons - Mobile: Carousel, Desktop: Row */}
          {/* Button order: If user has tasks, "Help complete" first; otherwise "Suggest tasks" first */}
          
          {/* Mobile Carousel */}
          <div 
            ref={carouselRef}
            className="sm:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {/* First button: Help complete (if has tasks) or Suggest tasks (if no tasks) */}
              {hasTasks ? (
                <button
                  onClick={handleHelpComplete}
                  disabled={isLoading}
                  className={`snap-center flex-shrink-0 w-[85vw] flex items-center justify-center gap-2 px-4 py-3 rounded-full font-sans text-[13px] font-medium transition-all ${
                    isLoading && activeAction === 'help_complete_task'
                      ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                      : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8]'
                  }`}
                >
                  {isLoading && activeAction === 'help_complete_task' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Target className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
                  )}
                  <span>Help me complete a task</span>
                </button>
              ) : (
                <button
                  onClick={handleSuggestTasks}
                  disabled={isLoading}
                  className={`snap-center flex-shrink-0 w-[85vw] flex items-center justify-center gap-2 px-4 py-3 rounded-full font-sans text-[13px] font-medium transition-all ${
                    isLoading && activeAction === 'suggest_tasks_for_today'
                      ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                      : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8]'
                  }`}
                >
                  {isLoading && activeAction === 'suggest_tasks_for_today' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
                  )}
                  <span>Suggest tasks for today</span>
                </button>
              )}
              
              {/* Second button: Suggest tasks (if has tasks) or Help complete (if no tasks) */}
              {hasTasks ? (
                <button
                  onClick={handleSuggestTasks}
                  disabled={isLoading}
                  className={`snap-center flex-shrink-0 w-[85vw] flex items-center justify-center gap-2 px-4 py-3 rounded-full font-sans text-[13px] font-medium transition-all ${
                    isLoading && activeAction === 'suggest_tasks_for_today'
                      ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                      : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8]'
                  }`}
                >
                  {isLoading && activeAction === 'suggest_tasks_for_today' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
                  )}
                  <span>Suggest tasks for today</span>
                </button>
              ) : (
                <button
                  onClick={handleHelpComplete}
                  disabled={isLoading}
                  className={`snap-center flex-shrink-0 w-[85vw] flex items-center justify-center gap-2 px-4 py-3 rounded-full font-sans text-[13px] font-medium transition-all ${
                    isLoading && activeAction === 'help_complete_task'
                      ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                      : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8]'
                  }`}
                >
                  {isLoading && activeAction === 'help_complete_task' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Target className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
                  )}
                  <span>Help me complete a task</span>
                </button>
              )}
              
              {/* Track-specific help - always third */}
              <button
                onClick={handleTrackHelp}
                disabled={isLoading}
                className={`snap-center flex-shrink-0 w-[85vw] flex items-center justify-center gap-2 px-4 py-3 rounded-full font-sans text-[13px] font-medium transition-all ${
                  isLoading && activeAction === 'track_specific_help'
                    ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                    : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8]'
                }`}
              >
                {isLoading && activeAction === 'track_specific_help' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
                )}
                <span>{trackHelpLabel}</span>
              </button>
            </div>
          </div>
          
          {/* Mobile Swipe Indicator Dots */}
          <div className="sm:hidden flex justify-center gap-1.5 mt-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  carouselIndex === index 
                    ? 'w-4 bg-accent-secondary dark:bg-[#b8896a]' 
                    : 'w-1.5 bg-[#e1ddd8] dark:bg-[#262b35]'
                }`}
              />
            ))}
          </div>
          
          {/* Desktop Row */}
          <div className="hidden sm:flex gap-2">
            {/* First button: Help complete (if has tasks) or Suggest tasks (if no tasks) */}
            {hasTasks ? (
              <button
                onClick={handleHelpComplete}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-full font-sans text-[13px] font-medium transition-all ${
                  isLoading && activeAction === 'help_complete_task'
                    ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                    : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] hover:scale-[1.02]'
                }`}
              >
                {isLoading && activeAction === 'help_complete_task' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Target className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
                )}
                <span>Help me complete a task</span>
              </button>
            ) : (
              <button
                onClick={handleSuggestTasks}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-full font-sans text-[13px] font-medium transition-all ${
                  isLoading && activeAction === 'suggest_tasks_for_today'
                    ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                    : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] hover:scale-[1.02]'
                }`}
              >
                {isLoading && activeAction === 'suggest_tasks_for_today' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lightbulb className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
                )}
                <span>Suggest tasks for today</span>
              </button>
            )}
            
            {/* Second button: Suggest tasks (if has tasks) or Help complete (if no tasks) */}
            {hasTasks ? (
              <button
                onClick={handleSuggestTasks}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-full font-sans text-[13px] font-medium transition-all ${
                  isLoading && activeAction === 'suggest_tasks_for_today'
                    ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                    : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] hover:scale-[1.02]'
                }`}
              >
                {isLoading && activeAction === 'suggest_tasks_for_today' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lightbulb className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
                )}
                <span>Suggest tasks for today</span>
              </button>
            ) : (
              <button
                onClick={handleHelpComplete}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-full font-sans text-[13px] font-medium transition-all ${
                  isLoading && activeAction === 'help_complete_task'
                    ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                    : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] hover:scale-[1.02]'
                }`}
              >
                {isLoading && activeAction === 'help_complete_task' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Target className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
                )}
                <span>Help me complete a task</span>
              </button>
            )}
            
            {/* Track-specific help - always third */}
            <button
              onClick={handleTrackHelp}
              disabled={isLoading}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-full font-sans text-[13px] font-medium transition-all ${
                isLoading && activeAction === 'track_specific_help'
                  ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted cursor-wait'
                  : 'bg-white dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] hover:scale-[1.02]'
              }`}
            >
              {isLoading && activeAction === 'track_specific_help' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-accent-secondary dark:text-[#b8896a]" />
              )}
              <span>{trackHelpLabel}</span>
            </button>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
              <p className="font-sans text-[13px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
        
        {/* Task Picker Modal (inline) */}
        {showTaskPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-[#171b22] rounded-[24px] p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <h3 className="font-albert text-[20px] text-text-primary dark:text-[#f5f5f8] font-semibold tracking-[-1px] mb-4">
                Which task do you want help with?
              </h3>
              
              <div className="space-y-2">
                {focusTasks.filter(t => t.status === 'pending').map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleTaskSelected({ id: task.id, title: task.title })}
                    className="w-full p-4 bg-[#f9f7f5] dark:bg-[#1d222b] rounded-[16px] text-left hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                  >
                    <p className="font-albert text-[16px] text-text-primary dark:text-[#f5f5f8] font-medium tracking-[-0.5px]">
                      {task.title}
                    </p>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowTaskPicker(false)}
                className="mt-4 w-full py-3 font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Result Modals */}
      {showSuggestModal && suggestResponse && (
        <AISuggestTasksModal
          response={suggestResponse}
          currentTaskCount={focusTasks.length}
          onAddTasks={handleAddSuggestedTasks}
          onClose={() => {
            setShowSuggestModal(false);
            setSuggestResponse(null);
          }}
        />
      )}
      
      {showHelpCompleteModal && helpCompleteResponse && selectedTaskForHelp && (
        <AIHelpCompleteModal
          response={helpCompleteResponse}
          task={selectedTaskForHelp}
          onUpdateTitle={(newTitle) => handleUpdateTaskTitle(selectedTaskForHelp.id, newTitle)}
          onClose={() => {
            setShowHelpCompleteModal(false);
            setHelpCompleteResponse(null);
            setSelectedTaskForHelp(null);
          }}
        />
      )}
      
      {showTrackHelpModal && trackHelpResponse && (
        <AITrackHelpModal
          response={trackHelpResponse}
          track={track || 'general'}
          currentTaskCount={focusTasks.length}
          onAddTask={handleAddTrackTask}
          onClose={() => {
            setShowTrackHelpModal(false);
            setTrackHelpResponse(null);
          }}
        />
      )}
    </>
  );
}

