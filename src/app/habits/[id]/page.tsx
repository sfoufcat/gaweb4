'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { HabitForm } from '@/components/habits/HabitForm';
import type { HabitFormData, Habit } from '@/types';

export default function EditHabitPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { id } = use(params);
  const [habit, setHabit] = useState<Habit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHabit = async () => {
      try {
        const response = await fetch(`/api/habits/${id}`);
        
        if (!response.ok) {
          throw new Error('Habit not found');
        }

        const data = await response.json();
        setHabit(data.habit);
      } catch (err) {
        console.error('Error fetching habit:', err);
        setError('Failed to load habit');
      } finally {
        setIsLoading(false);
      }
    };

    if (isLoaded && user) {
      fetchHabit();
    }
  }, [id, isLoaded, user]);

  const handleSubmit = async (data: HabitFormData) => {
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/habits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update habit');
      }

      router.push('/habits');
    } catch (err) {
      setError('Failed to update habit. Please try again.');
      console.error('Update habit error:', err);
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to mark this habit as complete and archive it?')) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/habits/${id}/archive`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to archive habit');
      }

      router.push('/habits');
    } catch (err) {
      setError('Failed to archive habit. Please try again.');
      console.error('Archive habit error:', err);
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || isLoading) {
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

  if (error && !habit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="text-center">
          <p className="text-lg text-red-600 font-sans mb-4">{error}</p>
          <button
            onClick={() => router.push('/habits')}
            className="px-6 py-3 bg-[#1A1A1A] text-white rounded-full font-sans font-semibold hover:scale-105 transition-transform"
          >
            Go to Habits
          </button>
        </div>
      </div>
    );
  }

  if (!habit) return null;

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Responsive Container */}
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 pb-32 pt-8">
        
        {/* Header */}
        <div className="mb-6">
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
              Edit my habit
            </h1>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600 font-sans">
              {error}
            </p>
          </div>
        )}

        {/* Form Container */}
        <div className="bg-white dark:bg-[#171b22] rounded-[24px] shadow-sm dark:shadow-none overflow-hidden">
          <HabitForm
            initialData={{
              text: habit.text,
              linkedRoutine: habit.linkedRoutine || '',
              frequencyType: habit.frequencyType,
              frequencyValue: habit.frequencyValue,
              reminder: habit.reminder,
              targetRepetitions: habit.targetRepetitions,
            }}
            onSubmit={handleSubmit}
            onArchive={handleArchive}
            isEditing={true}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}

