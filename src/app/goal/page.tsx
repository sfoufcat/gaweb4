'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import type { DailyReflection, WeeklyReflection, EmotionalState, EveningEmotionalState, ReflectionEmotionalState, EveningCheckIn } from '@/types';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DEMO_USER } from '@/lib/demo-utils';

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
const onTrackLabels = {
  on_track: 'On track',
  not_sure: 'Not sure',
  off_track: 'Off track',
};

export default function GoalPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { isDemoMode } = useDemoMode();
  
  // In demo mode, use demo user
  const user = useMemo(() => {
    if (isDemoMode) {
      return {
        id: DEMO_USER.id,
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        imageUrl: DEMO_USER.imageUrl,
      };
    }
    return clerkUser;
  }, [isDemoMode, clerkUser]);
  
  const isLoaded = isDemoMode || clerkLoaded;
  
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<{
    goal: string;
    targetDate: string;
    progress: number;
  } | null>(null);
  const [reflections, setReflections] = useState<(DailyReflection | WeeklyReflection)[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [reflectionsLoading, setReflectionsLoading] = useState(true);
  const [eveningCheckIn, setEveningCheckIn] = useState<EveningCheckIn | null>(null);
  const [weeklyReflection, setWeeklyReflection] = useState<{ completedAt?: string } | null>(null);

  // Check if we're in the weekly reflection window (Fri after evening, Sat, Sun)
  const isWeeklyReflectionWindow = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    
    const isFriday = dayOfWeek === 5;
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    
    // Saturday or Sunday - always in window
    if (isSaturday || isSunday) {
      return true;
    }
    
    // Friday - only in window after evening check-in is completed
    if (isFriday && eveningCheckIn?.completedAt) {
      return true;
    }
    
    return false;
  }, [eveningCheckIn]);

  // Determine if weekly reflection button should be shown (in window + not completed)
  const shouldShowWeeklyReflection = isWeeklyReflectionWindow && !weeklyReflection?.completedAt;
  
  // Determine if "Week Closed" should be shown (in window + completed)
  const shouldShowWeekClosed = isWeeklyReflectionWindow && !!weeklyReflection?.completedAt;

  // Fetch user goal and reflections
  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }

      // Demo mode: set demo goal and reflections
      if (isDemoMode) {
        setGoal({
          goal: 'Build a morning routine and exercise 5 days a week',
          targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
          progress: 65,
        });
        
        // Varied reflection notes for demo
        const demoNotes = [
          'Crushed my morning routine today! Woke up at 6 AM and hit the gym before work.',
          'Struggled a bit with motivation this morning, but pushed through and completed my workout anyway.',
          'Best workout of the week! Energy levels were high and I added extra reps to my routine.',
          'Took a rest day but still maintained my morning journaling habit. Feeling refreshed.',
          'Early morning yoga session followed by a healthy breakfast. Consistency is building!',
          'Missed the gym but went for an evening walk instead. Progress, not perfection.',
          'Great start to the day! Meditation + workout + healthy breakfast. Feeling unstoppable.',
        ];
        
        // Generate demo reflections
        const demoReflections: DailyReflection[] = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          return {
            id: `demo-reflection-${i}`,
            userId: DEMO_USER.id,
            organizationId: 'demo-org',
            goalId: 'demo-goal-1',
            date: date.toISOString().split('T')[0],
            type: 'daily' as const,
            emotionalState: (['confident', 'energized', 'steady', 'neutral'] as EmotionalState[])[i % 4],
            tasksCompleted: 2 + (i % 3),
            tasksTotal: 3 + (i % 2),
            note: demoNotes[i % demoNotes.length],
            createdAt: date.toISOString(),
            updatedAt: date.toISOString(),
          };
        });
        setReflections(demoReflections);
        setEveningCheckIn({ completedAt: new Date().toISOString() } as EveningCheckIn);
        setLoading(false);
        setReflectionsLoading(false);
        return;
      }

      try {
        // Fetch user data with goal
        const userResponse = await fetch('/api/user/me');
        if (userResponse.ok) {
          const data = await userResponse.json();
          if (data.goal) {
            // Also fetch goalProgress from user data
            setGoal({
              goal: data.goal.goal,
              targetDate: data.goal.targetDate,
              progress: data.user?.goalProgress || data.goal.progress?.percentage || 0,
            });
          }
        }

        // Fetch reflections
        const reflectionsResponse = await fetch('/api/goal/reflections');
        if (reflectionsResponse.ok) {
          const reflectionsData = await reflectionsResponse.json();
          setReflections(reflectionsData.reflections || []);
        }

        // Fetch evening check-in status (for Friday logic)
        const eveningResponse = await fetch('/api/checkin/evening');
        if (eveningResponse.ok) {
          const eveningData = await eveningResponse.json();
          setEveningCheckIn(eveningData.checkIn || null);
        }

        // Fetch weekly reflection status
        const weeklyResponse = await fetch('/api/checkin/weekly');
        if (weeklyResponse.ok) {
          const weeklyData = await weeklyResponse.json();
          setWeeklyReflection(weeklyData.checkIn || null);
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
  }, [user, isLoaded, isDemoMode]);

  // Calculate days left
  const daysLeft = useMemo(() => {
    if (!goal?.targetDate) return null;
    const today = new Date();
    const target = new Date(goal.targetDate);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [goal?.targetDate]);

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

  // Handle redirects in useEffect to avoid setState during render
  useEffect(() => {
    if (!isLoaded || loading) return;

    if (!user && !isDemoMode) {
      router.push('/sign-in');
      return;
    }

    if (!goal && !isDemoMode) {
      router.push('/onboarding/goal');
    }
  }, [isLoaded, loading, user, isDemoMode, goal, router]);

  // Show loading state
  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  // Show loading while redirecting
  if ((!user && !isDemoMode) || (!goal && !isDemoMode)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  // Safety check - should not reach here without goal in non-demo mode
  if (!goal) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  const progressPercentage = goal.progress || 0;

  // Circular Progress Component
  const CircularProgress = ({ size = 160 }: { size?: number }) => (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
        {/* Background circle */}
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          className="stroke-[#f3f1ef] dark:stroke-[#262b35]"
          strokeWidth="10"
        />
        {/* Progress circle - teal color from Figma */}
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke="#3d8b8b"
          strokeWidth="10"
          strokeDasharray={`${2 * Math.PI * 70}`}
          strokeDashoffset={`${2 * Math.PI * 70 * (1 - progressPercentage / 100)}`}
          strokeLinecap="round"
        />
        {/* Small circle at start of progress (amber/gold color) */}
        <circle
          cx="80"
          cy="10"
          r="5"
          fill="#d4a76a"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-albert text-[36px] text-text-primary dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2]">
          {Math.round(progressPercentage)}%
        </p>
        <p className="font-sans text-[16px] text-text-muted dark:text-[#7d8190] tracking-[-0.3px]">
          complete
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Mobile Layout */}
      <div className="flex lg:hidden flex-col gap-6 py-5">
        {/* Back button on left, Edit icon on right */}
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] transition-colors"
          >
            <svg className="w-5 h-5 text-text-primary dark:text-[#f5f5f8]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <Link 
            href="/goal/edit"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] transition-colors"
          >
            <svg className="w-5 h-5 text-text-primary dark:text-[#f5f5f8]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
          </Link>
        </div>

        {/* Goal Title - Centered */}
        <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2] text-center">
          {capitalizeFirstLetter(goal.goal)}
        </h1>

        {/* Circular Progress - Centered */}
        <div className="flex justify-center">
          <CircularProgress size={160} />
        </div>

        {/* Date and Days Left - Centered */}
        <div className="flex flex-col gap-1 items-center">
          <div className="flex items-center gap-[5px] text-text-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className="font-sans text-[16px] tracking-[-0.3px]">
              by {formatDate(goal.targetDate)}
            </span>
          </div>
          <div className="flex items-center gap-[5px] text-text-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="font-sans text-[16px] tracking-[-0.3px]">
              {daysLeft !== null && daysLeft >= 0 ? `${daysLeft} days left` : daysLeft !== null ? 'Goal date passed' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop Layout - Circle on left, title on right */}
      <div className="hidden lg:flex items-center justify-between w-full py-5">
        {/* Left: Circle and Goal Info */}
        <div className="flex items-center gap-6">
          {/* Circular Progress */}
          <CircularProgress size={160} />

          {/* Goal Info */}
          <div className="flex flex-col gap-2">
            <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
              {capitalizeFirstLetter(goal.goal)}
            </h1>

            {/* Date and Days Left */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-[5px] text-text-secondary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <span className="font-sans text-[16px] tracking-[-0.3px]">
                  by {formatDate(goal.targetDate)}
                </span>
              </div>
              <div className="flex items-center gap-[5px] text-text-secondary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="font-sans text-[16px] tracking-[-0.3px]">
                  {daysLeft !== null && daysLeft >= 0 ? `${daysLeft} days left` : daysLeft !== null ? 'Goal date passed' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Edit Button (Pencil) */}
        <Link 
          href="/goal/edit"
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] transition-colors"
        >
          <svg className="w-5 h-5 text-text-primary dark:text-[#f5f5f8]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
          </svg>
        </Link>
      </div>

      {/* Weekly Reflection CTA - Only show on Fri (after evening), Sat, Sun when not completed */}
      {shouldShowWeeklyReflection && (
        <div className="pt-6 pb-4">
          <Link
            href="/checkin/weekly/checkin"
            className="w-full flex items-center justify-center gap-3 py-4 bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#05070b] rounded-[32px] font-sans font-bold text-[16px] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] transition-all"
          >
            <Calendar className="w-5 h-5" />
            Start Weekly Reflection
          </Link>
        </div>
      )}
      
      {/* Week Closed indicator - only show in the reflection window when completed */}
      {shouldShowWeekClosed && (
        <div className="pt-6 pb-4">
          <div className="w-full flex items-center justify-center gap-3 py-4 bg-[#f3f1ef] dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2] rounded-[32px] font-sans font-bold text-[16px] tracking-[-0.5px]">
            <CheckCircle2 className="w-5 h-5 text-[#4CAF50]" />
            Week Closed
          </div>
        </div>
      )}

      {/* Reflections Section */}
      <div className="pt-6">
        <h2 className="font-albert text-[24px] text-text-primary tracking-[-1.5px] leading-[1.3] mb-3">
          Reflections
        </h2>

        {/* Tabs - Full width */}
        <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-[32px] transition-all ${
              activeTab === 'daily'
                ? 'bg-white dark:bg-[#171b22] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
                : ''
            }`}
          >
            <svg className={`w-5 h-5 ${activeTab === 'daily' ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#7d8190]'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
              activeTab === 'daily' ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#7d8190]'
            }`}>
              Daily
            </span>
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-[32px] transition-all ${
              activeTab === 'weekly'
                ? 'bg-white dark:bg-[#171b22] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
                : ''
            }`}
          >
            <svg className={`w-5 h-5 ${activeTab === 'weekly' ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#7d8190]'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            <span className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
              activeTab === 'weekly' ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#7d8190]'
            }`}>
              Weekly
            </span>
          </button>
        </div>

        {/* Reflections List */}
        {reflectionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-text-primary dark:border-[#f5f5f8]" />
          </div>
        ) : filteredReflections.length > 0 ? (
          <div className="space-y-3">
            {filteredReflections.map((reflection) => (
              <div key={reflection.id} className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
                {reflection.type === 'daily' ? (
                  // Daily Reflection Card
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[14px] text-text-muted dark:text-[#7d8190]">
                      <span>{formatReflectionDate(reflection.createdAt)}</span>
                      <span>
                        {(reflection as DailyReflection).tasksCompleted}/{(reflection as DailyReflection).tasksTotal}, {getEmotionalStateLabel((reflection as DailyReflection).emotionalState)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                        Note
                      </h3>
                      <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.2]">
                        {(reflection as DailyReflection).note}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Weekly Reflection Card
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[14px] text-text-muted dark:text-[#7d8190]">
                      <span>{formatReflectionDate(reflection.createdAt)}</span>
                      <span>
                        {(reflection as WeeklyReflection).progressChange >= 0 ? '+' : ''}{(reflection as WeeklyReflection).progressChange}%, {onTrackLabels[(reflection as WeeklyReflection).onTrackStatus]}
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                          What went well?
                        </h3>
                        <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.2]">
                          {(reflection as WeeklyReflection).whatWentWell}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                          What were your biggest obstacles?
                        </h3>
                        <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.2]">
                          {(reflection as WeeklyReflection).biggestObstacles}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                          What will you do differently next week?
                        </h3>
                        <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.2]">
                          {(reflection as WeeklyReflection).nextWeekPlan}
                        </p>
                      </div>
                      {(reflection as WeeklyReflection).publicFocus && (
                        <div className="space-y-2">
                          <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                            Focus for next week
                          </h3>
                          <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.2]">
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
          // Empty State
          <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6">
            <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.4] text-center">
              Your reflections will appear here
              <br />
              as soon as they&apos;re ready to be completed.
              <br /><br />
              Check back when the app asks you to reflect —
              <br />
              each entry will be saved and displayed on this screen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
