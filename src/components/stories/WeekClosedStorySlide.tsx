'use client';

interface WeekClosedStorySlideProps {
  progressChange: number;
  publicFocus?: string;
  userName: string;
}

/**
 * WeekClosedStorySlide - Story: "Week Closed"
 * 
 * Displays after weekly check-in completion, showing:
 * - Goal progress change for the week (+X%, -X%, or no change)
 * - Next week's public focus (if shared)
 * 
 * Uses a deep blue to purple gradient for weekend/reflection vibes.
 */
export function WeekClosedStorySlide({ 
  progressChange, 
  publicFocus,
  userName: _userName,
}: WeekClosedStorySlideProps) {
  // Format progress change for display
  const getProgressDisplay = () => {
    if (progressChange === 0) {
      return { text: 'No change', color: 'text-white/70' };
    }
    if (progressChange > 0) {
      return { text: `+${progressChange}%`, color: 'text-emerald-400' };
    }
    return { text: `${progressChange}%`, color: 'text-rose-400' };
  };

  const progress = getProgressDisplay();

  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center px-8">
      {/* Gradient Background - Deep blue to purple for weekend/reflection */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(165deg, #0f0c29 0%, #1a1a3e 20%, #24243e 40%, #302b63 60%, #4a3f7a 75%, #6b5b95 90%, #8b7bb5 100%)',
        }}
      />
      
      {/* Subtle pattern overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(255,255,255,0.08) 0%, transparent 50%)`,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-[320px]">
        {/* Title with calendar icon */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4" />
            </svg>
          </div>
          <h2 className="font-albert text-[28px] font-semibold text-white tracking-[-1px] leading-[1.2]">
            Week Closed
          </h2>
        </div>

        {/* Progress Change - Main Feature */}
        <div className="mb-8 p-6 rounded-2xl bg-white/10 backdrop-blur-sm text-center">
          <p className="font-albert text-[14px] text-white/60 mb-2 uppercase tracking-wide">
            Goal Progress
          </p>
          <div className={`font-albert text-[56px] font-bold ${progress.color} leading-none tracking-[-2px]`}>
            {progress.text}
          </div>
          <p className="font-albert text-[16px] text-white/70 mt-2">
            this week
          </p>
        </div>

        {/* Public Focus Section - Only if shared */}
        {publicFocus && (
          <div className="mb-6">
            <p className="font-albert text-[14px] text-white/60 mb-3 uppercase tracking-wide">
              Next Week&apos;s Focus
            </p>
            <div className="relative p-5 rounded-2xl bg-white/10 backdrop-blur-sm">
              {/* Quote marks */}
              <svg 
                className="absolute top-3 left-3 w-6 h-6 text-white/20" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <p className="font-albert text-[18px] text-white/90 leading-[1.5] tracking-[-0.3px] pl-6">
                {publicFocus}
              </p>
            </div>
          </div>
        )}

        {/* Motivational footer */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="font-albert text-[14px] text-white/50 text-center italic">
            {progressChange > 0 
              ? "Great progress! Keep the momentum going 🚀" 
              : progressChange < 0 
                ? "Every week is a fresh start ✨"
                : "Consistency is key. Keep showing up 💪"}
          </p>
        </div>
      </div>
    </div>
  );
}






