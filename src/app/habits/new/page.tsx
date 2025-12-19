'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { HabitForm } from '@/components/habits/HabitForm';
import type { HabitFormData } from '@/types';

export default function CreateHabitPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (data: HabitFormData) => {
    setError('');
    setIsSubmitting(true);

    try {
      console.log('=== HABIT CREATION DEBUG ===');
      console.log('Submitting habit data:', JSON.stringify(data, null, 2));
      
      const response = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      console.log('Response status:', response.status);
      console.log('Response OK:', response.ok);
      console.log('Response type:', response.type);
      
      if (!response.ok) {
        let errorData;
        const responseText = await response.text();
        console.log('Raw response text:', responseText);
        
        try {
          errorData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorData = { 
            error: 'Server returned an error but response was not JSON',
            rawResponse: responseText
          };
        }
        console.error('API Error Response:', errorData);
        console.error('Full response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(errorData.error || errorData.details || 'Failed to create habit');
      }

      const result = await response.json();
      console.log('Habit created successfully:', result);
      console.log('=== END DEBUG ===');
      
      // Redirect to homepage
      router.push('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create habit. Please try again.';
      setError(errorMessage);
      console.error('Create habit error:', err);
      setIsSubmitting(false);
    }
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
              Add a habit
            </h1>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600 font-sans">
              {error}
            </p>
            {error.includes('index') && (
              <p className="text-xs text-red-500 font-sans mt-2">
                Note: Your habit was created but we can&apos;t fetch it yet. Please create the Firestore index (check the console).
              </p>
            )}
          </div>
        )}

        {/* Form Container */}
        <div className="bg-white dark:bg-[#171b22] rounded-[24px] shadow-sm dark:shadow-none overflow-hidden">
          <HabitForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}

