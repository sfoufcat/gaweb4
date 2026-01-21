'use client';

/**
 * DashboardSkeleton - Neutral loading state for HomePageWrapper
 *
 * Shows skeleton placeholders that work for both coach and client views.
 * Prevents flash of wrong content while ViewModeContext determines role.
 *
 * Structure mirrors the common elements:
 * - Header with profile badge area + icons
 * - Stats grid (4 cards)
 * - Content sections
 */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-app-bg">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="space-y-3 mb-6">
          {/* Profile badge + icons row */}
          <div className="flex items-center justify-between">
            {/* Profile badge skeleton */}
            <div className="bg-[#f3f1ef] dark:bg-[#181d28] rounded-[40px] p-1 flex items-center gap-3 pr-4">
              {/* Avatar */}
              <div className="w-[48px] h-[48px] rounded-full bg-[#e8e5e0] dark:bg-[#262b35] animate-pulse" />
              {/* Name + greeting */}
              <div className="space-y-1.5">
                <div className="h-4 w-24 bg-[#e8e5e0] dark:bg-[#262b35] rounded-full animate-pulse" />
                <div className="h-4 w-20 bg-[#e8e5e0] dark:bg-[#262b35] rounded-full animate-pulse" />
              </div>
            </div>

            {/* Icons skeleton */}
            <div className="flex items-center gap-2">
              {/* Desktop icons */}
              <div className="hidden lg:flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#181d28] animate-pulse" />
                <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#181d28] animate-pulse" />
              </div>
              {/* Alignment gauge skeleton */}
              <div className="w-[42px] h-[42px] rounded-full bg-[#f3f1ef] dark:bg-[#181d28] animate-pulse" />
              {/* Theme toggle skeleton */}
              <div className="hidden lg:block w-[28px] h-[62px] rounded-full bg-[#f3f1ef] dark:bg-[#181d28] animate-pulse" />
            </div>
          </div>

          {/* Date row */}
          <div className="flex items-center justify-between lg:justify-start">
            <div className="h-3 w-32 bg-[#e8e5e0] dark:bg-[#262b35] rounded-full animate-pulse" />
            {/* Mobile icons */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-8 h-8 rounded-full bg-[#f3f1ef] dark:bg-[#181d28] animate-pulse" />
              <div className="w-8 h-8 rounded-full bg-[#f3f1ef] dark:bg-[#181d28] animate-pulse" />
            </div>
          </div>

          {/* Headline skeleton */}
          <div className="h-10 w-64 bg-[#e8e5e0] dark:bg-[#262b35] rounded-lg animate-pulse" />
        </div>

        {/* Stats grid skeleton - works for both coach (revenue, members, etc.) and client (habits, focus, etc.) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#f3f1ef] dark:bg-[#181d28] rounded-[20px] p-4 h-[100px] animate-pulse"
            >
              <div className="h-3 w-16 bg-[#e8e5e0] dark:bg-[#262b35] rounded-full mb-3" />
              <div className="h-6 w-12 bg-[#e8e5e0] dark:bg-[#262b35] rounded-lg mb-2" />
              <div className="h-2 w-20 bg-[#e8e5e0] dark:bg-[#262b35] rounded-full" />
            </div>
          ))}
        </div>

        {/* Main content area skeleton - two column layout on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Card 1 */}
          <div className="bg-[#f3f1ef] dark:bg-[#181d28] rounded-[28px] p-5 h-[180px] animate-pulse">
            <div className="h-4 w-24 bg-[#e8e5e0] dark:bg-[#262b35] rounded-full mb-4" />
            <div className="h-20 w-full bg-[#e8e5e0] dark:bg-[#262b35] rounded-xl mb-3" />
            <div className="h-3 w-32 bg-[#e8e5e0] dark:bg-[#262b35] rounded-full" />
          </div>

          {/* Card 2 */}
          <div className="bg-[#f3f1ef] dark:bg-[#181d28] rounded-[28px] p-5 h-[180px] animate-pulse">
            <div className="h-4 w-28 bg-[#e8e5e0] dark:bg-[#262b35] rounded-full mb-4" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-[#e8e5e0] dark:bg-[#262b35] rounded-lg" />
              <div className="h-4 w-3/4 bg-[#e8e5e0] dark:bg-[#262b35] rounded-lg" />
              <div className="h-4 w-1/2 bg-[#e8e5e0] dark:bg-[#262b35] rounded-lg" />
            </div>
          </div>
        </div>

        {/* Quick actions / Section skeleton */}
        <div className="space-y-4">
          <div className="h-5 w-32 bg-[#e8e5e0] dark:bg-[#262b35] rounded-full animate-pulse" />
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[200px] h-[120px] bg-[#f3f1ef] dark:bg-[#181d28] rounded-[20px] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardSkeleton;
