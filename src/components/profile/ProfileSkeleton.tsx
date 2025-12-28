'use client';

/**
 * Profile Page Skeleton Components
 * 
 * Provides loading skeletons for:
 * - Profile View (header, tabs, content)
 * - Profile Edit Form
 */

interface ProfileSkeletonProps {
  variant?: 'view' | 'edit';
  fromOnboarding?: boolean;
}

export function ProfileSkeleton({ variant = 'view', fromOnboarding = false }: ProfileSkeletonProps) {
  if (variant === 'edit') {
    return <ProfileEditSkeleton fromOnboarding={fromOnboarding} />;
  }
  return <ProfileViewSkeleton />;
}

function ProfileViewSkeleton() {
  return (
    <>
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
        {/* Avatar with shimmer effect */}
        <div className="relative">
          <div className="w-[120px] h-[120px] rounded-full overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-[#e1ddd8] via-[#ebe8e5] to-[#e1ddd8] dark:from-[#262b35] dark:via-[#2d333f] dark:to-[#262b35] animate-shimmer" 
                 style={{ backgroundSize: '200% 100%' }} />
          </div>
          <div className="absolute inset-0 rounded-full border-[3px] border-[#e1ddd8]/30 dark:border-[#262b35]/30" />
        </div>

        {/* Name and Info centered */}
        <div className="flex flex-col gap-3 items-center">
          <div className="h-10 w-48 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
            <div className="h-4 w-36 bg-[#e1ddd8]/70 dark:bg-[#262b35]/70 rounded-full animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
            <div className="h-4 w-28 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Desktop Profile Header */}
      <div className="hidden lg:flex items-center justify-between w-full py-5 mb-4">
        <div className="flex items-center gap-4">
          {/* Avatar with shimmer */}
          <div className="relative flex-shrink-0">
            <div className="w-[120px] h-[120px] rounded-full overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-[#e1ddd8] via-[#ebe8e5] to-[#e1ddd8] dark:from-[#262b35] dark:via-[#2d333f] dark:to-[#262b35] animate-shimmer" 
                   style={{ backgroundSize: '200% 100%' }} />
            </div>
            <div className="absolute inset-0 rounded-full border-[3px] border-[#e1ddd8]/30 dark:border-[#262b35]/30" />
          </div>

          <div className="flex flex-col gap-3">
            <div className="h-10 w-52 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
              <div className="h-4 w-44 bg-[#e1ddd8]/70 dark:bg-[#262b35]/70 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
              <div className="h-4 w-32 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 animate-pulse" />
          <div className="w-10 h-10 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 animate-pulse" />
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center justify-center py-3 mb-6">
        <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2 w-full">
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px] bg-white dark:bg-[#1e222a] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none">
            <div className="w-5 h-5 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse" />
            <div className="h-5 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px]">
            <div className="w-5 h-5 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/40 animate-pulse" />
            <div className="h-5 w-24 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Goal Card */}
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-6 space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-6 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
            <div className="h-5 w-16 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-5 w-full bg-[#e1ddd8]/70 dark:bg-[#262b35]/70 rounded-full" />
            <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full" />
          </div>
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

        {/* Habits Section */}
        <div className="space-y-4">
          <div className="h-6 w-20 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className="bg-white dark:bg-[#171b22] rounded-[20px] p-5 animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#e1ddd8] dark:bg-[#262b35]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-3/4 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
                    <div className="h-4 w-1/2 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full" />
                  </div>
                </div>
                <div className="flex gap-1.5 mt-4">
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <div key={j} className="w-6 h-6 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileEditSkeleton({ fromOnboarding }: { fromOnboarding: boolean }) {
  return (
    <div className={fromOnboarding ? 'min-h-full flex flex-col items-center justify-start py-6 px-4' : ''}>
      <div className={fromOnboarding ? 'w-full max-w-md lg:max-w-2xl mx-auto' : ''}>
        {/* Title */}
        {fromOnboarding ? (
          <div className="h-12 w-48 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse mb-8" />
        ) : (
          <div className="h-10 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse mb-6" />
        )}

        <div className="space-y-9">
          {/* Avatar Section */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-40 h-40 rounded-full overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-[#e1ddd8] via-[#ebe8e5] to-[#e1ddd8] dark:from-[#262b35] dark:via-[#2d333f] dark:to-[#262b35] animate-shimmer" 
                     style={{ backgroundSize: '200% 100%' }} />
              </div>
              {/* Edit button */}
              <div className="absolute bottom-0 right-0 w-6 h-6 bg-white dark:bg-[#1e222a] rounded-full border border-[#e1ddd8] dark:border-[#262b35] animate-pulse" />
            </div>
          </div>

          {/* Basic Info Fields */}
          <div className="space-y-4">
            {[
              { label: 'My name is', width: 'w-full' },
              { label: 'Location', width: 'w-3/4' },
              { label: 'Profession', width: 'w-2/3' },
              { label: 'Company', width: 'w-1/2' },
            ].map((field, i) => (
              <div key={i} className="space-y-1" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="h-3 w-16 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full animate-pulse ml-4" />
                <div className="h-[54px] w-full bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] animate-pulse flex items-center px-4">
                  <div className={`h-5 ${field.width} bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full`} />
                </div>
              </div>
            ))}
          </div>

          {/* About Me Section */}
          <div className="space-y-4">
            <div className="h-7 w-28 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
            
            {/* Bio textarea */}
            <div className="space-y-1">
              <div className="h-3 w-12 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full animate-pulse ml-4" />
              <div className="h-[100px] w-full bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[20px] animate-pulse p-4">
                <div className="space-y-2">
                  <div className="h-4 w-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full" />
                  <div className="h-4 w-4/5 bg-[#e1ddd8]/40 dark:bg-[#262b35]/40 rounded-full" />
                  <div className="h-4 w-2/3 bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 rounded-full" />
                </div>
              </div>
            </div>

            {/* Interests */}
            <div className="space-y-1">
              <div className="h-3 w-20 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full animate-pulse ml-4" />
              <div className="h-[54px] w-full bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] animate-pulse flex items-center px-4">
                <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full" />
              </div>
            </div>
          </div>

          {/* Contacts Section */}
          <div className="space-y-4">
            <div className="h-7 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
            
            {['Instagram', 'LinkedIn', 'X', 'Blog/website', 'Email', 'Phone'].map((field, i) => (
              <div key={i} className="space-y-1" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="h-3 w-16 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full animate-pulse ml-4" />
                <div className={`h-[54px] w-full ${field === 'Email' ? 'bg-[#f3f1ef]' : 'bg-white dark:bg-[#1e222a]'} border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] animate-pulse flex items-center px-4`}>
                  <div className="h-5 w-1/2 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="h-[50px] w-full bg-[#e1ddd8] dark:bg-[#262b35] rounded-[32px] animate-pulse" />
            <div className="h-[50px] w-full bg-white border border-[rgba(215,210,204,0.5)] rounded-[32px] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export { ProfileViewSkeleton, ProfileEditSkeleton };






