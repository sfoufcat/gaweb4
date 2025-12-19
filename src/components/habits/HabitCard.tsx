'use client';

import type { Habit } from '@/types';

interface HabitCardProps {
  habit: Habit;
  onClick: () => void;
}

export function HabitCard({ habit, onClick }: HabitCardProps) {
  const { text, linkedRoutine, reminder, progress, targetRepetitions } = habit;
  
  // Calculate progress
  const current = progress.currentCount;
  const target = targetRepetitions || 30; // Default to 30 if no limit
  const percentage = Math.min(Math.round((current / target) * 100), 100);

  // Format reminder time
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes}`;
  };

  // Check if completed today
  const today = new Date().toISOString().split('T')[0];
  const completedToday = progress.completionDates.includes(today);

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left box-border content-stretch flex gap-2 items-center overflow-clip p-4 rounded-[20px] 
        transition-all duration-200 hover:scale-[1.01]
        ${completedToday 
          ? 'bg-[var(--background\/elevated,#f3f1ef)]' 
          : 'bg-[var(--background\/secondary,#ffffff)]'
        }
      `}
    >
      {/* Time if reminder is set */}
      {reminder && (
        <div className="flex flex-col font-['Geist',sans-serif] font-normal justify-center leading-[0] shrink-0 text-[12px] text-[color:var(--text\/muted,#a7a39e)] text-nowrap w-[48px]">
          <p className="leading-[1.2] whitespace-pre">{formatTime(reminder.time)}</p>
        </div>
      )}

      {/* Content */}
      <div className="basis-0 content-stretch flex flex-col gap-[2px] grow items-start min-h-px min-w-px">
        <p className={`
          font-['Albert_Sans',sans-serif] font-semibold leading-[1.3] text-[18px] text-[color:var(--text\/primary,#1a1a1a)] tracking-[-1px] w-full
          ${completedToday ? '[text-decoration-skip-ink:none] [text-underline-position:from-font] decoration-solid line-through' : ''}
        `}>
          {text}
        </p>
        <div className="content-stretch flex font-['Geist',sans-serif] font-normal gap-[10px] items-center justify-center leading-[0] text-[12px] w-full">
          {linkedRoutine && (
            <div className="basis-0 flex flex-col grow justify-center min-h-px min-w-px text-[color:var(--text\/secondary,#5f5a55)]">
              <p className="leading-[1.2]">{linkedRoutine}</p>
            </div>
          )}
          <div className="flex flex-col justify-center shrink-0 text-[color:var(--text\/muted,#a7a39e)] text-nowrap">
            <p className="leading-[1.2] whitespace-pre">
              {targetRepetitions ? `${current}/${target}` : current}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}















