'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { useHabits } from '@/hooks/useHabits';
import type { Habit, FrequencyType } from '@/types';

type TabType = 'active' | 'completed';

export default function GrowingHabitsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { habits: currentHabits, isLoading: isLoadingCurrent } = useHabits();
  const [archivedHabits, setArchivedHabits] = useState<Habit[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [deleteConfirmHabitId, setDeleteConfirmHabitId] = useState<string | null>(null);
  const [restoreHabitId, setRestoreHabitId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Fetch archived habits when component mounts
  useEffect(() => {
    const fetchArchivedHabits = async () => {
      try {
        setIsLoadingArchived(true);
        const response = await fetch('/api/habits/archived');
        if (response.ok) {
          const data = await response.json();
          setArchivedHabits(data.habits || []);
        }
      } catch (error) {
        console.error('Error fetching archived habits:', error);
      } finally {
        setIsLoadingArchived(false);
      }
    };

    if (isLoaded && user) {
      fetchArchivedHabits();
    }
  }, [isLoaded, user]);

  // Format frequency for display
  const formatFrequency = (frequencyType: FrequencyType, frequencyValue: number[] | number): string => {
    if (frequencyType === 'daily') {
      return 'Daily';
    } else if (frequencyType === 'weekly_specific_days') {
      // Our day format: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
      const dayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
      if (Array.isArray(frequencyValue)) {
        if (frequencyValue.length === 5 && 
            frequencyValue.every(d => [0,1,2,3,4].includes(d))) {
          return 'Workdays';
        }
        return frequencyValue.map(d => dayNames[d]).join(', ');
      }
    } else if (frequencyType === 'weekly_number') {
      return `${frequencyValue}x per week`;
    } else if (frequencyType === 'monthly_specific_days') {
      if (Array.isArray(frequencyValue)) {
        return `Days: ${frequencyValue.join(', ')}`;
      }
    } else if (frequencyType === 'monthly_number') {
      return `${frequencyValue}x per month`;
    }
    return 'Custom';
  };

  // Format reminder
  const formatReminder = (habit: Habit): string => {
    if (!habit.reminder) return 'no reminder';
    const [hours, minutes] = habit.reminder.time.split(':');
    const hour = parseInt(hours);
    const displayHour = hour % 12 || 12;
    return `remind at ${displayHour}:${minutes}`;
  };

  // Calculate progress percentage
  const getProgressPercentage = (habit: Habit): number => {
    const target = habit.targetRepetitions || 30; // Default to 30 if no limit
    const current = habit.progress.currentCount;
    return Math.min((current / target) * 100, 100);
  };

  // Get progress color
  const getProgressColor = (percentage: number): string => {
    if (percentage === 0) return '#e1ddd8'; // gray
    if (percentage === 100) return '#4CAF50'; // green
    return '#a07855'; // accent
  };

  // Get habit status (active, completed, or archived)
  const getHabitStatus = (habit: Habit): 'active' | 'completed' => {
    // Check if reached target
    const target = habit.targetRepetitions || 30;
    if (habit.progress.currentCount >= target) {
      return 'completed';
    }
    
    return 'active';
  };

  // Check if habit is completed today
  const isCompletedToday = (habit: Habit) => {
    const today = new Date().toISOString().split('T')[0];
    return habit.progress.completionDates.includes(today);
  };

  // Check if habit is skipped today
  const isSkippedToday = (habit: Habit) => {
    const today = new Date().toISOString().split('T')[0];
    return habit.progress.skipDates?.includes(today) || false;
  };

  // Filter for display based on active tab
  const activeHabits = currentHabits.filter(h => getHabitStatus(h) === 'active');
  const completedHabits = currentHabits.filter(h => getHabitStatus(h) === 'completed');
  const displayCompletedHabits = [...completedHabits, ...archivedHabits];
  
  const displayedHabits = activeTab === 'active' ? activeHabits : displayCompletedHabits;
  const isLoading = isLoadingCurrent || isLoadingArchived;

  // Handle habit click - on all habits page, always go to edit page
  const handleHabitClick = (habit: Habit) => {
    router.push(`/habits/${habit.id}`);
  };

  // Handle delete habit
  const handleDeleteHabit = async (habitId: string) => {
    try {
      const response = await fetch(`/api/habits/${habitId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete habit');
      }

      // Remove from state
      setArchivedHabits(prev => prev.filter(h => h.id !== habitId));
      setDeleteConfirmHabitId(null);
    } catch (error) {
      console.error('Failed to delete habit:', error);
      alert('Failed to delete habit. Please try again.');
    }
  };

  // Handle restore habit
  const handleRestoreHabit = async (habitId: string) => {
    setIsRestoring(true);
    setRestoreError(null);
    
    try {
      const response = await fetch(`/api/habits/${habitId}/restore`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.limitReached) {
          setRestoreError('You already have 3 active habits. Archive one first to restore this habit.');
          return;
        }
        throw new Error(data.error || 'Failed to restore habit');
      }

      // Remove from archived list and close modal
      setArchivedHabits(prev => prev.filter(h => h.id !== habitId));
      setRestoreHabitId(null);
    } catch (error) {
      console.error('Failed to restore habit:', error);
      setRestoreError('Failed to restore habit. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Check if habit is archived (from archivedHabits list)
  const isArchivedHabit = (habit: Habit): boolean => {
    return archivedHabits.some(h => h.id === habit.id);
  };

  // Get the habit being restored
  const habitToRestore = restoreHabitId 
    ? archivedHabits.find(h => h.id === restoreHabitId) 
    : null;

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Responsive Container */}
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 pb-32 pt-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-0">
            <button
              onClick={() => router.back()}
              className="w-6 h-6 flex items-center justify-center text-text-primary"
              aria-label="Go back"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
              Growing Habits
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2 mb-6">
          {/* Active Tab */}
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 rounded-[32px] px-4 py-2 font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] transition-all duration-200 ${
              activeTab === 'active'
                ? 'bg-white dark:bg-[#171b22] text-text-primary dark:text-[#f5f5f8] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
                : 'text-text-secondary dark:text-[#7d8190]'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span>Active</span>
            </div>
          </button>

          {/* Completed Tab */}
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 rounded-[32px] px-4 py-2 font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] transition-all duration-200 ${
              activeTab === 'completed'
                ? 'bg-white dark:bg-[#171b22] text-text-primary dark:text-[#f5f5f8] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
                : 'text-text-secondary dark:text-[#7d8190]'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Completed</span>
            </div>
          </button>
        </div>

        {/* Habits List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
          </div>
        ) : displayedHabits.length === 0 ? (
          <div className="bg-white dark:bg-[#171b22] rounded-[24px] p-8 text-center">
            <div className="w-16 h-16 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-secondary dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="font-albert text-[24px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] mb-2">
              {activeTab === 'active' ? 'No active habits' : 'No completed habits'}
            </h2>
            <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] mb-6">
              {activeTab === 'active' 
                ? 'Start building consistency with your first habit'
                : 'Completed habits will appear here'}
            </p>
            {activeTab === 'active' && (
              <Link 
                href="/habits/new"
                className="inline-block px-8 py-3 bg-earth-900 dark:bg-[#b8896a] text-white rounded-full font-sans text-[14px] font-medium hover:scale-105 transition-all"
              >
                Create your first habit
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {displayedHabits.map((habit) => {
              const completedToday = isCompletedToday(habit);
              const skippedToday = isSkippedToday(habit);
              const current = habit.progress.currentCount;
              const target = habit.targetRepetitions || 30;
              const percentage = getProgressPercentage(habit);
              const progressColor = getProgressColor(percentage);
              const isInCompletedTab = activeTab === 'completed';

              return (
                <div
                  key={habit.id}
                  className={`${
                    completedToday ? 'bg-[#f3f1ef] dark:bg-[#1e222a] opacity-70' : 
                    skippedToday ? 'bg-[#f3f1ef] dark:bg-[#1e222a] opacity-70' : 
                    'bg-white dark:bg-[#171b22]'
                  } rounded-[20px] p-4 flex gap-3 w-full relative`}
                >
                  {/* Main content - clickable for active habits OR archived habits (restore) */}
                  <div 
                    onClick={
                      isInCompletedTab 
                        ? (isArchivedHabit(habit) ? () => { setRestoreHabitId(habit.id); setRestoreError(null); } : undefined)
                        : () => handleHabitClick(habit)
                    }
                    className={`flex gap-3 flex-1 ${
                      isInCompletedTab 
                        ? (isArchivedHabit(habit) ? 'cursor-pointer hover:scale-[1.01] transition-all' : 'cursor-default')
                        : 'cursor-pointer hover:scale-[1.01] transition-all'
                    }`}
                  >
                    {/* Circular Progress Chart */}
                    <div className="relative flex-shrink-0 w-[100px] h-[100px]">
                      {/* Background circle */}
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          className="stroke-[#f3f1ef] dark:stroke-[#262b35]"
                          strokeWidth="8"
                        />
                        {/* Progress circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke={progressColor}
                          strokeWidth="8"
                          strokeDasharray={`${percentage * 2.513} 251.3`}
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* Center text */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="font-albert text-[18px] font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                          {habit.targetRepetitions ? `${current}/${target}` : current}
                        </p>
                        <p className="font-albert text-[12px] text-text-muted tracking-[-0.24px] leading-[1.1]">
                          complete
                        </p>
                      </div>
                    </div>

                    {/* Habit Details */}
                    <div className="flex-1 flex flex-col gap-2">
                      <p className={`font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] ${
                        completedToday || skippedToday ? 'line-through text-text-primary' : 'text-text-primary'
                      }`}>
                        {habit.text}
                      </p>
                      
                      {/* Status and Linked Routine */}
                      <div className="flex flex-col gap-0.5">
                        {completedToday ? (
                          <p className="font-sans text-[12px] text-[#4CAF50] leading-[1.2]">
                            Completed today
                          </p>
                        ) : skippedToday ? (
                          <p className="font-sans text-[12px] text-text-secondary leading-[1.2]">
                            Skipped for today
                          </p>
                        ) : null}
                        
                        {habit.linkedRoutine && (
                          <p className="font-sans text-[12px] text-text-muted leading-[1.2]">
                            {habit.linkedRoutine}
                          </p>
                        )}
                      </div>
                      
                      {/* Always show labeled view on desktop */}
                      <div className="flex flex-col gap-1 font-sans text-[12px] leading-[1.2]">
                        <p className="text-text-muted">
                          <span className="text-text-secondary">Repeats:</span> {formatFrequency(habit.frequencyType, habit.frequencyValue)}
                        </p>
                        <p className="text-text-muted">
                          <span className="text-text-secondary">Reminder:</span> {formatReminder(habit)}
                        </p>
                        <p className="text-text-muted">
                          <span className="text-text-secondary">Progress:</span> {current}/{target}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Delete button - only show in completed tab */}
                  {isInCompletedTab && (
                    <button
                      onClick={() => setDeleteConfirmHabitId(habit.id)}
                      className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      aria-label="Delete habit"
                    >
                      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add Habit Button - only show on Active tab */}
            {activeTab === 'active' && (
              <Link
                href="/habits/new"
                className="bg-[#f3f1ef] dark:bg-[#171b22] rounded-[20px] p-4 flex items-center justify-center w-full text-center hover:scale-[1.01] transition-all"
              >
                <p className="font-albert text-[18px] font-semibold text-text-muted dark:text-[#7d8190] tracking-[-1px] leading-[1.3]">
                  Add habit
                </p>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmHabitId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#171b22] rounded-[24px] p-6 max-w-[400px] w-full">
            <h3 className="font-albert text-[24px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3] mb-3">
              Delete habit?
            </h3>
            <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4] mb-6">
              This action cannot be undone. The habit and all its progress will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmHabitId(null)}
                className="flex-1 py-3 px-6 rounded-full font-sans text-[14px] font-medium bg-[#f3f1ef] dark:bg-[#1e222a] text-text-primary dark:text-[#f5f5f8] hover:bg-[#e8e0d5] dark:hover:bg-[#262b35] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteHabit(deleteConfirmHabitId)}
                className="flex-1 py-3 px-6 rounded-full font-sans text-[14px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Habit Modal */}
      {restoreHabitId && habitToRestore && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#171b22] rounded-[24px] p-6 max-w-[400px] w-full animate-in fade-in zoom-in-95 duration-200">
            {/* Icon */}
            <div className="w-14 h-14 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-earth-900 dark:text-[#b8896a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            
            <h3 className="font-albert text-[24px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3] mb-2 text-center">
              Restore habit?
            </h3>
            
            <p className="font-albert text-[16px] font-semibold text-earth-900 dark:text-[#b8896a] tracking-[-0.5px] text-center mb-2">
              {habitToRestore.text}
            </p>
            
            <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4] mb-6 text-center">
              This habit will be moved back to your active habits. Your progress will be preserved.
            </p>

            {/* Error message */}
            {restoreError && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="font-sans text-[13px] text-amber-800 dark:text-amber-200 text-center">
                  {restoreError}
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => { setRestoreHabitId(null); setRestoreError(null); }}
                disabled={isRestoring}
                className="flex-1 py-3 px-6 rounded-full font-sans text-[14px] font-medium bg-[#f3f1ef] dark:bg-[#1e222a] text-text-primary dark:text-[#f5f5f8] hover:bg-[#e8e0d5] dark:hover:bg-[#262b35] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestoreHabit(restoreHabitId)}
                disabled={isRestoring}
                className="flex-1 py-3 px-6 rounded-full font-sans text-[14px] font-medium bg-earth-900 dark:bg-[#b8896a] text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRestoring ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Restoring...
                  </>
                ) : (
                  'Restore'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
