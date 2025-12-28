export default function SquadLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-10 w-48 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-lg animate-pulse mb-3" />
        <div className="h-5 w-64 bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 rounded-lg animate-pulse" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-[24px] p-6 animate-pulse"
          >
            <div className="h-5 w-24 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-lg mb-3" />
            <div className="h-8 w-16 bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Squad Members Skeleton */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-[24px] p-6">
        <div className="h-6 w-32 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-lg mb-4 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 bg-[#faf8f6]/80 dark:bg-[#11141b]/80 border border-[#e1ddd8]/30 dark:border-[#262b35]/30 rounded-[20px] animate-pulse"
            >
              <div className="w-12 h-12 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-lg" />
                <div className="h-4 w-48 bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 rounded-lg" />
              </div>
              <div className="h-4 w-16 bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Activity Feed Skeleton */}
      <div className="mt-8 bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-[24px] p-6">
        <div className="h-6 w-40 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-lg mb-4 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-lg" />
                <div className="h-3 w-1/2 bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
