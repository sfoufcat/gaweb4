import { useState, useEffect, useCallback } from 'react';
import type { OrgCheckInFlow, CheckInStep, CheckInFlowType } from '@/types';

interface UseCheckInFlowOptions {
  type?: CheckInFlowType;
  flowId?: string;
}

interface UseCheckInFlowReturn {
  flow: Pick<OrgCheckInFlow, 'id' | 'name' | 'type' | 'description'> | null;
  steps: CheckInStep[];
  isLoading: boolean;
  error: string | null;
  isDisabled: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch a check-in flow by type or ID
 * 
 * Usage:
 *   const { flow, steps, isLoading } = useCheckInFlow({ type: 'morning' });
 *   const { flow, steps, isLoading } = useCheckInFlow({ flowId: 'abc123' });
 */
export function useCheckInFlow({ type, flowId }: UseCheckInFlowOptions): UseCheckInFlowReturn {
  const [flow, setFlow] = useState<Pick<OrgCheckInFlow, 'id' | 'name' | 'type' | 'description'> | null>(null);
  const [steps, setSteps] = useState<CheckInStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  const fetchFlow = useCallback(async () => {
    if (!type && !flowId) {
      setError('Either type or flowId must be provided');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsDisabled(false);

      let url: string;
      if (flowId) {
        url = `/api/checkin/flows/${flowId}`;
      } else {
        url = `/api/checkin/flows/by-type/${type}`;
      }

      const response = await fetch(url);
      
      if (response.status === 404) {
        const data = await response.json();
        if (data.flowDisabled) {
          setIsDisabled(true);
          setFlow(null);
          setSteps([]);
          return;
        }
        throw new Error(data.error || 'Flow not found');
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch flow');
      }

      const data = await response.json();
      setFlow(data.flow);
      setSteps(data.steps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [type, flowId]);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  return {
    flow,
    steps,
    isLoading,
    error,
    isDisabled,
    refetch: fetchFlow,
  };
}

/**
 * Hook to check which check-in flows are available/enabled for the user
 */
export function useAvailableCheckIns() {
  const [flows, setFlows] = useState<Pick<OrgCheckInFlow, 'id' | 'name' | 'type' | 'description' | 'enabled' | 'stepCount'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/checkin/flows?enabledOnly=true');
      
      if (!response.ok) {
        throw new Error('Failed to fetch available check-ins');
      }

      const data = await response.json();
      setFlows(data.flows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const isMorningEnabled = flows.some(f => f.type === 'morning');
  const isEveningEnabled = flows.some(f => f.type === 'evening');
  const isWeeklyEnabled = flows.some(f => f.type === 'weekly');

  return {
    flows,
    isLoading,
    error,
    isMorningEnabled,
    isEveningEnabled,
    isWeeklyEnabled,
    refetch: fetchFlows,
  };
}

