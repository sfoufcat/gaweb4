'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import type { GoalHistoryEntry } from '@/types';

export default function AccomplishedGoalsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [accomplishedGoals, setAccomplishedGoals] = useState<GoalHistoryEntry[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/user/me');
        if (response.ok) {
          const data = await response.json();
          // Filter only completed goals (where completedAt is not null)
          const completed = (data.user?.goalHistory || []).filter(
            (g: GoalHistoryEntry) => g.completedAt !== null
          );
          // Sort by completedAt date, most recent first
          completed.sort((a: GoalHistoryEntry, b: GoalHistoryEntry) => 
            new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
          );
          setAccomplishedGoals(completed);
        }
      } catch (error) {
        console.error('Failed to fetch accomplished goals:', error);
      } finally {
        setLoading(false);
      }
    }

    if (isLoaded) {
      fetchData();
    }
  }, [user, isLoaded]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Capitalize first letter
  const capitalizeFirstLetter = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Header */}
      <div className="py-5 mb-6">
        {/* Mobile: Back button + Title */}
        <div className="flex lg:hidden items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 text-text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
            Accomplished goals
          </h1>
        </div>
        
        {/* Desktop: Title only */}
        <h1 className="hidden lg:block font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
          Accomplished goals
        </h1>
      </div>

      {/* Goals List */}
      {accomplishedGoals.length > 0 ? (
        <div className="space-y-4">
          {accomplishedGoals.map((goal, index) => (
            <Link 
              href={`/goal/accomplished/${index}`}
              key={`${goal.goal}-${goal.completedAt}-${index}`}
              className="block bg-white rounded-[20px] border border-[#e1ddd8] p-5 hover:border-[#a07855] hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex gap-4 items-start">
                {/* Trophy Icon */}
                <div className="w-12 h-12 rounded-full bg-[#f3f1ef] flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-accent-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.927 0" />
                  </svg>
                </div>

                {/* Goal Details */}
                <div className="flex-1">
                  <h3 className="font-albert text-xl font-semibold text-text-primary tracking-[-1px] leading-[1.3] mb-1">
                    {capitalizeFirstLetter(goal.goal)}
                  </h3>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <span>Completed {formatDate(goal.completedAt!)}</span>
                    </div>
                    
                    {goal.targetDate && (
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                        <span>Target was {formatDate(goal.targetDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow + 100% Badge */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="bg-[#e8f5e9] text-[#2e7d32] px-3 py-1 rounded-full text-sm font-semibold">
                    100%
                  </div>
                  <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-[20px] border border-[#e1ddd8]">
          <div className="w-16 h-16 rounded-full bg-[#f3f1ef] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.927 0" />
            </svg>
          </div>
          <h2 className="font-albert text-2xl text-text-primary tracking-[-1.5px] leading-[1.3] mb-2">
            No accomplished goals yet
          </h2>
          <p className="font-sans text-text-secondary mb-6 max-w-sm mx-auto">
            When you reach 100% on a goal, it will appear here as an accomplishment.
          </p>
          <Link
            href="/goal"
            className="inline-block px-6 py-3 bg-button-primary text-white rounded-full font-sans font-semibold text-sm hover:scale-105 transition-transform"
          >
            View Current Goal
          </Link>
        </div>
      )}

      {/* Back to profile link */}
      <div className="mt-8 text-center">
        <Link 
          href="/profile"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          <span className="font-sans text-sm">Back to profile</span>
        </Link>
      </div>
    </div>
  );
}



