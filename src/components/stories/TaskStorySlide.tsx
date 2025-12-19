'use client';

import type { Task } from '@/types';

interface TaskStorySlideProps {
  tasks: Task[];
  userName: string;
}

/**
 * TaskStorySlide - Story 1: "What I'm focusing on today"
 * 
 * Displays the user's Daily Focus tasks for today with completion status.
 * Uses checkbox style matching Daily Focus section.
 * Gradient: Purple/teal to pink/coral (matching Figma design)
 */
export function TaskStorySlide({ tasks, userName: _userName }: TaskStorySlideProps) {
  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center px-8">
      {/* Gradient Background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(165deg, #4A6572 0%, #6B5B7A 25%, #7E6B8F 40%, #9E7B8C 60%, #C4A59A 80%, #D4B8A8 100%)',
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-[320px]">
        {/* Title */}
        <h2 className="font-albert text-[24px] font-medium text-white tracking-[-1px] leading-[1.3] mb-8">
          What I&apos;m focusing on today
        </h2>
        
        {/* Tasks List */}
        {tasks.length > 0 ? (
          <div className="space-y-4">
            {tasks.slice(0, 3).map((task) => {
              const isCompleted = task.status === 'completed';
              
              return (
                <div key={task.id} className="flex items-center gap-3">
                  {/* Checkbox - Same style as Daily Focus but for dark bg */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-6 h-6 rounded-md border-2 ${
                        isCompleted
                          ? 'border-white/60 bg-white/20'
                          : 'border-white/40 bg-transparent'
                      } flex items-center justify-center transition-all duration-300`}
                    >
                      {isCompleted && (
                        <div className="w-3.5 h-3.5 bg-white rounded-sm" />
                      )}
                    </div>
                  </div>
                  
                  {/* Task Title */}
                  <p 
                    className={`font-albert text-[18px] text-white leading-[1.4] tracking-[-0.5px] ${
                      isCompleted ? 'line-through opacity-60' : ''
                    } ${task.isPrivate ? 'italic opacity-70' : ''}`}
                  >
                    {task.isPrivate ? 'Private task' : task.title}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="font-sans text-[16px] text-white/70">
              No tasks set for today
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
