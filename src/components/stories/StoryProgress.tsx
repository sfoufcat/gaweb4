'use client';

interface StoryProgressProps {
  totalSlides: number;
  currentSlide: number;
  progress: number; // 0-100 for current slide animation
}

/**
 * StoryProgress - Progress bars at the top of the story player
 * 
 * Shows horizontal bars indicating:
 * - Completed slides (full white)
 * - Current slide (animated fill)
 * - Upcoming slides (gray/transparent)
 */
export function StoryProgress({ totalSlides, currentSlide, progress }: StoryProgressProps) {
  return (
    <div className="flex gap-1.5 w-full px-4">
      {Array.from({ length: totalSlides }).map((_, index) => (
        <div 
          key={index}
          className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden"
        >
          <div 
            className="h-full bg-white rounded-full transition-all duration-100"
            style={{ 
              width: index < currentSlide 
                ? '100%' 
                : index === currentSlide 
                  ? `${progress}%` 
                  : '0%'
            }}
          />
        </div>
      ))}
    </div>
  );
}


