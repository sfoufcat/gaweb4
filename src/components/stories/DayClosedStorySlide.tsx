'use client';

import type { Task } from '@/types';

interface DayClosedStorySlideProps {
  completedTasks: Task[];
  userName: string;
  tasksCompleted?: number;
  tasksTotal?: number;
}

/**
 * DayClosedStorySlide - Story: "Day Closed"
 * 
 * Displays after evening check-in completion, showing completed tasks for the day.
 * Uses a warm sunset gradient to signify end of day accomplishments.
 * 
 * NOTE: The `completedTasks` prop comes from the snapshot captured during 
 * evening check-in (before tasks move to backlog). This ensures we always 
 * show the correct tasks regardless of current task list state.
 */
export function DayClosedStorySlide({ 
  completedTasks, 
  userName: _userName,
  tasksCompleted = 0,
  tasksTotal = 0,
}: DayClosedStorySlideProps) {
  // The snapshot should be the source of truth, but also check the stored count
  // in case there's a mismatch (use whichever is higher)
  const actualCompleted = Math.max(tasksCompleted, completedTasks.length);
  
  // Calculate completion rate
  const completionRate = tasksTotal > 0 ? Math.round((actualCompleted / tasksTotal) * 100) : 0;
  
  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center px-8">
      {/* Gradient Background - Warm sunset colors for end of day */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(165deg, #1a1a2e 0%, #16213e 20%, #2d3a4a 40%, #4a5568 55%, #6b5b7a 70%, #9b6b7a 85%, #c9879f 100%)',
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-[320px]">
        {/* Title with checkmark icon */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-albert text-[28px] font-semibold text-white tracking-[-1px] leading-[1.2]">
            Day Closed
          </h2>
        </div>

        {/* Completion Summary */}
        {tasksTotal > 0 && (
          <div className="mb-8 p-4 rounded-2xl bg-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-albert text-[14px] text-white/70">Today&apos;s progress</span>
              <span className="font-albert text-[16px] font-semibold text-white">
                {actualCompleted}/{tasksTotal} tasks
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Subtitle */}
        <p className="font-albert text-[16px] text-white/70 mb-4">
          What I accomplished today
        </p>
        
        {/* Completed Tasks List */}
        {completedTasks.length > 0 ? (
          <div className="space-y-3">
            {completedTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center gap-3">
                {/* Completed Checkbox */}
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 rounded-md border-2 border-emerald-400/60 bg-emerald-500/30 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                
                {/* Task Title */}
                <p className="font-albert text-[17px] text-white/90 leading-[1.4] tracking-[-0.3px]">
                  {task.title}
                </p>
              </div>
            ))}
            
            {completedTasks.length > 5 && (
              <p className="font-albert text-[14px] text-white/50 pl-9">
                +{completedTasks.length - 5} more completed
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-albert text-[15px] text-white/60">
              Rest day - no tasks completed
            </p>
          </div>
        )}

        {/* Motivational footer */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="font-albert text-[14px] text-white/50 text-center italic">
            {completedTasks.length > 0 
              ? "Great work today! 🌙" 
              : "Tomorrow is a new opportunity ✨"}
          </p>
        </div>
      </div>
    </div>
  );
}

