'use client';

interface GoalStorySlideProps {
  goalTitle: string;
  targetDate: string;
  progress?: number;
  userName: string;
}

/**
 * GoalStorySlide - Story 2: "My goal"
 * 
 * Displays the user's active goal with target date.
 * Gradient: Teal/green (matching Figma design)
 */
export function GoalStorySlide({ goalTitle, targetDate, progress, userName: _userName }: GoalStorySlideProps) {
  // Format the target date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Capitalize first letter
  const capitalizeFirstLetter = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center px-8">
      {/* Gradient Background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(165deg, #2A6B5E 0%, #3D8B7A 30%, #4A9E8C 50%, #5DB89E 70%, #7BCEB4 100%)',
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-[320px] text-center">
        {/* Small Label */}
        <p className="font-sans text-[14px] text-white/80 mb-4">
          My goal
        </p>
        
        {/* Goal Title */}
        <h2 className="font-albert text-[36px] font-medium text-white tracking-[-2px] leading-[1.2] mb-6">
          {capitalizeFirstLetter(goalTitle)}
        </h2>
        
        {/* Target Date */}
        {targetDate && (
          <p className="font-sans text-[16px] text-white/70">
            by {formatDate(targetDate)}
          </p>
        )}

        {/* Optional Progress Indicator */}
        {progress !== undefined && progress > 0 && (
          <div className="mt-8 flex flex-col items-center">
            <div className="w-full max-w-[200px] h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white/80 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="font-sans text-[14px] text-white/60 mt-2">
              {Math.round(progress)}% complete
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


