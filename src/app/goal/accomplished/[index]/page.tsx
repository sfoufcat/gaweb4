'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import type { GoalHistoryEntry, DailyReflection, WeeklyReflection, EmotionalState, EveningEmotionalState, ReflectionEmotionalState } from '@/types';

type TabType = 'daily' | 'weekly';

// Morning emotional state labels
const emotionalStateLabels: Record<EmotionalState, string> = {
  low_stuck: 'Low & Stuck',
  uneasy: 'Uneasy',
  uncertain: 'Uncertain',
  neutral: 'Neutral',
  steady: 'Steady',
  confident: 'Confident',
  energized: 'Energized',
};

// Evening emotional state labels
const eveningEmotionalStateLabels: Record<EveningEmotionalState, string> = {
  tough_day: 'Tough day',
  mixed: 'Mixed',
  steady: 'Steady',
  good_day: 'Good day',
  great_day: 'Great day',
};

// Combined function to get emotional state label
const getEmotionalStateLabel = (state: ReflectionEmotionalState): string => {
  if (state in emotionalStateLabels) {
    return emotionalStateLabels[state as EmotionalState];
  }
  if (state in eveningEmotionalStateLabels) {
    return eveningEmotionalStateLabels[state as EveningEmotionalState];
  }
  return 'Unknown';
};

// On-track status labels
const onTrackLabels: Record<string, string> = {
  on_track: 'On track',
  not_sure: 'Not sure',
  off_track: 'Off track',
};

