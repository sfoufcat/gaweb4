'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useHabits } from '@/hooks/useHabits';
import { HabitCheckInModal } from '@/components/habits/HabitCheckInModal';
import type { Habit, FrequencyType } from '@/types';

export default function GrowingHabitsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { habits, isLoading, markComplete } = useHabits();
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // Format frequency for display
  const formatFrequency = (frequencyType: FrequencyType, frequencyValue: number[] | number): string => {
    if (frequencyType === 'daily') {
      return 'Daily';
    } else if (frequencyType === 'weekly_number' || frequencyType === 'weekly_specific_days') {
      if (typeof frequencyValue === 'number') {
        return `${frequencyValue}x per week`;
      } else {
        // Days array: [1,2,3,4,5] = Workdays, etc.
        const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        if (Array.isArray(frequencyValue)) {
          if (frequencyValue.length === 5 && 
              frequencyValue.every(d => [1,2,3,4,5].includes(d))) {
            return 'Workdays';
          }
          return frequencyValue.map(d => dayNames[d]).join(', ');
        }
      }
    } else if (frequencyType === 'monthly_number' || frequencyType === 'monthly_specific_days') {
      return typeof frequencyValue === 'number' ? `${frequencyValue}x per month` : 'Custom monthly';
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

  // Check if habit is completed today
  const isCompletedToday = (habit: Habit) => {
    const today = new Date().toISOString().split('T')[0];
    return habit.progress.completionDates.includes(today);
  };

  // Handle habit click
  const handleHabitClick = (habit: Habit) => {
    const completedToday = isCompletedToday(habit);
    
    // If completed, go to edit page
    if (completedToday) {
      router.push(`/habits/${habit.id}`);
      return;
    }
    
    // Otherwise show check-in modal
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
      {/* Responsive Container */}
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 pb-32 pt-8">
        
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => router.back()}
            className="w-6 h-6 flex items-center justify-center text-text-primary mb-3"
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
              const target = habit.targetRepetitions || 30;
              const percentage = getProgressPercentage(habit);
              const progressColor = getProgressColor(percentage);

              return (
                <button
                  key={habit.id}
                  onClick={() => handleHabitClick(habit)}
                  className={`${
                    completedToday ? 'bg-[#f3f1ef] opacity-70' : 'bg-white'
                  } rounded-[20px] p-4 flex gap-3 w-full text-left hover:scale-[1.01] transition-all`}
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
                        stroke="#f3f1ef"
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
                      completedToday ? 'line-through text-text-primary' : 'text-text-primary'
                    }`}>
                      {habit.text}
                    </p>
                    
                    {habit.linkedRoutine && (
                      <p className="font-sans text-[12px] text-text-muted leading-[1.2]">
                        {habit.linkedRoutine}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-1 font-sans text-[12px] text-text-muted leading-[1.2]">
                      <span>{formatFrequency(habit.frequencyType, habit.frequencyValue)}</span>
                      <span>・</span>
                      <span>{formatReminder(habit)}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Add Habit Button */}
            <Link
              href="/habits/new"
              className="bg-[#f3f1ef] rounded-[20px] p-4 flex items-center justify-center w-full text-center hover:scale-[1.01] transition-all"
            >
              <p className="font-albert text-[18px] font-semibold text-text-muted tracking-[-1px] leading-[1.3]">
                Add habit
              </p>
            </Link>
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

