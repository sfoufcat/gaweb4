export function ProgramSkeleton() {
  return (
    <div className="space-y-6">
      {/* Pill Switcher Skeleton */}
      <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2">
        <div className="flex-1 rounded-[32px] h-[44px] bg-white dark:bg-[#171b22] animate-pulse shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)]" />
        <div className="flex-1 rounded-[32px] h-[44px] bg-transparent" />
      </div>

      {/* Program Card Skeleton */}
      <div className="bg-white dark:bg-[#171b22] rounded-[20px] overflow-hidden animate-pulse">
        {/* Cover Image */}
        <div className="h-[180px] bg-[#e1ddd8] dark:bg-[#262b35]" />

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div className="h-6 w-3/4 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />

          {/* Coach */}
          <div className="h-4 w-1/2 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full" />

          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
            <div className="h-4 w-8 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full" />
          </div>
        </div>
      </div>

      {/* Section Skeletons */}
      <div className="space-y-6">
        {/* Section Header */}
        <div className="h-6 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />

        {/* Content Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#171b22] rounded-[20px] p-5 animate-pulse"
            >
              <div className="h-5 w-2/3 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full mb-3" />
              <div className="h-4 w-full bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