export default function AccomplishedGoalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<GoalHistoryEntry | null>(null);
  const [reflections, setReflections] = useState<(DailyReflection | WeeklyReflection)[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [reflectionsLoading, setReflectionsLoading] = useState(true);

  const goalIndex = parseInt(params.index as string, 10);

  // Fetch accomplished goal data
  useEffect(() => {
    async function fetchData() {
      if (!user || isNaN(goalIndex)) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user data with goal history
        const userResponse = await fetch('/api/user/me');
        if (userResponse.ok) {
          const data = await userResponse.json();
          const goalHistory = data.user?.goalHistory || [];
          
          // Filter only completed goals and sort by completedAt
          const completedGoals = goalHistory
            .filter((g: GoalHistoryEntry) => g.completedAt !== null)
            .sort((a: GoalHistoryEntry, b: GoalHistoryEntry) => 
              new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
            );
          
          if (goalIndex >= 0 && goalIndex < completedGoals.length) {
            setGoal(completedGoals[goalIndex]);
          }
        }

        // Fetch reflections
        // Note: Currently all reflections are shown - in the future we could filter by goal date range
        const reflectionsResponse = await fetch('/api/goal/reflections?limit=100');
        if (reflectionsResponse.ok) {
          const reflectionsData = await reflectionsResponse.json();
          setReflections(reflectionsData.reflections || []);
        }
      } catch (error) {
        console.error('Failed to fetch goal data:', error);
      } finally {
        setLoading(false);
        setReflectionsLoading(false);
      }
    }

    if (isLoaded) {
      fetchData();
    }
  }, [user, isLoaded, goalIndex]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Format reflection date
  const formatReflectionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric'
    }) + ', ' + date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Filter reflections by tab
  const filteredReflections = useMemo(() => {
    return reflections.filter(r => r.type === activeTab);
  }, [reflections, activeTab]);

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

  if (!goal) {
    router.push('/goal/accomplished');
    return null;
  }

  // Circular Progress Component (always 100% for accomplished goals)
  const CircularProgress = ({ size = 160 }: { size?: number }) => (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
        {/* Background circle */}
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke="#f3f1ef"
          strokeWidth="10"
        />
        {/* Progress circle - green for completed */}
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke="#4CAF50"
          strokeWidth="10"
          strokeDasharray={`${2 * Math.PI * 70}`}
          strokeDashoffset="0"
          strokeLinecap="round"
        />
        {/* Small circle at start */}
        <circle
          cx="80"
          cy="10"
          r="5"
          fill="#4CAF50"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-albert text-[36px] text-[#4CAF50] tracking-[-2px] leading-[1.2]">
          100%
        </p>
        <p className="font-sans text-[16px] text-text-muted tracking-[-0.3px]">
          completed
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Mobile Layout */}
      <div className="flex lg:hidden flex-col gap-6 py-5">
        {/* Back button only (no edit for accomplished goals) */}
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] transition-colors"
          >
            <svg className="w-5 h-5 text-text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          {/* Trophy badge instead of edit button */}
          <div className="bg-[#e8f5e9] text-[#2e7d32] px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.927 0" />
            </svg>
            Accomplished
          </div>
        </div>

        {/* Goal Title - Centered */}
        <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2] text-center">
          {capitalizeFirstLetter(goal.goal)}
        </h1>

        {/* Circular Progress - Centered */}
        <div className="flex justify-center">
          <CircularProgress size={160} />
        </div>

        {/* Dates - Centered */}
        <div className="flex flex-col gap-1 items-center">
          <div className="flex items-center gap-[5px] text-[#4CAF50]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="font-sans text-[16px] tracking-[-0.3px]">
              Completed {formatDate(goal.completedAt!)}
            </span>
          </div>
          {goal.targetDate && (
            <div className="flex items-center gap-[5px] text-text-secondary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              <span className="font-sans text-[16px] tracking-[-0.3px]">
                Target was {formatDate(goal.targetDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center justify-between w-full py-5">
        {/* Left: Circle and Goal Info */}
        <div className="flex items-center gap-6">
          <CircularProgress size={160} />

          <div className="flex flex-col gap-2">
            <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
              {capitalizeFirstLetter(goal.goal)}
            </h1>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-[5px] text-[#4CAF50]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="font-sans text-[16px] tracking-[-0.3px]">
                  Completed {formatDate(goal.completedAt!)}
                </span>
              </div>
              {goal.targetDate && (
                <div className="flex items-center gap-[5px] text-text-secondary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                  <span className="font-sans text-[16px] tracking-[-0.3px]">
                    Target was {formatDate(goal.targetDate)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Trophy badge instead of edit button */}
        <div className="bg-[#e8f5e9] text-[#2e7d32] px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.927 0" />
          </svg>
          Accomplished
        </div>
      </div>

      {/* Reflections Section */}
      <div className="pt-6">
        <h2 className="font-albert text-[24px] text-text-primary tracking-[-1.5px] leading-[1.3] mb-3">
          Reflections
        </h2>

        {/* Tabs */}
        <div className="bg-[#f3f1ef] rounded-[40px] p-2 flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-[32px] transition-all ${
              activeTab === 'daily'
                ? 'bg-white shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)]'
                : ''
            }`}
          >
            <svg className={`w-5 h-5 ${activeTab === 'daily' ? 'text-text-primary' : 'text-text-secondary'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
              activeTab === 'daily' ? 'text-text-primary' : 'text-text-secondary'
            }`}>
              Daily
            </span>
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-[32px] transition-all ${
              activeTab === 'weekly'
                ? 'bg-white shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)]'
                : ''
            }`}
          >
            <svg className={`w-5 h-5 ${activeTab === 'weekly' ? 'text-text-primary' : 'text-text-secondary'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            <span className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
              activeTab === 'weekly' ? 'text-text-primary' : 'text-text-secondary'
            }`}>
              Weekly
            </span>
          </button>
        </div>

        {/* Reflections List */}
        {reflectionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-text-primary" />
          </div>
        ) : filteredReflections.length > 0 ? (
          <div className="space-y-3">
            {filteredReflections.map((reflection) => (
              <div key={reflection.id} className="bg-white rounded-[20px] p-4">
                {reflection.type === 'daily' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[14px] text-text-muted">
                      <span>{formatReflectionDate(reflection.createdAt)}</span>
                      <span>
                        {(reflection as DailyReflection).tasksCompleted}/{(reflection as DailyReflection).tasksTotal}, {getEmotionalStateLabel((reflection as DailyReflection).emotionalState)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-albert text-[18px] font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                        Note
                      </h3>
                      <p className="font-sans text-[16px] text-text-secondary tracking-[-0.3px] leading-[1.2]">
                        {(reflection as DailyReflection).note}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[14px] text-text-muted">
                      <span>{formatReflectionDate(reflection.createdAt)}</span>
                      <span>
                        {(reflection as WeeklyReflection).progressChange >= 0 ? '+' : ''}{(reflection as WeeklyReflection).progressChange}%, {onTrackLabels[(reflection as WeeklyReflection).onTrackStatus]}
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="font-albert text-[18px] font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                          What went well?
                        </h3>
                        <p className="font-sans text-[16px] text-text-secondary tracking-[-0.3px] leading-[1.2]">
                          {(reflection as WeeklyReflection).whatWentWell}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-albert text-[18px] font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                          What were your biggest obstacles?
                        </h3>
                        <p className="font-sans text-[16px] text-text-secondary tracking-[-0.3px] leading-[1.2]">
                          {(reflection as WeeklyReflection).biggestObstacles}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-albert text-[18px] font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                          What will you do differently next week?
                        </h3>
                        <p className="font-sans text-[16px] text-text-secondary tracking-[-0.3px] leading-[1.2]">
                          {(reflection as WeeklyReflection).nextWeekPlan}
                        </p>
                      </div>
                      {(reflection as WeeklyReflection).publicFocus && (
                        <div className="space-y-2">
                          <h3 className="font-albert text-[18px] font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                            Focus for next week
                          </h3>
                          <p className="font-sans text-[16px] text-text-secondary tracking-[-0.3px] leading-[1.2]">
                            {(reflection as WeeklyReflection).publicFocus}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[20px] p-6">
            <p className="font-sans text-[16px] text-text-secondary tracking-[-0.3px] leading-[1.4] text-center">
              No reflections recorded for this goal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

