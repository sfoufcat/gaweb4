/**
 * CoachPlanSkeleton
 * 
 * Beautiful skeleton loader for the Coach Upgrade Plan page.
 * Matches the structure of the actual plan page with:
 * - Header with logo
 * - Title and subtitle
 * - Three plan cards in a grid
 * - CTA button
 * - Why upgrade section
 */

export function CoachPlanSkeleton() {
  return (
    <div className="min-h-screen bg-app-bg">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-50 bg-app-bg/95 backdrop-blur-sm border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse" />
            <div className="h-5 w-28 rounded-md bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse" />
          </div>
          <div className="w-6 h-6 rounded-full bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
        </div>
      </div>

      <div className="px-4 py-8 lg:py-12 max-w-6xl mx-auto">
        {/* Title & Subtitle Skeleton */}
        <div className="text-center mb-10">
          <div className="h-10 lg:h-12 w-64 lg:w-80 mx-auto rounded-lg bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-4" />
          <div className="h-5 w-72 lg:w-96 mx-auto rounded-md bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
        </div>

        {/* Plan Cards Grid Skeleton */}
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 mb-12">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`relative p-6 rounded-[24px] border-2 ${
                index === 1
                  ? 'border-[#a07855]/30 bg-[#faf8f6] dark:bg-[#171b22]'
                  : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Tag placeholder */}
              {index < 2 && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className={`h-6 w-24 rounded-full animate-pulse ${
                    index === 1 
                      ? 'bg-gradient-to-r from-[#a07855]/40 to-[#c9a07a]/40' 
                      : 'bg-[#6b7280]/30'
                  }`} />
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-4 pr-8">
                <div className="h-7 w-24 rounded-md bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-2" />
                <div className="h-4 w-40 rounded-md bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
              </div>

              {/* Pricing */}
              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  <div className="h-10 w-20 rounded-md bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse" />
                  <div className="h-4 w-14 rounded-md bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                </div>
              </div>

              {/* Limits Grid */}
              <div className="grid grid-cols-2 gap-2 mb-5 p-3 bg-[#f9f8f7] dark:bg-[#11141b] rounded-xl">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="text-center py-1">
                    <div className="h-5 w-8 mx-auto rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-1" />
                    <div className="h-3 w-14 mx-auto rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
                  </div>
                ))}
              </div>

              {/* Features List */}
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse mt-0.5" />
                    <div 
                      className="h-4 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse"
                      style={{ width: `${60 + Math.random() * 30}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA Button Skeleton */}
        <div className="max-w-md mx-auto mb-12">
          <div className="w-full h-14 rounded-[32px] bg-gradient-to-r from-[#a07855]/30 to-[#c9a07a]/30 animate-pulse" />
          <div className="h-3 w-40 mx-auto mt-4 rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
        </div>

        {/* Why Upgrade Section Skeleton */}
        <div className="mb-12">
          <div className="h-7 w-48 mx-auto rounded-md bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-8" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#171b22] rounded-2xl p-5 border border-[#e1ddd8] dark:border-[#262b35] text-center"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="w-12 h-12 bg-[#faf8f6] dark:bg-[#262b35] rounded-xl mx-auto mb-3 animate-pulse" />
                <div className="h-4 w-24 mx-auto rounded bg-[#e1ddd8]/60 dark:bg-[#262b35] animate-pulse mb-2" />
                <div className="h-3 w-32 mx-auto rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Money Back Guarantee Skeleton */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="bg-gradient-to-br from-[#f0fdf4]/50 to-[#dcfce7]/50 dark:from-[#052e16]/20 dark:to-[#052e16]/10 rounded-[24px] p-6 lg:p-8 border border-[#bbf7d0]/50 dark:border-[#166534]/30">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/60 dark:bg-[#166534]/20 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="h-6 w-56 rounded bg-[#166534]/20 animate-pulse mb-3" />
                <div className="h-4 w-full rounded bg-[#166534]/10 animate-pulse mb-2" />
                <div className="h-4 w-3/4 rounded bg-[#166534]/10 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Contact Footer Skeleton */}
        <div className="text-center">
          <div className="h-4 w-64 mx-auto rounded bg-[#e1ddd8]/40 dark:bg-[#262b35]/60 animate-pulse" />
        </div>
      </div>
    </div>
  );
}




