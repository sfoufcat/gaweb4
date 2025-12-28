import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import type { FlowShowCondition, FlowShowConditions, FlowDisplayConfig } from '@/types';

/**
 * Dynamic prompt flow returned from API
 */
interface DynamicFlow {
  id: string;
  name: string;
  type: string;
  displayConfig?: FlowDisplayConfig;
  showConditions?: FlowShowConditions;
}

/**
 * User state for condition evaluation
 */
interface UserState {
  completedTasksToday: number;
  totalTasksToday: number;
  completedHabitsToday: number;
  completedHabitIds: string[];
  morningCheckInCompleted: boolean;
  eveningCheckInCompleted: boolean;
  weeklyReflectionCompleted: boolean;
  completedCustomFlowIds: string[];
  today: string;
  dayOfWeek: number;
}

/**
 * API response shape
 */
interface DynamicPromptsResponse {
  flows: DynamicFlow[];
  userState: UserState;
}

/**
 * A flow that should be shown on the homepage
 */
export interface ActiveDynamicPrompt {
  id: string;
  name: string;
  displayConfig: FlowDisplayConfig;
  url: string;
}

const fetcher = async (url: string): Promise<DynamicPromptsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch dynamic prompts');
  }
  return response.json();
};

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  condition: FlowShowCondition,
  userState: UserState,
  flowId: string
): boolean {
  switch (condition.type) {
    case 'time_window': {
      const hour = new Date().getHours();
      return hour >= condition.startHour && hour < condition.endHour;
    }
    
    case 'day_of_week': {
      return condition.days.includes(userState.dayOfWeek);
    }
    
    case 'habit_completed': {
      if (condition.anyHabit) {
        return userState.completedHabitsToday > 0;
      }
      if (condition.habitId) {
        return userState.completedHabitIds.includes(condition.habitId);
      }
      return false;
    }
    
    case 'tasks_completed': {
      return userState.completedTasksToday >= condition.minCount;
    }
    
    case 'flow_completed': {
      switch (condition.flowType) {
        case 'morning':
          return userState.morningCheckInCompleted;
        case 'evening':
          return userState.eveningCheckInCompleted;
        case 'weekly':
          return userState.weeklyReflectionCompleted;
        default:
          return false;
      }
    }
    
    case 'not_completed_today': {
      return !userState.completedCustomFlowIds.includes(flowId);
    }
    
    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a flow
 */
function evaluateShowConditions(
  flow: DynamicFlow,
  userState: UserState
): boolean {
  const { showConditions } = flow;
  
  if (!showConditions || !showConditions.conditions?.length) {
    return false; // No conditions = don't show
  }
  
  const results = showConditions.conditions.map(condition =>
    evaluateCondition(condition, userState, flow.id)
  );
  
  if (showConditions.logic === 'or') {
    return results.some(Boolean);
  }
  
  // Default to AND logic
  return results.every(Boolean);
}

/**
 * Hook to fetch and evaluate dynamic prompts for the homepage
 * 
 * Returns flows that should be displayed based on their conditions:
 * - Time windows (evaluated client-side for accuracy)
 * - Day of week
 * - Habit/task completion
 * - Flow completion (morning/evening/weekly)
 * - Not already completed today
 */
export function useDynamicPrompts() {
  const { data, error, isLoading, mutate } = useSWR<DynamicPromptsResponse>(
    '/api/homepage/dynamic-prompts',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000, // 1 minute
      refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes for time-based conditions
    }
  );
  
  // Re-evaluate when time changes (for time-based conditions)
  const [, setTick] = useState(0);
  
  useEffect(() => {
    // Re-evaluate every minute for time-based conditions
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Filter flows based on conditions
  const activePrompts = useMemo((): ActiveDynamicPrompt[] => {
    if (!data?.flows || !data?.userState) {
      return [];
    }
    
    return data.flows
      .filter(flow => evaluateShowConditions(flow, data.userState))
      .map(flow => ({
        id: flow.id,
        name: flow.name,
        displayConfig: flow.displayConfig || {
          title: flow.name,
          subtitle: 'Custom check-in',
        },
        url: `/checkin/flow/custom?flowId=${flow.id}`,
      }));
  }, [data]);
  
  return {
    activePrompts,
    isLoading,
    error: error?.message ?? null,
    refetch: mutate,
    // Expose raw data for debugging
    _rawFlows: data?.flows ?? [],
    _userState: data?.userState ?? null,
  };
}

/**
 * Default display config values
 */
export const DEFAULT_DISPLAY_CONFIG: FlowDisplayConfig = {
  icon: 'sparkles',
  gradient: 'from-purple-500 to-indigo-600',
  title: 'Check-in',
  subtitle: 'Take a moment to reflect',
};

/**
 * Get gradient class from display config
 */
export function getGradientClass(gradient?: string): string {
  if (!gradient) {
    return 'bg-gradient-to-br from-purple-500 to-indigo-600';
  }
  
  // If it's already a full class, use it
  if (gradient.startsWith('bg-')) {
    return gradient;
  }
  
  // If it's just the gradient colors, wrap it
  if (gradient.startsWith('from-')) {
    return `bg-gradient-to-br ${gradient}`;
  }
  
  // Assume it's a CSS gradient
  return '';
}

/**
 * Get custom style for CSS gradient
 */
export function getGradientStyle(gradient?: string): React.CSSProperties | undefined {
  if (!gradient) return undefined;
  
  // If it starts with linear-gradient or radial-gradient, use as background
  if (gradient.includes('gradient')) {
    return { background: gradient };
  }
  
  return undefined;
}

