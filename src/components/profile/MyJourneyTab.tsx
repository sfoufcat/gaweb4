'use client';

import Link from 'next/link';
import type { FirebaseUser, Habit, GoalHistoryEntry } from '@/types';

interface MyJourneyTabProps {
  user: FirebaseUser & { publicFocus?: string; publicFocusUpdatedAt?: string; goalHistory?: GoalHistoryEntry[] };
  goal?: {
    goal: string;
    targetDate: string;
    progress: {
      percentage: number;
    };
  } | null;
  habits?: Habit[];
  isOwnProfile?: boolean;
}

export function MyJourneyTab({ user, goal, habits = [], isOwnProfile = true }: MyJourneyTabProps) {
  // Calculate days left for goal
  const calculateDaysLeft = (targetDateStr: string) => {
    const today = new Date();
    const targetDate = new Date(targetDateStr);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysLeft = goal ? calculateDaysLeft(goal.targetDate) : 0;
  const progressPercentage = goal?.progress?.percentage || 0;
  
  // Count accomplished goals (where completedAt is not null)
  const accomplishedGoals = user.goalHistory?.filter(g => g.completedAt !== null) || [];

  // Helper to capitalize first letter
  const capitalizeFirstLetter = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Determine focus label based on day of week
  // Mon-Thu (1-4): "Focus for this week", Fri-Sun (5,6,0): "Focus for next week"
  const day = new Date().getDay();
  const isEarlyWeek = day >= 1 && day <= 4;
  const focusLabel = isEarlyWeek ? "Focus for this week" : "Focus for next week";

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* My Identity Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-albert text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
            My identity
          </h2>
          {isOwnProfile && (
            <Link 
              href="/identity" 
              className="font-sans text-xs text-accent-secondary hover:text-[#8a6649] font-medium transition-colors"
            >
              Edit
            </Link>
          )}
        </div>

        {user.identity ? (
          <p className="font-sans text-2xl text-text-secondary tracking-[-0.5px] leading-[1.2]">
            I am {user.identity.startsWith('I am ') ? user.identity.slice(5) : user.identity}
          </p>
        ) : (
          <div className="text-center py-8 bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35]">
            <p className="font-sans text-text-secondary dark:text-[#b2b6c2] mb-4">No identity set yet</p>
            {isOwnProfile && (
              <Link
                href="/identity"
                className="inline-block px-6 py-3 bg-brand-accent hover:opacity-90 text-white rounded-full font-sans font-semibold text-sm hover:scale-105 transition-transform"
              >
                Define Your Identity
              </Link>
            )}
          </div>
        )}
      </div>

      {/* My Goals Section */}
      <div className="space-y-3">
        <h2 className="font-albert text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
          My goals
        </h2>

        {goal ? (
          <>
            {/* Goal Card - Clickable only for own profile */}
            {isOwnProfile ? (
              <Link 
                href="/goal"
                className="bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35] p-4 flex gap-3 hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors cursor-pointer block"
              >
                {/* Circular Progress */}
                <div className="relative w-[100px] h-[100px] flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
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
                      className="stroke-[#2c2520] dark:stroke-[#f5f5f8]"
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - progressPercentage / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="font-albert text-lg font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                      {progressPercentage}%
                    </p>
                    <p className="font-albert text-xs text-text-muted tracking-[-0.24px] leading-[1.1]">
                      complete
                    </p>
                  </div>
                </div>

                {/* Goal Details */}
                <div className="flex-1 flex flex-col gap-2">
                  <p className="font-sans text-xs text-text-muted leading-[1.2]">
                    Current goal
                  </p>
                  <p className="font-albert text-lg font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                    {capitalizeFirstLetter(goal.goal)}
                  </p>
                  <p className="font-sans text-sm text-text-secondary leading-[1.2]">
                    {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today' : 'Overdue'}
                  </p>
                </div>
              </Link>
            ) : (
              /* Non-clickable goal card for other profiles */
              <div className="bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35] p-4 flex gap-3">
                {/* Circular Progress */}
                <div className="relative w-[100px] h-[100px] flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
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
                      className="stroke-[#2c2520] dark:stroke-[#f5f5f8]"
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - progressPercentage / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="font-albert text-lg font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                      {progressPercentage}%
                    </p>
                    <p className="font-albert text-xs text-text-muted tracking-[-0.24px] leading-[1.1]">
                      complete
                    </p>
                  </div>
                </div>

                {/* Goal Details */}
                <div className="flex-1 flex flex-col gap-2">
                  <p className="font-sans text-xs text-text-muted leading-[1.2]">
                    Current goal
                  </p>
                  <p className="font-albert text-lg font-semibold text-text-primary tracking-[-1px] leading-[1.3]">
                    {capitalizeFirstLetter(goal.goal)}
                  </p>
                  <p className="font-sans text-sm text-text-secondary leading-[1.2]">
                    {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today' : 'Overdue'}
                  </p>
                </div>
              </div>
            )}
            
            {/* See accomplished goals link */}
            {accomplishedGoals.length > 0 && (
              <Link 
                href="/goal/accomplished"
                className="flex items-center justify-center gap-1 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.927 0" />
                </svg>
                <span className="font-sans text-sm">
                  See accomplished goals ({accomplishedGoals.length})
                </span>
              </Link>
            )}
          </>
        ) : (
          <div className="text-center py-8 bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35]">
            <p className="font-sans text-text-secondary dark:text-[#b2b6c2] mb-4">No goal set yet</p>
            {isOwnProfile && (
              <Link
                href="/goal"
                className="inline-block px-6 py-3 bg-brand-accent hover:opacity-90 text-white rounded-full font-sans font-semibold text-sm hover:scale-105 transition-transform"
              >
                Define Your Goal
              </Link>
            )}
            
            {/* See accomplished goals even without active goal */}
            {accomplishedGoals.length > 0 && (
              <Link 
                href="/goal/accomplished"
                className="flex items-center justify-center gap-1 py-2 mt-4 text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.927 0" />
                </svg>
                <span className="font-sans text-sm">
                  See accomplished goals ({accomplishedGoals.length})
                </span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Focus for Next Week Section */}
      {user.publicFocus && (
        <div className="space-y-3">
          <h2 className="font-albert text-2xl text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            {focusLabel}
          </h2>
          <div className="bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35] p-4">
            <p className="font-sans text-lg text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.3]">
              {user.publicFocus}
            </p>
            {user.publicFocusUpdatedAt && (
              <p className="font-sans text-xs text-text-muted dark:text-[#7d8190] mt-2">
                Updated {new Date(user.publicFocusUpdatedAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* My Habits Section */}
      <div className="space-y-3">
        <h2 className="font-albert text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
          My habits
        </h2>

        {habits.length > 0 ? (
          <div className="space-y-2">
            {habits.slice(0, 3).map((habit) => (
              isOwnProfile ? (
                <Link 
                  key={habit.id}
                  href={`/habits/${habit.id}`}
                  className="block bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35] p-4 hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors"
                >
                  <p className="font-albert text-lg font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                    {habit.text}
                  </p>
                </Link>
              ) : (
                <div 
                  key={habit.id}
                  className="bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35] p-4"
                >
                  <p className="font-albert text-lg font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                    {habit.text}
                  </p>
                </div>
              )
            ))}
            
            {isOwnProfile && habits.length > 3 && (
              <Link 
                href="/habits"
                className="flex items-center justify-center gap-1 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="font-albert text-xs leading-[16px]">Show more</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </Link>
            )}
          </div>
        ) : (
          <div className="text-center py-8 bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35]">
            <p className="font-sans text-text-secondary dark:text-[#b2b6c2] mb-4">No habits yet</p>
            {isOwnProfile && (
              <Link
                href="/habits/new"
                className="inline-block px-6 py-3 bg-brand-accent hover:opacity-90 text-white rounded-full font-sans font-semibold text-sm hover:scale-105 transition-transform"
              >
                Create First Habit
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

