'use client';

/**
 * Profile Page Loading Skeleton
 * 
 * Shows a beautiful skeleton matching the profile layout:
 * - Profile header (avatar, name, profession, location)
 * - Tab switcher
 * - Tab content placeholders
 */
export default function ProfileLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Mobile Header Actions Row */}
      <div className="flex lg:hidden items-center justify-between w-full py-5">
        <div className="w-6 h-6 rounded bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 animate-pulse" />
          <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 animate-pulse" />
        </div>
      </div>

      {/* Mobile Profile Header - Avatar and Name centered */}
      <div className="flex lg:hidden flex-col items-center gap-4 w-full mb-6">
        {/* Avatar Skeleton with ring */}
        <div className="relative">
          <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-br from-[#e1ddd8] to-[#d4cfc9] dark:from-[#262b35] dark:to-[#1e222a] animate-pulse" />
          {/* Story ring effect */}
          <div className="absolute inset-0 rounded-full border-[3px] border-[#e1ddd8]/30 dark:border-[#262b35]/30 animate-pulse" />
        </div>

        {/* Name and Info centered */}
        <div className="flex flex-col gap-3 items-center">
          {/* Name */}
          <div className="h-10 w-48 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
          
          {/* Profession */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
            <div className="h-4 w-36 bg-[#e1ddd8]/70 dark:bg-[#262b35]/70 rounded-full animate-pulse" />
          </div>
          
          {/* Location */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
            <div className="h-4 w-28 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Desktop Profile Header */}
      <div className="hidden lg:flex items-center justify-between w-full py-5 mb-4">
        <div className="flex items-center gap-4">
          {/* Avatar Skeleton with ring */}
          <div className="relative flex-shrink-0">
            <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-br from-[#e1ddd8] to-[#d4cfc9] dark:from-[#262b35] dark:to-[#1e222a] animate-pulse" />
            <div className="absolute inset-0 rounded-full border-[3px] border-[#e1ddd8]/30 dark:border-[#262b35]/30 animate-pulse" />
          </div>

          {/* Name and Info */}
          <div className="flex flex-col gap-3">
            {/* Name */}
            <div className="h-10 w-52 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
            
            {/* Profession */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
              <div className="h-4 w-44 bg-[#e1ddd8]/70 dark:bg-[#262b35]/70 rounded-full animate-pulse" />
            </div>
            
            {/* Location */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
              <div className="h-4 w-32 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 animate-pulse" />
          <div className="w-10 h-10 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 animate-pulse" />
        </div>
      </div>

      {/* Tab Switcher Skeleton */}
      <div className="flex items-center justify-center py-3 mb-6">
        <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2 w-full">
          {/* Active Tab */}
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px] bg-white dark:bg-[#1e222a] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none">
            <div className="w-5 h-5 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
            <div className="h-5 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
          </div>
          {/* Inactive Tab */}
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px]">
            <div className="w-5 h-5 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/40 animate-pulse" />
            <div className="h-5 w-24 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Tab Content - Journey Tab Skeleton */}
      <div className="space-y-6">
        {/* Goal Card Skeleton */}
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6 space-y-4 animate-pulse">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div className="h-6 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
            <div className="h-5 w-16 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full" />
          </div>
          
          {/* Goal text */}
          <div className="space-y-2">
            <div className="h-5 w-full bg-[#e1ddd8]/70 dark:bg-[#262b35]/70 rounded-full" />
            <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full" />
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-4 w-20 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full" />
              <div className="h-4 w-12 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full" />
            </div>
            <div className="h-2 w-full bg-[#e1ddd8]/40 dark:bg-[#262b35]/40 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
            </div>
          </div>
        </div>

        {/* Habits Section Skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-20 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
          
          {/* Habit cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className="bg-white dark:bg-[#171b22] rounded-[20px] p-5 animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  {/* Habit icon */}
                  <div className="w-10 h-10 rounded-xl bg-[#e1ddd8] dark:bg-[#262b35]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-3/4 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
                    <div className="h-4 w-1/2 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full" />
                  </div>
                </div>
                {/* Streak dots */}
                <div className="flex gap-1.5 mt-4">
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <div 
                      key={j} 
                      className="w-6 h-6 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50" 
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
