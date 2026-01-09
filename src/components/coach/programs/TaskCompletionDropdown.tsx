'use client';

import { useState, useEffect } from 'react';
import {
  Check,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
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
  date?: string; // For aggregate view, which date they completed
}

interface TaskCompletionDropdownProps {
  taskId: string;           // programTaskId for API lookup
  taskTitle: string;        // Task label for display
  cohortId: string;         // Cohort to query
  date?: string;            // Single date filter (for day view)
  startDate?: string;       // Date range start (for week aggregate view)
  endDate?: string;         // Date range end (for week aggregate view)

  // Summary data (passed from parent, already available)
  completionRate: number;
  completedCount: number;
  totalMembers: number;
  isThresholdMet: boolean;
  threshold: number;

  // Optional: pre-loaded member data (to avoid fetch if parent has it)
  memberBreakdown?: MemberInfo[];
}

/**
 * TaskCompletionDropdown
 *
 * Displays task completion status with an expandable member breakdown.
 * Used in DayEditor and WeekEditor to show cohort completion for tasks.
 */
export function TaskCompletionDropdown({
  taskId,
  taskTitle,
  cohortId,
  date,
  startDate,
  endDate,
  completionRate,
  completedCount,
  totalMembers,
  isThresholdMet,
  threshold,
  memberBreakdown: preloadedMembers,
}: TaskCompletionDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [memberData, setMemberData] = useState<MemberInfo[] | null>(preloadedMembers || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-fetch member breakdown when expanded
  useEffect(() => {
    if (isExpanded && !memberData && !loading) {
      fetchMemberBreakdown();
    }
  }, [isExpanded]);

  const fetchMemberBreakdown = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      if (date) {
        params.set('date', date);
      } else if (startDate && endDate) {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }

      const response = await fetch(
        `/api/coach/cohort-tasks/${cohortId}/task/${encodeURIComponent(taskId)}?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch member data');
      }

      const result = await response.json();
      setMemberData(result.memberBreakdown || []);
    } catch (err) {
      console.error('Error fetching member breakdown:', err);
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (rate: number, thresh: number): string => {
    if (rate >= thresh) return 'bg-green-500';
    if (rate >= thresh - 15) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const progressColor = getProgressColor(completionRate, threshold);

  // Sort members: completed first, then by name
  const sortedMembers = memberData
    ? [...memberData].sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'completed' ? -1 : 1;
        }
        return a.firstName.localeCompare(b.firstName);
      })
    : [];

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-colors',
        isThresholdMet && 'border-green-500/30 bg-green-500/5'
      )}
    >
      {/* Task header - clickable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
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

        {/* Status icon */}
        <div
          className={cn(
            'shrink-0 h-5 w-5 rounded-full flex items-center justify-center',
            isThresholdMet
              ? 'bg-green-500 text-white'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isThresholdMet ? (
            <Check className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
        </div>

        {/* Task title and progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{taskTitle}</span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {completedCount}/{totalMembers}
            </span>
          </div>
          <div className="mt-1.5">
            <Progress
              value={completionRate}
              className="h-1.5"
              indicatorClassName={progressColor}
            />
          </div>
        </div>

        {/* Completion percentage */}
        <div
          className={cn(
            'shrink-0 text-sm font-medium w-12 text-right',
            isThresholdMet ? 'text-green-600' : 'text-muted-foreground'
          )}
        >
          {completionRate}%
        </div>
      </button>

      {/* Member breakdown (expanded) */}
      {isExpanded && (
        <div className="border-t px-3 pb-3">
          <div className="pt-3 space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive py-2">{error}</div>
            )}

            {!loading && !error && sortedMembers.length === 0 && (
              <div className="text-sm text-muted-foreground py-2">
                No member data available
              </div>
            )}

            {!loading && !error && sortedMembers.map((member) => (
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
                {/* Show date if aggregate view */}
                {member.date && member.status === 'completed' && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(member.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <div
                  className={cn(
                    'shrink-0 h-5 w-5 rounded-full flex items-center justify-center',
                    member.status === 'completed'
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {member.status === 'completed' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline version for displaying completion status within task rows.
 * Shows just the completion count/percentage badge that can be clicked to expand.
 */
interface TaskCompletionBadgeProps {
  completionRate: number;
  completedCount: number;
  totalMembers: number;
  isThresholdMet: boolean;
  threshold: number;
  onClick?: () => void;
}

export function TaskCompletionBadge({
  completionRate,
  completedCount,
  totalMembers,
  isThresholdMet,
  threshold,
  onClick,
}: TaskCompletionBadgeProps) {
  const getProgressColor = (rate: number, thresh: number): string => {
    if (rate >= thresh) return 'text-green-600 bg-green-50 border-green-200';
    if (rate >= thresh - 15) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const colorClasses = getProgressColor(completionRate, threshold);

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border transition-colors hover:opacity-80',
        colorClasses
      )}
      title={`${completedCount} of ${totalMembers} members completed (${completionRate}%)`}
    >
      {isThresholdMet ? (
        <Check className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      <span>{completedCount}/{totalMembers}</span>
      <span className="opacity-70">{completionRate}%</span>
    </button>
  );
}
