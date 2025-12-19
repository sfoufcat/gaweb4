export default function HabitsLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-[#e1ddd8]/50 rounded-lg animate-pulse" />
        <div className="flex gap-3">
          <div className="h-6 w-16 bg-[#e1ddd8]/40 rounded-lg animate-pulse" />
          <div className="h-6 w-16 bg-[#e1ddd8]/40 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Habits Grid Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/60 border border-[#e1ddd8]/50 rounded-[20px] p-4 flex gap-3 animate-pulse"
          >
            <div className="flex-1 space-y-2">
              <div className="h-6 w-3/4 bg-[#e1ddd8]/50 rounded-lg" />
              <div className="h-4 w-1/2 bg-[#e1ddd8]/30 rounded-lg" />
            </div>
            <div className="flex flex-col items-end justify-center gap-1">
              <div className="h-4 w-16 bg-[#e1ddd8]/30 rounded-lg" />
              <div className="h-4 w-12 bg-[#e1ddd8]/30 rounded-lg" />
              <div className="h-4 w-10 bg-[#e1ddd8]/30 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Stats Section Skeleton */}
      <div className="mt-8 bg-white/60 border border-[#e1ddd8]/50 rounded-[24px] p-6 animate-pulse">
        <div className="h-6 w-32 bg-[#e1ddd8]/50 rounded-lg mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 bg-[#e1ddd8]/30 rounded-[16px]" />
          <div className="h-20 bg-[#e1ddd8]/30 rounded-[16px]" />
        </div>
      </div>
    </div>
  );
}







