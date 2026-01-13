'use client';

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Users,
  Loader2,
  ListTodo,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface MemberInfo {
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  status: 'pending' | 'completed';
  completedAt?: string;
}

interface CohortTask {
  taskTemplateId: string;
  title: string;
  programDayIndex: number;
  completedCount: number;
  totalMembers: number;
  completionRate: number;
  isThresholdMet: boolean;
  memberBreakdown: MemberInfo[];
}

interface CohortTasksData {
  cohortId: string;
  cohortName: string;
  date: string;
  threshold: number;
  tasks: CohortTask[];
  stats: {
    totalTasks: number;
    tasksAtThreshold: number;
    overallCompletionRate: number;
  };
}

interface CohortTasksPanelProps {
  cohortId: string;
  date?: string;
  compact?: boolean;
  refreshInterval?: number;
  // NEW: Instance ID for migrated data (uses new unified API when present)
  instanceId?: string | null;
}

/**
 * CohortTasksPanel
 *
 * Displays cohort-level task completion with progress visualization
 * and expandable member breakdown.
 */
export function CohortTasksPanel({
  cohortId,
  date,
  compact = false,
  refreshInterval = 30000,
  instanceId,
}: CohortTasksPanelProps) {
  const [data, setData] = useState<CohortTasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const effectiveDate = date || new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchTasks();

    // Set up polling for real-time updates
    const interval = setInterval(fetchTasks, refreshInterval);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId, effectiveDate, refreshInterval, instanceId]);

  const fetchTasks = async () => {
    try {
      // Use new unified API if instanceId is present, otherwise use old API
      const apiUrl = instanceId
        ? `/api/instances/${instanceId}/completions?date=${effectiveDate}`
        : `/api/coach/cohort-tasks/${cohortId}?date=${effectiveDate}`;

      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch cohort tasks');
      }

      const result = await response.json();

      // Normalize response from new API to match old format
      if (instanceId && result.completions) {
        const normalizedData: CohortTasksData = {
          cohortId,
          cohortName: result.cohortName || '',
          date: effectiveDate,
          threshold: result.threshold || 80,
          tasks: result.completions.map((c: {
            taskId: string;
            label: string;
            dayIndex: number;
            completedCount: number;
            totalMembers: number;
            completionRate: number;
            isThresholdMet: boolean;
            memberBreakdown: MemberInfo[];
          }) => ({
            taskTemplateId: c.taskId,
            title: c.label,
            programDayIndex: c.dayIndex,
            completedCount: c.completedCount,
            totalMembers: c.totalMembers,
            completionRate: c.completionRate,
            isThresholdMet: c.isThresholdMet,
            memberBreakdown: c.memberBreakdown || [],
          })),
          stats: {
            totalTasks: result.completions.length,
            tasksAtThreshold: result.completions.filter((c: { isThresholdMet: boolean }) => c.isThresholdMet).length,
            overallCompletionRate: result.completions.length > 0
              ? Math.round(
                  result.completions.reduce((sum: number, c: { completionRate: number }) => sum + c.completionRate, 0) /
                    result.completions.length
                )
              : 0,
          },
        };
        setData(normalizedData);
      } else {
        setData(result);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching cohort tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getProgressColor = (completionRate: number, threshold: number): string => {
    if (completionRate >= threshold) return 'bg-green-500';
    if (completionRate >= threshold - 15) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data || data.tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <ListTodo className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No tasks for this date</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      {!compact && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Threshold: {data.threshold}%</span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              {data.stats.tasksAtThreshold}/{data.stats.totalTasks} tasks complete
            </span>
            <span className="font-medium">
              {data.stats.overallCompletionRate}% overall
            </span>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {data.tasks.map((task) => {
          const isExpanded = expandedTasks.has(task.taskTemplateId);
          const progressColor = getProgressColor(task.completionRate, data.threshold);

          return (
            <div
              key={task.taskTemplateId}
              className={cn(
                'rounded-lg border bg-card transition-colors',
                task.isThresholdMet && 'border-green-500/30 bg-green-500/5'
              )}
            >
              {/* Task header */}
              <button
                onClick={() => toggleExpanded(task.taskTemplateId)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
              >
                {/* Expand/collapse icon */}
                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Status icon - matches Daily Focus style */}
                <div
                  className={cn(
                    'shrink-0 h-5 w-5 rounded-lg border flex items-center justify-center transition-all duration-300 bg-white dark:bg-[#181d26]',
                    task.isThresholdMet
                      ? 'border-brand-accent'
                      : 'border-[#d4d0cb] dark:border-[#3d4351]'
                  )}
                >
                  {task.isThresholdMet && (
                    <div className="w-3 h-3 bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300" />
                  )}
                </div>

                {/* Task title and progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{task.title}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {task.completedCount}/{task.totalMembers}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Progress
                      value={task.completionRate}
                      className="h-1.5"
                      indicatorClassName={progressColor}
                    />
                  </div>
                </div>

                {/* Completion percentage */}
                <div
                  className={cn(
                    'shrink-0 text-sm font-medium w-12 text-right',
                    task.isThresholdMet ? 'text-green-600' : 'text-muted-foreground'
                  )}
                >
                  {task.completionRate}%
                </div>
              </button>

              {/* Member breakdown (collapsed by default) */}
              {isExpanded && (
                <div className="border-t px-3 pb-3">
                  <div className="pt-3 space-y-2">
                    {task.memberBreakdown.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center gap-3 text-sm"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.imageUrl} />
                          <AvatarFallback className="text-xs">
                            {member.firstName?.[0]}
                            {member.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">
                          {member.firstName} {member.lastName}
                        </span>
                        <div
                          className={cn(
                            'shrink-0 h-5 w-5 rounded-lg border flex items-center justify-center transition-all duration-300 bg-white dark:bg-[#181d26]',
                            member.status === 'completed'
                              ? 'border-brand-accent'
                              : 'border-[#d4d0cb] dark:border-[#3d4351]'
                          )}
                        >
                          {member.status === 'completed' && (
                            <div className="w-3 h-3 bg-brand-accent rounded-sm animate-in zoom-in-50 duration-300" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
