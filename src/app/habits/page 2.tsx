'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useHabits } from '@/hooks/useHabits';
import { HabitCheckInModal } from '@/components/habits/HabitCheckInModal';
import type { Habit } from '@/types';

export default function HabitsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { habits, isLoading, markComplete } = useHabits();
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // Format time helper
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const displayHour = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Check if habit is completed today
  const isCompletedToday = (habit: Habit) => {
    const today = new Date().toISOString().split('T')[0];
    return habit.progress.completionDates.includes(today);
  };

  // Handle habit click to show modal (only if not completed)
  const handleHabitClick = (habit: Habit) => {
    const completedToday = isCompletedToday(habit);
    
    // Don't show modal if already completed today
    if (completedToday) {
      return;
    }
    
    setSelectedHabit(habit);
    setShowCheckInModal(true);
  };

  // Handle marking habit as complete
  const handleCompleteHabit = async () => {
    if (!selectedHabit) return;
    
    try {
      await markComplete(selectedHabit.id);
      setShowCheckInModal(false);
      setSelectedHabit(null);
    } catch (error) {
      console.error('Failed to mark habit complete:', error);
    }
  };

  // Handle skipping habit for today
  const handleSkipHabit = () => {
    setShowCheckInModal(false);
    setSelectedHabit(null);
  };

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
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 pb-32 pt-8">
        
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-[#f3f1ef] rounded-full transition-all duration-200 mb-4"
            aria-label="Go back"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center justify-between">
            <h1 className="font-albert text-[36px] text-text-primary leading-[1.2] tracking-[-2px]">
              My Habits
            </h1>
            <Link 
              href="/habits/new"
              className="px-6 py-3 bg-earth-900 text-white rounded-full font-sans text-[14px] font-medium hover:scale-105 transition-all"
            >
              Add Habit
            </Link>
          </div>

          <p className="font-sans text-[14px] text-text-secondary mt-2">
            {habits.length} {habits.length === 1 ? 'habit' : 'habits'} active
          </p>
        </div>

        {/* Habits List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
          </div>
        ) : habits.length === 0 ? (
          <div className="bg-white rounded-[24px] p-8 text-center">
            <div className="w-16 h-16 bg-[#f3f1ef] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="font-albert text-[24px] text-text-primary tracking-[-1.5px] mb-2">
              No habits yet
            </h2>
            <p className="font-sans text-[14px] text-text-secondary mb-6">
              Start building consistency with your first habit
            </p>
            <Link 
              href="/habits/new"
              className="inline-block px-8 py-3 bg-earth-900 text-white rounded-full font-sans text-[14px] font-medium hover:scale-105 transition-all"
            >
              Create your first habit
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((habit) => {
              const completedToday = isCompletedToday(habit);
              const current = habit.progress.currentCount;
              const target = habit.targetRepetitions || null;
              const progressText = target ? `${current}/${target}` : `${current}`;

              return (
                <button
                  key={habit.id}
                  onClick={() => handleHabitClick(habit)}
                  disabled={completedToday}
                  className={`${
                    completedToday ? 'bg-[#f3f1ef] cursor-default opacity-60' : 'bg-white hover:scale-[1.01]'
                  } rounded-[20px] p-4 flex gap-2 w-full text-left transition-all`}
                >
                  {habit.reminder && (
                    <span className="font-sans text-[12px] text-text-muted leading-[1.2] flex-shrink-0 pt-1">
                      {formatTime(habit.reminder.time)}
                    </span>
                  )}
                  <div className="flex-1">
                    <p className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
                      completedToday ? 'line-through text-text-primary' : 'text-text-primary'
                    }`}>
                      {habit.text}
                    </p>
                    <div className="flex items-center justify-between text-[12px] leading-[1.2] mt-0.5">
                      <span className="font-sans text-text-secondary">
                        {habit.linkedRoutine || 'No routine linked'}
                      </span>
                      <span className="font-sans text-text-muted">{progressText}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* Habit Check-In Modal */}
      {selectedHabit && (
        <HabitCheckInModal
          habit={selectedHabit}
          isOpen={showCheckInModal}
          onClose={() => {
            setShowCheckInModal(false);
            setSelectedHabit(null);
          }}
          onComplete={handleCompleteHabit}
          onSkip={handleSkipHabit}
        />
      )}
    </div>
  );
}

